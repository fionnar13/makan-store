// کاتالوگ محصولات — لیست با واحدها، قیمت پیش‌فرض و موجودی قابل فروش انبار پیش‌فرض
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ApiError, handler, ok, parseBody } from '@/lib/api'
import { requireAuth, requirePerm } from '@/lib/auth'
import { audit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'products.view')
    const url = new URL(req.url)

    // meta=1 — فقط دسته‌بندی‌ها و برندها برای فرم‌ها (بدون لیست محصولات)
    // برندها وابسته به دسته‌بندی هستند تا در فرم‌ها بتوان لیست برند را بر اساس دسته فیلتر کرد
    if (url.searchParams.get('meta') === '1') {
      const [categories, brands] = await Promise.all([
        db.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
        db.brand.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true, isConfirmed: true, categoryId: true, category: { select: { name: true } } },
        }),
      ])
      return ok({
        categories,
        brands: brands.map(b => ({ id: b.id, name: b.name, isConfirmed: b.isConfirmed, categoryId: b.categoryId, categoryName: b.category?.name ?? null })),
      })
    }

    const q = url.searchParams.get('q')?.trim()
    const wh = await db.warehouse.findFirst({ where: { isDefault: true } })

    const products = await db.product.findMany({
      where: q ? { OR: [{ name: { contains: q } }, { sku: { contains: q } }] } : undefined,
      include: {
        brand: { select: { name: true, isConfirmed: true } },
        category: { select: { name: true } },
        units: { orderBy: { factor: 'asc' } },
        balances: wh ? { where: { warehouseId: wh.id } } : true,
      },
      orderBy: { createdAt: 'asc' },
    })

    // قیمت عمومی (scope=DEFAULT) هر واحد فروش — همان قیمتی که ویزیتور به مشتری نشان می‌دهد
    // برای نمای فروشگاهی و مقایسه محصولات؛ قیمت اختصاصی هر مشتری در لحظه ثبت سفارش resolve می‌شود
    const defaultPrices = products.length ? await db.priceRule.findMany({
      where: { scope: 'DEFAULT', isActive: true, productId: { in: products.map(p => p.id) } },
      select: { unitId: true, priceRls: true, minQtyBase: true },
    }) : []
    const priceByUnit = new Map<string, { priceRls: number; minQtyBase: number }>()
    for (const r of defaultPrices) {
      const cur = priceByUnit.get(r.unitId)
      // عمومی‌ترین قاعده: کمترین حداقل مقدار؛ در تساوی، قیمت کمتر
      if (!cur || r.minQtyBase < cur.minQtyBase || (r.minQtyBase === cur.minQtyBase && r.priceRls < cur.priceRls)) {
        priceByUnit.set(r.unitId, { priceRls: r.priceRls, minQtyBase: r.minQtyBase })
      }
    }

    const data = products.map(p => ({
      id: p.id, sku: p.sku, name: p.name, description: p.description,
      categoryId: p.categoryId, brandId: p.brandId, imageUrl: p.imageUrl,
      createdAt: p.createdAt,
      brand: p.brand?.name ?? null, brandConfirmed: p.brand?.isConfirmed ?? false,
      category: p.category?.name ?? null,
      baseUnitName: p.baseUnitName, weightG: p.weightG, volumeMl: p.volumeMl,
      packagingType: p.packagingType, minOrderQtyBase: p.minOrderQtyBase,
      orderMultipleBase: p.orderMultipleBase, reorderPointBase: p.reorderPointBase,
      isActive: p.isActive, isDemo: p.isDemo,
      availableBase: p.balances[0] ? p.balances[0].physicalQtyBase - p.balances[0].reservedQtyBase : 0,
      physicalBase: p.balances[0]?.physicalQtyBase ?? 0,
      reservedBase: p.balances[0]?.reservedQtyBase ?? 0,
      units: p.units.map(u => ({
        id: u.id, name: u.name, factor: u.factor, isBase: u.isBase, barcode: u.barcode,
        defaultPriceRls: priceByUnit.get(u.id)?.priceRls ?? null,
      })),
    }))
    return ok(data)
  })
}

const unitSchema = z.object({
  name: z.string().min(2, 'نام واحد الزامی است'),
  factor: z.number().int().min(1, 'فاکتور باید حداقل ۱ باشد'),
  isBase: z.boolean().default(false),
  barcode: z.string().optional().nullable(),
  priceRls: z.number().int().min(0).optional().nullable(),
})

const createSchema = z.object({
  sku: z.string().min(2, 'SKU الزامی است'),
  name: z.string().min(3, 'نام محصول الزامی است'),
  description: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  imageUrl: z.string().url('آدرس تصویر معتبر نیست').optional().nullable(),
  weightG: z.number().int().min(0).optional().nullable(),
  volumeMl: z.number().int().min(0).optional().nullable(),
  packagingType: z.string().optional().nullable(),
  minOrderQtyBase: z.number().int().min(1).default(1),
  orderMultipleBase: z.number().int().min(1).default(1),
  reorderPointBase: z.number().int().min(0).default(50),
  isActive: z.boolean().default(true),
  isDemo: z.boolean().default(false),
  units: z.array(unitSchema).min(1, 'حداقل یک واحد فروش الزامی است'),
})

export async function POST(req: NextRequest) {
  return handler(async () => {
    const user = await requirePerm(req, 'products.manage')
    const body = await parseBody(req, createSchema)
    const exists = await db.product.findUnique({ where: { sku: body.sku } })
    if (exists) throw new ApiError(409, 'SKU_EXISTS', 'این SKU قبلاً ثبت شده است')

    const product = await db.$transaction(async tx => {
      const created = await tx.product.create({
        data: {
          sku: body.sku, name: body.name, description: body.description ?? null,
          brandId: body.brandId ?? null, categoryId: body.categoryId ?? null,
          imageUrl: body.imageUrl ?? null,
          weightG: body.weightG ?? null, volumeMl: body.volumeMl ?? null,
          packagingType: body.packagingType ?? null,
          minOrderQtyBase: body.minOrderQtyBase, orderMultipleBase: body.orderMultipleBase,
          reorderPointBase: body.reorderPointBase, isActive: body.isActive, isDemo: body.isDemo,
          baseUnitName: body.units.find(u => u.isBase)?.name ?? body.units[0].name,
        },
      })
      for (const u of body.units) {
        const unit = await tx.productUnit.create({
          data: { productId: created.id, name: u.name, factor: u.factor, isBase: u.isBase, barcode: u.barcode ?? null },
        })
        if (u.priceRls != null && u.priceRls > 0) {
          await tx.priceRule.create({
            data: {
              productId: created.id, unitId: unit.id, scope: 'DEFAULT',
              priceRls: u.priceRls, minQtyBase: 1,
              note: body.isDemo ? 'DEMO_SEED — قیمت نمونه؛ نیازمند تأیید/اصلاح مدیر' : null,
            },
          })
        }
      }
      return created
    })

    await audit({ userId: user.id, action: 'product.create', entityType: 'Product', entityId: product.id, after: { sku: product.sku } })
    return ok({ id: product.id }, 201)
  })
}
