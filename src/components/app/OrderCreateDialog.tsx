'use client'
// ثبت سفارش — انتخاب مشتری/شعبه، ساخت اقلام با قیمت و موجودی زنده سرور، ثبت با Idempotency
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, formatFaNumber, Money, Field } from './kit'
import type { ProductListItem, CustomerListItem, BranchItem, SessionUserLike } from './types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Plus, Trash2, Info } from 'lucide-react'
import { toast } from 'sonner'

type PricePreview = { priceRls: number; unitFactor: number; scope: string; note: string | null; availableBase: number | null }

type DraftItem = {
  productId: string
  productName: string
  unitId: string
  unitName: string
  factor: number
  qty: number
  qtyBase: number
  unitPriceRls: number
  lineTotalRls: number
  availableBase: number | null
}

export default function OrderCreateDialog({ open, onOpenChange, onCreated, presetCustomerId }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
  presetCustomerId?: string
}) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [loadingBase, setLoadingBase] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [payMethod, setPayMethod] = useState<'CASH' | 'CREDIT' | 'TRANSFER'>('CREDIT')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([])
  const [productId, setProductId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [qty, setQty] = useState('1')
  const [preview, setPreview] = useState<PricePreview | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const idemKey = useRef<string>('')

  const customer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId])
  const product = useMemo(() => products.find(p => p.id === productId), [products, productId])
  const unit = useMemo(() => product?.units.find(u => u.id === unitId), [product, unitId])
  const qtyBase = unit && Number.isInteger(Number(qty)) && Number(qty) > 0 ? unit.factor * Number(qty) : null

  // بارگذاری پایه با هر بار باز شدن
  useEffect(() => {
    if (!open) return
    idemKey.current = crypto.randomUUID()
    setItems([]); setNotes(''); setBranchId(''); setCustomerId(presetCustomerId ?? ''); setPreview(null)
    setLoadingBase(true)
    Promise.all([
      apiFetch<CustomerListItem[]>('/api/customers').catch(() => []),
      apiFetch<ProductListItem[]>('/api/products').catch(() => []),
    ]).then(([cs, ps]) => {
      setCustomers(cs.filter(c => c.status === 'ACTIVE'))
      setProducts(ps.filter(p => p.isActive))
    }).finally(() => setLoadingBase(false))
  }, [open, presetCustomerId])

  // شعبه‌ها با انتخاب مشتری
  useEffect(() => {
    if (!customerId) { setBranches([]); return }
    apiFetch<{ branches: BranchItem[] }>(`/api/customers/${customerId}`)
      .then(d => setBranches(d.branches.filter(b => b.isActive)))
      .catch(() => setBranches([]))
  }, [customerId])

  // پیش‌نمایش قیمت زنده — منبع حقیقت: سرور
  useEffect(() => {
    if (!open || !productId || !unitId || !qtyBase || !customerId) { setPreview(null); return }
    setPreviewBusy(true)
    const t = setTimeout(() => {
      apiFetch<PricePreview>(`/api/pricing?productId=${productId}&unitId=${unitId}&qtyBase=${qtyBase}&customerId=${customerId}`)
        .then(setPreview)
        .catch(e => setPreview(null))
        .finally(() => setPreviewBusy(false))
    }, 250)
    return () => clearTimeout(t)
  }, [open, productId, unitId, qtyBase, customerId])

  const addItem = () => {
    if (!product || !unit || !qtyBase || qtyBase <= 0) {
      toast.error('کالا، واحد و مقدار را انتخاب کنید')
      return
    }
    if (preview && preview.availableBase != null && preview.availableBase < qtyBase) {
      toast.error(`موجودی قابل فروش کافی نیست (قابل فروش: ${formatFaNumber(preview.availableBase)})`)
      return
    }
    if (!preview) {
      toast.error('قیمت هنوز از سرور دریافت نشده است')
      return
    }
    const line: DraftItem = {
      productId: product.id, productName: product.name,
      unitId: unit.id, unitName: unit.name, factor: unit.factor,
      qty: Number(qty), qtyBase,
      unitPriceRls: preview.priceRls,
      lineTotalRls: Number(qty) * preview.priceRls,
      availableBase: preview.availableBase,
    }
    setItems(prev => {
      const existing = prev.find(i => i.productId === line.productId && i.unitId === line.unitId)
      if (existing) {
        return prev.map(i => i === existing ? { ...i, qty: i.qty + line.qty, qtyBase: i.qtyBase + line.qtyBase, lineTotalRls: i.lineTotalRls + line.lineTotalRls } : i)
      }
      return [...prev, line]
    })
    setProductId(''); setUnitId(''); setQty('1'); setPreview(null)
  }

  const totalRls = items.reduce((s, i) => s + i.lineTotalRls, 0)

  const submit = async () => {
    if (!customerId) { toast.error('انتخاب مشتری الزامی است'); return }
    if (!items.length) { toast.error('حداقل یک قلم به سفارش اضافه کنید'); return }
    setSubmitting(true)
    try {
      const res = await apiFetch<{ orderNo: string; totalRls: number; idempotent: boolean }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          branchId: branchId || null,
          payMethod,
          notes: notes || null,
          idempotencyKey: idemKey.current,
          items: items.map(i => ({ productId: i.productId, unitId: i.unitId, qty: i.qty })),
        }),
      })
      toast.success(res.idempotent ? `سفارش ${res.orderNo} قبلاً ثبت شده بود (درخواست تکراری)` : `سفارش ${res.orderNo} ثبت و موجودی رزرو شد`)
      onCreated()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت سفارش ناموفق بود')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت سفارش جدید</DialogTitle>
          <DialogDescription>قیمت و موجودی در لحظه از سرور دریافت می‌شود؛ رزرو پس از ثبت قطعی است.</DialogDescription>
        </DialogHeader>

        {loadingBase ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin ml-2" /> در حال بارگذاری…</div>
        ) : (
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="مشتری" required>
                <Select value={customerId} onValueChange={v => { setCustomerId(v); setBranchId('') }}>
                  <SelectTrigger><SelectValue placeholder="انتخاب فروشگاه…" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.shopName} ({c.code}) — مانده: <Money rls={c.balanceRls} /></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="شعبه" hint={branches.length === 0 ? 'شعبه‌ای ثبت نشده است' : undefined}>
                <Select value={branchId} onValueChange={setBranchId} disabled={!customerId || branches.length === 0}>
                  <SelectTrigger><SelectValue placeholder={customerId ? 'انتخاب شعبه…' : 'ابتدا مشتری'} /></SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {customer && (
              <div className="rounded-lg bg-stone-50 border px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                <span>گروه: <b className="text-stone-700">{customer.groupKey === 'GOLD' ? 'طلایی' : customer.groupKey === 'WHOLESALE' ? 'عمده' : 'معمولی'}</b></span>
                <span>سقف اعتبار: <Money rls={customer.creditLimitRls} /></span>
                <span>مانده بدهی: <Money rls={customer.balanceRls} /></span>
                <span>اعتبار باقی‌مانده: <Money rls={customer.remainingCreditRls} /></span>
              </div>
            )}

            {/* ساخت قلم */}
            <div className="rounded-xl border p-3 grid gap-3">
              <div className="grid sm:grid-cols-4 gap-2 items-end">
                <Field label="کالا" required>
                  <Select value={productId} onValueChange={v => { setProductId(v); setUnitId(v ? (products.find(p => p.id === v)?.units[0]?.id ?? '') : '') }}>
                    <SelectTrigger><SelectValue placeholder="انتخاب کالا…" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="واحد فروش" required>
                  <Select value={unitId} onValueChange={setUnitId} disabled={!product}>
                    <SelectTrigger><SelectValue placeholder={product ? 'انتخاب واحد…' : 'ابتدا کالا'} /></SelectTrigger>
                    <SelectContent>
                      {product?.units.map(u => <SelectItem key={u.id} value={u.id}>{u.name} {u.factor > 1 ? `(${formatFaNumber(u.factor)} عدد)` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="مقدار" required>
                  <Input dir="ltr" type="number" min={1} step={1} value={qty} onChange={e => setQty(e.target.value)} />
                </Field>
                <Button type="button" onClick={addItem} className="h-10"><Plus className="h-4 w-4 ml-1" /> افزودن</Button>
              </div>
              {qtyBase != null && productId && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
                  {previewBusy ? (
                    <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> دریافت قیمت از سرور…</span>
                  ) : preview ? (
                    <>
                      <span>قیمت واحد: <Money rls={preview.priceRls} className="font-bold text-emerald-800" /></span>
                      <span>مبلغ خط: <Money rls={Number(qty || 0) * preview.priceRls} className="font-bold text-emerald-800" /></span>
                      <span>قابل فروش: <b>{formatFaNumber(preview.availableBase ?? 0)}</b> واحد پایه</span>
                      <span className="text-emerald-700">(منبع قیمت: {preview.scope === 'DEFAULT' ? 'عمومی' : preview.scope === 'CUSTOMER' ? 'اختصاصی مشتری' : preview.scope === 'GROUP' ? 'گروه مشتری' : preview.scope})</span>
                      {preview.note && <span className="text-amber-700 flex items-center gap-1"><Info className="h-3 w-3" /> {preview.note}</span>}
                    </>
                  ) : (
                    <span className="text-rose-600">قیمت معتبری برای این کالا/واحد/مقدار یافت نشد</span>
                  )}
                </div>
              )}
            </div>

            {/* اقلام */}
            {items.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50">
                      <TableHead>کالا</TableHead>
                      <TableHead>واحد</TableHead>
                      <TableHead>مقدار</TableHead>
                      <TableHead>قیمت واحد</TableHead>
                      <TableHead>مبلغ</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i, idx) => (
                      <TableRow key={`${i.productId}-${i.unitId}-${idx}`}>
                        <TableCell className="text-sm">{i.productName}</TableCell>
                        <TableCell className="text-xs">{i.unitName}</TableCell>
                        <TableCell className="text-sm">{formatFaNumber(i.qty)} × {formatFaNumber(i.factor)}</TableCell>
                        <TableCell><Money rls={i.unitPriceRls} className="text-sm" /></TableCell>
                        <TableCell><Money rls={i.lineTotalRls} className="text-sm font-bold" /></TableCell>
                        <TableCell>
                          <button className="text-rose-500 hover:text-rose-700" aria-label="حذف" onClick={() => setItems(prev => prev.filter((_, j) => j !== idx))}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-t text-sm">
                  <span>جمع کل سفارش:</span>
                  <Money rls={totalRls} className="font-black text-emerald-700 text-base" />
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="روش پرداخت" required>
                <Select value={payMethod} onValueChange={v => setPayMethod(v as 'CASH' | 'CREDIT' | 'TRANSFER')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">نقدی (پرداخت هنگام تحویل)</SelectItem>
                    <SelectItem value="CREDIT">اعتباری (داخل سقف اعتبار)</SelectItem>
                    <SelectItem value="TRANSFER">انتقالی/کارت به کارت</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="توضیحات">
                <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختیاری…" />
              </Field>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-muted-foreground">در صورت قطع اینترنت، ارسال مجدد سفارش تکراری نسازد (Idempotency Key).</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
                <Button onClick={submit} disabled={submitting || items.length === 0 || !customerId}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin ml-1" />} ثبت سفارش
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
