// مشتریان عمده — لیست با مانده حساب از Ledger + ایجاد مشتری جدید
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { nextNumber } from '@/lib/numbering'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'customers.view')
    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim()

    const customers = await db.customer.findMany({
      where: q ? { OR: [{ shopName: { contains: q } }, { code: { contains: q } }, { phone: { contains: q } }, { ownerName: { contains: q } }] } : undefined,
      include: {
        territory: { select: { name: true } },
        _count: { select: { branches: true, orders: true } },
        ledger: { select: { amountRls: true } },
      },
      orderBy: { code: 'asc' },
    })

    const data = customers.map(c => {
      const balanceRls = c.ledger.reduce((s, l) => s + l.amountRls, 0)
      return {
        id: c.id, code: c.code, shopName: c.shopName,
        businessType: c.businessType, groupKey: c.groupKey,
        ownerName: c.ownerName, phone: c.phone, address: c.address,
        creditLimitRls: c.creditLimitRls, creditDays: c.creditDays,
        status: c.status, isDemo: c.isDemo, salesRepId: c.salesRepId,
        territory: c.territory?.name ?? null,
        branchesCount: c._count.branches, ordersCount: c._count.orders,
        balanceRls, remainingCreditRls: c.creditLimitRls - balanceRls,
        createdAt: c.createdAt,
      }
    })
    return ok(data)
  })
}

const createSchema = z.object({
  shopName: z.string().min(2, 'نام فروشگاه الزامی است'),
  businessType: z.enum(['GROCERY', 'SUPERMARKET', 'OTHER']).default('GROCERY'),
  groupKey: z.enum(['REGULAR', 'GOLD', 'WHOLESALE']).default('REGULAR'),
  ownerName: z.string().optional().nullable(),
  phone: z.string().min(8, 'شماره تماس الزامی است'),
  address: z.string().optional().nullable(),
  territoryId: z.string().optional().nullable(),
  creditLimitRls: z.number().int().min(0).default(0),
  creditDays: z.number().int().min(0).default(0),
  branches: z.array(z.object({
    name: z.string().min(2),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
  })).min(1, 'حداقل یک شعبه الزامی است'),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'customers.manage')
    const body = await parseBody(req, createSchema)

    const customer = await db.$transaction(async tx => {
      const code = await nextNumber(tx, 'CUS')
      const created = await tx.customer.create({
        data: {
          code, shopName: body.shopName, businessType: body.businessType,
          groupKey: body.groupKey, ownerName: body.ownerName ?? null,
          phone: body.phone, address: body.address ?? null,
          territoryId: body.territoryId ?? null,
          creditLimitRls: body.creditLimitRls, creditDays: body.creditDays,
          salesRepId: body.territoryId
            ? (await tx.territory.findUnique({ where: { id: body.territoryId } }))?.visitorId ?? null
            : null,
          createdById: user.id,
        },
      })
      for (const b of body.branches) {
        await tx.customerBranch.create({
          data: { customerId: created.id, name: b.name, address: b.address ?? null, phone: b.phone ?? null },
        })
      }
      return created
    })

    await audit({ userId: user.id, action: 'customer.create', entityType: 'Customer', entityId: customer.id, after: { code: customer.code, shopName: customer.shopName } })
    return ok({ id: customer.id, code: customer.code }, 201)
  })
}
