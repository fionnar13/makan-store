// تأمین‌کنندگان — لیست با مانده حساب (بدهی ما) + ایجاد
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { nextNumber } from '@/lib/numbering'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'suppliers.view')
    const suppliers = await db.supplier.findMany({
      include: {
        ledger: { select: { amountRls: true } },
        _count: { select: { lots: true, payments: true } },
      },
      orderBy: { code: 'asc' },
    })
    const data = suppliers.map(s => ({
      id: s.id, code: s.code, name: s.name, type: s.type,
      phone: s.phone, contactName: s.contactName, address: s.address,
      terms: s.terms, status: s.status, isDemo: s.isDemo,
      balanceRls: s.ledger.reduce((a, l) => a + l.amountRls, 0),
      lotsCount: s._count.lots, paymentsCount: s._count.payments,
      createdAt: s.createdAt,
    }))
    return ok(data)
  })
}

const createSchema = z.object({
  name: z.string().min(2, 'نام تأمین‌کننده الزامی است'),
  type: z.enum(['PRODUCER', 'IMPORTER', 'WHOLESALER']).default('PRODUCER'),
  phone: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'suppliers.manage')
    const body = await parseBody(req, createSchema)
    const supplier = await db.$transaction(async tx => {
      const code = await nextNumber(tx, 'SUP')
      return tx.supplier.create({ data: { code, ...body } })
    })
    await audit({ userId: user.id, action: 'supplier.create', entityType: 'Supplier', entityId: supplier.id, after: { code: supplier.code, name: supplier.name } })
    return ok({ id: supplier.id, code: supplier.code }, 201)
  })
}
