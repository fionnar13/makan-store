// ثبت رویدادهای Audit — بدون رمز/توکن/اطلاعات محرمانه
import { db } from '@/lib/db'

export async function audit(entry: {
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  ip?: string | null
  result?: 'SUCCESS' | 'DENIED' | 'ERROR'
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        beforeJson: entry.before !== undefined ? JSON.stringify(entry.before) : null,
        afterJson: entry.after !== undefined ? JSON.stringify(entry.after) : null,
        ip: entry.ip ?? null,
        result: entry.result ?? 'SUCCESS',
      },
    })
  } catch (e) {
    // Audit هرگز نباید جریان اصلی را بشکند، اما خطا لاگ می‌شود
    console.error('[AUDIT_FAIL]', e)
  }
}
