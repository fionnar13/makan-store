'use client'
// گزارش‌های تحلیلی — فروش، انبار، مطالبات
import { useState } from 'react'
import { useApiData, DataTable, Money, JDate, PageHeader, StatCard, formatFaNumber, Spinner } from './kit'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

type SalesDay = { day: string; dayLabel: string; revenueRls: number }
type SalesProduct = { id: string; name: string; sku: string; qtyBase: number; revenueRls: number }
type SalesCustomer = { id: string; name: string; code: string; orders: number; revenueRls: number }
type SalesVisitor = { id: string; name: string; orders: number; revenueRls: number }
type SalesTerritory = { id: string; name: string; orders: number; revenueRls: number }

type InventoryReport = {
  balances: Array<{ product: { name: string; sku: string; baseUnitName: string }; warehouse: string; physicalBase: number; reservedBase: number; availableBase: number; belowReorder: boolean }>
  nearExpiry: Array<{ product: { name: string }; lotNo: string; expiresAt: string; remainingBase: number }>
  expired: Array<{ product: { name: string }; lotNo: string; expiresAt: string; remainingBase: number }>
}
type Receivable = { code: string; shopName: string; balanceRls: number; creditLimitRls: number; creditDays: number; usagePct: number | null; lastReceiptAt: string | null }

const shortMoney = (v: number) => {
  if (v >= 1_000_000_000) return `${formatFaNumber(Math.round(v / 1_000_000_000))} میلیارد`
  if (v >= 1_000_000) return `${formatFaNumber(Math.round(v / 1_000_000))} م`
  if (v >= 1000) return `${formatFaNumber(Math.round(v / 1000))} ه`
  return formatFaNumber(v)
}

