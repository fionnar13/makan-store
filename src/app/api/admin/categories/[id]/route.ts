// دسته‌بندی — ویرایش و حذف (حذف فقط برای دسته‌بندی بدون محصول و بدون زیرگروه)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  parentId: z.string().optional().nullable(),
})

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, patchSchema)
    const before = await db.category.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'دسته‌بندی یافت نشد')
    if (body.parentId === id) throw new ApiError(400, 'BAD_PARENT', 'دسته‌بندی نمی‌تواند والد خودش باشد')
    if (body.parentId) {
      const parent = await db.category.findUnique({ where: { id: body.parentId } })
      if (!parent) throw new ApiError(404, 'PARENT_NOT_FOUND', 'دسته‌بندی والد یافت نشد')
    }
    if (body.name && body.name !== before.name) {
      const exists = await db.category.findUnique({ where: { name: body.name } })
      if (exists) throw new ApiError(409, 'NAME_EXISTS', 'دسته‌بندی با این نام قبلاً ثبت شده است')
    }
    const { name, parentId } = body
    const c = await db.category.update({
      where: { id },
      data: { ...(name !== undefined ? { name } : {}), ...(parentId !== undefined ? { parentId: parentId ?? null } : {}) },
    })
    await audit({ userId: user.id, action: 'admin.category.update', entityType: 'Category', entityId: id, before: { name: before.name, parentId: before.parentId }, after: { name, parentId } })
    return ok({ id })
  })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const before = await db.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'دسته‌بندی یافت نشد')
    if (before._count.products > 0) {
      throw new ApiError(409, 'CATEGORY_IN_USE', `این دسته‌بندی به ${before._count.products} محصول متصل است؛ ابتدا محصولات را منتقل کنید`, { products: before._count.products })
    }
    if (before._count.children > 0) {
      throw new ApiError(409, 'HAS_CHILDREN', 'این دسته‌بندی زیرگروه دارد؛ ابتدا زیرگروه‌ها را منتقل یا حذف کنید', { children: before._count.children })
    }
    await db.category.delete({ where: { id } })
    await audit({ userId: user.id, action: 'admin.category.delete', entityType: 'Category', entityId: id, before: { name: before.name } })
    return ok({ id })
  })
}
