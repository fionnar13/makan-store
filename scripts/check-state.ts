import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const cats = await db.category.findMany({ include: { brands: { select: { name: true } }, _count: { select: { products: true } } } })
for (const c of cats) console.log(`دسته: ${c.name} | محصولات: ${c._count.products} | برندها: ${c.brands.map(b => b.name).join('، ')}`)
console.log('---')
const prods = await db.product.findMany({ select: { sku: true, name: true, imageUrl: true, brand: { select: { name: true, isConfirmed: true } }, category: { select: { name: true } }, units: { select: { name: true, factor: true, isBase: true, priceRules: { where: { scope: 'DEFAULT' }, select: { priceRls: true } } } }, balances: { select: { physicalQtyBase: true } } } })
for (const p of prods) console.log(`${p.sku} | ${p.name} | برند: ${p.brand?.name} | ${p.category?.name} | تصویر: ${p.imageUrl} | واحد: ${p.units.map(u => `${u.name}${u.isBase ? '*' : ''}:${u.priceRules[0]?.priceRls ?? '-'}(${u.factor}x)`).join(' / ')} | موجودی: ${p.balances[0]?.physicalQtyBase ?? 0}`)
await db.$disconnect()
