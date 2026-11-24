'use client'
// انبار — موجودی، لات‌های بچ/انقضا، Ledger حرکات، ورود کالا و تعدیل
import { useState } from 'react'
import { apiFetch, useApiData, DataTable, Money, JDate, PageHeader, Field, StatusBadge, formatFaNumber } from './kit'
import type { ProductListItem, SessionUserLike } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type Wh = { id: string; code: string; name: string; isDefault: boolean }
type Balance = { id: string; product: { name: string; sku: string; baseUnitName: string; reorderPointBase: number }; warehouse: string; physicalBase: number; reservedBase: number; availableBase: number; belowReorder: boolean }
type Lot = { id: string; lotNo: string; product: { name: string; sku: string }; warehouse: string; supplier: string | null; producedAt: string | null; expiresAt: string | null; remainingBase: number; initialBase: number; costRls: number | null; isDemo: boolean; state: string }
type LedgerRow = { id: string; product: { name: string; sku: string }; movement: string; movementLabel: string; physDelta: number; reservedDelta: number; refType: string | null; note: string | null; createdAt: string }
type SupplierLite = { id: string; name: string; code: string }

export default function InventoryView({ user }: { user: SessionUserLike }) {
  const [refresh, setRefresh] = useState(0)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const canReceive = user.permissions.includes('inventory.receive')
  const canAdjust = user.permissions.includes('inventory.adjust')

  return (
    <div>
      <PageHeader
        title="انبار و موجودی"
        desc="موجودی فیزیکی، رزروشده و قابل فروش به تفکیک کالا و انبار — خروج با سیاست FEFO"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setRefresh(r => r + 1)}><RefreshCw className="h-4 w-4 ml-1" /> به‌روزرسانی</Button>
            {canReceive && <Button size="sm" onClick={() => setReceiveOpen(true)}><Plus className="h-4 w-4 ml-1" /> ورود کالا</Button>}
            {canAdjust && <Button size="sm" variant="outline" onClick={() => setAdjustOpen(true)}>تعدیل موجودی</Button>}
          </>
        }
      />

      <Tabs defaultValue="balances">
        <TabsList>
          <TabsTrigger value="balances">موجودی</TabsTrigger>
          <TabsTrigger value="lots">لات‌ها و انقضا</TabsTrigger>
          <TabsTrigger value="ledger">گردش انبار</TabsTrigger>
        </TabsList>

        <TabsContent value="balances" className="mt-4">
          <BalancesTab refresh={refresh} />
        </TabsContent>
        <TabsContent value="lots" className="mt-4">
          <LotsTab refresh={refresh} />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <LedgerTab refresh={refresh} />
        </TabsContent>
      </Tabs>

      <ReceiveDialog open={receiveOpen} onOpenChange={setReceiveOpen} onDone={() => setRefresh(r => r + 1)} canListSuppliers={user.permissions.includes('suppliers.view')} />
      <AdjustDialog open={adjustOpen} onOpenChange={setAdjustOpen} onDone={() => setRefresh(r => r + 1)} />
    </div>
  )
}

function BalancesTab({ refresh }: { refresh: number }) {
  const { data, loading, error } = useApiData<{ balances: Balance[] }>(refresh >= 0 ? `/api/inventory?type=balances` : null)
  if (error) return <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
  return (
    <DataTable
      columns={[
        { key: 'product', header: 'کالا', cell: (b: Balance) => <div><div className="text-sm">{b.product.name}</div><div className="text-[11px] text-muted-foreground" dir="ltr">{b.product.sku}</div></div> },
        { key: 'wh', header: 'انبار', cell: (b: Balance) => <span className="text-xs">{b.warehouse}</span> },
        { key: 'physical', header: 'فیزیکی', cell: (b: Balance) => <span className="text-sm">{formatFaNumber(b.physicalBase)}</span> },
        { key: 'reserved', header: 'رزروشده', cell: (b: Balance) => <span className="text-sm text-amber-700">{formatFaNumber(b.reservedBase)}</span> },
        { key: 'available', header: 'قابل فروش', cell: (b: Balance) => <span className={`text-sm font-black ${b.belowReorder ? 'text-rose-600' : 'text-emerald-700'}`}>{formatFaNumber(b.availableBase)}</span> },
        { key: 'unit', header: 'واحد پایه', cell: (b: Balance) => <span className="text-xs text-muted-foreground">{b.product.baseUnitName}</span> },
        { key: 'warn', header: '', cell: (b: Balance) => b.belowReorder ? <Badge className="border-transparent bg-rose-100 text-rose-800">کم‌موجودی</Badge> : null },
      ]}
      rows={data?.balances ?? []}
      loading={loading}
      rowKey={(b: Balance) => b.id}
      empty="موجودی‌ای ثبت نشده است"
    />
  )
}

