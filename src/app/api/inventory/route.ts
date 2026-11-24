// انبار — موجودی فیزیکی/رزرو/قابل فروش، لات‌های بچ و Ledger حرکات
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { MOVEMENT_LABELS } from '@/lib/format'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'inventory.view')
    const url = new URL(req.url)
    const type = url.searchParams.get('type') ?? 'balances'
    const productId = url.searchParams.get('productId')
    const expiringDays = parseInt(url.searchParams.get('expiringDays') ?? '90', 10)

    const warehouses = await db.warehouse.findMany({ orderBy: { isDefault: 'desc' } })

    if (type === 'lots') {
      const now = new Date()
      const lots = await db.inventoryLot.findMany({
        where: {
          ...(productId ? { productId } : {}),
          remainingQtyBase: { gt: 0 },
        },
        include: {
          product: { select: { name: true, sku: true, baseUnitName: true } },
          supplier: { select: { name: true } },
          warehouse: { select: { name: true } },
        },
        orderBy: { expiresAt: 'asc' },
      })
      const horizon = new Date(now.getTime() + expiringDays * 86400000)
      return ok({
        warehouses,
        lots: lots.map(l => ({
          id: l.id, lotNo: l.lotNo, product: l.product, warehouse: l.warehouse.name,
          supplier: l.supplier?.name ?? null, producedAt: l.producedAt, expiresAt: l.expiresAt,
          remainingBase: l.remainingQtyBase, initialBase: l.initialQtyBase,
          costRls: l.costRls, isDemo: l.isDemo,
          state: l.expiresAt && l.expiresAt < now ? 'EXPIRED' : l.expiresAt && l.expiresAt < horizon ? 'NEAR_EXPIRY' : 'OK',
        })),
      })
    }

    if (type === 'ledger') {
      const take = Math.min(parseInt(url.searchParams.get('take') ?? '120', 10), 300)
      const rows = await db.inventoryLedger.findMany({
        where: productId ? { productId } : undefined,
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        take,
      })
      return ok({
        warehouses,
        ledger: rows.map(r => ({
          id: r.id, product: r.product, warehouseId: r.warehouseId,
          movement: r.movement, movementLabel: MOVEMENT_LABELS[r.movement] ?? r.movement,
          physDelta: r.physDelta, reservedDelta: r.reservedDelta,
          refType: r.refType, refId: r.refId, note: r.note, createdAt: r.createdAt,
        })),
      })
    }

    // balances (پیش‌فرض)
    const balances = await db.inventoryBalance.findMany({
      where: productId ? { productId } : undefined,
      include: {
        product: { select: { name: true, sku: true, baseUnitName: true, reorderPointBase: true } },
        warehouse: { select: { name: true } },
      },
      orderBy: [{ warehouseId: 'asc' }, { physicalQtyBase: 'desc' }],
    })
    return ok({
      warehouses,
      balances: balances.map(b => {
        const available = b.physicalQtyBase - b.reservedQtyBase
        return {
          id: b.id, product: b.product, warehouse: b.warehouse.name,
          physicalBase: b.physicalQtyBase, reservedBase: b.reservedQtyBase, availableBase: available,
          belowReorder: available < b.product.reorderPointBase,
        }
      }),
    })
  })
}
