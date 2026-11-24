import { NextRequest } from 'next/server'
import { handler, ok, clientIp } from '@/lib/api'
import { SESSION_COOKIE, getSessionUser, revokeSession, sessionCookieOptions } from '@/lib/auth'
import { audit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  return handler(async () => {
    const token = req.cookies.get(SESSION_COOKIE)?.value
    if (token) {
      const user = await getSessionUser(req)
      await revokeSession(token)
      await audit({ userId: user?.id, action: 'auth.logout', entityType: 'User', entityId: user?.id, ip: clientIp(req) })
    }
    const res = ok({ done: true })
    // پاک‌سازی کوکی با همان ویژگی‌های زمان تنظیم (تا مطابقت داشته باشد)
    res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(req, 0))
    return res
  })
}
