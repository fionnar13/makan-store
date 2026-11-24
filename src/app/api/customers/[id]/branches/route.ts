// افزودن شعبه به مشتری
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const createSchema = z.object({
  name: z.string().min(2, 'نام شعبه الزامی است'),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  managerName: z.string().optional().nullable(),
  workingHours: z.string().optional().nullable(),
})

export async function POST(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requirePerm(req, 'customers.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, createSchema)
    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) throw new ApiError(404, 'NOT_FOUND', 'مشتری یافت نشد')
    const branch = await db.customerBranch.create({ data: { customerId: id, ...body } })
    await audit({ userId: user.id, action: 'customerBranch.create', entityType: 'CustomerBranch', entityId: branch.id, after: { customerId: id, name: branch.name } })
    return ok({ id: branch.id }, 201)
  })
}
