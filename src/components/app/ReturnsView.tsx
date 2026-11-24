'use client'
// مرجوعی کالا — درخواست، بررسی مدیر با کنترل کیفیت و سند اصلاح مالی
import { useState } from 'react'
import { apiFetch, useApiData, DataTable, Money, JDate, PageHeader, StatusBadge, Field, formatFaNumber } from './kit'
import type { OrderListItem, SessionUserLike } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, RefreshCw } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { DISPOSITION_LABELS } from '@/lib/format'

type ReturnRow = {
  id: string
  returnNo: string
  status: string
  reason: string | null
  order: { orderNo: string; totalRls: number }
  customer: { code: string; shopName: string }
  items: Array<{ id: string; productName: string; baseUnitName: string; qtyBase: number; reason: string | null; disposition: string; qcNote: string | null }>
  reviewedAt: string | null
  financialPosted: boolean
  createdAt: string
}

type OrderForReturn = OrderListItem & { items?: unknown }

export default function ReturnsView({ user }: { user: SessionUserLike }) {
  const [refresh, setRefresh] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const { data, loading, error, reload } = useApiData<ReturnRow[]>(refresh >= 0 ? '/api/returns' : null)
  const canManage = user.permissions.includes('returns.manage')
  const canCreate = user.permissions.includes('orders.create')

  return (
    <div>
      <PageHeader
        title="مرجوعی کالا"
        desc="جریان مستقل از لغو سفارش: درخواست → بررسی و کنترل کیفیت → تعیین تکلیف → سند اصلاح مالی"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 ml-1" /> به‌روزرسانی</Button>
            {canCreate && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> درخواست مرجوعی</Button>}
          </>
        }
      />

      {error ? (
        <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
      ) : (
        <DataTable
          columns={[
            { key: 'no', header: 'شماره', cell: (r: ReturnRow) => <span className="font-mono text-xs" dir="ltr">{r.returnNo}</span> },
            { key: 'order', header: 'سفارش', cell: (r: ReturnRow) => <span className="font-mono text-xs" dir="ltr">{r.order.orderNo}</span> },
            { key: 'customer', header: 'مشتری', cell: (r: ReturnRow) => <span className="text-sm">{r.customer.shopName}</span> },
            { key: 'items', header: 'اقلام', cell: (r: ReturnRow) => <span className="text-xs">{formatFaNumber(r.items.length)} قلم</span> },
            { key: 'reason', header: 'دلیل', cell: (r: ReturnRow) => <span className="text-xs text-muted-foreground line-clamp-1">{r.reason ?? '—'}</span> },
            { key: 'status', header: 'وضعیت', cell: (r: ReturnRow) => <StatusBadge status={r.status} /> },
            { key: 'fin', header: 'سند مالی', cell: (r: ReturnRow) => r.financialPosted ? <Badge className="border-transparent bg-emerald-100 text-emerald-800">ثبت شد</Badge> : <span className="text-xs text-muted-foreground">—</span> },
            { key: 'time', header: 'زمان', cell: (r: ReturnRow) => <span className="text-xs"><JDate d={r.createdAt} /></span> },
            { key: 'actions', header: '', cell: (r: ReturnRow) => r.status !== 'CLOSED' && canManage ? <Button variant="ghost" size="sm" onClick={() => setReviewId(r.id)}>بررسی</Button> : null },
          ]}
          rows={data ?? []}
          loading={loading}
          rowKey={(r: ReturnRow) => r.id}
          empty="درخواست مرجوعی‌ای ثبت نشده است"
        />
      )}

      <CreateReturnDialog open={createOpen} onOpenChange={setCreateOpen} onDone={() => { reload(); setRefresh(r => r + 1) }} />
      <ReviewDialog id={reviewId} onClose={() => setReviewId(null)} onDone={() => { reload(); setRefresh(r => r + 1) }} />
    </div>
  )
}

function CreateReturnDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { data: orders } = useApiData<OrderListItem[]>(open ? '/api/orders?take=150' : null)
  const eligible = (orders ?? []).filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status))
  const [orderId, setOrderId] = useState('')
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState<{ items: Array<{ productId: string; productName: string; unitName: string; qtyBase: number }> } | null>(null)
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const pickOrder = async (id: string) => {
    setOrderId(id); setDetail(null); setQtys({})
    if (!id) return
    try {
      const d = await apiFetch<{ items: Array<{ productId: string; productName: string; unitName: string; qtyBase: number }> }>(`/api/orders/${id}`)
      setDetail(d)
    } catch {
      toast.error('دریافت اقلام سفارش ناموفق بود')
    }
  }

  const submit = async () => {
    const items = Object.entries(qtys)
      .map(([productId, q]) => ({ productId, qtyBase: Number(q) }))
      .filter(i => i.qtyBase > 0)
    if (!orderId || !reason || items.length === 0) { toast.error('سفارش، دلیل و حداقل یک قلم با مقدار الزامی است'); return }
    setBusy(true)
    try {
      const res = await apiFetch<{ returnNo: string }>('/api/returns', {
        method: 'POST',
        body: JSON.stringify({ orderId, reason, items: items.map(i => ({ ...i, reason: reason })) }),
      })
      toast.success(`درخواست ${res.returnNo} ثبت شد و برای بررسی ارسال شد`)
      onDone(); onOpenChange(false)
      setOrderId(''); setReason(''); setDetail(null); setQtys({})
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت ناموفق بود')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>درخواست مرجوعی</DialogTitle><DialogDescription>فقط سفارش‌های تحویل‌شده قابل مرجوع‌اند؛ مجموع مرجوعی از مقدار سفارش بیشتر نمی‌شود.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <Field label="سفارش تحویل‌شده" required>
            <Select value={orderId} onValueChange={pickOrder}>
              <SelectTrigger><SelectValue placeholder="انتخاب سفارش…" /></SelectTrigger>
              <SelectContent className="max-h-52">
                {eligible.map(o => <SelectItem key={o.id} value={o.id}>{o.orderNo} — {o.customer.shopName} (<Money rls={o.totalRls} />)</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {detail && (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-stone-50"><TableHead>کالا</TableHead><TableHead>مقدار سفارش</TableHead><TableHead>مقدار مرجوعی (واحد پایه)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {detail.items.map(i => (
                    <TableRow key={i.productId}>
                      <TableCell className="text-sm">{i.productName}</TableCell>
                      <TableCell className="text-xs">{formatFaNumber(i.qtyBase)} پایه</TableCell>
                      <TableCell>
                        <Input dir="ltr" type="number" min={0} max={i.qtyBase} className="w-24" value={qtys[i.productId] ?? ''} onChange={e => setQtys(q => ({ ...q, [i.productId]: e.target.value }))} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Field label="دلیل مرجوعی" required><Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="مثلاً: قوطی‌های متورم…" /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
            <Button onClick={submit} disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت درخواست'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReviewDialog({ id, onClose, onDone }: { id: string | null; onClose: () => void; onDone: () => void }) {
  const { data, reload } = useApiData<{
    id: string; returnNo: string; status: string; reason: string | null
    customer: { shopName: string }; order: { orderNo: string }
    items: Array<{ id: string; productId: string; productName: string; baseUnitName: string; qtyBase: number; reason: string | null; disposition: string; unitPriceRls: number | null }>
  }>(id ? `/api/returns/${id}` : null)
  const [dispositions, setDispositions] = useState<Record<string, string>>({})
  const [qc, setQc] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!data) return
    const items = data.items.map(i => ({
      itemId: i.id,
      disposition: dispositions[i.id] ?? 'SCRAP',
      qcNote: qc || null,
    }))
    setBusy(true)
    try {
      const res = await apiFetch<{ creditRls: number }>(`/api/returns/${data.id}`, {
        method: 'POST',
        body: JSON.stringify({ note: qc || null, items }),
      })
      toast.success(res.creditRls > 0 ? `بررسی شد — سند اعتبار به مبلغ ${res.creditRls / 10} تومان در Ledger ثبت گردید` : 'بررسی شد — مبلغی برای سند اعتبار وجود نداشت')
      onDone(); onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'بررسی ناموفق بود')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={!!id} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        {data && (
          <>
            <DialogHeader>
              <DialogTitle>بررسی مرجوعی <span className="font-mono text-sm" dir="ltr">{data.returnNo}</span></DialogTitle>
              <DialogDescription>{data.customer.shopName} — سفارش <span dir="ltr">{data.order.orderNo}</span> | {data.reason}</DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-stone-50"><TableHead>کالا</TableHead><TableHead>مقدار</TableHead><TableHead>تعیین تکلیف</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.items.map(i => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div className="text-sm">{i.productName}</div>
                        {i.reason && <div className="text-[11px] text-muted-foreground">{i.reason}</div>}
                      </TableCell>
                      <TableCell className="text-xs">{formatFaNumber(i.qtyBase)} پایه</TableCell>
                      <TableCell>
                        <Select value={dispositions[i.id] ?? ''} onValueChange={v => setDispositions(d => ({ ...d, [i.id]: v }))}>
                          <SelectTrigger className="w-48"><SelectValue placeholder="انتخاب تکلیف…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RESTOCK">ورود مجدد به انبار (پس از QC)</SelectItem>
                            <SelectItem value="SCRAP">ضایعات</SelectItem>
                            <SelectItem value="QUARANTINE">قرنطینه</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Field label="یادداشت کنترل کیفیت" hint="برای همه اقلام ثبت می‌شود"><Input value={qc} onChange={e => setQc(e.target.value)} /></Field>
            <p className="text-[11px] text-muted-foreground">فقط اقلام «ورود مجدد» پس از کنترل کیفیت به موجودی قابل فروش اضافه می‌شوند؛ مبلغ اقلام پذیرفته‌شده با سند اعتبار (CREDIT_NOTE) از بدهی مشتری کسر می‌گردد.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>انصراف</Button>
              <Button onClick={submit} disabled={busy}>{busy ? 'در حال ثبت…' : 'ثبت بررسی و اسناد'}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
