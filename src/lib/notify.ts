// ایجاد اعلان برای کاربرانِ دارای مجوز مشخص یا کاربر مشخص
import { db } from '@/lib/db'

export async function notifyPermissionCodes(
  codes: string[],
  data: { type: string; title: string; body?: string; refType?: string; refId?: string },
) {
  const rolePerms = await db.rolePermission.findMany({
    where: { permission: { code: { in: codes } } },
    select: { roleId: true },
  })
  const roleIds = [...new Set(rolePerms.map(rp => rp.roleId))]
  const users = await db.userRole.findMany({
    where: { roleId: { in: roleIds } },
    select: { userId: true },
  })
  const userIds = [...new Set(users.map(u => u.userId))]
  if (userIds.length === 0) return
  await db.notification.createMany({
    data: userIds.map(userId => ({ userId, ...data })),
  })
}

export async function notifyUser(
  userId: string,
  data: { type: string; title: string; body?: string; refType?: string; refId?: string },
) {
  await db.notification.create({ data: { userId, ...data } })
}
