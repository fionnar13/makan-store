// تعدیل موجودی — با دلیل الزامی و ثبت Ledger
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody, clientIp } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { adjustStock } from '@/lib/inventory'
import { audit } from '@/lib/audit'

const adjustSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  deltaBase: z.number().int().refine(v => v !== 0, 'مقدار تعدیل نباید صفر باشد'),
  reason: z.string().min(3, 'دلیل تعدیل الزامی است'),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'inventory.adjust')
    const body = await parseBody(req, adjustSchema)
    await db.$transaction(async tx => {
      await adjustStock(tx, body, { userId: user.id, refType: 'ADJUST' })
    })
    await audit({
      userId: user.id, action: 'inventory.adjust', entityType: 'InventoryBalance',
      entityId: `${body.productId}@${body.warehouseId}`, after: { deltaBase: body.deltaBase, reason: body.reason }, ip: clientIp(req),
    })
    return ok({ ok: true }, 201)
  })
}
