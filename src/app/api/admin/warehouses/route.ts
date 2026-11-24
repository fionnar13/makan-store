// پنل مدیریت داده‌ها — انبارها (لیست + ایجاد)
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
    const warehouses = await db.warehouse.findMany({
      include: { _count: { select: { lots: true, balances: true } } },
      orderBy: { code: 'asc' },
    })
    return ok(warehouses.map(w => ({
      id: w.id,
      code: w.code,
      name: w.name,
      isDefault: w.isDefault,
      lotsCount: w._count.lots,
      balancesCount: w._count.balances,
    })))
  })
}

const createSchema = z.object({
  code: z.string().min(1, 'کد انبار الزامی است').max(20),
  name: z.string().min(2, 'نام انبار حداقل ۲ کاراکتر است').max(80),
  isDefault: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const body = await parseBody(req, createSchema)
    const exists = await db.warehouse.findUnique({ where: { code: body.code } })
    if (exists) throw new ApiError(409, 'CODE_EXISTS', 'کد انبار تکراری است')
    const w = await db.warehouse.create({
      data: {
        code: body.code, name: body.name,
        isDefault: body.isDefault ?? false,
      },
    })
    if (w.isDefault) {
      await db.warehouse.updateMany({ where: { id: { not: w.id }, isDefault: true }, data: { isDefault: false } })
    }
    await audit({ userId: user.id, action: 'admin.warehouse.create', entityType: 'Warehouse', entityId: w.id, after: { code: w.code, name: w.name, isDefault: w.isDefault } })
    return ok({ id: w.id }, 201)
  })
}
