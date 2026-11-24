/**
 * ─────────────────────────────────────────────────────────────
 * پیکربندی PM2 — سامانه بنکداری هوشمند
 * استقرار روی سرور (VPS):
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup        ← دستور چاپ‌شده را یک‌بار اجرا کنید تا بعد از ریبوت بالا بیاید
 * ⚠️ فقط مقدار DATABASE_URL را مطابق مسیر پروژه روی سرور ویرایش کنید.
 *    اگر از Nginx استفاده نمی‌کنید و می‌خواهید مستقیم به پورت 3000 دسترسی
 *    داشته باشید، HOSTNAME را به 0.0.0.0 تغییر دهید (توصیه: از Nginx استفاده کنید).
 * ─────────────────────────────────────────────────────────────
 */
module.exports = {
  apps: [
    {
      name: 'bankehdari',
      cwd: __dirname + '/.next/standalone',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
        // ⚠️ مسیر مطلق دیتابیس SQLite روی سرور خود را اینجا قرار دهید:
        DATABASE_URL: 'file:/opt/bankehdari/db/custom.db',
      },
    },
  ],
}
