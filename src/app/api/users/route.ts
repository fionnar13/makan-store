// کاربران — مدیریت RBAC
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requireAuth, requirePerm, hashPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  return handler(async () => {
    const me = await requireAuth(req)
    const url = new URL(req.url)
    const role = url.searchParams.get('role') // e.g. DRIVER برای تخصیص ارسال
    const listAllowed = me.permissions.includes('users.manage')
      || me.permissions.includes('deliveries.manage')
      || me.permissions.includes('territories.manage')
    if (!listAllowed) throw new ApiError(403, 'FORBIDDEN', 'دسترسی لازم را ندارید')
    const users = await db.user.findMany({
      where: role ? { roles: { some: { role: { name: role } } } } : undefined,
      include: { roles: { include: { role: { select: { name: true, label: true } } } } },
      orderBy: { createdAt: 'asc' },
    })
    return ok(users.map(u => ({
      id: u.id, phone: u.phone, name: u.name, isActive: u.isActive,
      phoneVerified: u.phoneVerified, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
      avatarUrl: u.avatarUrl,
      roles: u.roles.map(r => ({ name: r.role.name, label: r.role.label })),
      isSelf: u.id === me.id,
    })))
  })
}

const createSchema = z.object({
  phone: z.string().regex(/^09\d{9}$/, 'شماره موبایل معتبر نیست'),
  name: z.string().min(2, 'نام الزامی است'),
  password: z.string().min(6, 'رمز عبور حداقل ۶ کاراکتر است'),
  roleNames: z.array(z.string()).min(1, 'حداقل یک نقش الزامی است'),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const body = await parseBody(req, createSchema)
    const exists = await db.user.findUnique({ where: { phone: body.phone } })
    if (exists) throw new ApiError(409, 'PHONE_EXISTS', 'این شماره قبلاً ثبت شده است')
    const roles = await db.role.findMany({ where: { name: { in: body.roleNames } } })
    if (roles.length !== body.roleNames.length) throw new ApiError(400, 'BAD_ROLE', 'نقش نامعتبر وجود دارد')

    const created = await db.$transaction(async tx => {
      const u = await tx.user.create({
        data: { phone: body.phone, name: body.name, passwordHash: hashPassword(body.password), phoneVerified: true },
      })
      for (const r of roles) await tx.userRole.create({ data: { userId: u.id, roleId: r.id } })
      return u
    })
    await audit({ userId: user.id, action: 'user.create', entityType: 'User', entityId: created.id, after: { phone: created.phone, roles: body.roleNames } })
    return ok({ id: created.id }, 201)
  })
}
