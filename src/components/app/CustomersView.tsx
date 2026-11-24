'use client'
// مشتریان عمده — لیست، ایجاد، پرونده کامل (شعب/اعتبار/گردش)
import { useState } from 'react'
import { apiFetch, useApiData, DataTable, Money, JDate, PageHeader, StatusBadge, Field, formatFaNumber } from './kit'
import type { CustomerListItem, CustomerDetail, SessionUserLike, BranchItem } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, RefreshCw, Store } from 'lucide-react'
import { toast } from 'sonner'
import { BUSINESS_TYPE_LABELS, GROUP_LABELS, ENTRY_TYPE_LABELS } from '@/lib/format'

type Territory = { id: string; name: string; code: string }

export default function CustomersView({ user }: { user: SessionUserLike }) {
  const [q, setQ] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data, loading, error, reload } = useApiData<CustomerListItem[]>(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  const { data: territories } = useApiData<Territory[]>('/api/territories')

  const rows = data ?? []

  return (
    <div>
      <PageHeader
        title="مشتریان عمده"
        desc="خواربارفروشی‌ها، سوپرمارکت‌ها و فروشگاه‌های مواد غذایی — با شعب، سقف اعتبار و گردش حساب"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 ml-1" /> به‌روزرسانی</Button>
            {user.permissions.includes('customers.manage') && (
              <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> مشتری جدید</Button>
            )}
          </>
        }
      />

      <div className="mb-3 max-w-64">
        <Input placeholder="جستجوی نام، کد یا تلفن…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {error ? (
        <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
      ) : (
        <DataTable
          columns={[
            { key: 'code', header: 'کد', cell: (c: CustomerListItem) => <span className="font-mono text-xs" dir="ltr">{c.code}</span> },
            {
              key: 'shop', header: 'فروشگاه', cell: (c: CustomerListItem) => (
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-stone-400" />
                  <div>
                    <div className="text-sm font-medium">{c.shopName} {c.isDemo && <Badge variant="outline" className="text-[9px]">DEMO</Badge>}</div>
                    <div className="text-[11px] text-muted-foreground">{BUSINESS_TYPE_LABELS[c.businessType]} — {GROUP_LABELS[c.groupKey]}</div>
                  </div>
                </div>
              ),
            },
            { key: 'phone', header: 'تلفن', cell: (c: CustomerListItem) => <span className="text-xs" dir="ltr">{c.phone}</span> },
            { key: 'territory', header: 'منطقه', cell: (c: CustomerListItem) => <span className="text-xs">{c.territory ?? '—'}</span> },
            { key: 'balance', header: 'مانده بدهی', cell: (c: CustomerListItem) => <Money rls={c.balanceRls} className={`text-sm font-bold ${c.balanceRls > 0 ? 'text-amber-700' : 'text-emerald-700'}`} /> },
            { key: 'credit', header: 'اعتبار مانده', cell: (c: CustomerListItem) => <span className="text-xs"><Money rls={c.remainingCreditRls} /> <span className="text-muted-foreground">از {formatFaNumber(c.creditLimitRls / 10)} ت</span></span> },
            { key: 'branches', header: 'شعب', cell: (c: CustomerListItem) => <span className="text-xs">{formatFaNumber(c.branchesCount)}</span> },
            { key: 'status', header: 'وضعیت', cell: (c: CustomerListItem) => <StatusBadge status={c.status} /> },
            { key: 'actions', header: '', cell: (c: CustomerListItem) => <Button variant="ghost" size="sm" onClick={() => setDetailId(c.id)}>پرونده</Button> },
          ]}
          rows={rows}
          loading={loading}
          rowKey={(c: CustomerListItem) => c.id}
          empty="مشتری‌ای یافت نشد"
        />
      )}

      <CreateCustomerDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={reload} territories={territories ?? []} />
      <CustomerDetailDialog id={detailId} onClose={() => setDetailId(null)} onChanged={reload} canManage={user.permissions.includes('customers.manage')} />
    </div>
  )
}

