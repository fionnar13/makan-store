/**
 * مهاجرت: اتصال تصاویر واقعی محصولات + داده‌های کامل هر تصویر به فروشگاه
 * اجرا: DATABASE_URL="file:/home/z/my-project/db/custom.db" bun scripts/product-images-data.ts
 *
 * کارها:
 *  ۱) اتصال تصویر و تکمیل داده‌ها (نام، توضیح، وزن/حجم، بسته‌بندی) برای ۹ محصول DEMO موجود
 *  ۲) تغییرنام برندها مطابق برچسب واقعی تصاویر: مت→میت، واریان→وای، سان‌سان→سانی نایس
 *  ۳) برندهای جدید: ویتامین ۲۴، هیرو، رزوتی، اورانوس، بمدیس، دست‌چین
 *  ۴) دو دسته جدید: کمپوت میوه، سرکه و آبلیمو
 *  ۵) ثبت ۷ محصول جدید (هیرو، رزوتی، اورانوس، کمپوت گیلاس، سرکه سیب، سرکه انگوری، آبلیمو)
 *     همراه واحد فروش، قیمت عمومی DEFAULT، لات انبار DEMO_SEED و موجودی
 *  Idempotent — اجرای مکرر داده تکراری نمی‌سازد
 */
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const db = new PrismaClient()

const IMG = '/products/'

type UnitRenameDef = { old: string; name: string }
type UpdateDef = {
  sku: string
  name: string
  imageUrl: string
  desc: string
  weightG?: number
  volumeMl?: number
  packaging?: string
  brand?: string
  units?: UnitRenameDef[]
}
type NewUnitDef = { name: string; factor: number; isBase?: boolean; price?: number }
type NewDef = {
  sku: string
  name: string
  imageUrl: string
  desc: string
  brand: string
  brandConfirmed?: boolean
  category: string
  weightG?: number
  volumeMl?: number
  packaging: string
  reorder: number
  units: NewUnitDef[]
}

const seedNote = 'DEMO_SEED — قیمت نمونه؛ نیازمند تأیید/اصلاح مدیر'
const DEMO_EXPIRY = new Date('2027-11-22T00:00:00.000Z')
const DEMO_LOT_QTY = 100

