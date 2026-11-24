// موتور قیمت‌گذاری — پیش‌نمایش قیمت سمت سرور + مدیریت قواعد
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requireAuth, requirePerm } from '@/lib/auth'
import { resolvePrice } from '@/lib/pricing'
import { audit } from '@/lib/audit'

// پیش‌نمایش قیمت معتبر برای کالا/واحد/مقدار برای مشتری — منبع حقیقت: سرور
export async function GET(req: NextRequest) {
  return handler(async () => {
    await requireAuth(req)
    const url = new URL(req.url)
    const productId = url.searchParams.get('productId')
    const unitId = url.searchParams.get('unitId')
    const customerId = url.searchParams.get('customerId')
    const qtyBase = parseInt(url.searchParams.get('qtyBase') ?? '1', 10)
    if (!productId || !unitId || !customerId) {
      throw new ApiError(400, 'BAD_PARAMS', 'productId، unitId و customerId الزامی است')
    }
    const resolved = await resolvePrice({ productId, unitId, qtyBase, customerId })
    const wh = await db.warehouse.findFirst({ where: { isDefault: true } })
    let availableBase: number | null = null
    if (wh) {
      const bal = await db.inventoryBalance.findUnique({
        where: { productId_warehouseId: { productId, warehouseId: wh.id } },
      })
      availableBase = bal ? bal.physicalQtyBase - bal.reservedQtyBase : 0
    }
    return ok({ ...resolved, availableBase })
  })
}

const createSchema = z.object({
  productId: z.string().min(1),
  unitId: z.string().min(1),
  scope: z.enum(['DEFAULT', 'CUSTOMER', 'GROUP', 'TERRITORY', 'VOLUME']),
  refId: z.string().optional().nullable(),
  priceRls: z.number().int().min(0, 'قیمت باید عدد صحیح ریال باشد'),
  minQtyBase: z.number().int().min(1).default(1),
  maxQtyBase: z.number().int().min(1).optional().nullable(),
  startAt: z.string().optional().nullable(),
  endAt: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'products.manage')
    const body = await parseBody(req, createSchema)
    if (['CUSTOMER', 'TERRITORY'].includes(body.scope) && !body.refId) {
      throw new ApiError(400, 'REF_REQUIRED', 'برای این نوع قیمت، انتخاب مرجع الزامی است')
    }
    const unit = await db.productUnit.findUnique({ where: { id: body.unitId } })
    if (!unit || unit.productId !== body.productId) {
      throw new ApiError(400, 'BAD_UNIT', 'واحد فروش با کالا هم‌خوانی ندارد')
    }
    const rule = await db.priceRule.create({
      data: {
        productId: body.productId, unitId: body.unitId, scope: body.scope,
        refId: body.refId ?? null, priceRls: body.priceRls,
        minQtyBase: body.minQtyBase, maxQtyBase: body.maxQtyBase ?? null,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        note: body.note ?? null,
      },
    })
    await audit({ userId: user.id, action: 'priceRule.create', entityType: 'PriceRule', entityId: rule.id, after: { scope: body.scope, priceRls: body.priceRls } })
    return ok({ id: rule.id }, 201)
  })
}

const patchSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean().optional(),
  priceRls: z.number().int().min(0).optional(),
})

export async function PATCH(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'products.manage')
    const body = await parseBody(req, patchSchema)
    const before = await db.priceRule.findUnique({ where: { id: body.id } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'قاعده قیمت یافت نشد')
    await db.priceRule.update({
      where: { id: body.id },
      data: { isActive: body.isActive, priceRls: body.priceRls },
    })
    await audit({ userId: user.id, action: 'priceRule.update', entityType: 'PriceRule', entityId: body.id, before: { isActive: before.isActive, priceRls: before.priceRls }, after: body })
    return ok({ id: body.id })
  })
}