function LotsTab({ refresh }: { refresh: number }) {
  const [days, setDays] = useState('90')
  const { data, loading, error } = useApiData<{ lots: Lot[] }>(refresh >= 0 ? `/api/inventory?type=lots&expiringDays=${days}` : null)
  if (error) return <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
  return (
    <div>
      <div className="mb-3 max-w-56">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">انقضا در ۳۰ روز آینده</SelectItem>
            <SelectItem value="60">انقضا در ۶۰ روز آینده</SelectItem>
            <SelectItem value="90">انقضا در ۹۰ روز آینده</SelectItem>
            <SelectItem value="3650">همه بچ‌ها</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={[
          { key: 'lot', header: 'بچ', cell: (l: Lot) => <span className="font-mono text-[11px]" dir="ltr">{l.lotNo}</span> },
          { key: 'product', header: 'کالا', cell: (l: Lot) => <span className="text-sm">{l.product.name}</span> },
          { key: 'wh', header: 'انبار', cell: (l: Lot) => <span className="text-xs">{l.warehouse}</span> },
          { key: 'supplier', header: 'تأمین‌کننده', cell: (l: Lot) => <span className="text-xs">{l.supplier ?? '—'}</span> },
          { key: 'produced', header: 'تولید', cell: (l: Lot) => <span className="text-xs"><JDate d={l.producedAt} /></span> },
          { key: 'expires', header: 'انقضا', cell: (l: Lot) => <span className="text-xs"><JDate d={l.expiresAt} /></span> },
          { key: 'remaining', header: 'باقی‌مانده', cell: (l: Lot) => <span className="text-sm font-bold">{formatFaNumber(l.remainingBase)}</span> },
          { key: 'cost', header: 'بها واحد پایه', cell: (l: Lot) => <Money rls={l.costRls} className="text-xs" /> },
          { key: 'state', header: 'وضعیت', cell: (l: Lot) => <StatusBadge status={l.state} label={l.state === 'OK' ? 'سالم' : l.state === 'NEAR_EXPIRY' ? 'نزدیک انقضا' : 'منقضی'} /> },
          { key: 'demo', header: '', cell: (l: Lot) => l.isDemo ? <Badge variant="outline" className="text-[9px]">DEMO</Badge> : null },
        ]}
        rows={data?.lots ?? []}
        loading={loading}
        rowKey={(l: Lot) => l.id}
        empty="لاتی یافت نشد"
      />
    </div>
  )
}

function LedgerTab({ refresh }: { refresh: number }) {
  const { data, loading, error } = useApiData<{ ledger: LedgerRow[] }>(refresh >= 0 ? `/api/inventory?type=ledger&take=120` : null)
  if (error) return <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
  return (
    <DataTable
      columns={[
        { key: 'time', header: 'زمان', cell: (r: LedgerRow) => <span className="text-xs"><JDate d={r.createdAt} time /></span> },
        { key: 'product', header: 'کالا', cell: (r: LedgerRow) => <span className="text-sm">{r.product.name}</span> },
        {
          key: 'movement', header: 'حرکت', cell: (r: LedgerRow) => (
            <Badge variant="secondary" className="text-[10px]">{r.movementLabel}</Badge>
          ),
        },
        { key: 'phys', header: 'Δ فیزیکی', cell: (r: LedgerRow) => <span className={`text-sm font-bold ${r.physDelta > 0 ? 'text-emerald-700' : r.physDelta < 0 ? 'text-rose-600' : 'text-muted-foreground'}`}>{r.physDelta > 0 ? '+' : ''}{formatFaNumber(r.physDelta)}</span> },
        { key: 'res', header: 'Δ رزرو', cell: (r: LedgerRow) => <span className={`text-sm font-bold ${r.reservedDelta > 0 ? 'text-amber-700' : r.reservedDelta < 0 ? 'text-teal-700' : 'text-muted-foreground'}`}>{r.reservedDelta > 0 ? '+' : ''}{formatFaNumber(r.reservedDelta)}</span> },
        { key: 'note', header: 'یادداشت', cell: (r: LedgerRow) => <span className="text-xs text-muted-foreground line-clamp-1">{r.note ?? '—'}</span> },
      ]}
      rows={data?.ledger ?? []}
      loading={loading}
      rowKey={(r: LedgerRow) => r.id}
      empty="حرکتی ثبت نشده است"
    />
  )
}

