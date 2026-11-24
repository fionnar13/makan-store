'use client'
// ورود به سامانه — شماره موبایل + رمز عبور (نشست امن HttpOnly) و ورود با گوگل (در صورت فعال‌سازی مدیر)
import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { apiFetch, LogoImg, type SiteIdentity } from './kit'
import type { SessionUserLike } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// لوگوی رسمی گوگل — چهار رنگ، بدون فایل خارجی
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export default function Login({ onSuccess, authError, onRetry, site }: {
  onSuccess: (u: SessionUserLike) => void
  authError?: string | null
  onRetry?: () => void
  site?: SiteIdentity | null
}) {
  const siteName = site?.name ?? 'بنکداری هوشمند'
  const siteSlogan = site?.slogan ?? 'سامانه مدیریت B2B بنکداری مواد غذایی'
  const [phone, setPhone] = useState('09120000000')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  // وضعیت ورود با گوگل — فقط وقتی مدیر فعال کرده و شناسه/رمز تنظیم شده دکمه نشان داده می‌شود
  const [googleAvailable, setGoogleAvailable] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)

  // خطای بازگشت از گوگل — ?googleError=... از ریدایرکت callback
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const ge = p.get('googleError')
    if (ge) {
      setGoogleError(ge)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    apiFetch<{ enabled: boolean; configured: boolean }>('/api/auth/google/status')
      .then(s => setGoogleAvailable(s.enabled && s.configured))
      .catch(() => setGoogleAvailable(false))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const me = await apiFetch<SessionUserLike>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      })
      toast.success(`خوش آمدید ${me.name}`)
      onSuccess(me)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ورود ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  // شروع ورود با گوگل — داخل iframe (پیش‌نمایش) گوگل اجرا نمی‌شود؛ در تب جدید باز می‌کنیم
  const startGoogle = () => {
    try {
      if (window.self !== window.top) {
        window.open('/api/auth/google/start', '_blank')
        toast.info('ورود با گوگل در تب جدید باز شد؛ پس از ورود، تب را ببیندید و این صفحه را بازخوانی کنید.')
        return
      }
    } catch { /* دسترسی به top ممکن نیست — همان جابه‌جایی عادی */ }
    window.location.href = '/api/auth/google/start'
  }

  const fill = (p: string, pass: string) => {
    setPhone(p)
    setPassword(pass)
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-stone-100">
      {/* معرفی */}
      <div className="hidden lg:flex flex-col justify-center gap-6 bg-sidebar text-sidebar-foreground px-12">
        <div className="flex items-center gap-3">
          <LogoImg
            src={site?.logoUrl}
            alt={siteName}
            className="h-12 w-12 rounded-xl object-cover"
            fallback={<span className="grid place-items-center h-12 w-12 rounded-xl bg-primary text-primary-foreground text-2xl font-black">ب</span>}
          />
          <div>
            <h1 className="text-2xl font-black">{siteName}</h1>
            <p className="text-sm text-sidebar-foreground/60">{siteSlogan}</p>
          </div>
        </div>
        <ul className="grid gap-3 text-sm text-sidebar-foreground/80">
          <li>• سفارش‌گیری ویزیتورها با رزرو اتمیک موجودی و جلوگیری از فروش بیش از موجودی</li>
          <li>• موتور قیمت‌گذاری سمت سرور با قیمت اختصاصی مشتری، گروه و منطقه</li>
          <li>• مدیریت بچ‌ها و تاریخ انقضا با سیاست FEFO</li>
          <li>• دفتر مالی مشتریان، تأمین‌کنندگان و اسناد اصلاحی</li>
          <li>• داشبورد مدیریتی و گزارش‌های فروش، انبار و وصول مطالبات</li>
        </ul>
        <p className="text-xs text-sidebar-foreground/40">این نسخه با داده‌های نمایشی (DEMO_SEED) راه‌اندازی شده است.</p>
      </div>

      {/* فرم ورود */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-card border shadow-sm p-6 grid gap-4">
          <div className="text-center">
            <div className="lg:hidden mb-2">
              <LogoImg
                src={site?.logoUrl}
                alt={siteName}
                className="h-11 w-11 mx-auto rounded-xl object-cover"
                fallback={<span className="grid place-items-center h-11 w-11 mx-auto rounded-xl bg-primary text-primary-foreground text-xl font-black">ب</span>}
              />
            </div>
            <h2 className="text-lg font-bold">ورود به {siteName}</h2>
            <p className="text-xs text-muted-foreground mt-1">با شماره موبایل و رمز عبور خود وارد شوید</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">شماره موبایل</Label>
            <Input
              id="phone" dir="ltr" inputMode="numeric" placeholder="09xxxxxxxxx"
              value={phone} onChange={e => setPhone(e.target.value)} required
              autoComplete="username"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">رمز عبور</Label>
            <Input
              id="password" type="password" dir="ltr" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required
              autoComplete="current-password"
            />
          </div>
          {authError && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 grid gap-2" role="alert">
              <div className="flex items-start gap-2 text-xs text-amber-900">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                <span>{authError}</span>
              </div>
              {onRetry && (
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onRetry}>
                  تلاش مجدد برای برقراری نشست
                </Button>
              )}
            </div>
          )}
          <Button type="submit" disabled={busy} className="mt-1">
            {busy ? 'در حال ورود…' : 'ورود'}
          </Button>

          {/* ورود با گوگل — فقط وقتی مدیر فعال و پیکربندی کرده باشد */}
          {googleAvailable && (
            <>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="h-px flex-1 bg-stone-200" aria-hidden />
                یا
                <span className="h-px flex-1 bg-stone-200" aria-hidden />
              </div>
              <Button type="button" variant="outline" onClick={startGoogle} className="gap-2 bg-white">
                <GoogleG /> ورود با گوگل
              </Button>
              <p className="text-[10px] text-muted-foreground text-center -mt-1">
                ورود با گوگل در تب جدید انجام می‌شود؛ با اولین ورود، حساب با نقش «کاربر آنلاین» ساخته می‌شود
              </p>
            </>
          )}

          {googleError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" role="alert">
              ورود با گوگل ناموفق بود: {googleError}
            </div>
          )}

          <div className="rounded-lg bg-stone-50 border p-3 text-[11px] text-muted-foreground grid gap-1.5">
            <span className="font-medium text-stone-600">حساب‌های نمایشی این محیط:</span>
            <button type="button" className="text-right hover:underline" onClick={() => fill('09120000000', 'Admin#1404')}>
              مدیر کل: <span dir="ltr">09120000000</span> — <span dir="ltr">Admin#1404</span>
            </button>
            <button type="button" className="text-right hover:underline" onClick={() => fill('09120000005', 'Demo#1404')}>
              ویزیتور: <span dir="ltr">09120000005</span> — <span dir="ltr">Demo#1404</span>
            </button>
            <span>سایر نقش‌ها با همان رمز نمایشی (<span dir="ltr">Demo#1404</span>) از <span dir="ltr">09120000001</span> تا <span dir="ltr">09120000009</span></span>
          </div>
        </form>
      </div>
    </div>
  )
}
