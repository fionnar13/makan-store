// انبار — ویرایش و حذف (حذف فقط برای انبار بدون لات و موجودی)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(2).max(80).optional(),
  isDefault: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, patchSchema)
    const before = await db.warehouse.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'انبار یافت نشد')
    if (body.code && body.code !== before.code) {
      const exists = await db.warehouse.findUnique({ where: { code: body.code } })
      if (exists) throw new ApiError(409, 'CODE_EXISTS', 'کد انبار تکراری است')
    }
    if (before.isDefault && body.isDefault === false) {
      throw new ApiError(400, 'DEFAULT_REQUIRED', 'حداقل یک انبار باید پیش‌فرض باشد؛ ابتدا انبار دیگری را پیش‌فرض کنید')
    }
    const w = await db.warehouse.update({ where: { id }, data: body })
    if (body.isDefault === true) {
      await db.warehouse.updateMany({ where: { id: { not: id }, isDefault: true }, data: { isDefault: false } })
    }
    await audit({
      userId: user.id, action: 'admin.warehouse.update', entityType: 'Warehouse', entityId: id,
      before: { code: before.code, name: before.name, isDefault: before.isDefault },
      after: body,
    })
    return ok({ id })
  })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const before = await db.warehouse.findUnique({
      where: { id },
      include: { _count: { select: { lots: true, balances: true } } },
    })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'انبار یافت نشد')
    if (before._count.lots > 0 || before._count.balances > 0) {
      throw new ApiError(409, 'WAREHOUSE_IN_USE', 'این انبار لات یا موجودی ثبت‌شده دارد و قابل حذف نیست؛ برای انبار بسته، آن را غیرپیش‌فرض نگه دارید یا با انباردار هماهنگ کنید', { lots: before._count.lots, balances: before._count.balances })
    }
    if (before.isDefault) {
      throw new ApiError(400, 'DEFAULT_REQUIRED', 'انبار پیش‌فرض قابل حذف نیست؛ ابتدا انبار دیگری را پیش‌فرض کنید')
    }
    await db.warehouse.delete({ where: { id } })
    await audit({ userId: user.id, action: 'admin.warehouse.delete', entityType: 'Warehouse', entityId: id, before: { code: before.code, name: before.name } })
    return ok({ id })
  })
}