// ─── ۱) به‌روزرسانی ۹ محصول موجود ───
const UPDATES: UpdateDef[] = [
  {
    sku: 'TOM-CC-800',
    name: 'رب گوجه‌فرنگی چین‌چین — شیشه ۷۰۰ گرمی',
    imageUrl: IMG + 'tomato-paste-chinchin.jpg',
    desc: 'رب گوجه‌فرنگی غلیظ چین‌چین در شیشه‌ای دربِ فلزی؛ تهیه‌شده از گوجه‌فرنگی رسیده تازه با رنگ و عطر کاملاً طبیعی، بدون افزودن رنگ و نگهدارنده. مناسب انواع خورشت، دُم‌پخت و غذاهای خانگی. عرضه عمده در کارتن ۲۴ عددی برای بنکداران و فروشگاه‌ها.',
    weightG: 700, packaging: 'شیشه/کارتن',
    units: [{ old: 'قوطی ۸۰۰ گرمی', name: 'شیشه ۷۰۰ گرمی' }],
  },
  {
    sku: 'TOM-MT-800',
    name: 'رب گوجه‌فرنگی میت (DIMOMET) — شیشه ۸۰۰ گرمی',
    imageUrl: IMG + 'tomato-paste-mit.jpg',
    desc: 'رب گوجه‌فرنگی میت (DIMOMET) تولیدی Mataim در شیشه ۸۰۰ گرمی؛ رنگ درخشان، غلظت مناسب و طعم گوجه‌فرنگی رسیده. انتخاب اقتصادی و پرتکرار برای سبد مصرف خانوار و مصارف صنفی.',
    weightG: 800, packaging: 'شیشه/کارتن',
    units: [{ old: 'قوطی ۸۰۰ گرمی', name: 'شیشه ۸۰۰ گرمی' }],
  },
  {
    sku: 'TOM-SPD-800',
    name: 'رب گوجه‌فرنگی اسپادانا — قوطی ۸۰۰ گرمی',
    imageUrl: IMG + 'tomato-paste-spadana.jpg',
    desc: 'کنسرو رب گوجه‌فرنگی اسپادانا در قوطی ۸۰۰ گرمی با درپوش پلاستیکی؛ بریکس بالا، رنگ طبیعی و ماندگاری مطمئن. مناسب رستوران، آشپزخانه صنعتی و مصرف روزانه خانگی.',
    weightG: 800, packaging: 'قوطی/کارتن',
  },
  {
    sku: 'TUN-BBR-180',
    name: 'تن ماهی بابارار در روغن گیاهی — قوطی ۱۸۰ گرمی',
    imageUrl: IMG + 'tuna-babarar-180.jpg',
    desc: 'تن ماهی بابارار (BABARAR) در روغن گیاهی، قوطی ۱۸۰ گرمی؛ گوشت سفید تُن بافت‌دار، سرشار از پروتئین و امگا۳. آماده مصرف در سالاد، ساندویچ و نان‌و‌پنیر؛ ماندگاری بالا در دمای محیط.',
    weightG: 180, packaging: 'قوطی/کارتن',
  },
  {
    sku: 'CNS-ENT-LQ-400',
    name: 'کنسرو لوبیا چیتی با قارچ انتخاب — قوطی ۴۰۰ گرمی',
    imageUrl: IMG + 'beans-mushroom-entekhab.jpg',
    desc: 'کنسرو لوبیا چیتی با قارچ انتخاب (ENTEKHAB) قوطی ۴۰۰ گرمی؛ دانه‌های لوبیای یکدست با سس گوجه‌فرنگی خوش‌طعم و تکه‌های قارچ تازه. غذای آماده و پرطرفدار قفسه فروشگاه‌ها.',
    weightG: 400, packaging: 'قوطی/کارتن',
  },
  {
    sku: 'CNS-VAR-LC-400',
    name: 'کنسرو لوبیا چیتی وای در سس گوجه‌فرنگی — قوطی ۳۳۸ گرمی',
    imageUrl: IMG + 'beans-chiti-vay.jpg',
    desc: 'کنسرو لوبیا چیتی وای در سس گوجه‌فرنگی، قوطی ۳۳۸ گرمی؛ لوبیای درشت و ترد در سس غلیظ با طعم خانگی. منبع پروتئین و فیبر گیاهی — غذای آماده مقوی برای همه اعضای خانواده.',
    weightG: 338, packaging: 'قوطی/کارتن',
    units: [{ old: 'قوطی ۴۰۰ گرمی', name: 'قوطی ۳۳۸ گرمی' }],
  },
  {
    sku: 'BEV-SS-FR-300',
    name: 'نوشیدنی میوه‌ای سانی نایس ناتفیلز — قوطی ۳۳۰ میلی‌لیتری',
    imageUrl: IMG + 'sani-nice-notfilz.jpg',
    desc: 'نوشیدنی میوه‌ای سانی نایس (Sani Nice) سری ناتفیلز در چهار طعم پرتقال، انبه، آناناس و هلو؛ قوطی ۳۳۰ میلی‌لیتری خنک و طراوت‌بخش. پرفروش فصل گرم و محبوب نوجوانان.',
    volumeMl: 330, packaging: 'قوطی/کارتن',
    units: [{ old: 'بطری ۳۰۰ میلی‌لیتری', name: 'قوطی ۳۳۰ میلی‌لیتری' }],
  },
  {
    sku: 'BEV-FP-EN-250',
    name: 'نوشیدنی انرژی‌زای فایر پاور (Fire Power) — قوطی ۲۵۰ میلی‌لیتری',
    imageUrl: IMG + 'fire-power-energy.jpg',
    desc: 'نوشیدنی انرژی‌زای فایر پاور (FIRE POWER) قوطی ۲۵۰ میلی‌لیتری؛ ترکیب کافئین، تائورین و ویتامین‌های گروه B برای انرژی فوری و تمرکز بیشتر. طرح آتشین چشم‌نواز — پرفروش فروشگاه‌های رفاهی و باشگاهی.',
    volumeMl: 250, packaging: 'قوطی/کارتن',
  },
  {
    sku: 'BEV-VTC-250',
    name: 'نوشیدنی ویتامین C ویتامین ۲۴ — شیشه ۲۵۰ میلی‌لیتری',
    imageUrl: IMG + 'vitamin-c-24.jpg',
    desc: 'نوشیدنی ویتامین C برند ویتامین ۲۴ در شیشه ۲۵۰ میلی‌لیتری با درب فلزی؛ دوز مؤثر ویتامین C با طعم مرکبات برای تقویت سیستم ایمنی. فصلی‌ترین محصول قفسه نوشیدنی در روزهای سرد.',
    brand: 'ویتامین ۲۴', volumeMl: 250, packaging: 'شیشه/کارتن',
    units: [{ old: 'بطری ۲۵۰ میلی‌لیتری', name: 'شیشه ۲۵۰ میلی‌لیتری' }],
  },
]

