// تنظیمات ورود با گوگل — خواندن و ذخیره Client ID/Secret و کلید فعال‌سازی
// Secret هرگز در پاسخ برگردانده نمی‌شود؛ فقط وضعیت «ثبت‌شده/ثبت‌نشده»
// دسترسی: فقط مجوز users.manage (مدیر کل / آدمین)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { GOOGLE_ENABLED_KEY, GOOGLE_CLIENT_ID_KEY, GOOGLE_CLIENT_SECRET_KEY } from '@/lib/google-auth'

function deriveOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
    || req.headers.get('x-bwh-proto')?.trim().toLowerCase()
    || (req.nextUrl.protocol === 'https:' ? 'https' : 'http')
  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.nextUrl.host
  return `${proto}://${host}`
}

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'users.manage')
    const rows = await db.setting.findMany({
      where: { key: { in: [GOOGLE_ENABLED_KEY, GOOGLE_CLIENT_ID_KEY, GOOGLE_CLIENT_SECRET_KEY] } },
    })
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]))

    const envId = process.env.GOOGLE_CLIENT_ID?.trim()
    const envSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
    const envConfigured = !!(envId && envSecret)

    return ok({
      enabled: map[GOOGLE_ENABLED_KEY] === '1',
      clientId: envConfigured ? envId! : map[GOOGLE_CLIENT_ID_KEY] ?? '',
      secretSet: envConfigured || !!map[GOOGLE_CLIENT_SECRET_KEY],
      redirectUri: `${deriveOrigin(req)}/api/auth/google/callback`,
      source: envConfigured ? 'env' as const : 'db' as const,
    })
  })
}

const putSchema = z.object({
  enabled: z.boolean().optional(),
  clientId: z.string().trim().max(200).optional(),
  clientSecret: z.string().trim().min(10, 'Client Secret معتبر نیست').max(300).optional(),
})

export async function PUT(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const body = await parseBody(req, putSchema)

    const before = await db.setting.findMany({
      where: { key: { in: [GOOGLE_ENABLED_KEY, GOOGLE_CLIENT_ID_KEY] } },
    })
    const beforeMap = Object.fromEntries(before.map(r => [r.key, r.value]))

    const updates: Array<{ key: string; value: string }> = []
    if (body.enabled !== undefined) updates.push({ key: GOOGLE_ENABLED_KEY, value: body.enabled ? '1' : '0' })
    if (body.clientId !== undefined) updates.push({ key: GOOGLE_CLIENT_ID_KEY, value: body.clientId })
    if (body.clientSecret !== undefined) updates.push({ key: GOOGLE_CLIENT_SECRET_KEY, value: body.clientSecret })

    for (const u of updates) {
      await db.setting.upsert({ where: { key: u.key }, update: { value: u.value }, create: { key: u.key, value: u.value } })
    }

    await audit({
      userId: user.id,
      action: 'auth.google.config',
      entityType: 'Setting',
      entityId: GOOGLE_ENABLED_KEY,
      before: { enabled: beforeMap[GOOGLE_ENABLED_KEY] === '1', clientId: beforeMap[GOOGLE_CLIENT_ID_KEY] ?? null },
      after: {
        enabled: body.enabled,
        clientIdChanged: body.clientId !== undefined,
        secretChanged: body.clientSecret !== undefined,
      },
    })

    return ok({ saved: updates.length })
  })
}
