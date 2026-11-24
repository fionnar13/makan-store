'use client'
// مالی — خلاصه، مطالبات سررسیدشده، دریافت‌ها، پرداخت‌ها، گردش حساب مشتری
import { useState } from 'react'
import { apiFetch, useApiData, DataTable, Money, JDate, PageHeader, StatCard, Field, formatFaNumber } from './kit'
import type { CustomerListItem, SessionUserLike } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { ENTRY_TYPE_LABELS } from '@/lib/format'

type Summary = {
  monthReceiptsRls: number; monthReceiptsCount: number
  monthPaymentsRls: number; monthPaymentsCount: number
  monthExpensesRls: number
  totalDebtRls: number
  overdue: Array<{ id: string; code: string; shopName: string; creditDays: number; overdueRls: number }>
  suppliers: Array<{ id: string; code: string; name: string; balanceRls: number }>
}
type Receipt = { id: string; receiptNo: string; customer: { code: string; shopName: string }; amountRls: number; method: string; refNo: string | null; note: string | null; createdAt: string }
type Payment = { id: string; paymentNo: string; supplier: { code: string; name: string } | null; category: string; amountRls: number; method: string; refNo: string | null; note: string | null; createdAt: string }
type LedgerData = {
  customer: { code: string; shopName: string; creditLimitRls: number; creditDays: number }
  entries: Array<{ id: string; entryType: string; amountRls: number; description: string | null; createdAt: string; balanceAfterRls: number }>
  balanceRls: number
}

export default function FinanceView({ user }: { user: SessionUserLike }) {
  const [refresh, setRefresh] = useState(0)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const canReceipt = user.permissions.includes('finance.receipts')
  const canPay = user.permissions.includes('finance.payments')

  return (
    <div>
      <PageHeader
        title="مالی و حساب‌ها"
        desc="دفتر مالی مشتریان و تأمین‌کنندگان — هر ثبت با Ledger و Audit؛ حذف مخرب اسناد ممنوع است"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setRefresh(r => r + 1)}><RefreshCw className="h-4 w-4 ml-1" /> به‌روزرسانی</Button>
            {canReceipt && <Button size="sm" onClick={() => setReceiptOpen(true)}><Plus className="h-4 w-4 ml-1" /> ثبت دریافت</Button>}
            {canPay && <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}><Plus className="h-4 w-4 ml-1" /> ثبت پرداخت</Button>}
          </>
        }
      />

      <SummaryCards refresh={refresh} />

      <Tabs defaultValue="ledger" className="mt-5">
        <TabsList>
          <TabsTrigger value="ledger">گردش حساب مشتری</TabsTrigger>
          <TabsTrigger value="receipts">دریافت‌ها</TabsTrigger>
          <TabsTrigger value="payments">پرداخت‌ها</TabsTrigger>
        </TabsList>
        <TabsContent value="ledger" className="mt-4"><LedgerExplorer /></TabsContent>
        <TabsContent value="receipts" className="mt-4"><ReceiptsTab refresh={refresh} /></TabsContent>
        <TabsContent value="payments" className="mt-4"><PaymentsTab refresh={refresh} /></TabsContent>
      </Tabs>

      <ReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} onDone={() => setRefresh(r => r + 1)} />
      <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} onDone={() => setRefresh(r => r + 1)} />
    </div>
  )
}

