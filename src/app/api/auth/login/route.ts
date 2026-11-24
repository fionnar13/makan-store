import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody, rateLimit, clientIp } from '@/lib/api'
import { SESSION_COOKIE, createSession, verifyPassword, recordLogin, sessionCookieOptions } from '@/lib/auth'
import { audit } from '@/lib/audit'

const bodySchema = z.object({
  phone: z.string().regex(/^09\d{9}$/, 'شماره موبایل معتبر نیست'),
  password: z.string().min(6, 'رمز عبور حداقل ۶ کاراکتر است'),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const ip = clientIp(req)
    rateLimit(`login:${ip}`, 10, 60_000) // حداکثر ۱۰ تلاش در دقیقه
    const body = await parseBody(req, bodySchema)

    const user = await db.user.findUnique({
      where: { phone: body.phone },
      include: { roles: { include: { role: true } } },
    })
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      await audit({ action: 'auth.login', entityType: 'User', entityId: body.phone, ip, result: 'DENIED' })
      throw new ApiError(401, 'BAD_CREDENTIALS', 'شماره موبایل یا رمز عبور اشتباه است')
    }
    if (!user.isActive) {
      throw new ApiError(403, 'USER_INACTIVE', 'حساب کاربری شما غیرفعال است')
    }

    const token = await createSession(user.id, ip, req.headers.get('user-agent'))
    await recordLogin(user.id, ip)
    await audit({ userId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, ip })

    const res = ok({ id: user.id, name: user.name, phone: user.phone, avatarUrl: user.avatarUrl })
    // کوکی سازگار با iframe/پیش‌نمایش: در HTTPS از SameSite=None; Secure; Partitioned استفاده می‌شود
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(req, 7 * 24 * 3600))
    return res
  })
}
