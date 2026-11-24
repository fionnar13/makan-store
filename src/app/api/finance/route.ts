// مالی — خلاصه، گردش حساب مشتریان، دریافت‌ها و پرداخت‌ها
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ApiError, handler, ok } from '@/lib/api'
import { requirePerm } from '@/lib/auth'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'finance.view')
    const url = new URL(req.url)
    const type = url.searchParams.get('type') ?? 'summary'
    const now = new Date()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    if (type === 'ledger') {
      const customerId = url.searchParams.get('customerId')
      if (!customerId) throw new ApiError(400, 'BAD_PARAMS', 'انتخاب مشتری الزامی است')
      const [customer, entries] = await Promise.all([
        db.customer.findUnique({ where: { id: customerId }, select: { id: true, code: true, shopName: true, creditLimitRls: true, creditDays: true } }),
        db.customerLedger.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } }),
      ])
      if (!customer) throw new ApiError(404, 'NOT_FOUND', 'مشتری یافت نشد')
      let running = 0
      const rows = entries.map(e => { running += e.amountRls; return { ...e, balanceAfterRls: running } })
      return ok({ customer, entries: rows.reverse().slice(0, 200), balanceRls: running })
    }

    if (type === 'receipts') {
      const take = Math.min(parseInt(url.searchParams.get('take') ?? '100', 10), 300)
      const receipts = await db.receipt.findMany({
        include: { customer: { select: { code: true, shopName: true } } },
        orderBy: { createdAt: 'desc' }, take,
      })
      return ok(receipts)
    }

    if (type === 'payments') {
      const take = Math.min(parseInt(url.searchParams.get('take') ?? '100', 10), 300)
      const payments = await db.payment.findMany({
        include: { supplier: { select: { code: true, name: true } } },
        orderBy: { createdAt: 'desc' }, take,
      })
      return ok(payments)
    }

    // summary
    const [monthReceipts, monthPayments, monthExpenses, ledgerGroups, supplierLedgers, overdueCandidates] = await Promise.all([
      db.receipt.aggregate({ where: { createdAt: { gte: startMonth } }, _sum: { amountRls: true }, _count: true }),
      db.payment.aggregate({ where: { createdAt: { gte: startMonth } }, _sum: { amountRls: true }, _count: true }),
      db.expense.aggregate({ where: { createdAt: { gte: startMonth } }, _sum: { amountRls: true } }),
      db.customerLedger.groupBy({ by: ['customerId'], _sum: { amountRls: true } }),
      db.supplierLedger.groupBy({ by: ['supplierId'], _sum: { amountRls: true } }),
      db.customer.findMany({
        where: { creditDays: { gt: 0 } },
        select: {
          id: true, code: true, shopName: true, creditDays: true, creditLimitRls: true,
          ledger: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, amountRls: true } },
        },
      }),
    ])

    const supplierIds = supplierLedgers.map(s => s.supplierId)
    const suppliers = supplierIds.length ? await db.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, code: true, name: true } }) : []

    // مطالبات سررسیدشده — تقریب: مانده مثبت مشتری‌ای که آخرین گردش منفی (پرداخت) قدیمی‌تر از creditDays است
    const nowMs = now.getTime()
    const overdue = overdueCandidates
      .map(c => {
        const bal = ledgerGroups.find(g => g.customerId === c.id)?._sum.amountRls ?? 0
        const last = c.ledger[0]
        const dueMs = last ? last.createdAt.getTime() + c.creditDays * 86400000 : 0
        return bal > 0 && dueMs > 0 && dueMs < nowMs
          ? { id: c.id, code: c.code, shopName: c.shopName, creditDays: c.creditDays, overdueRls: bal, lastActivityAt: last?.createdAt ?? null }
          : null
      })
      .filter(Boolean) as Array<{ id: string; code: string; shopName: string; creditDays: number; overdueRls: number; lastActivityAt: Date | null }>

    return ok({
      monthReceiptsRls: monthReceipts._sum.amountRls ?? 0,
      monthReceiptsCount: monthReceipts._count,
      monthPaymentsRls: monthPayments._sum.amountRls ?? 0,
      monthPaymentsCount: monthPayments._count,
      monthExpensesRls: monthExpenses._sum.amountRls ?? 0,
      totalDebtRls: ledgerGroups.reduce((s, g) => s + Math.max(g._sum.amountRls ?? 0, 0), 0),
      overdue: overdue.sort((a, b) => b.overdueRls - a.overdueRls),
      suppliers: suppliers.map(s => ({
        ...s,
        balanceRls: supplierLedgers.find(g => g.supplierId === s.id)?._sum.amountRls ?? 0,
      })),
    })
  })
}
