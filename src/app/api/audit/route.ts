// Audit Log — ردپای عملیات حساس
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok } from '@/lib/api'
import { requirePerm } from '@/lib/auth'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'audit.view')
    const url = new URL(req.url)
    const take = Math.min(parseInt(url.searchParams.get('take') ?? '150', 10), 500)
    const rows = await db.auditLog.findMany({
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    })
    return ok(rows.map(r => ({
      id: r.id, user: r.user ? { name: r.user.name, phone: r.user.phone } : null,
      action: r.action, entityType: r.entityType, entityId: r.entityId,
      beforeJson: r.beforeJson, afterJson: r.afterJson,
      ip: r.ip, result: r.result, createdAt: r.createdAt,
    })))
  })
}
