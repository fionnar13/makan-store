// پنل مدیریت داده‌ها — تنظیمات سیستمی (key/value)
// کلیدهای seq:* شمارنده‌های داخلی شماره‌گذاری اسناد هستند و فقط خواندنی‌اند
// دسترسی: فقط مجوز users.manage (مدیر کل / آدمین)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'users.manage')
    const settings = await db.setting.findMany({ orderBy: { key: 'asc' } })
    return ok(settings.map(s => ({
      key: s.key,
      value: s.value,
      isSystemCounter: s.key.startsWith('seq:'),
      updatedAt: s.updatedAt,
    })))
  })
}

const upsertSchema = z.object({
  key: z.string().min(1).max(80).regex(/^[a-zA-Z0-9._:]+$/, 'کلید فقط می‌تواند شامل حروف لاتین، عدد، نقطه و دونقطه باشد'),
  value: z.string().max(500, 'مقدار حداکثر ۵۰۰ کاراکتر است'),
})

export async function PUT(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const body = await parseBody(req, upsertSchema)
    if (body.key.startsWith('seq:')) {
      throw new ApiError(400, 'LOCKED_KEY', 'کلیدهای seq:* شمارنده داخلی شماره‌گذاری اسناد هستند و از طریق پنل قابل ویرایش نیستند')
    }
    const before = await db.setting.findUnique({ where: { key: body.key } })
    const s = await db.setting.upsert({
      where: { key: body.key },
      update: { value: body.value },
      create: { key: body.key, value: body.value },
    })
    await audit({
      userId: user.id, action: 'admin.setting.upsert', entityType: 'Setting', entityId: body.key,
      before: before ? { value: before.value } : null,
      after: { value: body.value },
    })
    return ok({ key: s.key })
  })
}
