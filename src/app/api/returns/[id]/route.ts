// بررسی مرجوعی — کنترل کیفیت، تعیین تکلیف اقلام و سند اصلاح مالی
// RESTOCK → ورود مجدد به موجودی قابل فروش (لات جدید RETURN_IN)
// SCRAP/QUARANTINE → بدون ورود به موجودی قابل فروش
// مبلغ اقلام پذیرفته‌شده → سند اعتبار (CREDIT_NOTE) منفی در Ledger مشتری
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    await requirePerm(req, 'returns.view')
    const { id } = await ctx.params
    const r = await db.returnRequest.findUnique({
      where: { id },
      include: {
        order: { select: { orderNo: true, totalRls: true, items: true } },
        customer: { select: { code: true, shopName: true } },
        items: { include: { product: { select: { name: true, baseUnitName: true } } } },
      },
    })
    if (!r) throw new ApiError(404, 'NOT_FOUND', 'درخواست مرجوعی یافت نشد')
    return ok({
      id: r.id, returnNo: r.returnNo, status: r.status, reason: r.reason,
      order: r.order, customer: r.customer, reviewedAt: r.reviewedAt,
      financialPosted: r.financialPosted, createdAt: r.createdAt,
      items: r.items.map(i => {
        const orderItem = r.order.items.find(oi => oi.productId === i.productId)
        return {
          id: i.id, productId: i.productId, productName: i.product.name,
          baseUnitName: i.product.baseUnitName, qtyBase: i.qtyBase, reason: i.reason,
          disposition: i.disposition, qcNote: i.qcNote,
          unitPriceRls: orderItem?.unitPriceRls ?? null,
        }
      }),
    })
  })
}

const reviewSchema = z.object({
  note: z.string().optional().nullable(),
  items: z.array(z.object({
    itemId: z.string().min(1),
    disposition: z.enum(['RESTOCK', 'SCRAP', 'QUARANTINE']),
    qcNote: z.string().optional().nullable(),
  })).min(1, 'تعیین تکلیف اقلام الزامی است'),
})

export async function POST(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'returns.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, reviewSchema)
    const rr = await db.returnRequest.findUnique({
      where: { id },
      include: { order: { include: { items: true } }, items: true },
    })
    if (!rr) throw new ApiError(404, 'NOT_FOUND', 'درخواست مرجوعی یافت نشد')
    if (rr.status === 'CLOSED') throw new ApiError(409, 'BAD_STATE', 'این درخواست قبلاً بسته شده است')
    for (const it of body.items) {
      if (!rr.items.some(ri => ri.id === it.itemId)) {
        throw new ApiError(400, 'BAD_ITEM', 'قلم مرجوعی متعلق به این درخواست نیست')
      }
    }

    const creditRls = await db.$transaction(async tx => {
      let credit = 0
      for (const it of body.items) {
        const ri = rr.items.find(x => x.id === it.itemId)!
        const orderItem = rr.order.items.find(oi => oi.productId === ri.productId)
        await tx.returnItem.update({
          where: { id: it.itemId },
          data: { disposition: it.disposition, qcNote: it.qcNote ?? null },
        })
        if (it.disposition === 'RESTOCK') {
          // ورود مجدد به موجودی قابل فروش — لات جدید بدون انقضای قطعی
          const lotNo = `RET-${rr.returnNo}-${ri.productId.slice(0, 6).toUpperCase()}`
          const lot = await tx.inventoryLot.create({
            data: {
              productId: ri.productId, warehouseId: (await tx.warehouse.findFirst({ where: { isDefault: true } }))!.id,
              lotNo, initialQtyBase: ri.qtyBase, remainingQtyBase: ri.qtyBase,
              costRls: orderItem ? Math.round((orderItem.lineTotalRls / orderItem.qtyBase) * 0.82) : null,
              refType: 'RETURN', refId: rr.id,
            },
          })
          const bal = (await tx.warehouse.findFirst({ where: { isDefault: true } }))!.id
          await tx.inventoryBalance.upsert({
            where: { productId_warehouseId: { productId: ri.productId, warehouseId: bal } },
            update: { physicalQtyBase: { increment: ri.qtyBase } },
            create: { productId: ri.productId, warehouseId: bal, physicalQtyBase: ri.qtyBase, reservedQtyBase: 0 },
          })
          await tx.inventoryLedger.create({
            data: {
              productId: ri.productId, warehouseId: bal, lotId: lot.id,
              movement: 'RETURN_IN', physDelta: ri.qtyBase, reservedDelta: 0,
              refType: 'RETURN', refId: rr.id, userId: user.id,
              note: `ورود مرجوعی ${rr.returnNo} پس از کنترل کیفیت`,
            },
          })
        }
        // مبلغ سند اعتبار = نسبت مقدار مرجوعی از مبلغ کل خط سفارش
        if (orderItem) {
          credit += Math.round((orderItem.lineTotalRls / orderItem.qtyBase) * ri.qtyBase)
        }
      }
      if (credit > 0) {
        await tx.customerLedger.create({
          data: {
            customerId: rr.customerId, entryType: 'CREDIT_NOTE', amountRls: -credit,
            refType: 'RETURN', refId: rr.id,
            description: body.note ?? `سند اعتبار مرجوعی ${rr.returnNo}`,
            userId: user.id,
          },
        })
      }
      await tx.returnRequest.update({
        where: { id: rr.id },
        data: {
          status: 'CLOSED', reviewedById: user.id, reviewedAt: new Date(),
          financialPosted: credit > 0,
        },
      })
      return credit
    })

    await audit({ userId: user.id, action: 'return.review', entityType: 'ReturnRequest', entityId: rr.id, after: { creditRls, dispositions: body.items } })
    return ok({ creditRls }, 201)
  })
}
