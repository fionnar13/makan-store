// پیام‌رسانی داخلی — گفت‌وگوی خصوصی؛ ذخیره در Database + اعلان
// (نسخه اول با Polling کوتاه؛ ارتقا به WebSocket/Durable Objects در استقرار Cloudflare مستند شده است)
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { notifyUser } from '@/lib/notify'

export async function GET(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'messages.use')
    const url = new URL(req.url)
    const withUserId = url.searchParams.get('withUserId')

    if (withUserId) {
      const other = await db.user.findUnique({ where: { id: withUserId }, select: { id: true, name: true, isActive: true } })
      if (!other) throw new ApiError(404, 'NOT_FOUND', 'کاربر یافت نشد')
      const msgs = await db.message.findMany({
        where: {
          OR: [
            { senderUserId: user.id, recipientUserId: withUserId },
            { senderUserId: withUserId, recipientUserId: user.id },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 200,
      })
      // علامت‌گذاری پیام‌های خوانده‌نشده دریافت‌شده
      await db.message.updateMany({
        where: { senderUserId: withUserId, recipientUserId: user.id, isRead: false },
        data: { isRead: true },
      })
      return ok({ other, messages: msgs })
    }

    // فهرست مخاطبان — کاربران فعال با مجوز پیام‌رسانی
    const users = await db.user.findMany({
      where: { isActive: true, id: { not: user.id } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    const lastMsgs = await db.message.findMany({
      where: { OR: [{ senderUserId: user.id }, { recipientUserId: user.id }] },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })
    const contacts = users.map(u => {
      const last = lastMsgs.find(m => m.senderUserId === u.id || m.recipientUserId === u.id)
      const unread = lastMsgs.filter(m => m.senderUserId === u.id && m.recipientUserId === user.id && !m.isRead).length
      return { id: u.id, name: u.name, lastBody: last?.body ?? null, lastAt: last?.createdAt ?? null, unread }
    }).sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0))
    return ok(contacts)
  })
}

const sendSchema = z.object({
  recipientUserId: z.string().min(1, 'انتخاب گیرنده الزامی است'),
  body: z.string().min(1, 'متن پیام الزامی است').max(2000, 'متن پیام بیش از حد طولانی است'),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'messages.use')
    const body = await parseBody(req, sendSchema)
    const recipient = await db.user.findUnique({ where: { id: body.recipientUserId } })
    if (!recipient || !recipient.isActive) throw new ApiError(400, 'BAD_RECIPIENT', 'گیرنده معتبر نیست')
    const msg = await db.message.create({
      data: { senderUserId: user.id, recipientUserId: body.recipientUserId, body: body.body },
    })
    await notifyUser(body.recipientUserId, {
      type: 'MESSAGE', title: 'پیام جدید',
      body: `${user.name}: ${body.body.slice(0, 80)}`,
      refType: 'MESSAGE', refId: msg.id,
    })
    return ok({ id: msg.id }, 201)
  })
}
