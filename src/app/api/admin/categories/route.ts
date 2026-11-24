// پنل مدیریت داده‌ها — دسته‌بندی محصولات (لیست + ایجاد)
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
    const categories = await db.category.findMany({
      include: {
        _count: { select: { products: true, children: true } },
        parent: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    })
    return ok(categories.map(c => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      parentName: c.parent?.name ?? null,
      productsCount: c._count.products,
      childrenCount: c._count.children,
    })))
  })
}

const createSchema = z.object({
  name: z.string().min(2, 'نام دسته‌بندی حداقل ۲ کاراکتر است').max(80),
  parentId: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const body = await parseBody(req, createSchema)
    if (body.parentId) {
      const parent = await db.category.findUnique({ where: { id: body.parentId } })
      if (!parent) throw new ApiError(404, 'PARENT_NOT_FOUND', 'دسته‌بندی والد یافت نشد')
    }
    const exists = await db.category.findUnique({ where: { name: body.name } })
    if (exists) throw new ApiError(409, 'NAME_EXISTS', 'دسته‌بندی با این نام قبلاً ثبت شده است')
    const c = await db.category.create({ data: { name: body.name, parentId: body.parentId ?? null } })
    await audit({ userId: user.id, action: 'admin.category.create', entityType: 'Category', entityId: c.id, after: { name: c.name, parentId: c.parentId } })
    return ok({ id: c.id }, 201)
  })
}
