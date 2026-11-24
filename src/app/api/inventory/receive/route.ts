// ورود کالا به انبار — ایجاد لات با بچ/انقضا + افزایش موجودی فیزیکی (Transaction)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody, clientIp } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { receiveStock } from '@/lib/inventory'
import { audit } from '@/lib/audit'

const receiveSchema = z.object({
  productId: z.string().min(1, 'انتخاب کالا الزامی است'),
  warehouseId: z.string().min(1, 'انتخاب انبار الزامی است'),
  qtyBase: z.number().int().min(1, 'مقدار باید عدد صحیح مثبت باشد'),
  lotNo: z.string().min(1, 'شماره بچ الزامی است'),
  producedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'inventory.receive')
    const body = await parseBody(req, receiveSchema)
    const product = await db.product.findUnique({ where: { id: body.productId } })
    if (!product) throw new ApiError(404, 'NOT_FOUND', 'کالا یافت نشد')
    const wh = await db.warehouse.findUnique({ where: { id: body.warehouseId } })
    if (!wh) throw new ApiError(404, 'NOT_FOUND', 'انبار یافت نشد')

    const lot = await db.$transaction(async tx => {
      return receiveStock(tx, {
        productId: body.productId, warehouseId: body.warehouseId,
        qtyBase: body.qtyBase, lotNo: body.lotNo,
        producedAt: body.producedAt ? new Date(body.producedAt) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        supplierId: body.supplierId ?? null,
      }, { refType: 'RECEIVE', refId: null, userId: user.id })
    })

    await audit({
      userId: user.id, action: 'inventory.receive', entityType: 'InventoryLot', entityId: lot.id,
      after: { product: product.sku, lotNo: body.lotNo, qtyBase: body.qtyBase }, ip: clientIp(req),
    })
    return ok({ id: lot.id, lotNo: lot.lotNo }, 201)
  })
}
