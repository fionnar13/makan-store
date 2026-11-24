// مناطق فروش — بدون حدس GIS؛ ترسیم/ورود رسمی GeoJSON توسط مدیر
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'customers.view')
    const territories = await db.territory.findMany({
      include: { _count: { select: { customers: true } } },
      orderBy: { code: 'asc' },
    })
    const visitorIds = territories.map(t => t.visitorId).filter(Boolean) as string[]
    const visitors = visitorIds.length ? await db.user.findMany({ where: { id: { in: visitorIds } }, select: { id: true, name: true } }) : []
    const vMap = new Map(visitors.map(v => [v.id, v.name]))
    return ok(territories.map(t => ({
      id: t.id, code: t.code, name: t.name,
      polygonJson: t.polygonJson, isActive: t.isActive, note: t.note,
      visitorId: t.visitorId, visitorName: t.visitorId ? vMap.get(t.visitorId) ?? null : null,
      customersCount: t._count.customers,
      hasPolygon: !!t.polygonJson,
      createdAt: t.createdAt,
    })))
  })
}

const createSchema = z.object({
  code: z.string().min(1, 'کد منطقه الزامی است'),
  name: z.string().min(2, 'نام منطقه الزامی است'),
  polygonJson: z.string().optional().nullable(),
  visitorId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'territories.manage')
    const body = await parseBody(req, createSchema)
    if (body.polygonJson) {
      // اعتبارسنجی GeoJSON واقعی — حدس و داده ساختگی ممنوع
      try {
        const geo = JSON.parse(body.polygonJson)
        if (geo.type !== 'FeatureCollection' && geo.type !== 'Feature' && geo.type !== 'Polygon') {
          throw new Error('type')
        }
      } catch {
        throw new ApiError(400, 'BAD_GEOJSON', 'متن واردشده GeoJSON معتبر نیست (Polygon / Feature / FeatureCollection)')
      }
    }
    const exists = await db.territory.findUnique({ where: { code: body.code } })
    if (exists) throw new ApiError(409, 'CODE_EXISTS', 'کد منطقه تکراری است')
    const t = await db.territory.create({
      data: {
        code: body.code, name: body.name,
        polygonJson: body.polygonJson ?? null,
        visitorId: body.visitorId ?? null, note: body.note ?? null,
      },
    })
    await audit({ userId: user.id, action: 'territory.create', entityType: 'Territory', entityId: t.id, after: { code: t.code } })
    return ok({ id: t.id }, 201)
  })
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  polygonJson: z.string().optional().nullable(),
  visitorId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  note: z.string().optional().nullable(),
})

export async function PATCH(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'territories.manage')
    const body = await parseBody(req, patchSchema)
    const before = await db.territory.findUnique({ where: { id: body.id } })
    if (!before) throw new ApiError(404, 'NOT_FOUND', 'منطقه یافت نشد')
    if (body.polygonJson) {
      try {
        const geo = JSON.parse(body.polygonJson)
        if (geo.type !== 'FeatureCollection' && geo.type !== 'Feature' && geo.type !== 'Polygon') throw new Error('type')
      } catch {
        throw new ApiError(400, 'BAD_GEOJSON', 'متن واردشده GeoJSON معتبر نیست')
      }
    }
    const { id, ...data } = body
    await db.territory.update({ where: { id }, data })
    await audit({ userId: user.id, action: 'territory.update', entityType: 'Territory', entityId: id, before: { visitorId: before.visitorId, isActive: before.isActive }, after: data })
    return ok({ id })
  })
}
