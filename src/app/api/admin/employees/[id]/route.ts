// کارمند — ویرایش و حذف
// اگر کارمند به حساب کاربری متصل است، حذف فقط پس از قطع اتصال مجاز می‌شود
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(15).optional().nullable(),
  position: z.string().max(80).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  userId: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
})

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, patchSchema)
    const before = await db.employee.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'کارمند یافت نشد')
    if (body.userId && body.userId !== before.userId) {
      const linked = await db.employee.findUnique({ where: { userId: body.userId } })
      if (linked && linked.id !== id) throw new ApiError(409, 'USER_ALREADY_LINKED', 'این حساب کاربری قبلاً به کارمند دیگری متصل شده است')
      const u = await db.user.findUnique({ where: { id: body.userId } })
      if (!u) throw new ApiError(404, 'USER_NOT_FOUND', 'کاربر موردنظر یافت نشد')
    }
    let hireDate: Date | null | undefined = undefined
    if (body.hireDate !== undefined) {
      if (body.hireDate === null) {
        hireDate = null
      } else {
        hireDate = new Date(body.hireDate)
        if (Number.isNaN(hireDate.getTime())) throw new ApiError(400, 'BAD_DATE', 'تاریخ استخدام معتبر نیست')
      }
    }
    const { hireDate: _h, ...data } = body
    const e = await db.employee.update({
      where: { id },
      data: { ...data, ...(hireDate !== undefined ? { hireDate } : {}) },
    })
    await audit({
      userId: user.id, action: 'admin.employee.update', entityType: 'Employee', entityId: id,
      before: { fullName: before.fullName, status: before.status, userId: before.userId },
      after: data,
    })
    return ok({ id })
  })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const before = await db.employee.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'کارمند یافت نشد')
    if (before.userId) {
      throw new ApiError(409, 'LINKED_TO_USER', 'این کارمند به یک حساب کاربری متصل است؛ ابتدا اتصال را قطع کنید یا وضعیت را INACTIVE کنید')
    }
    await db.employee.delete({ where: { id } })
    await audit({ userId: user.id, action: 'admin.employee.delete', entityType: 'Employee', entityId: id, before: { code: before.code, fullName: before.fullName } })
    return ok({ id })
  })
}
