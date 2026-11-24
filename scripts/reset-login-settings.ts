// بازنشانی تنظیمات صفحه ورود به حالت کارخانه — حذف کلیدهای login.* از جدول Setting
// اجرا: bun run scripts/reset-login-settings.ts
import { db } from '../src/lib/db'
import { Prisma } from '@prisma/client'

async function main() {
  const res = await db.setting.deleteMany({
    where: { key: { startsWith: 'login.' } },
  })
  console.log(`deleted ${res.count} login.* setting rows`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