function CreateCustomerDialog({ open, onOpenChange, onCreated, territories }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
  territories: Territory[]
}) {
  const [form, setForm] = useState({ shopName: '', ownerName: '', phone: '', address: '', groupKey: 'REGULAR', businessType: 'GROCERY', territoryId: '', creditLimitToman: '0', creditDays: '0', branchName: '', branchAddress: '' })
  const [busy, setBusy] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.shopName || !form.phone || !form.branchName) {
      toast.error('نام فروشگاه، تلفن و نام شعبه الزامی است')
      return
    }
    setBusy(true)
    try {
      await apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          shopName: form.shopName,
          businessType: form.businessType,
          groupKey: form.groupKey,
          ownerName: form.ownerName || null,
          phone: form.phone,
          address: form.address || null,
          territoryId: form.territoryId || null,
          creditLimitRls: Math.round(Number(form.creditLimitToman || 0) * 10),
          creditDays: Number(form.creditDays || 0),
          branches: [{ name: form.branchName, address: form.branchAddress || null, phone: form.phone }],
        }),
      })
      toast.success('مشتری ثبت شد')
      onCreated()
      onOpenChange(false)
      setForm({ shopName: '', ownerName: '', phone: '', address: '', groupKey: 'REGULAR', businessType: 'GROCERY', territoryId: '', creditLimitToman: '0', creditDays: '0', branchName: '', branchAddress: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>مشتری جدید</DialogTitle><DialogDescription>اطلاعات کسب‌وکار و شعبه اصلی را ثبت کنید.</DialogDescription></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="نام فروشگاه" required><Input value={form.shopName} onChange={e => set('shopName', e.target.value)} /></Field>
          <Field label="نام مالک"><Input value={form.ownerName} onChange={e => set('ownerName', e.target.value)} /></Field>
          <Field label="تلفن" required><Input dir="ltr" value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="نوع کسب‌وکار">
            <Select value={form.businessType} onValueChange={v => set('businessType', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GROCERY">خواربارفروشی</SelectItem>
                <SelectItem value="SUPERMARKET">سوپرمارکت</SelectItem>
                <SelectItem value="OTHER">سایر</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="گروه مشتری (مبنای قیمت‌گذاری)">
            <Select value={form.groupKey} onValueChange={v => set('groupKey', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REGULAR">معمولی</SelectItem>
                <SelectItem value="GOLD">طلایی</SelectItem>
                <SelectItem value="WHOLESALE">عمده</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="منطقه فروش">
            <Select value={form.territoryId} onValueChange={v => set('territoryId', v)}>
              <SelectTrigger><SelectValue placeholder="بدون منطقه" /></SelectTrigger>
              <SelectContent>
                {territories.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="آدرس"><Input value={form.address} onChange={e => set('address', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="سقف اعتبار (تومان)" hint="۰ = بدون اعتبار"><Input dir="ltr" type="number" min={0} value={form.creditLimitToman} onChange={e => set('creditLimitToman', e.target.value)} /></Field>
            <Field label="مهلت تسویه (روز)"><Input dir="ltr" type="number" min={0} value={form.creditDays} onChange={e => set('creditDays', e.target.value)} /></Field>
          </div>
          <Field label="نام شعبه اول" required><Input value={form.branchName} onChange={e => set('branchName', e.target.value)} /></Field>
          <Field label="آدرس شعبه"><Input value={form.branchAddress} onChange={e => set('branchAddress', e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت مشتری'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CustomerDetailDialog({ id, onClose, onChanged, canManage }: { id: string | null; onClose: () => void; onChanged: () => void; canManage: boolean }) {
  const { data, loading, error, reload } = useApiData<CustomerDetail>(id ? `/api/customers/${id}` : null)
  const [branchOpen, setBranchOpen] = useState(false)
  const [branch, setBranch] = useState({ name: '', address: '', phone: '' })
  const [busy, setBusy] = useState(false)

  const addBranch = async () => {
    if (!id || !branch.name) { toast.error('نام شعبه الزامی است'); return }
    setBusy(true)
    try {
      await apiFetch(`/api/customers/${id}/branches`, { method: 'POST', body: JSON.stringify({ name: branch.name, address: branch.address || null, phone: branch.phone || null }) })
      toast.success('شعبه اضافه شد')
      setBranchOpen(false); setBranch({ name: '', address: '', phone: '' })
      reload(); onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا')
    } finally { setBusy(false) }
  }

  const toggleStatus = async () => {
    if (!data) return
    const next = data.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE'
    try {
      await apiFetch(`/api/customers/${data.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
      toast.success(next === 'ACTIVE' ? 'مشتری فعال شد' : 'مشتری مسدود شد')
      reload(); onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'خطا') }
  }

  return (
    <Dialog open={!!id} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        {loading && <p className="text-sm text-center py-8 text-muted-foreground">در حال بارگذاری…</p>}
        {error && <p className="text-sm text-rose-600 text-center py-8">{error}</p>}
        {data && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">{data.shopName} <StatusBadge status={data.status} /> {data.isDemo && <Badge variant="outline">DEMO</Badge>}</DialogTitle>
              <DialogDescription>کد <span dir="ltr">{data.code}</span> | ثبت در <JDate d={data.createdAt} /> | {data.territory?.name ?? 'بدون منطقه'}</DialogDescription>
            </DialogHeader>

            <div className="grid sm:grid-cols-4 gap-2 text-sm">
              <div className="rounded-lg border bg-amber-50 p-3"><div className="text-xs text-muted-foreground">مانده بدهی</div><Money rls={data.balanceRls} className="font-black text-amber-700" /></div>
              <div className="rounded-lg border bg-stone-50 p-3"><div className="text-xs text-muted-foreground">سقف اعتبار</div><Money rls={data.creditLimitRls} className="font-bold" /></div>
              <div className="rounded-lg border bg-emerald-50 p-3"><div className="text-xs text-muted-foreground">اعتبار باقی‌مانده</div><Money rls={data.remainingCreditRls} className="font-bold text-emerald-700" /></div>
              <div className="rounded-lg border bg-stone-50 p-3"><div className="text-xs text-muted-foreground">خرید کل (تحویل‌شده)</div><Money rls={data.totalPurchasesRls} className="font-bold" /></div>
            </div>

            {canManage && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setBranchOpen(true)}><Plus className="h-4 w-4 ml-1" /> افزودن شعبه</Button>
                <Button size="sm" variant={data.status === 'ACTIVE' ? 'destructive' : 'default'} onClick={toggleStatus}>
                  {data.status === 'ACTIVE' ? 'مسدودسازی' : 'فعال‌سازی'}
                </Button>
              </div>
            )}

            <div>
              <div className="text-xs font-bold text-muted-foreground mb-2">شعب ({formatFaNumber(data.branches.length)})</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {data.branches.map((b: BranchItem) => (
                  <div key={b.id} className="rounded-lg border px-3 py-2 text-xs">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-muted-foreground mt-0.5">{b.address ?? '—'} | <span dir="ltr">{b.phone ?? '—'}</span></div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-muted-foreground mb-2">سفارش‌های اخیر</div>
              {data.recentOrders.length === 0 ? <p className="text-xs text-muted-foreground">سفارشی ثبت نشده</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>شماره</TableHead><TableHead>وضعیت</TableHead><TableHead>مبلغ</TableHead><TableHead>تاریخ</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.recentOrders.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs" dir="ltr">{o.orderNo}</TableCell>
                        <TableCell><StatusBadge status={o.status} /></TableCell>
                        <TableCell><Money rls={o.totalRls} className="text-xs" /></TableCell>
                        <TableCell className="text-xs"><JDate d={o.createdAt} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div>
              <div className="text-xs font-bold text-muted-foreground mb-2">گردش حساب اخیر (از Ledger مالی)</div>
              {data.recentLedger.length === 0 ? <p className="text-xs text-muted-foreground">گردشی ثبت نشده</p> : (
                <div className="max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>سند</TableHead><TableHead>مبلغ</TableHead><TableHead>توضیح</TableHead><TableHead>تاریخ</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.recentLedger.map(l => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">{ENTRY_TYPE_LABELS[l.entryType] ?? l.entryType}</TableCell>
                          <TableCell><Money rls={l.amountRls} sign className={`text-xs font-bold ${l.amountRls > 0 ? 'text-amber-700' : 'text-emerald-700'}`} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.description ?? '—'}</TableCell>
                          <TableCell className="text-xs"><JDate d={l.createdAt} time /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>

      <Dialog open={branchOpen} onOpenChange={setBranchOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>افزودن شعبه</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Field label="نام شعبه" required><Input value={branch.name} onChange={e => setBranch(b => ({ ...b, name: e.target.value }))} /></Field>
            <Field label="آدرس"><Input value={branch.address} onChange={e => setBranch(b => ({ ...b, address: e.target.value }))} /></Field>
            <Field label="تلفن"><Input dir="ltr" value={branch.phone} onChange={e => setBranch(b => ({ ...b, phone: e.target.value }))} /></Field>
            <Button onClick={addBranch} disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت شعبه'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