// ─── ۲) ۷ محصول جدید ───
const NEW_PRODUCTS: NewDef[] = [
  {
    sku: 'BEV-HER-JU-500',
    name: 'آبمیوه هیرو (HERO) — بطری ۵۰۰ میلی‌لیتری',
    imageUrl: IMG + 'juice-hero-500.jpg',
    desc: 'آبمیوه هیرو (HERO) با محتوای میوه ۱۰۰٪، بطری ۵۰۰ میلی‌لیتری در چهار طعم پرتقال، هلو، آناناس و انبه؛ رنگ سبز چشم‌نواز و برچسب Premium Quality. منبع طبیعی ویتامین‌ها برای سبد خانوار.',
    brand: 'هیرو', category: 'نوشیدنی',
    volumeMl: 500, packaging: 'بطری/کارتن', reorder: 150,
    units: [
      { name: 'بطری ۵۰۰ میلی‌لیتری', factor: 1, isBase: true, price: 55000 },
      { name: 'کارتن ۱۲ عددی', factor: 12, price: 620000 },
    ],
  },
  {
    sku: 'BEV-RZT-BS-290',
    name: 'نوشیدنی دانه ریحان رزوتی (REZOTI) — بطری شیشه‌ای ۲۹۰ میلی‌لیتری',
    imageUrl: IMG + 'basil-seed-rezoti.jpg',
    desc: 'نوشیدنی دانه ریحان رزوتی (REZOTI) در بطری شیشه‌ای درب‌کلیپسی در چهار طعم سیب، آناناس، انبه و گیلاس؛ دانه‌های ریحان معلق با طعم میوه‌ای خنک و متفاوت — محصولی خاص با مشتریان وفادار.',
    brand: 'رزوتی', category: 'نوشیدنی',
    volumeMl: 290, packaging: 'شیشه/کارتن', reorder: 150,
    units: [
      { name: 'بطری ۲۹۰ میلی‌لیتری', factor: 1, isBase: true, price: 45000 },
      { name: 'کارتن ۲۴ عددی', factor: 24, price: 990000 },
    ],
  },
  {
    sku: 'BEV-URN-WT-500',
    name: 'آب معدنی طبیعی اورانوس (URANUS) — بطری ۵۰۰ میلی‌لیتری',
    imageUrl: IMG + 'water-uranus-500.jpg',
    desc: 'آب معدنی طبیعی اورانوس (URANUS) از چشمه کوهستانی، بطری ۵۰۰ میلی‌لیتری PET؛ املاح معدنی متعادل و طعم خالص و سبک. کالای پرگردش و پرفروشِ همیشگی قفسه فروشگاه.',
    brand: 'اورانوس', category: 'نوشیدنی',
    volumeMl: 500, packaging: 'بطری/کارتن', reorder: 300,
    units: [
      { name: 'بطری ۵۰۰ میلی‌لیتری', factor: 1, isBase: true, price: 12000 },
      { name: 'کارتن ۲۴ عددی', factor: 24, price: 250000 },
    ],
  },
  {
    sku: 'CMP-BMD-CH-450',
    name: 'کمپوت گیلاس بمدیس — قوطی ۴۵۰ گرمی',
    imageUrl: IMG + 'compote-cherry-bamdis.jpg',
    desc: 'کمپوت گیلاس بمدیس در قوطی ۴۵۰ گرمی؛ گیلاس‌های درشت و رسیده در شیره غلیظ، بدون رنگ و طعم‌دهنده مصنوعی. دسر سنتی و پذیرایی سفره — ماندگاری بالا در دمای محیط.',
    brand: 'بمدیس', category: 'کمپوت میوه',
    weightG: 450, packaging: 'قوطی/کارتن', reorder: 80,
    units: [
      { name: 'قوطی ۴۵۰ گرمی', factor: 1, isBase: true, price: 62000 },
      { name: 'کارتن ۱۲ عددی', factor: 12, price: 700000 },
    ],
  },
  {
    sku: 'VGR-DST-AP-750',
    name: 'سرکه سیب دست‌چین — بطری ۷۵۰ میلی‌لیتری',
    imageUrl: IMG + 'vinegar-apple-dastchin.jpg',
    desc: 'سرکه سیب دست‌چین در بطری ۷۵۰ میلی‌لیتری با برچسب برگ‌مانند؛ طعم ملایم اسیدی طبیعی از سیب رسیده. همراه با سرکه سفید هم‌خانواده آن، مناسب سالاد، ترشیجات و آشپزی.',
    brand: 'دست‌چین', category: 'سرکه و آبلیمو',
    volumeMl: 750, packaging: 'بطری/کارتن', reorder: 80,
    units: [
      { name: 'بطری ۷۵۰ میلی‌لیتری', factor: 1, isBase: true, price: 45000 },
      { name: 'کارتن ۱۲ عددی', factor: 12, price: 480000 },
    ],
  },
  {
    sku: 'VGR-DST-GR-1500',
    name: 'سرکه انگوری دست‌چین — بطری ۱.۵ لیتری',
    imageUrl: IMG + 'vinegar-grape-dastchin.jpg',
    desc: 'سرکه انگوری دست‌چین در بطری ۱.۵ لیتری؛ حاصل تخمیر طبیعی انگور رسیده با اسیدیته متعادل و عطر میوه‌ای. اقتصادی‌ترین حجم برای مصارف خانگی و صنفی آشپزخانه.',
    brand: 'دست‌چین', category: 'سرکه و آبلیمو',
    volumeMl: 1500, packaging: 'بطری/کارتن', reorder: 80,
    units: [
      { name: 'بطری ۱.۵ لیتری', factor: 1, isBase: true, price: 78000 },
      { name: 'کارتن ۶ عددی', factor: 6, price: 430000 },
    ],
  },
  {
    sku: 'LMJ-DST-1000',
    name: 'آبلیموی ترش دست‌چین — بطری ۱ لیتری',
    imageUrl: IMG + 'lime-juice-dastchin.jpg',
    desc: 'آبلیموی ترش دست‌چین در بطری ۱ لیتری؛ طعم اسیدی قوی و عطر لیموی تازه برای آش، سالاد و دُم‌پخت. تهیه‌شده از آب لیموی مرغوب — چاشنی ضروری آشپزخانه ایرانی.',
    brand: 'دست‌چین', category: 'سرکه و آبلیمو',
    volumeMl: 1000, packaging: 'بطری/کارتن', reorder: 100,
    units: [
      { name: 'بطری ۱ لیتری', factor: 1, isBase: true, price: 52000 },
      { name: 'کارتن ۱۲ عددی', factor: 12, price: 560000 },
    ],
  },
]

