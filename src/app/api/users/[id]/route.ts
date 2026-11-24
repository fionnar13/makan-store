// ویرایش کاربر — نقش‌ها، فعال‌سازی، تغییر رمز
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm, hashPassword } from '@/lib/auth'
import { audit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
  roleNames: z.array(z.string()).optional(),
})

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const me = await requirePerm(req, 'users.manage')
    const { id } = await ctx.params
    const body = await parseBody(req, patchSchema)
    const before = await db.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'کاربر یافت نشد')

    await db.$transaction(async tx => {
      const data: { name?: string; isActive?: boolean; passwordHash?: string } = {}
      if (body.name) data.name = body.name
      if (body.isActive !== undefined) data.isActive = body.isActive
      if (body.password) data.passwordHash = hashPassword(body.password)
      if (Object.keys(data).length) await tx.user.update({ where: { id }, data })

      if (body.roleNames) {
        const roles = await tx.role.findMany({ where: { name: { in: body.roleNames } } })
        if (roles.length !== body.roleNames.length) throw new ApiError(400, 'BAD_ROLE', 'نقش نامعتبر وجود دارد')
        await tx.userRole.deleteMany({ where: { userId: id } })
        for (const r of roles) await tx.userRole.create({ data: { userId: id, roleId: r.id } })
      }
    })

    // تغییر وضعیت حساس → لغو نشست‌ها
    if (body.isActive === false || body.password) {
      await db.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })
    }

    await audit({
      userId: me.id, action: 'user.update', entityType: 'User', entityId: id,
      before: { isActive: before.isActive, roles: before.roles.map(r => r.role.name) },
      after: { isActive: body.isActive, roles: body.roleNames, passwordChanged: !!body.password },
    })
    return ok({ id })
  })
}
