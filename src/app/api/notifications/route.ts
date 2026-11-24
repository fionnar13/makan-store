// اعلان‌ها — لیست، شمارش خوانده‌نشده و علامت‌گذاری
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseBody } from '@/lib/api'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  return handler(async () => {
    const user = await requireAuth(req)
    const url = new URL(req.url)
    const take = Math.min(parseInt(url.searchParams.get('take') ?? '30', 10), 100)
    const [items, unread] = await Promise.all([
      db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take }),
      db.notification.count({ where: { userId: user.id, isRead: false } }),
    ])
    return ok({ items, unread })
  })
}

const markSchema = z.object({
  ids: z.array(z.string()).optional().nullable(),
  all: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requireAuth(req)
    const body = await parseBody(req, markSchema)
    if (body.all) {
      await db.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } })
    } else if (body.ids?.length) {
      await db.notification.updateMany({ where: { userId: user.id, id: { in: body.ids } }, data: { isRead: true } })
    }
    const unread = await db.notification.count({ where: { userId: user.id, isRead: false } })
    return ok({ unread })
  })
}
