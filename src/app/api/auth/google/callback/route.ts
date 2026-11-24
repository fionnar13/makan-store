// بازگشت از گوگل — تبادل کد با توکن، واکشی پروفایل، ساخت/یافتن کاربر و برقراری نشست
import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { clientIp, rateLimit } from '@/lib/api'
import { createSession, recordLogin, hashPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { getGoogleOAuthConfig, isGoogleLoginEnabled, GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL } from '@/lib/google-auth'
import { OAUTH_STATE_COOKIE } from '../start/route'

const SESSION_COOKIE = 'bwh_session'

function deriveOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
    || req.headers.get('x-bwh-proto')?.trim().toLowerCase()
    || (req.nextUrl.protocol === 'https:' ? 'https' : 'http')
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.nextUrl.host
  return `${proto}://${host}`
}

function isHttps(req: NextRequest): boolean {
  return deriveOrigin(req).startsWith('https://')
}

// صفحه خطای ساده فارسی — به‌جای JSON تا کاربر عادی پیام را ببیند
function errorPage(origin: string, title: string, detail: string): NextResponse {
  const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:Vazirmatn,system-ui,sans-serif;background:#f5f5f4;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:32px;max-width:420px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.06)}h1{font-size:18px;color:#b91c1c;margin:0 0 12px}p{font-size:14px;color:#57534e;line-height:2;margin:0 0 20px}a{display:inline-block;background:#059669;color:#fff;border-radius:10px;padding:10px 24px;text-decoration:none;font-size:14px}</style></head>
<body><main><h1>${title}</h1><p>${detail}</p><a href="${origin}/">بازگشت به صفحه ورود</a></main></body></html>`
  return new NextResponse(html, { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req)
  try {
    rateLimit(`google-cb:${ip}`, 30, 60_000)

    const origin = deriveOrigin(req)
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const googleError = url.searchParams.get('error')

    const oauthCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value
    let oauth: { state?: string; verifier?: string } = {}
    try { oauth = oauthCookie ? JSON.parse(oauthCookie) : {} } catch { oauth = {} }

    if (googleError) {
      const msg = googleError === 'access_denied' ? 'ورود با گوگل لغو شد.' : `خطای گوگل: ${googleError}`
      return errorPage(origin, 'ورود ناموفق بود', msg)
    }
    if (!code || !state || !oauth.state || !oauth.verifier || !safeEqual(state, oauth.state)) {
      return errorPage(origin, 'درخواست نامعتبر', 'وضعیت احراز هویت یافت نشد یا منقضی شده است. لطفاً دوباره از دکمه «ورود با گوگل» استفاده کنید.')
    }

    const [enabled, config] = await Promise.all([isGoogleLoginEnabled(), getGoogleOAuthConfig()])
    if (!enabled || !config) {
      return errorPage(origin, 'ورود با گوگل فعال نیست', 'این قابلیت توسط مدیر سیستم غیرفعال شده است.')
    }

    // تبادل کد با توکن‌ها
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
        code_verifier: oauth.verifier,
      }),
    })
    if (!tokenRes.ok) {
      console.error('[GOOGLE_TOKEN_ERROR]', await tokenRes.text().catch(() => ''))
      return errorPage(origin, 'ورود ناموفق بود', 'تبادل توکن با گوگل ناموفق بود. چند لحظه بعد دوباره تلاش کنید.')
    }
    const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string }
    if (!tokens.access_token) {
      return errorPage(origin, 'ورود ناموفق بود', 'پاسخ گوگل معتبر نبود.')
    }

    // واکشی پروفایل کاربر
    const uiRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    })
    if (!uiRes.ok) {
      return errorPage(origin, 'ورود ناموفق بود', 'دریافت اطلاعات پروفایل از گوگل ناموفق بود.')
    }
    const profile = (await uiRes.json()) as {
      sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string
    }
    if (!profile.email || !profile.email_verified) {
      return errorPage(origin, 'ایمیل تأیید نشده', 'حساب گوگل شما ایمیل تأیید‌شده ندارد و امکان ورود وجود نیست.')
    }

    // یافتن یا ساخت کاربر
    let user = await db.user.findUnique({ where: { googleId: profile.sub } })
      ?? await db.user.findUnique({ where: { email: profile.email } })

    let createdNew = false
    if (!user) {
      // نقش پیش‌فرض کاربر آنلاین — در صورت نبود، ساخته می‌شود (سازگار با دیتابیس‌های قدیمی)
      const role = await db.role.findUnique({ where: { name: 'ONLINE_USER' } })
        ?? await db.role.create({ data: { name: 'ONLINE_USER', label: 'کاربر آنلاین (ورود با گوگل)', isSystem: true } })

      user = await db.user.create({
        data: {
          name: profile.name?.trim() || profile.email.split('@')[0],
          email: profile.email,
          googleId: profile.sub,
          passwordHash: hashPassword(randomBytes(32).toString('base64url')), // رمز غیرقابل‌حدس — ورود با موبایل برای این حساب ممکن نیست
          avatarUrl: null,
        },
      })
      await db.userRole.create({ data: { userId: user.id, roleId: role.id } })
      createdNew = true
    }

    if (!user.isActive) {
      return errorPage(origin, 'حساب غیرفعال', 'حساب کاربری شما توسط مدیر غیرفعال شده است.')
    }

    // برقراری نشست
    const token = await createSession(user.id, ip, req.headers.get('user-agent'))
    await recordLogin(user.id, ip)
    await audit({
      userId: user.id,
      action: createdNew ? 'auth.google.signup' : 'auth.google.login',
      entityType: 'User',
      entityId: user.id,
      ip,
      after: createdNew ? { email: user.email, role: 'ONLINE_USER' } : undefined,
    })

    // کوکی نشست — گردش کار topLevel است؛ SameSite=Lax بدون Partitioned تا کوکی پس از ریدایرکت ارسال شود
    const res = NextResponse.redirect(`${origin}/#/dashboard`)
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps(req),
      path: '/',
      maxAge: 7 * 24 * 3600,
    })
    res.cookies.delete(OAUTH_STATE_COOKIE)
    return res
  } catch (err) {
    console.error('[GOOGLE_CALLBACK_ERROR]', err)
    return errorPage(deriveOrigin(req), 'خطای غیرمنتظره', 'در پردازش ورود با گوگل خطایی رخ داد. لطفاً دوباره تلاش کنید.')
  }
}
