/**
 * بازنشانی منطقی داده‌ها بدون تعویض فایل SQLite
 * (فایل را حذف نمی‌کنیم تا اتصال سرور در حال اجرا سالم بماند)
 * اجرا: bun run scripts/reset-data.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  await db.$transaction([
    db.orderStatusEvent.deleteMany(),
    db.orderItem.deleteMany(),
    db.invoice.deleteMany(),
    db.customerLedger.deleteMany(),
    db.supplierLedger.deleteMany(),
    db.receipt.deleteMany(),
    db.payment.deleteMany(),
    db.expense.deleteMany(),
    db.returnItem.deleteMany(),
    db.returnRequest.deleteMany(),
    db.visit.deleteMany(),
    db.attendance.deleteMany(),
    db.saleTarget.deleteMany(),
    db.inventoryLedger.deleteMany(),
    db.inventoryBalance.deleteMany(),
    db.inventoryLot.deleteMany(),
    db.message.deleteMany(),
    db.notification.deleteMany(),
    db.auditLog.deleteMany(),
    db.session.deleteMany(),
    db.order.deleteMany(),
    db.productUnit.deleteMany(),
    db.priceRule.deleteMany(),
    db.product.deleteMany(),
    db.brand.deleteMany(),
    db.category.deleteMany(),
    db.customerBranch.deleteMany(),
    db.customer.deleteMany(),
    db.supplier.deleteMany(),
    db.territory.deleteMany(),
    db.warehouse.deleteMany(),
    db.rolePermission.deleteMany(),
    db.userRole.deleteMany(),
    db.role.deleteMany(),
    db.permission.deleteMany(),
    db.employee.deleteMany(),
    db.setting.deleteMany(),
  ])
  console.log('همه جداول خالی شد')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
