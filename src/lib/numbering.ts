// شماره‌گذاری اسناد — ORD-20261122-0001 / INV-... / RCP-... / PAY-... / RET-...
// داخل Transaction استفاده شود.
import { Prisma, PrismaClient } from '@prisma/client'

type Tx = Prisma.TransactionClient | PrismaClient

export async function nextNumber(tx: Tx, prefix: string): Promise<string> {
  const today = new Date()
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const key = `seq:${prefix}:${ymd}`
  const setting = await tx.setting.findUnique({ where: { key } })
  const n = (setting ? parseInt(setting.value, 10) : 0) + 1
  await tx.setting.upsert({
    where: { key },
    update: { value: String(n) },
    create: { key, value: String(n) },
  })
  return `${prefix}-${ymd}-${String(n).padStart(4, '0')}`
}
