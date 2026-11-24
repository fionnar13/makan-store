// پنل مدیریت داده‌ها — کارمندان (لیست + ایجاد)
// کارمند می‌تواند به یک حساب کاربری متصل شود (مثلاً ویزیتور برای بازدیدها)
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
    const employees = await db.employee.findMany({ orderBy: { code: 'asc' } })
    // رابطه Employee→User در اسکیما فقط با فیلد اسکالر userId است؛
    // نام کاربران متصل در کوئری جداگانه واکشی می‌شود (الگوی مسیر territories)
    const userIds = employees.map(e => e.userId).filter(Boolean) as string[]
    const linkedUsers = userIds.length
      ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, phone: true } })
      : []
    const uMap = new Map(linkedUsers.map(u => [u.id, u]))
    return ok(employees.map(e => ({
      id: e.id,
      code: e.code,
      fullName: e.fullName,
      phone: e.phone,
      position: e.position,
      status: e.status,
      hireDate: e.hireDate,
      userId: e.userId,
      userName: e.userId ? uMap.get(e.userId)?.name ?? null : null,
      userPhone: e.userId ? uMap.get(e.userId)?.phone ?? null : null,
      createdAt: e.createdAt,
    })))
  })
}

const createSchema = z.object({
  code: z.string().min(1, 'کد پرسنلی الزامی است').max(20),
  fullName: z.string().min(2, 'نام کامل حداقل ۲ کاراکتر است').max(120),
  phone: z.string().max(15).optional().nullable(),
  position: z.string().max(80).optional().nullable(),
  userId: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const body = await parseBody(req, createSchema)
    const exists = await db.employee.findUnique({ where: { code: body.code } })
    if (exists) throw new ApiError(409, 'CODE_EXISTS', 'کد پرسنلی تکراری است')
    if (body.userId) {
      const linked = await db.employee.findUnique({ where: { userId: body.userId } })
      if (linked) throw new ApiError(409, 'USER_ALREADY_LINKED', 'این حساب کاربری قبلاً به کارمند دیگری متصل شده است')
      const u = await db.user.findUnique({ where: { id: body.userId } })
      if (!u) throw new ApiError(404, 'USER_NOT_FOUND', 'کاربر موردنظر یافت نشد')
    }
    let hireDate: Date | null = null
    if (body.hireDate) {
      hireDate = new Date(body.hireDate)
      if (Number.isNaN(hireDate.getTime())) throw new ApiError(400, 'BAD_DATE', 'تاریخ استخدام معتبر نیست')
    }
    const e = await db.employee.create({
      data: {
        code: body.code, fullName: body.fullName,
        phone: body.phone ?? null, position: body.position ?? null,
        userId: body.userId ?? null, hireDate,
      },
    })
    await audit({ userId: user.id, action: 'admin.employee.create', entityType: 'Employee', entityId: e.id, after: { code: e.code, fullName: e.fullName, userId: e.userId } })
    return ok({ id: e.id }, 201)
  })
}
