// حضور و غیاب — ورود/خروج شخصی + گزارش ماهانه
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requireAuth } from '@/lib/auth'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  return handler(async () => {
    const user = await requireAuth(req)
    const url = new URL(req.url)
    const month = url.searchParams.get('month') // YYYY-MM
    const all = url.searchParams.get('all') === '1' && user.permissions.includes('reports.view')

    const ym = month ?? todayStr().slice(0, 7)
    const records = await db.attendance.findMany({
      where: {
        date: { startsWith: ym },
        ...(all ? {} : { userId: user.id }),
      },
      orderBy: { date: 'desc' },
      take: 200,
    })
    const users = all ? await db.user.findMany({ where: { id: { in: [...new Set(records.map(r => r.userId))] } }, select: { id: true, name: true } }) : []
    const userMap = new Map(users.map(u => [u.id, u.name]))
    const today = await db.attendance.findUnique({ where: { userId_date: { userId: user.id, date: todayStr() } } })
    return ok({
      today, month: ym,
      records: records.map(r => ({ ...r, userName: all ? userMap.get(r.userId) ?? r.userId : undefined })),
    })
  })
}

const actionSchema = z.object({
  action: z.enum(['checkIn', 'checkOut', 'setLeave', 'setMission']),
  note: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requireAuth(req)
    const body = await parseBody(req, actionSchema)
    const date = todayStr()
    const existing = await db.attendance.findUnique({ where: { userId_date: { userId: user.id, date } } })

    if (body.action === 'checkIn') {
      if (existing?.checkInAt) throw new ApiError(409, 'BAD_STATE', 'ورود امروز قبلاً ثبت شده است')
      await db.attendance.upsert({
        where: { userId_date: { userId: user.id, date } },
        update: { checkInAt: new Date(), status: 'PRESENT', note: body.note ?? existing?.note ?? null },
        create: { userId: user.id, date, checkInAt: new Date(), status: 'PRESENT', note: body.note ?? null },
      })
      return ok({ action: 'checkIn' }, 201)
    }
    if (body.action === 'checkOut') {
      if (!existing?.checkInAt) throw new ApiError(409, 'BAD_STATE', 'ابتدا ورود را ثبت کنید')
      if (existing.checkOutAt) throw new ApiError(409, 'BAD_STATE', 'خروج امروز قبلاً ثبت شده است')
      await db.attendance.update({ where: { id: existing.id }, data: { checkOutAt: new Date() } })
      return ok({ action: 'checkOut' }, 201)
    }
    // مرخصی/مأموریت — ثبت توسط خود کاربر، تأیید مدیر در گزارش
    await db.attendance.upsert({
      where: { userId_date: { userId: user.id, date } },
      update: { status: body.action === 'setLeave' ? 'LEAVE' : 'MISSION', note: body.note ?? null },
      create: { userId: user.id, date, status: body.action === 'setLeave' ? 'LEAVE' : 'MISSION', note: body.note ?? null },
    })
    return ok({ action: body.action }, 201)
  })
}
