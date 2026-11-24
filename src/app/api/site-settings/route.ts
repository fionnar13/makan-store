// هویت وب‌سایت — نام، شعار، لوگو، فایوآیکون
// GET عمومی است (حتی پیش از ورود برای صفحه لاگین)؛ PUT فقط با مجوز users.manage
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

const KEYS = ['site.name', 'site.slogan', 'site.logoUrl', 'site.faviconUrl'] as const
export const DEFAULT_SITE_NAME = 'بنکداری هوشمند'
export const DEFAULT_SITE_SLOGAN = 'سامانه مدیریت B2B بنکداری مواد غذایی'

export type SiteIdentity = {
  name: string
  slogan: string
  logoUrl: string | null
  faviconUrl: string | null
}

async function readIdentity(): Promise<SiteIdentity> {
  const rows = await db.setting.findMany({ where: { key: { in: [...KEYS] } } })
  const map = Object.fromEntries(rows.map(r => [r.key, r.value])) as Record<string, string>
  return {
    name: map['site.name'] || DEFAULT_SITE_NAME,
    slogan: map['site.slogan'] || DEFAULT_SITE_SLOGAN,
    logoUrl: map['site.logoUrl'] || null,
    faviconUrl: map['site.faviconUrl'] || null,
  }
}

export async function GET() {
  return handler(async () => {
    return ok(await readIdentity())
  })
}

const urlOrReset = z.string()
  .max(300)
  .refine(v => v.startsWith('/uploads/site/'), 'نشانی تصویر نامعتبر است')

const putSchema = z.object({
  name: z.string().trim().min(2, 'نام وب‌سایت حداقل ۲ کاراکتر است').max(60, 'نام وب‌سایت حداکثر ۶۰ کاراکتر است').optional(),
  slogan: z.string().trim().max(120, 'شعار حداکثر ۱۲۰ کاراکتر است').optional(),
  // null = بازنشانی به پیش‌فرض (حذف تصویر سفارشی)
  logoUrl: urlOrReset.nullable().optional(),
  faviconUrl: urlOrReset.nullable().optional(),
}).refine(v => Object.keys(v).length > 0, 'داده‌ای برای ذخیره ارسال نشده است')

export async function PUT(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const body = await parseBody(req, putSchema)

    const updates: Array<{ key: string; value: string }> = []
    if (body.name !== undefined) updates.push({ key: 'site.name', value: body.name })
    if (body.slogan !== undefined) updates.push({ key: 'site.slogan', value: body.slogan })
    if (body.logoUrl !== undefined) updates.push({ key: 'site.logoUrl', value: body.logoUrl ?? '' })
    if (body.faviconUrl !== undefined) updates.push({ key: 'site.faviconUrl', value: body.faviconUrl ?? '' })

    const before = await readIdentity()
    for (const u of updates) {
      await db.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      })
    }
    await audit({
      userId: user.id,
      action: 'site.identity.update',
      entityType: 'Setting',
      entityId: 'site.*',
      before: { name: before.name, slogan: before.slogan, logoUrl: before.logoUrl, faviconUrl: before.faviconUrl },
      after: body,
    })

    return ok(await readIdentity())
  })
}
