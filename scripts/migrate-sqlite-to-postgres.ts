/**
 * ─────────────────────────────────────────────────────────────────────────────
 * مهاجرت داده: SQLite → PostgreSQL  (Makan Store)
 * ─────────────────────────────────────────────────────────────────────────────
 * کارکرد:
 *   - جدول‌های SQLite قدیمی (db/custom.db) را می‌خواند (با bun:sqlite — بدون
 *     هیچ وابستگی اضافه) و در PostgreSQL هدف می‌نویسد (با PrismaClient).
 *   - IDها (cuid) عیناً حفظ می‌شوند → روابط و ارجاع‌ها دست‌نخورده می‌مانند.
 *   - تبدیل انواع: Boolean (0/1 → false/true)، DateTime (ms epoch → Date).
 *   - ترتیب درج مطابق وابستگی FK (والد قبل از فرزند).
 *   - «dry-run» پیش‌فرض است؛ فقط آمار می‌دهد. برای نوشتن واقعی: --write
 *   - اگر جدول‌های مقصد از قبل داده داشته باشند، با خطا متوقف می‌شود
 *     (مگر --allow-non-empty بدهید) تا Seed و مهاجرت با هم تداخل نکنند.
 *
 * اجرا:
 *   # فقط آمار (هیچ چیزی نوشته نمی‌شود):
 *   bun run scripts/migrate-sqlite-to-postgres.ts --source db/custom.db
 *
 *   # مهاجرت واقعی:
 *   bun run scripts/migrate-sqlite-to-postgres.ts --source db/custom.db --write
 *
 * متغیرهای محیطی:
 *   DATABASE_URL / DIRECT_URL — رشته اتصال PostgreSQL مقصد (از .env خوانده می‌شود)
 *   SQLITE_SOURCE             — مسیر فایل SQLite مبدا (جایگزین --source)
 *
 * ⚠️ نکته: فایل‌های آپلودی در دیتابیس نیستند؛ پس از مهاجرت، پوشه‌های
 *   public/uploads و public/products را هم روی مقصد کپی کنید.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { PrismaClient, Prisma } from '@prisma/client'
import { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── تنظیمات ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const ALLOW_NON_EMPTY = args.includes('--allow-non-empty')
const sourceArgIdx = args.indexOf('--source')
const SOURCE =
  sourceArgIdx >= 0 && args[sourceArgIdx + 1]
    ? resolve(args[sourceArgIdx + 1])
    : resolve(process.env.SQLITE_SOURCE || 'db/custom.db')

if (!existsSync(SOURCE)) {
  console.error(`❌ فایل SQLite مبدا پیدا نشد: ${SOURCE}`)
  console.error('   مسیر درست را با --source یا متغیر SQLITE_SOURCE بدهید.')
  process.exit(1)
}

const db = new PrismaClient()

// ترتیب درج مطابق وابستگی FK — والد قبل از فرزند
const TABLES = [
  'User', 'Role', 'Permission', 'UserRole', 'RolePermission', 'Session',
  'Employee', 'Territory', 'Category', 'Brand', 'Customer', 'CustomerBranch',
  'Supplier', 'Product', 'ProductUnit', 'PriceRule', 'Warehouse',
  'InventoryLot', 'InventoryBalance', 'InventoryLedger',
  'Order', 'OrderItem', 'OrderStatusEvent', 'Invoice',
  'CustomerLedger', 'SupplierLedger', 'Receipt', 'Payment', 'Expense',
  'ReturnRequest', 'ReturnItem', 'Visit', 'Attendance', 'SaleTarget',
  'Notification', 'Message', 'AuditLog', 'Setting',
] as const

// نام delegate در PrismaClient (model → camelCase)
const delegate = (model: string) => model[0].toLowerCase() + model.slice(1)

// متادیتای انواع هر مدل از DMMF کلاینت تولیدشده
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dmmfModels: any[] = (Prisma as any).dmmf?.datamodel?.models ?? []
const fieldMeta = new Map<string, Map<string, 'boolean' | 'datetime' | 'other'>>()
for (const m of dmmfModels) {
  const fields = new Map<string, 'boolean' | 'datetime' | 'other'>()
  for (const f of m.fields ?? []) {
    if (f.kind !== 'scalar') continue
    if (f.type === 'Boolean') fields.set(f.name, 'boolean')
    else if (f.type === 'DateTime') fields.set(f.name, 'datetime')
  }
  fieldMeta.set(m.name, fields)
}

/** تبدیل یک ردیف خام SQLite به ورودی معتبر Prisma */
function convert(model: string, row: Record<string, unknown>) {
  const meta = fieldMeta.get(model)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const kind = meta?.get(k) ?? 'other'
    if (v === null || v === undefined) { out[k] = null; continue }
    if (kind === 'boolean') out[k] = v === 1 || v === true
    else if (kind === 'datetime') out[k] = new Date(typeof v === 'number' ? v : Number(v))
    else out[k] = v
  }
  return out
}

