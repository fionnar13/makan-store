// بازدیدها — ثبت بازدید، پایان بازدید با نتیجه؛ سه رویداد مستقل: بازدید/سفارش/وصول
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { VISIT_RESULT_LABELS } from '@/lib/format'

export async function GET(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'visits.view')
    const url = new URL(req.url)
    const mine = url.searchParams.get('mine') === '1'
    // ویزیتور فقط بازدیدهای خودش را می‌بیند (کنترل سمت سرور)
    const onlySelf = mine || (!user.permissions.includes('reports.view') && user.permissions.includes('visits.manage'))
    const take = Math.min(parseInt(url.searchParams.get('take') ?? '100', 10), 300)
    const visits = await db.visit.findMany({
      where: onlySelf ? { visitorId: user.id } : undefined,
      include: {
        customer: { select: { code: true, shopName: true } },
      },
      orderBy: { startedAt: 'desc' },
      take,
    })
    return ok(visits.map(v => ({
      id: v.id, customer: v.customer, branchId: v.branchId,
      startedAt: v.startedAt, endedAt: v.endedAt,
      result: v.result, resultLabel: v.result ? VISIT_RESULT_LABELS[v.result] ?? v.result : null,
      noOrderReason: v.noOrderReason, note: v.note, lat: v.lat, lng: v.lng,
    })))
  })
}

const createSchema = z.object({
  customerId: z.string().min(1, 'انتخاب مشتری الزامی است'),
  branchId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'visits.manage')
    const body = await parseBody(req, createSchema)
    const customer = await db.customer.findUnique({ where: { id: body.customerId } })
    if (!customer) throw new ApiError(404, 'NOT_FOUND', 'مشتری یافت نشد')
    if (body.branchId) {
      const b = await db.customerBranch.findUnique({ where: { id: body.branchId } })
      if (!b || b.customerId !== customer.id) throw new ApiError(400, 'BAD_BRANCH', 'شعبه معتبر نیست')
    }
    const visit = await db.visit.create({
      data: {
        visitorId: user.id, customerId: body.customerId, branchId: body.branchId ?? null,
        note: body.note ?? null, lat: body.lat ?? null, lng: body.lng ?? null,
      },
    })
    await audit({ userId: user.id, action: 'visit.start', entityType: 'Visit', entityId: visit.id, after: { customer: customer.code } })
    return ok({ id: visit.id }, 201)
  })
}
