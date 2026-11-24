// جزئیات و ویرایش محصول + قواعد قیمت با برچسب‌های قابل نمایش
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { GROUP_LABELS } from '@/lib/format'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    await requirePerm(req, 'products.view')
    const { id } = await ctx.params
    const p = await db.product.findUnique({
      where: { id },
      include: {
        brand: { select: { name: true, isConfirmed: true } },
        category: { select: { name: true } },
        units: { orderBy: { factor: 'asc' } },
        prices: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!p) throw new ApiError(404, 'NOT_FOUND', 'محصول یافت نشد')

    // برچسب‌گذاری scopeهای وابسته به مرجع
    const customerIds = p.prices.filter(r => r.scope === 'CUSTOMER' && r.refId).map(r => r.refId!)
    const territoryIds = p.prices.filter(r => r.scope === 'TERRITORY' && r.refId).map(r => r.refId!)
    const customers = customerIds.length ? await db.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, shopName: true } }) : []
    const territories = territoryIds.length ? await db.territory.findMany({ where: { id: { in: territoryIds } }, select: { id: true, name: true } }) : []
    const custMap = new Map(customers.map(c => [c.id, c.shopName]))
    const tzMap = new Map(territories.map(t => [t.id, t.name]))

    return ok({
      id: p.id, sku: p.sku, name: p.name, description: p.description,
      brand: p.brand?.name ?? null, brandId: p.brandId, categoryId: p.categoryId,
      imageUrl: p.imageUrl,
      category: p.category?.name ?? null, baseUnitName: p.baseUnitName,
      weightG: p.weightG, volumeMl: p.volumeMl, packagingType: p.packagingType,
      minOrderQtyBase: p.minOrderQtyBase, orderMultipleBase: p.orderMultipleBase,
      reorderPointBase: p.reorderPointBase, isActive: p.isActive, isDemo: p.isDemo,
      units: p.units.map(u => ({ id: u.id, name: u.name, factor: u.factor, isBase: u.isBase, barcode: u.barcode })),
      prices: p.prices.map(r => ({
        id: r.id, unitId: r.unitId, scope: r.scope,
        scopeLabel: r.scope === 'CUSTOMER' ? (custMap.get(r.refId!) ?? 'مشتری') :
          r.scope === 'GROUP' ? (GROUP_LABELS[r.refId ?? ''] ?? r.refId) :
          r.scope === 'TERRITORY' ? (tzMap.get(r.refId!) ?? 'منطقه') :
          r.scope === 'VOLUME' ? `مقدار ≥ ${r.minQtyBase}` : 'عمومی',
        priceRls: r.priceRls, minQtyBase: r.minQtyBase, maxQtyBase: r.maxQtyBase,
        startAt: r.startAt, endAt: r.endAt, isActive: r.isActive, note: r.note,
      })),
    })
  })
}

const patchSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  imageUrl: z.string().url('آدرس تصویر معتبر نیست').optional().nullable(),
  weightG: z.number().int().min(0).optional().nullable(),
  volumeMl: z.number().int().min(0).optional().nullable(),
  packagingType: z.string().optional().nullable(),
  minOrderQtyBase: z.number().int().min(1).optional(),
  orderMultipleBase: z.number().int().min(1).optional(),
  reorderPointBase: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'products.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, patchSchema)
    const before = await db.product.findUnique({ where: { id } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'محصول یافت نشد')
    const updated = await db.product.update({ where: { id }, data: body })
    await audit({ userId: user.id, action: 'product.update', entityType: 'Product', entityId: id, before: { isActive: before.isActive, name: before.name }, after: body })
    return ok({ id: updated.id })
  })
}