function SummaryCards({ refresh }: { refresh: number }) {
  const { data } = useApiData<Summary>(refresh >= 0 ? '/api/finance?type=summary' : null)
  if (!data) return <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="h-24" /><div className="h-24" /><div className="h-24" /><div className="h-24" /></div>
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="دریافت‌های این ماه" tone="good" value={<Money rls={data.monthReceiptsRls} />} hint={`${formatFaNumber(data.monthReceiptsCount)} سند`} />
        <StatCard label="پرداخت‌های این ماه" value={<Money rls={data.monthPaymentsRls} />} hint={`${formatFaNumber(data.monthPaymentsCount)} سند`} />
        <StatCard label="هزینه‌های این ماه" tone="warn" value={<Money rls={data.monthExpensesRls} />} />
        <StatCard label="مجموع مطالبات (بدهی مشتریان)" tone="warn" value={<Money rls={data.totalDebtRls} />} />
      </div>
      {data.overdue.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 overflow-hidden">
          <div className="px-4 py-2.5 text-sm font-bold text-rose-800 border-b border-rose-200">مطالبات با احتمال سررسید گذشته</div>
          <Table>
            <TableHeader><TableRow className="bg-rose-100/50"><TableHead>مشتری</TableHead><TableHead>مهلت تسویه</TableHead><TableHead>مانده</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.overdue.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="text-sm">{o.shopName} <span className="text-xs text-muted-foreground" dir="ltr">({o.code})</span></TableCell>
                  <TableCell className="text-xs">{formatFaNumber(o.creditDays)} روز</TableCell>
                  <TableCell><Money rls={o.overdueRls} className="text-sm font-bold text-rose-700" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {data.suppliers.some(s => s.balanceRls > 0) && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-2.5 text-sm font-bold border-b bg-stone-50">بدهی به تأمین‌کنندگان</div>
          <Table>
            <TableHeader><TableRow><TableHead>تأمین‌کننده</TableHead><TableHead>مانده بدهی ما</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.suppliers.filter(s => s.balanceRls > 0).map(s => (
                <TableRow key={s.id}>
                  <TableCell className="text-sm">{s.name} <span className="text-xs text-muted-foreground" dir="ltr">({s.code})</span></TableCell>
                  <TableCell><Money rls={s.balanceRls} className="text-sm font-bold" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function LedgerExplorer() {
  const [customerId, setCustomerId] = useState('')
  const { data: customers } = useApiData<CustomerListItem[]>('/api/customers')
  const { data, loading } = useApiData<LedgerData>(customerId ? `/api/finance?type=ledger&customerId=${customerId}` : null)

  return (
    <div>
      <div className="mb-3 max-w-72">
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger><SelectValue placeholder="انتخاب مشتری برای گردش حساب…" /></SelectTrigger>
          <SelectContent className="max-h-60">{customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.shopName} ({c.code})</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {customerId && data && (
        <>
          <div className="grid sm:grid-cols-3 gap-2 mb-3">
            <StatCard label="مانده بدهی فعلی" tone={data.balanceRls > 0 ? 'warn' : 'good'} value={<Money rls={data.balanceRls} />} />
            <StatCard label="سقف اعتبار" value={<Money rls={data.customer.creditLimitRls} />} />
            <StatCard label="مهلت تسویه" value={`${formatFaNumber(data.customer.creditDays)} روز`} />
          </div>
          <DataTable
            columns={[
              { key: 'time', header: 'زمان', cell: (e: LedgerData['entries'][0]) => <span className="text-xs"><JDate d={e.createdAt} time /></span> },
              { key: 'type', header: 'سند', cell: (e: LedgerData['entries'][0]) => <Badge variant="secondary" className="text-[10px]">{ENTRY_TYPE_LABELS[e.entryType] ?? e.entryType}</Badge> },
              { key: 'amount', header: 'مبلغ', cell: (e: LedgerData['entries'][0]) => <Money rls={e.amountRls} sign className={`text-sm font-bold ${e.amountRls > 0 ? 'text-amber-700' : 'text-emerald-700'}`} /> },
              { key: 'balance', header: 'مانده پس از سند', cell: (e: LedgerData['entries'][0]) => <Money rls={e.balanceAfterRls} className="text-sm" /> },
              { key: 'desc', header: 'توضیح', cell: (e: LedgerData['entries'][0]) => <span className="text-xs text-muted-foreground">{e.description ?? '—'}</span> },
            ]}
            rows={data.entries}
            loading={loading}
            rowKey={(e: LedgerData['entries'][0]) => e.id}
            empty="گردشی ثبت نشده است"
          />
        </>
      )}
      {!customerId && <p className="text-sm text-muted-foreground text-center py-8">برای مشاهده گردش، مشتری را انتخاب کنید</p>}
    </div>
  )
}

function ReceiptsTab({ refresh }: { refresh: number }) {
  const { data, loading, error } = useApiData<Receipt[]>(refresh >= 0 ? '/api/finance?type=receipts' : null)
  if (error) return <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
  return (
    <DataTable
      columns={[
        { key: 'no', header: 'شماره', cell: (r: Receipt) => <span className="font-mono text-xs" dir="ltr">{r.receiptNo}</span> },
        { key: 'customer', header: 'مشتری', cell: (r: Receipt) => <span className="text-sm">{r.customer.shopName}</span> },
        { key: 'amount', header: 'مبلغ', cell: (r: Receipt) => <Money rls={r.amountRls} className="text-sm font-bold text-emerald-700" /> },
        { key: 'method', header: 'روش', cell: (r: Receipt) => <span className="text-xs">{r.method === 'CASH' ? 'نقدی' : r.method === 'TRANSFER' ? 'انتقالی' : 'چک'}</span> },
        { key: 'ref', header: 'مرجع', cell: (r: Receipt) => <span className="text-xs text-muted-foreground" dir="ltr">{r.refNo ?? '—'}</span> },
        { key: 'time', header: 'زمان', cell: (r: Receipt) => <span className="text-xs"><JDate d={r.createdAt} time /></span> },
        { key: 'note', header: 'یادداشت', cell: (r: Receipt) => <span className="text-xs text-muted-foreground line-clamp-1">{r.note ?? '—'}</span> },
      ]}
      rows={data ?? []}
      loading={loading}
      rowKey={(r: Receipt) => r.id}
      empty="دریافتی ثبت نشده است"
    />
  )
}

function PaymentsTab({ refresh }: { refresh: number }) {
  const { data, loading, error } = useApiData<Payment[]>(refresh >= 0 ? '/api/finance?type=payments' : null)
  if (error) return <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
  return (
    <DataTable
      columns={[
        { key: 'no', header: 'شماره', cell: (p: Payment) => <span className="font-mono text-xs" dir="ltr">{p.paymentNo}</span> },
        { key: 'supplier', header: 'تأمین‌کننده', cell: (p: Payment) => <span className="text-sm">{p.supplier?.name ?? '—'}</span> },
        { key: 'category', header: 'نوع', cell: (p: Payment) => <Badge variant="secondary" className="text-[10px]">{p.category === 'SUPPLIER' ? 'تأمین‌کننده' : p.category === 'SALARY' ? 'حقوق' : 'هزینه'}</Badge> },
        { key: 'amount', header: 'مبلغ', cell: (p: Payment) => <Money rls={p.amountRls} className="text-sm font-bold" /> },
        { key: 'method', header: 'روش', cell: (p: Payment) => <span className="text-xs">{p.method === 'CASH' ? 'نقدی' : p.method === 'TRANSFER' ? 'انتقالی' : 'چک'}</span> },
        { key: 'time', header: 'زمان', cell: (p: Payment) => <span className="text-xs"><JDate d={p.createdAt} time /></span> },
        { key: 'note', header: 'یادداشت', cell: (p: Payment) => <span className="text-xs text-muted-foreground line-clamp-1">{p.note ?? '—'}</span> },
      ]}
      rows={data ?? []}
      loading={loading}
      rowKey={(p: Payment) => p.id}
      empty="پرداختی ثبت نشده است"
    />
  )
}

function ReceiptDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { data: customers } = useApiData<CustomerListItem[]>(open ? '/api/customers' : null)
  const [form, setForm] = useState({ customerId: '', amountToman: '', method: 'CASH', refNo: '', note: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.customerId || Number(form.amountToman) < 1) { toast.error('مشتری و مبلغ الزامی است'); return }
    setBusy(true)
    try {
      const res = await apiFetch<{ receiptNo: string }>('/api/finance/receipts', {
        method: 'POST',
        body: JSON.stringify({
          customerId: form.customerId,
          amountRls: Math.round(Number(form.amountToman) * 10),
          method: form.method,
          refNo: form.refNo || null,
          note: form.note || null,
        }),
      })
      toast.success(`دریافت ${res.receiptNo} ثبت و در Ledger مشتری سند منفی شد`)
      onDone(); onOpenChange(false)
      setForm({ customerId: '', amountToman: '', method: 'CASH', refNo: '', note: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت ناموفق بود')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>ثبت دریافت از مشتری</DialogTitle><DialogDescription>مانده بدهی مشتری از Ledger محاسبه می‌شود؛ دریافت، سند منفی می‌خورد.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="مشتری" required>
            <Select value={form.customerId} onValueChange={v => set('customerId', v)}>
              <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
              <SelectContent className="max-h-52">
                {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.shopName} — بدهی: <Money rls={c.balanceRls} /></SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="مبلغ (تومان)" required><Input dir="ltr" type="number" min={1} value={form.amountToman} onChange={e => set('amountToman', e.target.value)} /></Field>
          <Field label="روش">
            <Select value={form.method} onValueChange={v => set('method', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="CASH">نقدی</SelectItem><SelectItem value="TRANSFER">انتقالی/کارت</SelectItem><SelectItem value="CHEQUE">چک</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="شماره مرجع"><Input dir="ltr" value={form.refNo} onChange={e => set('refNo', e.target.value)} /></Field>
          <Field label="یادداشت"><Input value={form.note} onChange={e => set('note', e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button onClick={submit} disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت دریافت'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PaymentDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { data: suppliers } = useApiData<Array<{ id: string; name: string; code: string; balanceRls: number }>>(open ? '/api/suppliers' : null)
  const [form, setForm] = useState({ category: 'SUPPLIER', supplierId: '', amountToman: '', method: 'CASH', refNo: '', note: '' })
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (Number(form.amountToman) < 1) { toast.error('مبلغ الزامی است'); return }
    if (form.category === 'SUPPLIER' && !form.supplierId) { toast.error('انتخاب تأمین‌کننده الزامی است'); return }
    setBusy(true)
    try {
      const res = await apiFetch<{ paymentNo: string }>('/api/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: form.category === 'SUPPLIER' ? form.supplierId : null,
          category: form.category,
          amountRls: Math.round(Number(form.amountToman) * 10),
          method: form.method,
          refNo: form.refNo || null,
          note: form.note || null,
        }),
      })
      toast.success(`پرداخت ${res.paymentNo} ثبت شد`)
      onDone(); onOpenChange(false)
      setForm({ category: 'SUPPLIER', supplierId: '', amountToman: '', method: 'CASH', refNo: '', note: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت ناموفق بود')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>ثبت پرداخت</DialogTitle><DialogDescription>پرداخت به تأمین‌کننده در Ledger تأمین‌کننده ثبت می‌شود.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="نوع پرداخت" required>
            <Select value={form.category} onValueChange={v => set('category', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="SUPPLIER">پرداخت به تأمین‌کننده</SelectItem><SelectItem value="EXPENSE">هزینه</SelectItem><SelectItem value="SALARY">حقوق و پورسانت</SelectItem></SelectContent>
            </Select>
          </Field>
          {form.category === 'SUPPLIER' && (
            <Field label="تأمین‌کننده" required>
              <Select value={form.supplierId} onValueChange={v => set('supplierId', v)}>
                <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
                <SelectContent>
                  {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name} — بدهی ما: <Money rls={s.balanceRls} /></SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="مبلغ (تومان)" required><Input dir="ltr" type="number" min={1} value={form.amountToman} onChange={e => set('amountToman', e.target.value)} /></Field>
          <Field label="روش">
            <Select value={form.method} onValueChange={v => set('method', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="CASH">نقدی</SelectItem><SelectItem value="TRANSFER">انتقالی/کارت</SelectItem><SelectItem value="CHEQUE">چک</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="شماره مرجع"><Input dir="ltr" value={form.refNo} onChange={e => set('refNo', e.target.value)} /></Field>
          <Field label="یادداشت"><Input value={form.note} onChange={e => set('note', e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button onClick={submit} disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت پرداخت'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
