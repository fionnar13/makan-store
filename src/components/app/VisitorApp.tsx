'use client'
// اپ ویزیتور — رابط موبایل فروش: مشتریان، سفارش جدید، بازدید، حضور، کارنامه
// قیمت و موجودی از سرور؛ مرورگر منبع حقیقت نیست
import { useState } from 'react'
import { apiFetch, useApiData, Money, JDate, PageHeader, StatusBadge, Field, formatFaNumber } from './kit'
import OrderCreateDialog from './OrderCreateDialog'
import type { CustomerListItem, OrderListItem, SessionUserLike, ViewKeyLike } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Store, RefreshCw, LogIn, LogOut, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { VISIT_RESULT_LABELS, ENTRY_TYPE_LABELS } from '@/lib/format'

type VisitRow = { id: string; customer: { code: string; shopName: string }; startedAt: string; endedAt: string | null; result: string | null; resultLabel: string | null; note: string | null }
type AttendanceData = { today: { checkInAt: string | null; checkOutAt: string | null; status: string } | null }
type TargetMine = { periodYm: string; target: { amountRls: number } | null; achievedRls: number; ordersCount: number; visitsCount: number; orderedVisits: number; conversionPct: number | null }
type CustomerDetailLite = { branches: Array<{ id: string; name: string; address: string | null }>; balanceRls: number; creditLimitRls: number; remainingCreditRls: number; recentOrders: Array<{ id: string; orderNo: string; status: string; totalRls: number; createdAt: string }>; recentLedger: Array<{ id: string; entryType: string; amountRls: number; description: string | null; createdAt: string }> }

