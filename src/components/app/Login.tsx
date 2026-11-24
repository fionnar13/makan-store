'use client'
// ورود به سامانه — شماره موبایل + رمز عبور (نشست امن HttpOnly)
import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { apiFetch, LogoImg, type SiteIdentity } from './kit'
import type { SessionUserLike } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

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
