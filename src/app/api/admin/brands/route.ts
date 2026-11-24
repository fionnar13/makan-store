// پنل مدیریت داده‌ها — برندها (لیست + ایجاد)
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
    const categoryId = new URL(req.url).searchParams.get('categoryId')?.trim()
    const brands = await db.brand.findMany({
      where: categoryId ? { categoryId } : undefined,
      include: { _count: { select: { products: true } }, category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })
    return ok(brands.map(b => ({
      id: b.id,
      name: b.name,
      categoryId: b.categoryId,
      categoryName: b.category?.name ?? null,
      isConfirmed: b.isConfirmed,
      isDemo: b.isDemo,
      productsCount: b._count.products,
    })))
  })
}

const createSchema = z.object({
  name: z.string().min(1, 'نام برند الزامی است').max(80),
  categoryId: z.string().min(1, 'انتخاب دسته‌بندی الزامی است'), // برند همیشه وابسته به یک دسته است
  isConfirmed: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const body = await parseBody(req, createSchema)
    const category = await db.category.findUnique({ where: { id: body.categoryId } })
    if (!category) throw new ApiError(400, 'BAD_CATEGORY', 'دسته‌بندی انتخاب‌شده یافت نشد')
    const exists = await db.brand.findUnique({ where: { name: body.name } })
    if (exists) throw new ApiError(409, 'NAME_EXISTS', 'برند با این نام قبلاً ثبت شده است')
    const b = await db.brand.create({
      data: { name: body.name, isConfirmed: body.isConfirmed ?? false, categoryId: body.categoryId },
    })
    await audit({ userId: user.id, action: 'admin.brand.create', entityType: 'Brand', entityId: b.id, after: { name: b.name, categoryId: b.categoryId, isConfirmed: b.isConfirmed } })
    return ok({ id: b.id }, 201)
  })
}
