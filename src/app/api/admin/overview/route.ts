// پنل مدیریت داده‌ها — نمای کلی: تعداد ردیف همه جدول‌های اصلی
// دسترسی: فقط مجوز users.manage (مدیر کل / آدمین)
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok } from '@/lib/api'
import { requirePerm } from '@/lib/auth'

export async function GET(req: NextRequest) {
  return handler(async () => {
    await requirePerm(req, 'users.manage')

    const [
      products, activeProducts, categories, brands, unconfirmedBrands,
      customers, activeCustomers, users, activeUsers, territories,
      suppliers, warehouses, employees, activeEmployees,
      orders, visits, returns, targets, settings, auditLogs,
    ] = await Promise.all([
      db.product.count(),
      db.product.count({ where: { isActive: true } }),
      db.category.count(),
      db.brand.count(),
      db.brand.count({ where: { isConfirmed: false } }),
      db.customer.count(),
      db.customer.count({ where: { status: 'ACTIVE' } }),
      db.user.count(),
      db.user.count({ where: { isActive: true } }),
      db.territory.count(),
      db.supplier.count(),
      db.warehouse.count(),
      db.employee.count(),
      db.employee.count({ where: { status: 'ACTIVE' } }),
      db.order.count(),
      db.visit.count(),
      db.returnRequest.count(),
      db.saleTarget.count(),
      db.setting.count(),
      db.auditLog.count(),
    ])

    return ok({
      tables: [
        { key: 'products', label: 'محصولات', count: products, hint: `${activeProducts} فعال`, view: 'catalog' },
        { key: 'categories', label: 'دسته‌بندی‌ها', count: categories, hint: 'مدیریت در همین پنل', view: null },
        { key: 'brands', label: 'برندها', count: brands, hint: `${unconfirmedBrands} نیازمند تأیید`, view: null },
        { key: 'customers', label: 'مشتریان', count: customers, hint: `${activeCustomers} فعال`, view: 'customers' },
        { key: 'users', label: 'کاربران', count: users, hint: `${activeUsers} فعال`, view: 'users' },
        { key: 'territories', label: 'مناطق فروش (لوکیشن)', count: territories, hint: 'مدیریت در «مناطق فروش»', view: 'territories' },
        { key: 'suppliers', label: 'تأمین‌کنندگان', count: suppliers, hint: 'مدیریت در «تأمین‌کنندگان»', view: 'suppliers' },
        { key: 'warehouses', label: 'انبارها', count: warehouses, hint: 'مدیریت در همین پنل', view: null },
        { key: 'employees', label: 'کارمندان', count: employees, hint: `${activeEmployees} فعال`, view: null },
        { key: 'orders', label: 'سفارش‌ها', count: orders, hint: 'سوابق عملیاتی', view: 'orders' },
        { key: 'visits', label: 'بازدیدها', count: visits, hint: 'سوابق عملیاتی', view: 'visits' },
        { key: 'returns', label: 'مرجوعی‌ها', count: returns, hint: 'سوابق عملیاتی', view: 'returns' },
        { key: 'targets', label: 'اهداف فروش', count: targets, hint: 'اهداف ماهانه ویزیتورها', view: null },
        { key: 'settings', label: 'تنظیمات سیستمی', count: settings, hint: 'شامل شمارنده‌های اسناد', view: null },
        { key: 'auditLogs', label: 'رکوردهای Audit', count: auditLogs, hint: 'تاریخچه عملیات', view: 'audit' },
      ],
    })
  })
}
