'use client'
// داشبورد مدیریتی — ارقام واقعی از Database
import { useApiData, Money, JDate, StatCard, Spinner, StatusBadge, Num, formatFaNumber } from './kit'
import type { SessionUserLike, ViewKeyLike } from './types'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { AlertTriangle } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type DashboardData = {
  salesTodayRls: number
  salesTodayCount: number
  salesMonthRls: number
  salesMonthCount: number
  purchaseMonthRls: number
  cogsMonthRls: number
  grossProfitMonthRls: number
  receiptsTodayRls: number
  receiptsTodayCount: number
  totalDebtRls: number
  totalCreditRls: number
  activeCustomers30d: number
  statusCounts: Record<string, number>
  newOrders: number
  awaitingDispatch: number
  lowStock: Array<{ productId: string; name: string; availableBase: number; reorderPoint: number; unit: string }>
  totalAvailableBase: number
  nearExpiryLots: Array<{ id: string; lotNo: string; product: string; expiresAt: string; remainingBase: number }>
  expiredLots: Array<{ id: string; lotNo: string; product: string; expiresAt: string; remainingBase: number }>
  chart: Array<{ day: string; sales: number; collections: number }>
  visitorPerf: Array<{ userId: string; name: string; orders: number; totalRls: number }>
}

// کوتاه‌سازی مبالغ محور برای خوانایی
const shortMoney = (v: number) => {
  if (v >= 1_000_000_000) return `${formatFaNumber(Math.round(v / 1_000_000_000))} میلیارد`
  if (v >= 1_000_000) return `${formatFaNumber(Math.round(v / 1_000_000))} م`
  if (v >= 1000) return `${formatFaNumber(Math.round(v / 1000))} ه`
  return formatFaNumber(v)
}

