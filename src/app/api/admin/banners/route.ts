// بنرهای هیرو اسلایدشو صفحه فروشگاه — مدیریت فقط با مجوز users.manage
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseBody } from '@/lib/api'
import { requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'users.manage')
    const banners = await db.banner.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
    return ok(banners)
  })
}

const createSchema = z.object({
  imageUrl: z.string().trim().min(1, 'تصویر بنر الزامی است').max(300).refine(v => v.startsWith('/uploads/banners/'), 'نشانی تصویر بنر نامعتبر است'),
  title: z.string().trim().max(80, 'عنوان حداکثر ۸۰ کاراکتر است').optional(),
  subtitle: z.string().trim().max(160, 'زیرعنوان حداکثر ۱۶۰ کاراکتر است').optional(),
  linkUrl: z.string().trim().max(300).optional(),
  linkLabel: z.string().trim().max(40, 'متن دکمه حداکثر ۴۰ کاراکتر است').optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'users.manage')
    const body = await parseBody(req, createSchema)

    const created = await db.banner.create({
      data: {
        imageUrl: body.imageUrl,
        title: body.title || null,
        subtitle: body.subtitle || null,
        linkUrl: body.linkUrl || null,
        linkLabel: body.linkLabel || null,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
      },
    })

    await audit({
      userId: user.id, action: 'banner.create', entityType: 'Banner', entityId: created.id,
      after: { imageUrl: created.imageUrl, title: created.title, sortOrder: created.sortOrder },
    })
    return ok(created, 201)
  })
}
