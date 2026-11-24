// ثبت پرداخت — به تأمین‌کننده (با Ledger) یا هزینه/حقوق
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody, clientIp } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { nextNumber } from '@/lib/numbering'
import { audit } from '@/lib/audit'

const paymentSchema = z.object({
  supplierId: z.string().optional().nullable(),
  category: z.enum(['SUPPLIER', 'EXPENSE', 'SALARY']).default('SUPPLIER'),
  amountRls: z.number().int().min(1, 'مبلغ باید عدد صحیح مثبت ریال باشد'),
  method: z.enum(['CASH', 'TRANSFER', 'CHEQUE']).default('CASH'),
  refNo: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'finance.payments')
    const body = await parseBody(req, paymentSchema)
    if (body.category === 'SUPPLIER' && !body.supplierId) {
      throw new ApiError(400, 'SUPPLIER_REQUIRED', 'برای پرداخت به تأمین‌کننده، انتخاب تأمین‌کننده الزامی است')
    }
    let supplier: { id: string; code: string; name: string } | null = null
    if (body.supplierId) {
      const s = await db.supplier.findUnique({ where: { id: body.supplierId } })
      if (!s) throw new ApiError(404, 'NOT_FOUND', 'تأمین‌کننده یافت نشد')
      supplier = s
    }

    const paymentNo = await db.$transaction(async tx => {
      const no = await nextNumber(tx, 'PAY')
      const payment = await tx.payment.create({
        data: {
          paymentNo: no, supplierId: body.supplierId ?? null, category: body.category,
          amountRls: body.amountRls, method: body.method, refNo: body.refNo ?? null,
          note: body.note ?? null, userId: user.id,
        },
      })
      if (supplier) {
        await tx.supplierLedger.create({
          data: {
            supplierId: supplier.id, entryType: 'PAYMENT', amountRls: -body.amountRls,
            refType: 'PAYMENT', refId: payment.id,
            description: body.note ?? `پرداخت ${no} به ${supplier.name}`,
            userId: user.id,
          },
        })
      }
      if (body.category !== 'SUPPLIER') {
        await tx.expense.create({
          data: { category: body.category, amountRls: body.amountRls, description: body.note ?? `${body.category === 'SALARY' ? 'حقوق' : 'هزینه'} — سند ${no}`, userId: user.id },
        })
      }
      return no
    })

    await audit({ userId: user.id, action: 'finance.payment', entityType: 'Payment', entityId: paymentNo, after: { supplier: supplier?.code ?? null, category: body.category, amountRls: body.amountRls }, ip: clientIp(req) })
    return ok({ paymentNo }, 201)
  })
}
