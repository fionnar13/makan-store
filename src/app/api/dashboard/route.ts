// داشبورد مدیریتی — همه ارقام از Database واقعی
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok } from '@/lib/api'
import { requirePerm } from '@/lib/auth'

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'dashboard.view')
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const d14 = new Date(startToday.getTime() - 13 * 86400000)
    const d30 = new Date(startToday.getTime() - 29 * 86400000)
    const d60 = new Date(now.getTime() + 60 * 86400000)

    const [todayInv, monthInv, monthPurchase, receiptsToday, statusGroups, balances, nearLots, expiredLots, ledgerGroups, activeOrders, monthOrders, outLedger, inv14, rec14] = await Promise.all([
      db.invoice.aggregate({ where: { issuedAt: { gte: startToday } }, _sum: { totalRls: true }, _count: true }),
      db.invoice.aggregate({ where: { issuedAt: { gte: startMonth } }, _sum: { totalRls: true }, _count: true }),
      db.supplierLedger.aggregate({ where: { entryType: 'PURCHASE', createdAt: { gte: startMonth } }, _sum: { amountRls: true } }),
      db.receipt.aggregate({ where: { createdAt: { gte: startToday } }, _sum: { amountRls: true }, _count: true }),
      db.order.groupBy({ by: ['status'], _count: true }),
      db.inventoryBalance.findMany({ include: { product: { select: { name: true, reorderPointBase: true, baseUnitName: true } } } }),
      db.inventoryLot.findMany({
        where: { remainingQtyBase: { gt: 0 }, expiresAt: { gte: now, lte: d60 } },
        include: { product: { select: { name: true } } }, orderBy: { expiresAt: 'asc' },
      }),
      db.inventoryLot.findMany({
        where: { remainingQtyBase: { gt: 0 }, expiresAt: { lt: now } },
        include: { product: { select: { name: true } } },
      }),
      db.customerLedger.groupBy({ by: ['customerId'], _sum: { amountRls: true } }),
      db.order.findMany({ where: { createdAt: { gte: d30 } }, select: { customerId: true }, distinct: ['customerId'] }),
      db.order.findMany({
        where: { createdAt: { gte: startMonth }, visitorId: { not: null } },
        select: { visitorId: true, totalRls: true },
      }),
      db.inventoryLedger.findMany({
        where: { movement: 'OUT', createdAt: { gte: startMonth }, lotId: { not: null } },
        select: { physDelta: true, lot: { select: { costRls: true } } },
      }),
      db.invoice.findMany({ where: { issuedAt: { gte: d14 } }, select: { issuedAt: true, totalRls: true } }),
      db.receipt.findMany({ where: { createdAt: { gte: d14 } }, select: { createdAt: true, amountRls: true } }),
    ])

    // بدهی مشتریان از Ledger مالی (مثبت = بدهی، منفی = بستانکاری)
    let totalDebt = 0, totalCredit = 0
    for (const g of ledgerGroups) {
      const v = g._sum.amountRls ?? 0
      if (v > 0) totalDebt += v; else totalCredit += -v
    }

    const lowStock = balances
      .filter(b => b.physicalQtyBase - b.reservedQtyBase < b.product.reorderPointBase)
      .map(b => ({ productId: b.productId, name: b.product.name, availableBase: b.physicalQtyBase - b.reservedQtyBase, reorderPoint: b.product.reorderPointBase, unit: b.product.baseUnitName }))
    const totalAvailable = balances.reduce((s, b) => s + b.physicalQtyBase - b.reservedQtyBase, 0)

    // سود ناخالص تخمینی ماه = فروش فاکتور شده − بهای تمام‌شده خروج‌های واقعی
    const cogsMonth = outLedger.reduce((s, l) => s + Math.abs(l.physDelta) * (l.lot?.costRls ?? 0), 0)

    // نمودار ۱۴ روز
    const map = new Map<string, { sales: number; collections: number }>()
    for (let i = 0; i < 14; i++) {
      const d = new Date(startToday.getTime() - (13 - i) * 86400000)
      map.set(dayKey(d), { sales: 0, collections: 0 })
    }
    for (const inv of inv14) {
      const k = dayKey(inv.issuedAt)
      const e = map.get(k); if (e) e.sales += inv.totalRls
    }
    for (const r of rec14) {
      const k = dayKey(r.createdAt)
      const e = map.get(k); if (e) e.collections += r.amountRls
    }
    const faDay = new Intl.DateTimeFormat('fa-IR', { calendar: 'persian', day: 'numeric', month: 'short' })
    const chart = [...map.entries()].map(([k, v]) => ({ day: faDay.format(new Date(k + 'T12:00:00')), ...v }))

    // عملکرد ویزیتورها این ماه
    const visMap = new Map<string, { orders: number; totalRls: number }>()
    for (const o of monthOrders) {
      if (!o.visitorId) continue
      const e = visMap.get(o.visitorId) ?? { orders: 0, totalRls: 0 }
      e.orders++; e.totalRls += o.totalRls
      visMap.set(o.visitorId, e)
    }
    const visitorUsers = await db.user.findMany({ where: { id: { in: [...visMap.keys()] } }, select: { id: true, name: true } })
    const visitorPerf = visitorUsers.map(u => ({ userId: u.id, name: u.name, ...(visMap.get(u.id)!) }))

    const statusCounts: Record<string, number> = {}
    for (const g of statusGroups) statusCounts[g.status] = g._count

    return ok({
      salesTodayRls: todayInv._sum.totalRls ?? 0,
      salesTodayCount: todayInv._count,
      salesMonthRls: monthInv._sum.totalRls ?? 0,
      salesMonthCount: monthInv._count,
      purchaseMonthRls: monthPurchase._sum.amountRls ?? 0,
      cogsMonthRls: cogsMonth,
      grossProfitMonthRls: (monthInv._sum.totalRls ?? 0) - cogsMonth,
      receiptsTodayRls: receiptsToday._sum.amountRls ?? 0,
      receiptsTodayCount: receiptsToday._count,
      totalDebtRls: totalDebt,
      totalCreditRls: totalCredit,
      activeCustomers30d: activeOrders.length,
      statusCounts,
      newOrders: (statusCounts['SUBMITTED'] ?? 0) + (statusCounts['RESERVED'] ?? 0),
      awaitingDispatch: statusCounts['READY_FOR_DISPATCH'] ?? 0,
      lowStock,
      totalAvailableBase: totalAvailable,
      nearExpiryLots: nearLots.map(l => ({ id: l.id, lotNo: l.lotNo, product: l.product.name, expiresAt: l.expiresAt, remainingBase: l.remainingQtyBase })),
      expiredLots: expiredLots.map(l => ({ id: l.id, lotNo: l.lotNo, product: l.product.name, expiresAt: l.expiresAt, remainingBase: l.remainingQtyBase })),
      chart,
      visitorPerf,
    })
  })
}