// برندهای جدید با دسته‌بندی مربوطه
const NEW_BRANDS: Array<{ name: string; category: string }> = [
  { name: 'ویتامین ۲۴', category: 'نوشیدنی' },
  { name: 'هیرو', category: 'نوشیدنی' },
  { name: 'رزوتی', category: 'نوشیدنی' },
  { name: 'اورانوس', category: 'نوشیدنی' },
  { name: 'بمدیس', category: 'کمپوت میوه' },
  { name: 'دست‌چین', category: 'سرکه و آبلیمو' },
]

// دسته‌های جدید
const NEW_CATEGORIES = ['کمپوت میوه', 'سرکه و آبلیمو']

// تغییرنام برندها مطابق برچسب واقعی تصاویر
const BRAND_RENAMES: Array<[string, string]> = [
  ['مت', 'میت'],
  ['واریان', 'وای'],
  ['سان‌سان', 'سانی نایس'],
]

async function upsertCategory(name: string): Promise<string> {
  const cat = await db.category.upsert({ where: { name }, update: {}, create: { name } })
  return cat.id
}

async function main() {
  console.log('== مهاجرت تصاویر و داده محصولات ==')

  // ۱) دسته‌های جدید
  const catIds: Record<string, string> = {}
  for (const c of NEW_CATEGORIES) catIds[c] = await upsertCategory(c)
  const allCats = await db.category.findMany()
  for (const c of allCats) catIds[c.name] = c.id
  console.log(`   دسته‌ها: ${allCats.length}`)

  // ۲) تغییرنام برندها
  for (const [oldName, newName] of BRAND_RENAMES) {
    const oldB = await db.brand.findUnique({ where: { name: oldName } })
    const newB = await db.brand.findUnique({ where: { name: newName } })
    if (oldB && !newB) {
      await db.brand.update({ where: { id: oldB.id }, data: { name: newName } })
      console.log(`   برند: «${oldName}» → «${newName}»`)
    } else if (oldB && newB && oldB.id !== newB.id) {
      // برند جدید از قبل هست — محصولات را به آن منتقل و قدیمی را حذف می‌کنیم
      await db.product.updateMany({ where: { brandId: oldB.id }, data: { brandId: newB.id } })
      await db.brand.delete({ where: { id: oldB.id } })
      console.log(`   برند تکراری «${oldName}» با «${newName}» ادغام شد`)
    }
  }

  // ۳) برندهای جدید
  for (const b of NEW_BRANDS) {
    const catId = catIds[b.category] ?? null
    const existing = await db.brand.findUnique({ where: { name: b.name } })
    if (existing) {
      await db.brand.update({ where: { id: existing.id }, data: { categoryId: catId, isConfirmed: true } })
    } else {
      await db.brand.create({ data: { name: b.name, categoryId: catId, isConfirmed: true, isDemo: true } })
    }
  }
  console.log(`   برندهای جدید: ${NEW_BRANDS.length}`)

  // ۴) به‌روزرسانی ۹ محصول موجود
  for (const u of UPDATES) {
    const p = await db.product.findUnique({ where: { sku: u.sku }, include: { units: true } })
    if (!p) { console.log(`   !! محصول یافت نشد: ${u.sku}`); continue }
    const data: Record<string, unknown> = {
      name: u.name, description: u.desc, imageUrl: u.imageUrl,
      weightG: u.weightG ?? null, volumeMl: u.volumeMl ?? null,
      packagingType: u.packaging ?? p.packagingType,
    }
    if (u.brand) {
      const b = await db.brand.findUnique({ where: { name: u.brand } })
      if (b) data.brandId = b.id
    }
    await db.product.update({ where: { id: p.id }, data })
    for (const unit of u.units ?? []) {
      const target = p.units.find(x => x.name === unit.old) ?? p.units.find(x => x.name === unit.name)
      if (target && target.name !== unit.name) {
        await db.productUnit.update({ where: { id: target.id }, data: { name: unit.name } })
      }
    }
    console.log(`   ✓ به‌روزرسانی: ${u.sku}`)
  }

  // ۵) محصولات جدید
  const wh = await db.warehouse.findFirst({ where: { isDefault: true } })
  const supplier = await db.supplier.findUnique({ where: { code: 'SUP-001' } })
  let createdCount = 0, lotCount = 0
  for (const n of NEW_PRODUCTS) {
    const brand = await db.brand.findUnique({ where: { name: n.brand } })
    const catId = catIds[n.category] ?? null
    const existing = await db.product.findUnique({ where: { sku: n.sku } })
    if (existing) {
      // Idempotent: فقط تصویر و داده‌ها تازه می‌شوند
      await db.product.update({
        where: { id: existing.id },
        data: {
          name: n.name, description: n.desc, imageUrl: n.imageUrl,
          brandId: brand?.id ?? null, categoryId: catId,
          weightG: n.weightG ?? null, volumeMl: n.volumeMl ?? null,
          packagingType: n.packaging,
        },
      })
    } else {
      const p = await db.product.create({
        data: {
          sku: n.sku, name: n.name, description: n.desc,
          imageUrl: n.imageUrl, brandId: brand?.id ?? null, categoryId: catId,
          baseUnitName: n.units.find(u => u.isBase)!.name,
          weightG: n.weightG ?? null, volumeMl: n.volumeMl ?? null,
          packagingType: n.packaging,
          minOrderQtyBase: 1, orderMultipleBase: 1,
          reorderPointBase: n.reorder,
          isDemo: true, isActive: true,
        },
      })
      createdCount++
      for (const u of n.units) {
        const unit = await db.productUnit.create({
          data: { productId: p.id, name: u.name, factor: u.factor, isBase: !!u.isBase },
        })
        if (u.price) {
          await db.priceRule.create({
            data: { productId: p.id, unitId: unit.id, scope: 'DEFAULT', priceRls: u.price, minQtyBase: 1, note: seedNote },
          })
        }
      }
      // لات انبار DEMO_SEED — همان الگوی seed اصلی
      if (wh) {
        const basePrice = n.units.find(u => u.isBase)?.price ?? 0
        const costRls = Math.round((basePrice * 0.82) / 10) * 10
        const lot = await db.inventoryLot.create({
          data: {
            productId: p.id, warehouseId: wh.id,
            lotNo: `LOT-SEED-${n.sku}-${randomUUID().slice(0, 6).toUpperCase()}`,
            producedAt: new Date('2026-09-01T00:00:00.000Z'),
            expiresAt: DEMO_EXPIRY,
            supplierId: supplier?.id ?? null,
            initialQtyBase: DEMO_LOT_QTY, remainingQtyBase: DEMO_LOT_QTY,
            costRls, refType: 'SEED', isDemo: true,
          },
        })
        await db.inventoryBalance.upsert({
          where: { productId_warehouseId: { productId: p.id, warehouseId: wh.id } },
          update: { physicalQtyBase: { increment: DEMO_LOT_QTY } },
          create: { productId: p.id, warehouseId: wh.id, physicalQtyBase: DEMO_LOT_QTY, reservedQtyBase: 0 },
        })
        await db.inventoryLedger.create({
          data: {
            productId: p.id, warehouseId: wh.id, lotId: lot.id,
            movement: 'RECEIVE', physDelta: DEMO_LOT_QTY,
            refType: 'SEED', note: 'موجودی نمونه DEMO_SEED — قابل اصلاح/حذف مدیر',
          },
        })
        lotCount++
      }
    }
    console.log(`   ✓ محصول: ${n.sku}`)
  }
  console.log(`   محصولات جدید ساخته‌شده: ${createdCount} | لات انبار جدید: ${lotCount}`)

  const total = await db.product.count()
  const withImg = await db.product.count({ where: { imageUrl: { not: null } } })
  console.log(`== انجام شد — کل محصولات: ${total} (با تصویر: ${withImg}) ==`)
  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
