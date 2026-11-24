// پایان بازدید با ثبت نتیجه
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requireAuth } from '@/lib/auth'
import { audit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

const patchSchema = z.object({
  result: z.enum(['ORDERED', 'PAYMENT_COLLECTED', 'NO_ORDER', 'NOT_PRESENT']),
  noOrderReason: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
})

export async function PATCH(req: NextRequest, ctx: Ctx) {
  return handler(async () => {
    const user = await requireAuth(req)
    const { id } = await ctx.params
    const body = await parseBody(req, patchSchema)
    const visit = await db.visit.findUnique({ where: { id } })
    if (!visit) throw new ApiError(404, 'NOT_FOUND', 'بازدید یافت نشد')
    // فقط ویزیتورِ همان بازدید یا مدیر (سطح دسترسی سمت سرور)
    if (visit.visitorId !== user.id && !user.permissions.includes('reports.view')) {
      throw new ApiError(403, 'FORBIDDEN', 'اجازه ویرایش این بازدید را ندارید')
    }
    if (visit.endedAt) throw new ApiError(409, 'BAD_STATE', 'این بازدید قبلاً پایان یافته است')
    await db.visit.update({
      where: { id },
      data: { endedAt: new Date(), result: body.result, noOrderReason: body.noOrderReason ?? null, note: body.note ?? visit.note, lat: body.lat ?? visit.lat, lng: body.lng ?? visit.lng },
    })
    await audit({ userId: user.id, action: 'visit.end', entityType: 'Visit', entityId: id, after: { result: body.result } })
    return ok({ id })
  })
}