function ReceiveDialog({ open, onOpenChange, onDone, canListSuppliers }: {
  open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void; canListSuppliers: boolean
}) {
  const { data: products } = useApiData<ProductListItem[]>(open ? '/api/products' : null)
  const { data: whs } = useApiData<{ warehouses: Wh[] }>(open ? '/api/inventory?type=balances' : null)
  const { data: suppliers } = useApiData<SupplierLite[]>(open && canListSuppliers ? '/api/suppliers' : null)
  const [form, setForm] = useState({ productId: '', warehouseId: '', qtyBase: '24', lotNo: '', producedAt: '', expiresAt: '', supplierId: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.productId || !form.warehouseId || !form.lotNo || Number(form.qtyBase) < 1) {
      toast.error('کالا، انبار، شماره بچ و مقدار الزامی است')
      return
    }
    setBusy(true)
    try {
      await apiFetch('/api/inventory/receive', {
        method: 'POST',
        body: JSON.stringify({
          productId: form.productId, warehouseId: form.warehouseId,
          qtyBase: Number(form.qtyBase), lotNo: form.lotNo,
          producedAt: form.producedAt ? new Date(form.producedAt).toISOString() : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          supplierId: form.supplierId || null,
        }),
      })
      toast.success('ورود کالا ثبت شد — لات جدید ایجاد و موجودی فیزیکی افزایش یافت')
      onDone(); onOpenChange(false)
      setForm({ productId: '', warehouseId: '', qtyBase: '24', lotNo: '', producedAt: '', expiresAt: '', supplierId: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت ناموفق بود')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>ورود کالا به انبار</DialogTitle><DialogDescription>لات جدید با شماره بچ و تاریخ انقضا ایجاد می‌شود؛ منبع حقیقت موجودی همین‌جاست.</DialogDescription></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="کالا" required>
            <Select value={form.productId} onValueChange={v => set('productId', v)}>
              <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
              <SelectContent className="max-h-52">{products?.filter(p => p.isActive).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="انبار" required>
            <Select value={form.warehouseId} onValueChange={v => set('warehouseId', v)}>
              <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
              <SelectContent>{whs?.warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (پیش‌فرض)' : ''}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="مقدار (واحد پایه)" required><Input dir="ltr" type="number" min={1} value={form.qtyBase} onChange={e => set('qtyBase', e.target.value)} /></Field>
          <Field label="شماره بچ" required><Input dir="ltr" value={form.lotNo} onChange={e => set('lotNo', e.target.value)} placeholder="LOT-20261122-A1" /></Field>
          <Field label="تاریخ تولید"><Input type="date" value={form.producedAt} onChange={e => set('producedAt', e.target.value)} /></Field>
          <Field label="تاریخ انقضا" hint="مبنای سیاست FEFO"><Input type="date" value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} /></Field>
          {canListSuppliers && (
            <Field label="تأمین‌کننده">
              <Select value={form.supplierId} onValueChange={v => set('supplierId', v)}>
                <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
                <SelectContent>{suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت ورود'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AdjustDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { data: products } = useApiData<ProductListItem[]>(open ? '/api/products' : null)
  const { data: whs } = useApiData<{ warehouses: Wh[] }>(open ? '/api/inventory?type=balances' : null)
  const [form, setForm] = useState({ productId: '', warehouseId: '', deltaBase: '0', reason: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.productId || !form.warehouseId || Number(form.deltaBase) === 0 || form.reason.length < 3) {
      toast.error('کالا، انبار، مقدار غیرصفر و دلیل الزامی است')
      return
    }
    setBusy(true)
    try {
      await apiFetch('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({ productId: form.productId, warehouseId: form.warehouseId, deltaBase: Number(form.deltaBase), reason: form.reason }),
      })
      toast.success('تعدیل ثبت شد')
      onDone(); onOpenChange(false)
      setForm({ productId: '', warehouseId: '', deltaBase: '0', reason: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت ناموفق بود')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>تعدیل موجودی</DialogTitle><DialogDescription>مقدار مثبت = افزایش انبار، منفی = کسری/ضایعات. دلیل الزامی است و در Ledger ثبت می‌شود.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="کالا" required>
            <Select value={form.productId} onValueChange={v => set('productId', v)}>
              <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
              <SelectContent className="max-h-52">{products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="انبار" required>
            <Select value={form.warehouseId} onValueChange={v => set('warehouseId', v)}>
              <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
              <SelectContent>{whs?.warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Δ مقدار (واحد پایه، + یا −)" required><Input dir="ltr" type="number" value={form.deltaBase} onChange={e => set('deltaBase', e.target.value)} /></Field>
          <Field label="دلیل" required><Input value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="مثلاً: کسری شمارش فیزیکی" /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button onClick={submit} disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت تعدیل'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