export default function VisitorApp({ user, go }: { user: SessionUserLike; go: (v: ViewKeyLike) => void }) {
  return (
    <div className="mx-auto max-w-md pb-8">
      <PageHeader
        title={`اپ ویزیتور — ${user.name}`}
        desc="ابزار فروش روزانه: سفارش‌گیری سریع با قیمت و موجودی زنده سرور"
        actions={
          <>
            <button onClick={() => go('storefront')} className="text-xs underline text-emerald-700 font-medium">نمایش فروشگاه به مشتری</button>
            <button onClick={() => go('dashboard')} className="text-xs underline text-muted-foreground">نمای کامل دسکتاپ</button>
          </>
        }
      />

      <Tabs defaultValue="customers">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="customers" className="text-xs">مشتریان</TabsTrigger>
          <TabsTrigger value="orders" className="text-xs">سفارش‌ها</TabsTrigger>
          <TabsTrigger value="visits" className="text-xs">بازدید</TabsTrigger>
          <TabsTrigger value="kpi" className="text-xs">کارنامه</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4"><CustomersTab /></TabsContent>
        <TabsContent value="orders" className="mt-4"><MyOrdersTab /></TabsContent>
        <TabsContent value="visits" className="mt-4"><VisitsTab /></TabsContent>
        <TabsContent value="kpi" className="mt-4"><KpiTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function CustomersTab() {
  const [refresh, setRefresh] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [presetCustomer, setPresetCustomer] = useState<string | undefined>(undefined)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const { data, loading } = useApiData<CustomerListItem[]>(refresh >= 0 ? '/api/customers' : null)
  const mine = (data ?? []).filter(c => c.status === 'ACTIVE')

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Input placeholder="جستجوی مشتری…" value={q} onChange={e => setQ(e.target.value)} />
        <Button size="sm" onClick={() => { setPresetCustomer(undefined); setCreateOpen(true) }}><Plus className="h-4 w-4 ml-1" /> سفارش</Button>
      </div>
      {loading && <p className="text-sm text-center py-6 text-muted-foreground">در حال بارگذاری…</p>}
      <div className="grid gap-2">
        {mine.filter(c => !q || c.shopName.includes(q) || c.code.includes(q) || c.phone.includes(q)).map(c => (
          <div key={c.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between">
              <button className="text-right flex-1" onClick={() => setDetailId(c.id)}>
                <div className="text-sm font-bold flex items-center gap-1.5"><Store className="h-4 w-4 text-stone-400" /> {c.shopName}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5"><span dir="ltr">{c.code}</span> | {c.territory ?? '—'}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  بدهی: <Money rls={c.balanceRls} className={c.balanceRls > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'} /> | اعتبار باقی: <Money rls={c.remainingCreditRls} />
                </div>
              </button>
              <Button size="sm" className="h-8" onClick={() => { setPresetCustomer(c.id); setCreateOpen(true) }}>سفارش</Button>
            </div>
          </div>
        ))}
        {!loading && mine.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">مشتری‌ای یافت نشد</p>}
      </div>

      <OrderCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => setRefresh(r => r + 1)} presetCustomerId={presetCustomer} />
      <CustomerMiniDetail id={detailId} onClose={() => setDetailId(null)} />
    </div>
  )
}

function CustomerMiniDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, loading } = useApiData<CustomerDetailLite>(id ? `/api/customers/${id}` : null)
  return (
    <Dialog open={!!id} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        {loading && <p className="text-sm text-center py-6 text-muted-foreground">در حال بارگذاری…</p>}
        {data && (
          <>
            <DialogHeader><DialogTitle>مشتری</DialogTitle></DialogHeader>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border bg-amber-50 p-2.5"><div className="text-[10px] text-muted-foreground">بدهی</div><Money rls={data.balanceRls} className="font-bold" /></div>
              <div className="rounded-lg border bg-stone-50 p-2.5"><div className="text-[10px] text-muted-foreground">سقف اعتبار</div><Money rls={data.creditLimitRls} className="font-bold" /></div>
              <div className="rounded-lg border bg-emerald-50 p-2.5"><div className="text-[10px] text-muted-foreground">اعتبار مانده</div><Money rls={data.remainingCreditRls} className="font-bold text-emerald-700" /></div>
            </div>
            <div>
              <div className="text-xs font-bold text-muted-foreground mb-1.5">شعب</div>
              {data.branches.map(b => (
                <div key={b.id} className="flex items-center gap-1.5 text-xs py-1"><MapPin className="h-3 w-3 text-stone-400" /> {b.name} — {b.address ?? '—'}</div>
              ))}
            </div>
            <div>
              <div className="text-xs font-bold text-muted-foreground mb-1.5">سفارش‌های اخیر</div>
              {data.recentOrders.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : data.recentOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <span className="font-mono" dir="ltr">{o.orderNo}</span>
                  <StatusBadge status={o.status} />
                  <Money rls={o.totalRls} />
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-bold text-muted-foreground mb-1.5">گردش اخیر</div>
              {data.recentLedger.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : data.recentLedger.slice(0, 5).map(l => (
                <div key={l.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                  <span>{ENTRY_TYPE_LABELS[l.entryType] ?? l.entryType}</span>
                  <Money rls={l.amountRls} sign className={l.amountRls > 0 ? 'text-amber-700' : 'text-emerald-700'} />
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MyOrdersTab() {
  const [refresh, setRefresh] = useState(0)
  const { data, loading } = useApiData<OrderListItem[]>(refresh >= 0 ? '/api/orders?mine=1&take=60' : null)
  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={() => setRefresh(r => r + 1)} className="text-xs text-muted-underline flex items-center gap-1"><RefreshCw className="h-3 w-3" /> به‌روزرسانی</button>
      </div>
      {loading && <p className="text-sm text-center py-6 text-muted-foreground">در حال بارگذاری…</p>}
      <div className="grid gap-2">
        {(data ?? []).map(o => (
          <div key={o.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs" dir="ltr">{o.orderNo}</span>
              <StatusBadge status={o.status} label={o.statusLabel} />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs">
              <span>{o.customer.shopName}</span>
              <Money rls={o.totalRls} className="font-bold text-emerald-700" />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1"><JDate d={o.createdAt} time /></div>
          </div>
        ))}
        {!loading && (data ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">هنوز سفارشی ثبت نکرده‌اید</p>}
      </div>
    </div>
  )
}

function VisitsTab() {
  const [refresh, setRefresh] = useState(0)
  const { data: visits, loading, reload: reloadVisits } = useApiData<VisitRow[]>(refresh >= 0 ? '/api/visits?mine=1&take=50' : null)
  const { data: att, reload: reloadAtt } = useApiData<AttendanceData>(refresh >= 0 ? '/api/attendance' : null)
  const [createOpen, setCreateOpen] = useState(false)
  const [endVisit, setEndVisit] = useState<VisitRow | null>(null)

  const attAction = async (action: string) => {
    try {
      await apiFetch('/api/attendance', { method: 'POST', body: JSON.stringify({ action }) })
      toast.success('ثبت شد')
      reloadAtt()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'خطا') }
  }

  const t = att?.today
  return (
    <div className="grid gap-3">
      <div className="rounded-xl border bg-card p-3">
        <div className="text-sm font-bold mb-2">حضور امروز</div>
        <div className="text-[11px] text-muted-foreground">
          ورود: {t?.checkInAt ? <JDate d={t.checkInAt} time /> : '—'} | خروج: {t?.checkOutAt ? <JDate d={t.checkOutAt} time /> : '—'}
        </div>
        <div className="flex gap-2 mt-2.5">
          {!t?.checkInAt && <Button size="sm" onClick={() => attAction('checkIn')}><LogIn className="h-4 w-4 ml-1" /> ورود</Button>}
          {t?.checkInAt && !t.checkOutAt && <Button size="sm" variant="outline" onClick={() => attAction('checkOut')}><LogOut className="h-4 w-4 ml-1" /> خروج</Button>}
        </div>
      </div>

      <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> شروع بازدید جدید</Button>

      {visits?.map(v => (
        <div key={v.id} className="rounded-xl border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{v.customer.shopName}</span>
            {v.result ? <Badge variant="secondary" className="text-[10px]">{VISIT_RESULT_LABELS[v.result] ?? v.result}</Badge> : <Badge className="border-transparent bg-amber-100 text-amber-800 text-[10px]">در جریان</Badge>}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">شروع: <JDate d={v.startedAt} time /> {v.endedAt && <> | پایان: <JDate d={v.endedAt} time /></>}</div>
          {!v.endedAt && <Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => setEndVisit(v)}>ثبت نتیجه و پایان</Button>}
        </div>
      ))}
      {!loading && (visits ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">بازدیدی ثبت نشده است</p>}

      <StartVisitDialog open={createOpen} onOpenChange={setCreateOpen} onDone={() => setRefresh(r => r + 1)} />
      <EndVisitDialog visit={endVisit} onClose={() => setEndVisit(null)} onDone={() => setRefresh(r => r + 1)} />
    </div>
  )
}

function StartVisitDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { data: customers } = useApiData<CustomerListItem[]>(open ? '/api/customers' : null)
  const [customerId, setCustomerId] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!customerId) { toast.error('انتخاب مشتری الزامی است'); return }
    setBusy(true)
    try {
      await apiFetch('/api/visits', { method: 'POST', body: JSON.stringify({ customerId }) })
      toast.success('بازدید آغاز شد')
      onDone(); onOpenChange(false); setCustomerId('')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'خطا') } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>شروع بازدید</DialogTitle><DialogDescription>زمان شروع از سرور ثبت می‌شود.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="مشتری" required>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
              <SelectContent className="max-h-52">{customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.shopName}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Button onClick={submit} disabled={busy}>{busy ? '…' : 'شروع بازدید'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function EndVisitDialog({ visit, onClose, onDone }: { visit: VisitRow | null; onClose: () => void; onDone: () => void }) {
  const [result, setResult] = useState('')
  const [noOrderReason, setNoOrderReason] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!visit || !result) { toast.error('نتیجه الزامی است'); return }
    setBusy(true)
    try {
      await apiFetch(`/api/visits/${visit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ result, noOrderReason: result === 'NO_ORDER' ? noOrderReason || null : null }),
      })
      toast.success('پایان بازدید ثبت شد')
      onDone(); onClose(); setResult(''); setNoOrderReason('')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'خطا') } finally { setBusy(false) }
  }

  return (
    <Dialog open={!!visit} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>پایان بازدید</DialogTitle><DialogDescription>{visit?.customer.shopName}</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="نتیجه" required>
            <Select value={result} onValueChange={setResult}>
              <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
              <SelectContent>{Object.entries(VISIT_RESULT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {result === 'NO_ORDER' && <Field label="علت عدم سفارش"><Input value={noOrderReason} onChange={e => setNoOrderReason(e.target.value)} /></Field>}
          <Button onClick={submit} disabled={busy}>{busy ? '…' : 'ثبت پایان'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function KpiTab() {
  const { data } = useApiData<TargetMine>('/api/targets?mine=1')
  if (!data) return <p className="text-sm text-muted-foreground text-center py-8">در حال بارگذاری…</p>
  const pct = data.target && data.target.amountRls > 0 ? Math.min(100, Math.round((data.achievedRls / data.target.amountRls) * 100)) : null
  return (
    <div className="grid gap-3">
      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-bold mb-3">کارنامه فروش — دوره {data.periodYm}</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border bg-stone-50 p-2.5"><div className="text-[10px] text-muted-foreground">هدف</div><Money rls={data.target?.amountRls ?? 0} className="font-bold" /></div>
          <div className="rounded-lg border bg-emerald-50 p-2.5"><div className="text-[10px] text-muted-foreground">تحقق‌شده</div><Money rls={data.achievedRls} className="font-bold text-emerald-700" /></div>
          <div className="rounded-lg border bg-stone-50 p-2.5"><div className="text-[10px] text-muted-foreground">سفارش‌ها</div><span className="font-bold">{formatFaNumber(data.ordersCount)}</span></div>
          <div className="rounded-lg border bg-stone-50 p-2.5"><div className="text-[10px] text-muted-foreground">نرخ تبدیل بازدید</div><span className="font-bold">{data.conversionPct != null ? `${formatFaNumber(data.conversionPct)}٪` : '—'}</span></div>
        </div>
        {pct != null && (
          <div className="mt-3">
            <Progress value={pct} aria-label="تحقق هدف" />
            <span className="text-[11px] text-muted-foreground mt-1 block">{formatFaNumber(pct)}٪ از هدف ماه</span>
          </div>
        )}
      </div>
      <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground grid gap-1.5">
        <span className="font-bold text-stone-700">یادآوری</span>
        <span>• سفارش فقط پس از تأیید سرور قطعی است؛ رزرو موجودی در لحظه ثبت انجام می‌شود.</span>
        <span>• ثبت بازدید، سفارش و وصول وجه سه رویداد مستقل‌اند و به‌صورت جداگانه مبنای محاسبه می‌شوند.</span>
      </div>
    </div>
  )
}
