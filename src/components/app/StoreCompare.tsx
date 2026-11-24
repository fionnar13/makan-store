'use client'
// گفت‌وگوی مقایسه محصولات — جدول سطر‌به‌سطر ویژگی‌ها (حداکثر ۴ کالا)
// در هر ردیف قیمت، ارزان‌ترین گزینه با رنگ سبز و نشان «ارزان‌ترین» برجسته می‌شود
import { useMemo, type ReactNode } from 'react'
import { Money, formatFaNumber } from './kit'
import { ProductTile, stockInfo } from './StoreShared'
import type { ProductListItem } from './types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Scale, X } from 'lucide-react'

type SpecRow = {
  label: string
  isPrice?: boolean
  unitName?: string
  cell: (p: ProductListItem) => ReactNode
}

export default function CompareDialog({ open, onOpenChange, products, onRemove }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: ProductListItem[]
  onRemove: (id: string) => void
}) {
  // همه نام‌های واحد فروش در میان کالاهای مقایسه‌شده — هر نام یک ردیف قیمت
  const unitRows = useMemo(() => {
    const seen = new Map<string, number>() // نام واحد → فاکتور
    for (const p of products) {
      for (const u of p.units) if (!seen.has(u.name)) seen.set(u.name, u.factor)
    }
    return [...seen.entries()]
      .sort((a, b) => a[1] - b[1]) // واحد پایه (فاکتور ۱) اول
      .map(([name, factor]) => ({ name, factor }))
  }, [products])

  const priceOf = (p: ProductListItem, unitName: string): number | null =>
    p.units.find(u => u.name === unitName)?.defaultPriceRls ?? null

  // کمترین قیمت هر ردیف — فقط وقتی حداقل دو کالا قیمت دارند برجسته می‌شود
  const minFor = (unitName: string): number | null => {
    const vals = products
      .map(p => priceOf(p, unitName))
      .filter((v): v is number => v != null && v > 0)
    return vals.length >= 2 ? Math.min(...vals) : null
  }

  const rows: SpecRow[] = [
    { label: 'برند', cell: p => p.brand ?? '—' },
    { label: 'دسته‌بندی', cell: p => p.category ?? '—' },
    { label: 'SKU', cell: p => <span dir="ltr" className="font-mono text-[11px]">{p.sku}</span> },
    ...unitRows.map(r => ({
      label: `${r.name}${r.factor > 1 ? ` (×${formatFaNumber(r.factor)})` : ''}`,
      isPrice: true,
      unitName: r.name,
      cell: (p: ProductListItem) => null as ReactNode,
    })),
    { label: 'حداقل سفارش', cell: p => `${formatFaNumber(p.minOrderQtyBase)} ${p.baseUnitName}` },
    { label: 'مضرب سفارش', cell: p => formatFaNumber(p.orderMultipleBase) },
    {
      label: 'وزن / حجم',
      cell: p => p.weightG != null
        ? `${formatFaNumber(p.weightG)} گرم`
        : p.volumeMl != null ? `${formatFaNumber(p.volumeMl)} میلی‌لیتر` : '—',
    },
    { label: 'نوع بسته‌بندی', cell: p => p.packagingType ?? '—' },
    {
      label: 'موجودی قابل فروش',
      cell: p => {
        const st = stockInfo(p)
        return (
          <span className="flex items-center gap-1.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden />
            <span className={st.cls}>{st.label}</span>
            <span className="text-muted-foreground">({formatFaNumber(p.availableBase)})</span>
          </span>
        )
      },
    },
    {
      label: 'وضعیت کالا',
      cell: p => (
        <span className="flex flex-wrap gap-1">
          <Badge variant={p.isActive ? 'secondary' : 'outline'} className={`text-[10px] ${p.isActive ? '' : 'text-rose-600 border-rose-300'}`}>
            {p.isActive ? 'فعال' : 'غیرفعال'}
          </Badge>
          {p.isDemo && <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300">DEMO_SEED</Badge>}
        </span>
      ),
    },
    {
      label: 'توضیحات',
      cell: p => p.description
        ? <span className="text-[11px] leading-5 line-clamp-3 block max-w-[16rem]">{p.description}</span>
        : '—',
    },
  ]

  const renderCell = (row: SpecRow, p: ProductListItem): ReactNode => {
    if (row.isPrice && row.unitName) {
      const v = priceOf(p, row.unitName)
      if (v == null) return <span className="text-muted-foreground text-xs">—</span>
      const min = minFor(row.unitName)
      const isMin = min != null && v === min
      return (
        <span className="flex flex-col items-start gap-1">
          <Money rls={v} className={`text-xs font-bold ${isMin ? 'text-emerald-700' : 'text-stone-700'}`} />
          {isMin && <Badge className="border-transparent bg-emerald-100 text-emerald-800 text-[9px] px-1.5">ارزان‌ترین</Badge>}
        </span>
      )
    }
    return row.cell(p)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> مقایسه محصولات</DialogTitle>
          <DialogDescription>
            مقایسه {formatFaNumber(products.length)} کالا در جدول سطر‌به‌سطر — ارزان‌ترین قیمت هر ردیف با نشان سبز مشخص شده است
          </DialogDescription>
        </DialogHeader>

        {products.length < 2 ? (
          <p className="text-sm text-muted-foreground text-center py-8">حداقل دو محصول برای مقایسه انتخاب کنید</p>
        ) : (
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50 hover:bg-stone-50">
                  <TableHead className="sticky right-0 bg-stone-50 z-10 w-28">ویژگی</TableHead>
                  {products.map(p => (
                    <TableHead key={p.id} className="min-w-[10.5rem]">
                      <div className="flex items-start gap-2">
                        <div className="h-12 w-12 rounded-lg overflow-hidden border shrink-0 bg-stone-50">
                          <ProductTile p={p} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold leading-5 line-clamp-2">{p.name}</div>
                          <button
                            onClick={() => onRemove(p.id)}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] text-rose-600 hover:underline"
                            aria-label={`حذف ${p.name} از مقایسه`}
                          >
                            <X className="h-3 w-3" /> حذف از مقایسه
                          </button>
                        </div>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.label}>
                    <TableCell className="sticky right-0 bg-stone-50 z-10 text-[11px] font-bold text-stone-600 whitespace-nowrap">
                      {row.label}
                    </TableCell>
                    {products.map(p => (
                      <TableCell key={p.id} className={row.isPrice ? 'align-top' : ''}>
                        {renderCell(row, p)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
