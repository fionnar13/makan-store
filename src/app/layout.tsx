import type { Metadata, Viewport } from "next";
import "vazirmatn/Vazirmatn-font-face.css";
import "./globals.css";
import { Toaster } from "sonner";
import { db } from "@/lib/db";

// هویت وب‌سایت از دیتابیس خوانده می‌شود (تنظیم از پنل مدیریت → تب «وب‌سایت»)
// اگر دیتابیس در دسترس نبود، مقادیر پیش‌فرض استفاده می‌شوند
async function readSiteIdentity(): Promise<{ name: string; slogan: string; faviconUrl: string | null }> {
  try {
    const rows = await db.setting.findMany({
      where: { key: { in: ["site.name", "site.slogan", "site.faviconUrl"] } },
    })
    const map = Object.fromEntries(rows.map(r => [r.key, r.value])) as Record<string, string>
    return {
      name: map["site.name"] || "بنکداری هوشمند",
      slogan: map["site.slogan"] || "سامانه مدیریت B2B بنکداری مواد غذایی",
      faviconUrl: map["site.faviconUrl"] || null,
    }
  } catch {
    return { name: "بنکداری هوشمند", slogan: "سامانه مدیریت B2B بنکداری مواد غذایی", faviconUrl: null }
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const site = await readSiteIdentity()
  return {
    title: site.name,
    description: `${site.slogan} — سفارش‌گیری، انبار، مالی، ارسال و تحلیل`,
    keywords: ["بنکداری", "B2B", "عمده‌فروشی", "مدیریت انبار", "سفارش"],
    icons: { icon: site.faviconUrl ?? "/logo.svg" },
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster position="bottom-left" dir="rtl" richColors closeButton />
      </body>
    </html>
  );
}
