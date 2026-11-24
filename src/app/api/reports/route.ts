// گزارش‌های تحلیلی — فروش، انبار، مطالبات، عملکرد ویزیتور
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ApiError, handler, ok } from '@/lib/api'
import { requirePerm } from '@/lib/auth'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'reports.view')
    const url = new URL(req.url)
    const type = url.searchParams.get('type') ?? 'sales'
    const groupBy = url.searchParams.get('groupBy') ?? 'day'
    const now = new Date()
    const defFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : defFrom
    const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')!) : now

    if (type === 'inventory') {
      const balances = await db.inventoryBalance.findMany({
        include: {
          product: { select: { name: true, sku: true, baseUnitName: true, reorderPointBase: true } },
          warehouse: { select: { name: true } },
        },
        orderBy: { physicalQtyBase: 'desc' },
      })
      const horizon = new Date(now.getTime() + 90 * 86400000)
      const lots = await db.inventoryLot.findMany({
        where: { remainingQtyBase: { gt: 0 }, expiresAt: { lt: horizon } },
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { expiresAt: 'asc' },
      })
      return ok({
        balances: balances.map(b => ({
          product: b.product, warehouse: b.warehouse.name,
          physicalBase: b.physicalQtyBase, reservedBase: b.reservedQtyBase,
          availableBase: b.physicalQtyBase - b.reservedQtyBase,
          belowReorder: b.physicalQtyBase - b.reservedQtyBase < b.product.reorderPointBase,
        })),
        nearExpiry: lots.filter(l => l.expiresAt && l.expiresAt >= now).map(l => ({ product: l.product, lotNo: l.lotNo, expiresAt: l.expiresAt, remainingBase: l.remainingQtyBase })),
        expired: lots.filter(l => l.expiresAt && l.expiresAt < now).map(l => ({ product: l.product, lotNo: l.lotNo, expiresAt: l.expiresAt, remainingBase: l.remainingQtyBase })),
      })
    }

    if (type === 'receivables') {
      const groups = await db.customerLedger.groupBy({ by: ['customerId'], _sum: { amountRls: true } })
      const customers = await db.customer.findMany({
        select: { id: true, code: true, shopName: true, creditLimitRls: true, creditDays: true },
      })
      const lastReceipts = await db.receipt.groupBy({ by: ['customerId'], _max: { createdAt: true } })
      return ok(customers.map(c => {
        const bal = groups.find(g => g.customerId === c.id)?._sum.amountRls ?? 0
        return {
          code: c.code, shopName: c.shopName, balanceRls: bal,
          creditLimitRls: c.creditLimitRls, creditDays: c.creditDays,
          usagePct: c.creditLimitRls > 0 ? Math.round((Math.max(bal, 0) / c.creditLimitRls) * 100) : null,
          lastReceiptAt: lastReceipts.find(r => r.customerId === c.id)?._max.createdAt ?? null,
        }
      }).sort((a, b) => b.balanceRls - a.balanceRls))
    }

    // sales reports
    const orders = await db.order.findMany({
      where: { status: { in: ['DELIVERED', 'COMPLETED'] }, createdAt: { gte: from, lte: to } },
      include: {
        customer: { select: { code: true, shopName: true, territoryId: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })
    const territories = await db.territory.findMany({ select: { id: true, name: true } })

    if (groupBy === 'product') {
      const map = new Map<string, { name: string; sku: string; qtyBase: number; revenueRls: number }>()
      for (const o of orders) for (const i of o.items) {
        const e = map.get(i.productId) ?? { name: i.product.name, sku: i.product.sku, qtyBase: 0, revenueRls: 0 }
        e.qtyBase += i.qtyBase; e.revenueRls += i.lineTotalRls
        map.set(i.productId, e)
      }
      return ok([...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenueRls - a.revenueRls))
    }
    if (groupBy === 'customer') {
      const map = new Map<string, { name: string; code: string; orders: number; revenueRls: number }>()
      for (const o of orders) {
        const e = map.get(o.customerId) ?? { name: o.customer.shopName, code: o.customer.code, orders: 0, revenueRls: 0 }
        e.orders++; e.revenueRls += o.totalRls
        map.set(o.customerId, e)
      }
      return ok([...map.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenueRls - a.revenueRls))
    }
    if (groupBy === 'visitor') {
      const visitorOrders = orders.filter(o => o.visitorId)
      const map = new Map<string, { orders: number; revenueRls: number }>()
      for (const o of visitorOrders) {
        const e = map.get(o.visitorId!) ?? { orders: 0, revenueRls: 0 }
        e.orders++; e.revenueRls += o.totalRls
        map.set(o.visitorId!, e)
      }
      const users = await db.user.findMany({ where: { id: { in: [...map.keys()] } }, select: { id: true, name: true } })
      return ok(users.map(u => ({ id: u.id, name: u.name, ...(map.get(u.id)!) })).sort((a, b) => b.revenueRls - a.revenueRls))
    }
    if (groupBy === 'territory') {
      const map = new Map<string, { orders: number; revenueRls: number }>()
      for (const o of orders) {
        const tid = o.customer.territoryId
        if (!tid) continue
        const e = map.get(tid) ?? { orders: 0, revenueRls: 0 }
        e.orders++; e.revenueRls += o.totalRls
        map.set(tid, e)
      }
      return ok(territories.filter(t => map.has(t.id)).map(t => ({ id: t.id, name: t.name, ...(map.get(t.id)!) })).sort((a, b) => b.revenueRls - a.revenueRls))
    }

    // day
    const map = new Map<string, number>()
    for (const o of orders) {
      const d = o.deliveredAt ?? o.createdAt
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      map.set(k, (map.get(k) ?? 0) + o.totalRls)
    }
    const faDay = new Intl.DateTimeFormat('fa-IR', { calendar: 'persian', day: 'numeric', month: 'short' })
    return ok([...map.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, v]) => ({ day: k, dayLabel: faDay.format(new Date(k + 'T12:00:00')), revenueRls: v })))
  })
}
