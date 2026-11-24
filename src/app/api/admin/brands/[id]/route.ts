// برند — ویرایش و حذف (حذف فقط برای برند بدون محصول)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  categoryId: z.string().min(1).optional(),
  isConfirmed: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, patchSchema)
    const before = await db.brand.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'برند یافت نشد')
    if (body.name && body.name !== before.name) {
      const exists = await db.brand.findUnique({ where: { name: body.name } })
      if (exists) throw new ApiError(409, 'NAME_EXISTS', 'برند با این نام قبلاً ثبت شده است')
    }
    if (body.categoryId && body.categoryId !== before.categoryId) {
      const category = await db.category.findUnique({ where: { id: body.categoryId } })
      if (!category) throw new ApiError(400, 'BAD_CATEGORY', 'دسته‌بندی انتخاب‌شده یافت نشد')
    }
    const b = await db.brand.update({ where: { id }, data: body })
    await audit({
      userId: user.id, action: 'admin.brand.update', entityType: 'Brand', entityId: id,
      before: { name: before.name, categoryId: before.categoryId, isConfirmed: before.isConfirmed },
      after: body,
    })
    return ok({ id })
  })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const before = await db.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'برند یافت نشد')
    if (before._count.products > 0) {
      throw new ApiError(409, 'BRAND_IN_USE', `این برند به ${before._count.products} محصول متصل است؛ ابتدا محصولات را منتقل کنید`, { products: before._count.products })
    }
    await db.brand.delete({ where: { id } })
    await audit({ userId: user.id, action: 'admin.brand.delete', entityType: 'Brand', entityId: id, before: { name: before.name } })
    return ok({ id })
  })
}