export default function ReportsView() {
  const [groupBy, setGroupBy] = useState('day')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const qs = `type=sales&groupBy=${groupBy}${from ? `&from=${new Date(from).toISOString()}` : ''}${to ? `&to=${new Date(to).toISOString()}` : ''}`

  return (
    <div>
      <PageHeader title="گزارش‌های تحلیلی" desc="فیلتر تاریخ روی همه گزارش‌ها اعمال می‌شود — منبع داده: Database واقعی" />

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">فروش</TabsTrigger>
          <TabsTrigger value="inventory">انبار</TabsTrigger>
          <TabsTrigger value="receivables">مطالبات</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="mt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">روند روزانه</SelectItem>
                <SelectItem value="product">به تفکیک کالا</SelectItem>
                <SelectItem value="customer">به تفکیک مشتری</SelectItem>
                <SelectItem value="visitor">به تفکیک ویزیتور</SelectItem>
                <SelectItem value="territory">به تفکیک منطقه</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} aria-label="از تاریخ" />
            <Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} aria-label="تا تاریخ" />
          </div>
          <SalesReport qs={qs} groupBy={groupBy} />
        </TabsContent>

        <TabsContent value="inventory" className="mt-4"><InventoryReportTab /></TabsContent>
        <TabsContent value="receivables" className="mt-4"><ReceivablesTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function SalesReport({ qs, groupBy }: { qs: string; groupBy: string }) {
  const { data, loading, error } = useApiData<SalesDay[] | SalesProduct[] | SalesCustomer[] | SalesVisitor[] | SalesTerritory[]>(qs)

  if (loading) return <Spinner />
  if (error) return <p className="text-sm text-rose-600 py-6 text-center">{error}</p>

  if (groupBy === 'day') {
    const rows = (data as SalesDay[]) ?? []
    const total = rows.reduce((s, r) => s + r.revenueRls, 0)
    return (
      <div className="grid gap-4">
        <StatCard label="جمع فروش دوره (تحویل‌شده)" tone="good" value={<Money rls={total} />} />
        {rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">در این دوره فروشی ثبت نشده است</p> : (
          <div className="rounded-xl border bg-card p-4" dir="ltr">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rows} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} reversed />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={shortMoney} orientation="right" width={70} />
                <Tooltip formatter={(v: number) => [`${formatFaNumber(Math.round(v / 10))} تومان`, 'فروش']} labelStyle={{ direction: 'rtl' }} />
                <Bar dataKey="revenueRls" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <DataTable
          columns={[
            { key: 'day', header: 'روز', cell: (r: SalesDay) => <span className="text-sm">{r.dayLabel}</span> },
            { key: 'revenue', header: 'فروش', cell: (r: SalesDay) => <Money rls={r.revenueRls} className="text-sm font-bold" /> },
          ]}
          rows={rows}
          rowKey={(r: SalesDay) => r.day}
          empty="داده‌ای نیست"
        />
      </div>
    )
  }

  if (groupBy === 'product') {
    const rows = (data as SalesProduct[]) ?? []
    return (
      <DataTable
        columns={[
          { key: 'name', header: 'کالا', cell: (r: SalesProduct) => <div><div className="text-sm">{r.name}</div><div className="text-[11px] text-muted-foreground" dir="ltr">{r.sku}</div></div> },
          { key: 'qty', header: 'تعداد فروش (پایه)', cell: (r: SalesProduct) => <span className="text-sm">{formatFaNumber(r.qtyBase)}</span> },
          { key: 'revenue', header: 'درآمد', cell: (r: SalesProduct) => <Money rls={r.revenueRls} className="text-sm font-bold" /> },
        ]}
        rows={rows}
        rowKey={(r: SalesProduct) => r.id}
        empty="در این دوره فروشی ثبت نشده است"
      />
    )
  }

  if (groupBy === 'customer') {
    const rows = (data as SalesCustomer[]) ?? []
    return (
      <DataTable
        columns={[
          { key: 'name', header: 'مشتری', cell: (r: SalesCustomer) => <span className="text-sm">{r.name} <span className="text-[11px] text-muted-foreground" dir="ltr">({r.code})</span></span> },
          { key: 'orders', header: 'سفارش', cell: (r: SalesCustomer) => <span className="text-sm">{formatFaNumber(r.orders)}</span> },
          { key: 'revenue', header: 'درآمد', cell: (r: SalesCustomer) => <Money rls={r.revenueRls} className="text-sm font-bold" /> },
        ]}
        rows={rows}
        rowKey={(r: SalesCustomer) => r.id}
        empty="در این دوره فروشی ثبت نشده است"
      />
    )
  }

  if (groupBy === 'visitor') {
    const rows = (data as SalesVisitor[]) ?? []
    return (
      <DataTable
        columns={[
          { key: 'name', header: 'ویزیتور', cell: (r: SalesVisitor) => <span className="text-sm">{r.name}</span> },
          { key: 'orders', header: 'سفارش', cell: (r: SalesVisitor) => <span className="text-sm">{formatFaNumber(r.orders)}</span> },
          { key: 'revenue', header: 'درآمد', cell: (r: SalesVisitor) => <Money rls={r.revenueRls} className="text-sm font-bold" /> },
        ]}
        rows={rows}
        rowKey={(r: SalesVisitor) => r.id}
        empty="در این دوره فروشی ثبت نشده است"
      />
    )
  }

  const rows = (data as SalesTerritory[]) ?? []
  return (
    <DataTable
      columns={[
        { key: 'name', header: 'منطقه', cell: (r: SalesTerritory) => <span className="text-sm">{r.name}</span> },
        { key: 'orders', header: 'سفارش', cell: (r: SalesTerritory) => <span className="text-sm">{formatFaNumber(r.orders)}</span> },
        { key: 'revenue', header: 'درآمد', cell: (r: SalesTerritory) => <Money rls={r.revenueRls} className="text-sm font-bold" /> },
      ]}
      rows={rows}
      rowKey={(r: SalesTerritory) => r.id}
      empty="در این دوره فروشی ثبت نشده است"
    />
  )
}

