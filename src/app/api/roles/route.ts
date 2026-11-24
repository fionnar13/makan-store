// نقش‌ها و مجوزها — برای نمایش ماتریس دسترسی
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok } from '@/lib/api'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requireAuth(req)
    const roles = await db.role.findMany({
      include: { perms: { include: { permission: { select: { code: true, label: true } } } }, _count: { select: { users: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const permissions = await db.permission.findMany({ orderBy: { code: 'asc' } })
    return ok({
      roles: roles.map(r => ({
        id: r.id, name: r.name, label: r.label, isSystem: r.isSystem,
        usersCount: r._count.users,
        permissions: r.perms.map(p => p.permission.code),
      })),
      permissions: permissions.map(p => ({ code: p.code, label: p.label })),
    })
  })
}
