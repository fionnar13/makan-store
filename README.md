<div dir="rtl">

# Makan Store — سامانه بنکداری و فروشگاه محصولات

پلتفرم بنکداری و فروشگاهی برای مدیریت محصولات، مشتریان، ویزیتورها و سفارش‌ها؛ همراه با فروشگاه آنلاین محصولات، پنل مدیریت داده‌ها و تنظیمات کامل ظاهر سایت.

## امکانات

- **ورود و نقش‌ها**: مدیر سیستم، آدمین، ویزیتور، مشتری — با سیستم دسترسی مبتنی بر مجوز (Permission)
- **فروشگاه محصولات**: صفحه نمایش محصولات با دیزاین فروشگاهی، تصاویر واقعی محصولات و **امکان مقایسه محصولات**
- **کاتالوگ محصولات**: مدیریت دسته‌بندی‌ها و برندها — هر دسته‌بندی برندهای مخصوص خود را دارد
- **پنل مدیریت داده‌ها**: مدیریت محصولات، مشتریان، کاربران، لوکیشن‌ها و … (ویژه مدیر و آدمین)
- **تنظیمات سایت**: تغییر نام وب‌سایت، شعار، لوگو و فاوآیکون از داخل پنل مدیریت
- **تصویر پروفایل**: هر کاربر می‌تواند تصویر پروفایل خود را تنظیم کند
- **آپلود امن فایل**: اعتبارسنجی نوع واقعی فایل با امضای بایت (Magic Bytes) و محدودیت حجم

## فناوری‌ها

| لایه | فناوری |
| --- | --- |
| فریم‌ورک | Next.js 16 (App Router) |
| زبان | TypeScript |
| استایل | Tailwind CSS |
| دیتابیس | Prisma ORM + PostgreSQL (14+) |
| رانتایم | Bun (یا Node.js) |

## راه‌اندازی سریع (لوکال)

```bash
# ۱) نصب وابستگی‌ها
bun install        # یا: npm install

# ۲) دیتابیس PostgreSQL و کاربر بسازید:
psql -U postgres -c "CREATE ROLE makan LOGIN PASSWORD 'رمز-قوی' CREATEDB"
psql -U postgres -c "CREATE DATABASE makan OWNER makan"

# ۳) ساخت فایل محیطی از روی نمونه
cp .env.example .env
#    ⚠️ DATABASE_URL یک Connection String کامل است:
#    postgresql://makan:رمز-قوی@localhost:5432/makan?schema=public

# ۴) اعمال مهاجرت‌ها و ساخت داده اولیه (Seed)
bun run db:migrate      # یا در پروداکشن: bun run db:deploy
bun run db:seed

# ۵) اجرا
bun run dev        # http://localhost:3000
```

> **رمز مدیر اولیه**: پس از اولین Seed، اگر `ADMIN_PASSWORD` در `.env` تنظیم نشده باشد،
> یک رمز تصادفی ساخته و در `db/.initial-admin-password.txt` ذخیره می‌شود.
> برای رمز دلخواه، قبل از Seed مقدار `ADMIN_PASSWORD` را در `.env` قرار دهید.
>
> **داده واقعی SQLite دارید؟** با `bun run db:migrate-data` همه‌چیز (با حفظ IDها) منتقل می‌شود —
> راهنمای کامل: [docs/postgres-migration.md](docs/postgres-migration.md)

## استقرار (Deployment)

فایل‌های استقرار در ریپو موجودند:

- `Dockerfile` و `docker-compose.yml` — استقرار با داکر
- `ecosystem.config.js` — استقرار با PM2
- `Caddyfile` — تنظیمات ریورس پراکسی Caddy

راهنمای کامل و تصویری نصب در لوکال و هاست: [راهنمای-نصب-و-راه-اندازی.md](راهنمای-نصب-و-راه-اندازی.md)

## ساختار پروژه

```
├── src/
│   ├── app/            # صفحات و API Routes (Next.js App Router)
│   ├── components/     # کامپوننت‌های UI (فروشگاه، کاتالوگ، پنل مدیریت)
│   └── lib/            # احراز هویت، مجوزها، آپلود، ابزارهای API
├── prisma/
│   ├── schema.prisma   # اسکیمای دیتابیس (PostgreSQL)
│   └── migrations/     # مهاجرت‌های Prisma (برای prisma migrate deploy)
├── scripts/            # Seed، مهاجرت داده و اسکریپت‌های کمکی
├── public/
│   ├── products/       # تصاویر محصولات فروشگاه
│   └── uploads/        # لوگو، فاوآیکون و تصاویر پروفایل (در رانتایم)
├── docs/
│   └── postgres-migration.md  # راهنمای کامل PG: استقرار، مهاجرت داده، Rollback
├── Dockerfile · docker-compose.yml (با سرویس postgres:16-alpine) · ecosystem.config.js · Caddyfile
└── راهنمای-نصب-و-راه-اندازی.md
```

## نکته‌های مهم

- دیتابیس پروژه **PostgreSQL** است؛ برای استقرار با Docker، سرویس `db` در `docker-compose.yml` آماده است (Volume پایدار + Healthcheck) و پیش از هر استارت `prisma migrate deploy` اجرا می‌شود.
- فایل‌های `db/` (بکاپ‌های SQLite و رمزها) و فایل `.env` در گیت **ذخیره نمی‌شوند**؛ پس از هر clone کافی است `db:migrate` و `db:seed` را اجرا کنید.
- محتوای `public/uploads/` (لوگو، فاوآیکون، پروفایل‌ها) در رانتایم ساخته می‌شود و جزو ریپو نیست.
- کوکی نشست برای کارکرد صحیح داخل iframe به‌صورت خودکار با `SameSite=None; Secure; Partitioned` (در HTTPS) تنظیم می‌شود.
- راهنمای کامل مهاجرت SQLite → PostgreSQL و برنامه بازگشت (Rollback): [docs/postgres-migration.md](docs/postgres-migration.md)

</div>