function InventoryReportTab() {
  const { data, loading, error } = useApiData<InventoryReport>('/api/reports?type=inventory')
  if (error) return <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
  return (
    <div className="grid gap-4">
      {data && (data.expired.length > 0 || data.nearExpiry.length > 0) && (
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-2.5 text-sm font-bold border-b bg-stone-50">هشدار انقضا (۹۰ روز آینده و گذشته)</div>
          <div className="p-3 grid gap-1.5 text-xs max-h-40 overflow-y-auto">
            {data.expired.map(l => (
              <div key={l.lotNo} className="flex justify-between rounded-lg bg-rose-50 border border-rose-100 px-2.5 py-1.5">
                <span>{l.product.name} — <span dir="ltr">{l.lotNo}</span></span>
                <span className="text-rose-700 font-bold">منقضی — {formatFaNumber(l.remainingBase)} پایه</span>
              </div>
            ))}
            {data.nearExpiry.map(l => (
              <div key={l.lotNo} className="flex justify-between rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-1.5">
                <span>{l.product.name} — <span dir="ltr">{l.lotNo}</span></span>
                <span className="text-amber-700">انقضا: <JDate d={l.expiresAt} /></span>
              </div>
            ))}
          </div>
        </div>
      )}
      <DataTable
        columns={[
          { key: 'product', header: 'کالا', cell: (b: InventoryReport['balances'][0]) => <div><div className="text-sm">{b.product.name}</div><div className="text-[11px] text-muted-foreground" dir="ltr">{b.product.sku}</div></div> },
          { key: 'wh', header: 'انبار', cell: (b: InventoryReport['balances'][0]) => <span className="text-xs">{b.warehouse}</span> },
          { key: 'physical', header: 'فیزیکی', cell: (b: InventoryReport['balances'][0]) => <span className="text-sm">{formatFaNumber(b.physicalBase)}</span> },
          { key: 'reserved', header: 'رزروشده', cell: (b: InventoryReport['balances'][0]) => <span className="text-sm text-amber-700">{formatFaNumber(b.reservedBase)}</span> },
          { key: 'available', header: 'قابل فروش', cell: (b: InventoryReport['balances'][0]) => <span className={`text-sm font-black ${b.belowReorder ? 'text-rose-600' : 'text-emerald-700'}`}>{formatFaNumber(b.availableBase)}</span> },
        ]}
        rows={data?.balances ?? []}
        loading={loading}
        rowKey={(b: InventoryReport['balances'][0]) => `${b.product.sku}-${b.warehouse}`}
        empty="موجودی‌ای نیست"
      />
    </div>
  )
}

function ReceivablesTab() {
  const { data, loading, error } = useApiData<Receivable[]>('/api/reports?type=receivables')
  if (error) return <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
  return (
    <DataTable
      columns={[
        { key: 'customer', header: 'مشتری', cell: (r: Receivable) => <span className="text-sm">{r.shopName} <span className="text-[11px] text-muted-foreground" dir="ltr">({r.code})</span></span> },
        { key: 'balance', header: 'مانده بدهی', cell: (r: Receivable) => <Money rls={r.balanceRls} className={`text-sm font-bold ${r.balanceRls > 0 ? 'text-amber-700' : 'text-emerald-700'}`} /> },
        { key: 'limit', header: 'سقف اعتبار', cell: (r: Receivable) => <Money rls={r.creditLimitRls} className="text-xs" /> },
        {
          key: 'usage', header: 'مصرف اعتبار', cell: (r: Receivable) => r.usagePct != null ? (
            <div className="w-32"><Progress value={Math.min(100, r.usagePct)} aria-label="مصرف اعتبار" /><span className="text-[10px] text-muted-foreground">{formatFaNumber(r.usagePct)}٪</span></div>
          ) : <span className="text-xs text-muted-foreground">—</span>,
        },
        { key: 'days', header: 'مهلت', cell: (r: Receivable) => <span className="text-xs">{formatFaNumber(r.creditDays)} روز</span> },
        { key: 'last', header: 'آخرین دریافت', cell: (r: Receivable) => <span className="text-xs">{r.lastReceiptAt ? <JDate d={r.lastReceiptAt} /> : '—'}</span> },
      ]}
      rows={data ?? []}
      loading={loading}
      rowKey={(r: Receivable) => r.code}
      empty="داده‌ای نیست"
    />
  )
}
