// ویرایش / حذف بنر فروشگاه — فقط با مجوز users.manage
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  imageUrl: z.string().trim().max(300).refine(v => v.startsWith('/uploads/banners/'), 'نشانی تصویر بنر نامعتبر است').optional(),
  title: z.string().trim().max(80).nullable().optional(),
  subtitle: z.string().trim().max(160).nullable().optional(),
  linkUrl: z.string().trim().max(300).nullable().optional(),
  linkLabel: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
}).refine(v => Object.keys(v).length > 0, 'داده‌ای برای ذخیره ارسال نشده است')

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, patchSchema)

    const before = await db.banner.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'بنر یافت نشد')

    const updated = await db.banner.update({
      where: { id },
      data: {
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.title !== undefined ? { title: body.title || null } : {}),
        ...(body.subtitle !== undefined ? { subtitle: body.subtitle || null } : {}),
        ...(body.linkUrl !== undefined ? { linkUrl: body.linkUrl || null } : {}),
        ...(body.linkLabel !== undefined ? { linkLabel: body.linkLabel || null } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    })

    await audit({
      userId: user.id, action: 'banner.update', entityType: 'Banner', entityId: id,
      before: { imageUrl: before.imageUrl, sortOrder: before.sortOrder, isActive: before.isActive },
      after: { imageUrl: updated.imageUrl, sortOrder: updated.sortOrder, isActive: updated.isActive },
    })
    return ok(updated)
  })
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const before = await db.banner.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'بنر یافت نشد')

    await db.banner.delete({ where: { id } })
    await audit({
      userId: user.id, action: 'banner.delete', entityType: 'Banner', entityId: id,
      before: { imageUrl: before.imageUrl, title: before.title },
    })
    return ok({ id })
  })
}
