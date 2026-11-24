// شروع ورود با گوگل — ریدایرکت به صفحه رضایت گوگل با OAuth 2.0 + PKCE
import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { handler, clientIp, rateLimit } from '@/lib/api'
import { getGoogleOAuthConfig, isGoogleLoginEnabled, GOOGLE_AUTH_URL } from '@/lib/google-auth'

export const OAUTH_STATE_COOKIE = 'bwh_oauth'

// نشانی مطلق برنامه از دید مرورگر — با توجه به پراکسی/پیش‌نمایش
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

function errorRedirect(origin: string, code: string): NextResponse {
  const res = NextResponse.redirect(`${origin}/?googleError=${encodeURIComponent(code)}`)
  res.cookies.delete(OAUTH_STATE_COOKIE)
  return res
}

export async function GET(req: NextRequest) {
  return handler(async () => {
    const ip = clientIp(req)
    rateLimit(`google-start:${ip}`, 20, 60_000)

    const origin = deriveOrigin(req)
    const [enabled, config] = await Promise.all([isGoogleLoginEnabled(), getGoogleOAuthConfig()])
    if (!enabled || !config) return errorRedirect(origin, 'ورود با گوگل فعال نیست')

    const state = randomBytes(16).toString('hex')
    const codeVerifier = randomBytes(32).toString('base64url')
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')

    const authUrl = new URL(GOOGLE_AUTH_URL)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', config.clientId)
    authUrl.searchParams.set('redirect_uri', `${origin}/api/auth/google/callback`)
    authUrl.searchParams.set('scope', 'openid email profile')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('access_type', 'online')
    authUrl.searchParams.set('prompt', 'select_account')

    const res = NextResponse.redirect(authUrl.toString())
    // کوکی وضعیت — ۱۰ دقیقه؛ SameSite=Lax برای گردش کار topLevel OAuth (بدون Partitioned)
    res.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, verifier: codeVerifier }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps(req),
      path: '/',
      maxAge: 600,
    })
    return res
  })
}