export default function DashboardView({ user, go }: { user: SessionUserLike; go: (v: ViewKeyLike) => void }) {
  const { data, loading, error, reload } = useApiData<DashboardData>('/api/dashboard')

  if (loading) return <Spinner label="در حال محاسبه شاخص‌ها…" />
  if (error) return (
    <div className="text-center py-10">
      <p className="text-sm text-rose-600">{error}</p>
      <button onClick={reload} className="text-sm underline mt-2">تلاش مجدد</button>
    </div>
  )
  if (!data) return null

  const d = data
  const s = d.statusCounts

  return (
    <div className="grid gap-6">
      {/* شاخص‌های اصلی */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="فروش امروز (فاکتور شده)" tone="good" value={<Money rls={d.salesTodayRls} />} hint={`${formatFaNumber(d.salesTodayCount)} فاکتور`} />
        <StatCard label="فروش ماه جاری" tone="good" value={<Money rls={d.salesMonthRls} />} hint={`${formatFaNumber(d.salesMonthCount)} فاکتور`} />
        <StatCard label="خرید ماه جاری" value={<Money rls={d.purchaseMonthRls} />} hint="از تأمین‌کنندگان" />
        <StatCard label="سود ناخالص تخمینی ماه" tone={d.grossProfitMonthRls >= 0 ? 'good' : 'bad'} value={<Money rls={d.grossProfitMonthRls} />} hint="بر مبنای بهای تمام‌شده لات‌های خروجی" />
        <StatCard label="دریافت امروز" tone="good" value={<Money rls={d.receiptsTodayRls} />} hint={`${formatFaNumber(d.receiptsTodayCount)} دریافت`} />
        <StatCard label="بدهی مشتریان (مطالبات)" tone="warn" value={<Money rls={d.totalDebtRls} />} hint={`بستانکاری: ${formatFaNumber(d.totalCreditRls / 10)} تومان`} />
        <StatCard label="سفارش‌های جدید" tone={d.newOrders > 0 ? 'warn' : 'default'} value={formatFaNumber(d.newOrders)} hint={`در انتظار اقدام — شامل ثبت‌شده و رزرو`} />
        <StatCard label="موجودی قابل فروش" value={`${formatFaNumber(d.totalAvailableBase)} پایه`} hint={`${formatFaNumber(d.activeCustomers30d)} مشتری فعال در ۳۰ روز`} />
      </div>

      {/* وضعیت سفارش‌ها */}
      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-bold mb-3">وضعیت سفارش‌ها</div>
        <div className="flex flex-wrap gap-2">
          {['SUBMITTED', 'RESERVED', 'CONFIRMED', 'CREDIT_APPROVED', 'PAID', 'PICKING', 'READY_FOR_DISPATCH', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'].map(k => (
            <div key={k} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 bg-stone-50">
              <StatusBadge status={k} />
              <span className="text-sm font-bold">{formatFaNumber(s[k] ?? 0)}</span>
            </div>
          ))}
        </div>
        {user.permissions.includes('orders.view') && (
          <button onClick={() => go('orders')} className="text-xs text-emerald-700 hover:underline mt-3">رفتن به سفارش‌ها ←</button>
        )}
      </div>

      {/* نمودار */}
      <div className="rounded-xl border bg-card p-4" dir="ltr">
        <div className="text-sm font-bold mb-3" dir="rtl">روند فروش و وصول مطالبات — ۱۴ روز اخیر</div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={d.chart} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
            <defs>
              <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="gCol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d97706" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#d97706" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} reversed />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={shortMoney} orientation="right" width={70} />
            <Tooltip formatter={(v: number) => [`${formatFaNumber(Math.round(v / 10))} تومان`]} labelStyle={{ direction: 'rtl' }} />
            <Legend formatter={(v: string) => v === 'sales' ? 'فروش' : 'وصول'} />
            <Area type="monotone" dataKey="sales" stroke="#059669" fill="url(#gSales)" strokeWidth={2} />
            <Area type="monotone" dataKey="collections" stroke="#d97706" fill="url(#gCol)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* کم‌موجودی */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold">کالاهای رو به اتمام</span>
            <span className="text-xs text-muted-foreground">({formatFaNumber(d.lowStock.length)} مورد)</span>
          </div>
          {d.lowStock.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">موجودی همه کالاها بالای نقطه سفارش است</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>کالا</TableHead><TableHead>قابل فروش</TableHead><TableHead>نقطه سفارش</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.lowStock.slice(0, 6).map(l => (
                  <TableRow key={l.productId}>
                    <TableCell className="text-sm">{l.name}</TableCell>
                    <TableCell><span className="text-rose-600 font-bold">{formatFaNumber(l.availableBase)}</span> {l.unit}</TableCell>
                    <TableCell className="text-sm">{formatFaNumber(l.reorderPoint)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* انقضا */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-bold">نزدیک انقضا / منقضی</span>
            <span className="text-xs text-muted-foreground">({formatFaNumber(d.nearExpiryLots.length + d.expiredLots.length)} بچ)</span>
          </div>
          <div className="max-h-56 overflow-y-auto p-2 text-xs">
            {d.expiredLots.map(l => (
              <div key={l.id} className="flex items-center justify-between rounded-lg bg-rose-50 border border-rose-100 px-2.5 py-2 mb-1.5">
                <span>{l.product} — بچ <span dir="ltr">{l.lotNo.slice(0, 18)}</span></span>
                <span className="text-rose-700 font-bold">منقضی! {formatFaNumber(l.remainingBase)} پایه</span>
              </div>
            ))}
            {d.nearExpiryLots.slice(0, 5).map(l => (
              <div key={l.id} className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2 mb-1.5">
                <span>{l.product} — بچ <span dir="ltr">{l.lotNo.slice(0, 18)}</span></span>
                <span className="text-amber-700">انقضا: <JDate d={l.expiresAt} /> — {formatFaNumber(l.remainingBase)} پایه</span>
              </div>
            ))}
            {d.expiredLots.length === 0 && d.nearExpiryLots.length === 0 && (
              <p className="text-muted-foreground text-center py-6">بچی در وضعیت هشدار نیست</p>
            )}
          </div>
        </div>
      </div>

      {/* عملکرد ویزیتورها */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-bold">عملکرد ویزیتورها — ماه جاری (سفارش‌های ثبت‌شده)</div>
        {d.visitorPerf.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">سفارشی از ویزیتورها ثبت نشده است</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>ویزیتور</TableHead><TableHead>تعداد سفارش</TableHead><TableHead>مبلغ</TableHead></TableRow></TableHeader>
            <TableBody>
              {d.visitorPerf.map(v => (
                <TableRow key={v.userId}>
                  <TableCell className="text-sm">{v.name}</TableCell>
                  <TableCell><Num n={v.orders} /></TableCell>
                  <TableCell><Money rls={v.totalRls} className="font-bold" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
