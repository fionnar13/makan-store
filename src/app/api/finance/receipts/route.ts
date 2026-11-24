// ثبت دریافت از مشتری — Receipt + سند منفی در Ledger مالی (Transaction)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody, clientIp } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { nextNumber } from '@/lib/numbering'
import { audit } from '@/lib/audit'

const receiptSchema = z.object({
  customerId: z.string().min(1, 'انتخاب مشتری الزامی است'),
  amountRls: z.number().int().min(1, 'مبلغ باید عدد صحیح مثبت ریال باشد'),
  method: z.enum(['CASH', 'TRANSFER', 'CHEQUE']).default('CASH'),
  refNo: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'finance.receipts')
    const body = await parseBody(req, receiptSchema)
    const customer = await db.customer.findUnique({ where: { id: body.customerId } })
    if (!customer) throw new ApiError(404, 'NOT_FOUND', 'مشتری یافت نشد')

    const receiptNo = await db.$transaction(async tx => {
      const no = await nextNumber(tx, 'RCP')
      const receipt = await tx.receipt.create({
        data: {
          receiptNo: no, customerId: body.customerId, amountRls: body.amountRls,
          method: body.method, refNo: body.refNo ?? null, note: body.note ?? null,
          userId: user.id,
        },
      })
      await tx.customerLedger.create({
        data: {
          customerId: body.customerId, entryType: 'RECEIPT', amountRls: -body.amountRls,
          refType: 'RECEIPT', refId: receipt.id,
          description: body.note ?? `دریافت ${no} از ${customer.shopName}`,
          userId: user.id,
        },
      })
      return no
    })

    await audit({ userId: user.id, action: 'finance.receipt', entityType: 'Receipt', entityId: receiptNo, after: { customer: customer.code, amountRls: body.amountRls, method: body.method }, ip: clientIp(req) })
    return ok({ receiptNo }, 201)
  })
}