// ─── اجرا ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('== مهاجرت داده SQLite → PostgreSQL ==')
  console.log(`   مبدا:   ${SOURCE}`)
  console.log(`   مقصد:   ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@') ?? '(؟)'}`)
  console.log(`   حالت:   ${WRITE ? 'ثبت واقعی (--write)' : 'dry-run (فقط آمار)'}\n`)

  const sqlite = new Database(SOURCE, { readonly: true })

  // ۱) آمار مبدا + تشخیص جدول‌های خالی/موجود
  const rowsByTable = new Map<string, Record<string, unknown>[]>()
  for (const t of TABLES) {
    let rows: Record<string, unknown>[] = []
    try {
      rows = sqlite.query(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[]
    } catch {
      // جدول در مبدا وجود ندارد (نسخه‌های قدیمی‌تر اسکیما) — رد می‌شود
      continue
    }
    rowsByTable.set(t, rows)
  }
  if (rowsByTable.size === 0) {
    console.error('❌ هیچ جدول شناخته‌شده‌ای در مبدا پیدا نشد.')
    process.exit(1)
  }

  const total = [...rowsByTable.values()].reduce((s, r) => s + r.length, 0)
  console.log(`   جدول‌های مبدا: ${rowsByTable.size} — مجموع ردیف‌ها: ${total}\n`)
  for (const [t, rows] of rowsByTable) {
    console.log(`   • ${t.padEnd(18)} ${String(rows.length).padStart(6)}`)
  }

  if (!WRITE) {
    console.log('\n✅ dry-run تمام شد. برای مهاجرت واقعی پرچم --write را اضافه کنید.')
    return
  }

  // ۲) کنترل خالی بودن مقصد — جلوگیری از تداخل با Seed
  let existing = 0
  for (const t of TABLES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = await (db as any)[delegate(t)].count()
    existing += n
  }
  if (existing > 0 && !ALLOW_NON_EMPTY) {
    console.error(
      `\n❌ دیتابیس مقصد از قبل ${existing} ردیف دارد (احتمالاً Seed اجرا شده).` +
      '\n   برای جلوگیری از تداخل ID/کلید یونیک، مهاجرت فقط روی دیتابیس خالی انجام می‌شود.' +
      '\n   راه‌ها: ۱) دیتابیس تازه بسازید، یا ۲) اگر مطمئنید، --allow-non-empty بدهید.',
    )
    process.exit(1)
  }

  // ۳) درج به ترتیب FK — داخل یک تراکنش (همه یا هیچ)
  console.log('\n== درج در PostgreSQL ==')
  const inserted: Record<string, number> = {}
  await db.$transaction(async (tx) => {
    for (const t of TABLES) {
      const rows = rowsByTable.get(t)
      if (!rows || rows.length === 0) { inserted[t] = 0; continue }
      // دسته‌ای برای عملکرد؛ ۵۰۰ ردیف در هر createMany
      let done = 0
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map((r) => convert(t, r))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any)[delegate(t)].createMany({ data: chunk })
        done += chunk.length
      }
      inserted[t] = done
      console.log(`   ✓ ${t.padEnd(18)} ${done}`)
    }
  }, { timeout: 300_000 })

  // ۴) راستی‌آزمایی تعدادها
  console.log('\n== راستی‌آزمایی ==')
  let mismatch = 0
  for (const [t, n] of Object.entries(inserted)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = await (db as any)[delegate(t)].count()
    const src = rowsByTable.get(t)?.length ?? 0
    if (target !== src) { mismatch++; console.log(`   ✗ ${t}: مبدا ${src} ≠ مقصد ${target}`) }
  }
  if (mismatch > 0) {
    console.error(`\n❌ ${mismatch} جدول تعدادشان مطابقت ندارد — بررسی کنید.`)
    process.exit(1)
  }
  console.log(`\n✅ مهاجرت کامل شد — ${total} ردیف در ${rowsByTable.size} جدول، IDها حفظ شد.`)
  console.log('   فراموش نکنید: پوشه‌های public/uploads و public/products را هم کپی کنید.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
