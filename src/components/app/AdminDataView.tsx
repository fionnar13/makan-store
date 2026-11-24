'use client'
// پنل مدیریت داده‌ها — مدیریت موجودیت‌های پایه دیتابیس
// دسترسی: فقط مجوز users.manage (مدیر کل / آدمین)
import { useEffect, useRef, useState } from 'react'
import { apiFetch, apiUpload, useApiData, DataTable, JDate, PageHeader, Field, formatFaNumber, SiteIdentity, notifySiteChanged } from './kit'
import type { SessionUserLike, ViewKeyLike } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, RefreshCw, Lock, Pencil, Trash2, ArrowUpRight, ImagePlus, Globe, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type TableStat = { key: string; label: string; count: number; hint: string; view: string | null }
type OverviewData = { tables: TableStat[] }

type CategoryRow = { id: string; name: string; parentId: string | null; parentName: string | null; productsCount: number; childrenCount: number }
type BrandRow = { id: string; name: string; categoryId: string | null; categoryName: string | null; isConfirmed: boolean; isDemo: boolean; productsCount: number }
type WarehouseRow = { id: string; code: string; name: string; isDefault: boolean; lotsCount: number; balancesCount: number }
type EmployeeRow = { id: string; code: string; fullName: string; phone: string | null; position: string | null; status: string; hireDate: string | null; userId: string | null; userName: string | null; userPhone: string | null; createdAt: string }
type SettingRow = { key: string; value: string; isSystemCounter: boolean; updatedAt: string }

type GoFn = (v: ViewKeyLike) => void

export default function AdminDataView({ user, go }: { user: SessionUserLike; go: GoFn }) {
  const [tab, setTab] = useState('overview')
  const { data, loading, error, reload } = useApiData<OverviewData>('/api/admin/overview')

  return (
    <div>
      <PageHeader
        title="پنل مدیریت داده‌ها"
        desc="مدیریت مستقیم داده‌های پایه دیتابیس — فقط برای مدیر کل؛ همه تغییرات در سوابق سیستم (Audit) ثبت می‌شود"
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 ml-1" /> به‌روزرسانی</Button>}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="categories">دسته‌بندی‌ها</TabsTrigger>
          <TabsTrigger value="brands">برندها</TabsTrigger>
          <TabsTrigger value="warehouses">انبارها</TabsTrigger>
          <TabsTrigger value="employees">کارمندان</TabsTrigger>
          <TabsTrigger value="site">وب‌سایت</TabsTrigger>
          <TabsTrigger value="settings">تنظیمات</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {error ? (
            <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
          ) : (
            <OverviewTab tables={data?.tables ?? []} loading={loading} go={go} />
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
        <TabsContent value="brands" className="mt-4"><BrandsTab /></TabsContent>
        <TabsContent value="warehouses" className="mt-4"><WarehousesTab /></TabsContent>
        <TabsContent value="employees" className="mt-4"><EmployeesTab /></TabsContent>
        <TabsContent value="site" className="mt-4"><SiteSettingsTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── نمای کلی ───

function OverviewTab({ tables, loading, go }: { tables: TableStat[]; loading: boolean; go: GoFn }) {
  if (loading && tables.length === 0) {
    return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-stone-100 animate-pulse" />)}</div>
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tables.map(t => (
        <button
          key={t.key}
          onClick={() => t.view && go(t.view as ViewKeyLike)}
          className={`rounded-xl border bg-card p-4 text-right shadow-sm transition-colors ${t.view ? 'hover:border-emerald-500 hover:bg-emerald-50/40' : 'cursor-default'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{t.label}</span>
            {t.view && <ArrowUpRight className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />}
          </div>
          <div className="text-2xl font-black mt-2" dir="ltr">{formatFaNumber(t.count)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">{t.hint}</div>
        </button>
      ))}
    </div>
  )
}

// ─── دسته‌بندی‌ها ───

function CategoriesTab() {
  const { data, loading, reload } = useApiData<CategoryRow[]>('/api/admin/categories')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [deleting, setDeleting] = useState<CategoryRow | null>(null)
  const [busy, setBusy] = useState(false)

  const doDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await apiFetch(`/api/admin/categories/${deleting.id}`, { method: 'DELETE' })
      toast.success('دسته‌بندی حذف شد')
      setDeleting(null)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در حذف')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="h-4 w-4 ml-1" /> دسته‌بندی جدید</Button>
      </div>
      <DataTable
        columns={[
          { key: 'name', header: 'نام', cell: (c: CategoryRow) => <span className="text-sm font-medium">{c.name}</span> },
          { key: 'parent', header: 'والد', cell: (c: CategoryRow) => c.parentName ? <Badge variant="secondary" className="text-[10px]">{c.parentName}</Badge> : <span className="text-muted-foreground text-xs">—</span> },
          { key: 'products', header: 'محصولات', cell: (c: CategoryRow) => <span className="text-xs" dir="ltr">{formatFaNumber(c.productsCount)}</span> },
          { key: 'children', header: 'زیرگروه‌ها', cell: (c: CategoryRow) => <span className="text-xs" dir="ltr">{formatFaNumber(c.childrenCount)}</span> },
          {
            key: 'actions', header: '', cell: (c: CategoryRow) => (
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setDialogOpen(true) }} aria-label="ویرایش"><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" disabled={c.productsCount > 0 || c.childrenCount > 0} onClick={() => setDeleting(c)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ),
          },
        ]}
        rows={data ?? []}
        loading={loading}
        rowKey={(c: CategoryRow) => c.id}
        empty="دسته‌بندی ثبت نشده است"
      />
      <CategoryDialog
        open={dialogOpen}
        editing={editing}
        categories={(data ?? []).filter(c => c.id !== editing?.id)}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        onDone={reload}
      />
      <ConfirmDelete
        open={!!deleting}
        title={`حذف دسته‌بندی «${deleting?.name ?? ''}»`}
        description="این عملیات بازگشت‌پذیر نیست. اگر این دسته‌بندی به محصول یا زیرگروهی متصل باشد، سرور اجازه حذف نمی‌دهد."
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={doDelete}
      />
    </div>
  )
}

function CategoryDialog({ open, editing, categories, onClose, onDone }: {
  open: boolean
  editing: CategoryRow | null
  categories: CategoryRow[]
  onClose: () => void
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<string>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setParentId(editing?.parentId ?? '')
    }
  }, [open, editing])

  const submit = async () => {
    setBusy(true)
    try {
      const body = { name, parentId: parentId || null }
      if (editing) {
        await apiFetch(`/api/admin/categories/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        toast.success('دسته‌بندی ویرایش شد')
      } else {
        await apiFetch('/api/admin/categories', { method: 'POST', body: JSON.stringify(body) })
        toast.success('دسته‌بندی ایجاد شد')
      }
      onDone()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}</DialogTitle>
          <DialogDescription>نام باید یکتا باشد؛ انتخاب والد اختیاری است.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="نام دسته‌بندی" required><Input value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="دسته‌بندی والد (اختیاری)">
            <Select value={parentId || 'none'} onValueChange={v => setParentId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="بدون والد" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون والد</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>انصراف</Button>
            <Button onClick={submit} disabled={busy || name.trim().length < 2}>{busy ? 'در حال ثبت…' : 'ذخیره'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── برندها ───

function BrandsTab() {
  const { data, loading, reload } = useApiData<BrandRow[]>('/api/admin/brands')
  const { data: categories } = useApiData<CategoryRow[]>('/api/admin/categories')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BrandRow | null>(null)
  const [deleting, setDeleting] = useState<BrandRow | null>(null)
  const [busy, setBusy] = useState(false)

  // فیلتر بر اساس دسته‌بندی — برندها وابسته به دسته‌بندی‌ها هستند
  const rows = (data ?? []).filter(b => catFilter === 'all' || b.categoryId === catFilter)

  const doDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await apiFetch(`/api/admin/brands/${deleting.id}`, { method: 'DELETE' })
      toast.success('برند حذف شد')
      setDeleting(null)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در حذف')
    } finally { setBusy(false) }
  }

  const toggleConfirm = async (b: BrandRow) => {
    try {
      await apiFetch(`/api/admin/brands/${b.id}`, { method: 'PATCH', body: JSON.stringify({ isConfirmed: !b.isConfirmed }) })
      toast.success(!b.isConfirmed ? 'برند تأیید شد' : 'تأیید برند لغو شد')
      reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'خطا') }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="w-56">
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه دسته‌بندی‌ها</SelectItem>
              {(categories ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="h-4 w-4 ml-1" /> برند جدید</Button>
      </div>
      <DataTable
        columns={[
          {
            key: 'name', header: 'برند', cell: (b: BrandRow) => (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{b.name}</span>
                {b.isDemo && <Badge variant="outline" className="text-[9px]">DEMO</Badge>}
              </div>
            ),
          },
          {
            key: 'category', header: 'دسته‌بندی', cell: (b: BrandRow) => (
              b.categoryName
                ? <Badge variant="secondary" className="text-[10px]">{b.categoryName}</Badge>
                : <span className="text-[11px] text-amber-700">بدون دسته — ویرایش کنید</span>
            ),
          },
          {
            key: 'confirmed', header: 'تأیید مدیر', cell: (b: BrandRow) => (
              <Switch checked={b.isConfirmed} onCheckedChange={() => toggleConfirm(b)} aria-label="تأیید برند" />
            ),
          },
          { key: 'products', header: 'محصولات', cell: (b: BrandRow) => <span className="text-xs" dir="ltr">{formatFaNumber(b.productsCount)}</span> },
          {
            key: 'actions', header: '', cell: (b: BrandRow) => (
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(b); setDialogOpen(true) }} aria-label="ویرایش"><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" disabled={b.productsCount > 0} onClick={() => setDeleting(b)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        loading={loading}
        rowKey={(b: BrandRow) => b.id}
        empty="برندی ثبت نشده است"
      />
      <BrandDialog open={dialogOpen} editing={editing} onClose={() => { setDialogOpen(false); setEditing(null) }} onDone={reload} />
      <ConfirmDelete
        open={!!deleting}
        title={`حذف برند «${deleting?.name ?? ''}»`}
        description="اگر این برند به محصولی متصل باشد، سرور اجازه حذف نمی‌دهد."
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={doDelete}
      />
    </div>
  )
}

function BrandDialog({ open, editing, onClose, onDone }: {
  open: boolean
  editing: BrandRow | null
  onClose: () => void
  onDone: () => void
}) {
  const { data: categories } = useApiData<CategoryRow[]>('/api/admin/categories')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setCategoryId(editing?.categoryId ?? '')
      setIsConfirmed(editing?.isConfirmed ?? false)
    }
  }, [open, editing])

  const submit = async () => {
    setBusy(true)
    try {
      const body = { name, categoryId, isConfirmed }
      if (editing) {
        await apiFetch(`/api/admin/brands/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        toast.success('برند ویرایش شد')
      } else {
        await apiFetch('/api/admin/brands', { method: 'POST', body: JSON.stringify(body) })
        toast.success('برند ایجاد شد')
      }
      onDone()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'ویرایش برند' : 'برند جدید'}</DialogTitle>
          <DialogDescription>هر برند متعلق به یک دسته‌بندی است؛ برند بدون تأیید در کاتالوگ نیازمند بررسی است.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="دسته‌بندی" required>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="انتخاب دسته…" /></SelectTrigger>
              <SelectContent>
                {(categories ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="نام برند" required><Input value={name} onChange={e => setName(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={isConfirmed} onCheckedChange={setIsConfirmed} aria-label="تأییدشده" />
            تأییدشده توسط مدیر
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>انصراف</Button>
            <Button onClick={submit} disabled={busy || name.trim().length < 1 || !categoryId}>{busy ? 'در حال ثبت…' : 'ذخیره'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── انبارها ───

function WarehousesTab() {
  const { data, loading, reload } = useApiData<WarehouseRow[]>('/api/admin/warehouses')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WarehouseRow | null>(null)
  const [deleting, setDeleting] = useState<WarehouseRow | null>(null)
  const [busy, setBusy] = useState(false)

  const doDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await apiFetch(`/api/admin/warehouses/${deleting.id}`, { method: 'DELETE' })
      toast.success('انبار حذف شد')
      setDeleting(null)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در حذف')
    } finally { setBusy(false) }
  }

  const toggleDefault = async (w: WarehouseRow) => {
    try {
      await apiFetch(`/api/admin/warehouses/${w.id}`, { method: 'PATCH', body: JSON.stringify({ isDefault: !w.isDefault }) })
      toast.success(!w.isDefault ? 'انبار پیش‌فرض شد' : 'انبار نمی‌تواند غیرپیش‌فرض شود — حداقل یک انبار پیش‌فرض لازم است')
      reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'خطا') }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="h-4 w-4 ml-1" /> انبار جدید</Button>
      </div>
      <DataTable
        columns={[
          { key: 'code', header: 'کد', cell: (w: WarehouseRow) => <span className="text-xs" dir="ltr">{w.code}</span> },
          { key: 'name', header: 'نام انبار', cell: (w: WarehouseRow) => (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{w.name}</span>
              {w.isDefault && <Badge className="text-[9px] border-transparent bg-emerald-600 text-white">پیش‌فرض</Badge>}
            </div>
          ) },
          { key: 'lots', header: 'لات‌ها', cell: (w: WarehouseRow) => <span className="text-xs" dir="ltr">{formatFaNumber(w.lotsCount)}</span> },
          { key: 'balances', header: 'موجودی‌ها', cell: (w: WarehouseRow) => <span className="text-xs" dir="ltr">{formatFaNumber(w.balancesCount)}</span> },
          {
            key: 'default', header: 'پیش‌فرض', cell: (w: WarehouseRow) => (
              <Switch checked={w.isDefault} onCheckedChange={() => toggleDefault(w)} aria-label="انبار پیش‌فرض" />
            ),
          },
          {
            key: 'actions', header: '', cell: (w: WarehouseRow) => (
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(w); setDialogOpen(true) }} aria-label="ویرایش"><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" disabled={w.lotsCount > 0 || w.balancesCount > 0 || w.isDefault} onClick={() => setDeleting(w)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ),
          },
        ]}
        rows={data ?? []}
        loading={loading}
        rowKey={(w: WarehouseRow) => w.id}
        empty="انباری ثبت نشده است"
      />
      <WarehouseDialog open={dialogOpen} editing={editing} onClose={() => { setDialogOpen(false); setEditing(null) }} onDone={reload} />
      <ConfirmDelete
        open={!!deleting}
        title={`حذف انبار «${deleting?.name ?? ''}»`}
        description="انباری که لات یا موجودی دارد قابل حذف نیست؛ انبار پیش‌فرض نیز حذف نمی‌شود."
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={doDelete}
      />
    </div>
  )
}

function WarehouseDialog({ open, editing, onClose, onDone }: {
  open: boolean
  editing: WarehouseRow | null
  onClose: () => void
  onDone: () => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setCode(editing?.code ?? '')
      setName(editing?.name ?? '')
      setIsDefault(editing?.isDefault ?? false)
    }
  }, [open, editing])

  const submit = async () => {
    setBusy(true)
    try {
      const body = { code, name, isDefault }
      if (editing) {
        await apiFetch(`/api/admin/warehouses/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        toast.success('انبار ویرایش شد')
      } else {
        await apiFetch('/api/admin/warehouses', { method: 'POST', body: JSON.stringify(body) })
        toast.success('انبار ایجاد شد')
      }
      onDone()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'ویرایش انبار' : 'انبار جدید'}</DialogTitle>
          <DialogDescription>کد انبار یکتاست؛ اگر «پیش‌فرض» بزنید، پیش‌فرضی قبلی به‌صورت خودکار برداشته می‌شود.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="کد انبار" required><Input dir="ltr" value={code} onChange={e => setCode(e.target.value)} disabled={!!editing} /></Field>
          <Field label="نام انبار" required><Input value={name} onChange={e => setName(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} aria-label="انبار پیش‌فرض" />
            انبار پیش‌فرض سیستم
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>انصراف</Button>
            <Button onClick={submit} disabled={busy || !code.trim() || name.trim().length < 2}>{busy ? 'در حال ثبت…' : 'ذخیره'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── کارمندان ───

function EmployeesTab() {
  const { data, loading, reload } = useApiData<EmployeeRow[]>('/api/admin/employees')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EmployeeRow | null>(null)
  const [deleting, setDeleting] = useState<EmployeeRow | null>(null)
  const [busy, setBusy] = useState(false)

  const doDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await apiFetch(`/api/admin/employees/${deleting.id}`, { method: 'DELETE' })
      toast.success('کارمند حذف شد')
      setDeleting(null)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در حذف')
    } finally { setBusy(false) }
  }

  const toggleStatus = async (e: EmployeeRow) => {
    try {
      await apiFetch(`/api/admin/employees/${e.id}`, { method: 'PATCH', body: JSON.stringify({ status: e.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }) })
      toast.success(e.status === 'ACTIVE' ? 'کارمند غیرفعال شد' : 'کارمند فعال شد')
      reload()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'خطا') }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}><Plus className="h-4 w-4 ml-1" /> کارمند جدید</Button>
      </div>
      <DataTable
        columns={[
          { key: 'code', header: 'کد پرسنلی', cell: (e: EmployeeRow) => <span className="text-xs" dir="ltr">{e.code}</span> },
          {
            key: 'name', header: 'کارمند', cell: (e: EmployeeRow) => (
              <div>
                <div className="text-sm font-medium">{e.fullName}</div>
                {e.phone && <div className="text-[11px] text-muted-foreground" dir="ltr">{e.phone}</div>}
              </div>
            ),
          },
          { key: 'position', header: 'سمت', cell: (e: EmployeeRow) => <span className="text-xs">{e.position ?? '—'}</span> },
          {
            key: 'user', header: 'حساب متصل', cell: (e: EmployeeRow) => e.userName ? (
              <div>
                <div className="text-xs font-medium">{e.userName}</div>
                <div className="text-[10px] text-muted-foreground" dir="ltr">{e.userPhone}</div>
              </div>
            ) : <span className="text-xs text-muted-foreground">—</span>
          },
          { key: 'hire', header: 'استخدام', cell: (e: EmployeeRow) => <span className="text-xs">{e.hireDate ? <JDate d={e.hireDate} /> : '—'}</span> },
          {
            key: 'status', header: 'فعال', cell: (e: EmployeeRow) => (
              <Switch checked={e.status === 'ACTIVE'} onCheckedChange={() => toggleStatus(e)} aria-label="فعال/غیرفعال" />
            ),
          },
          {
            key: 'actions', header: '', cell: (e: EmployeeRow) => (
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(e); setDialogOpen(true) }} aria-label="ویرایش"><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" disabled={!!e.userId} onClick={() => setDeleting(e)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ),
          },
        ]}
        rows={data ?? []}
        loading={loading}
        rowKey={(e: EmployeeRow) => e.id}
        empty="کارمندی ثبت نشده است"
      />
      <EmployeeDialog open={dialogOpen} editing={editing} onClose={() => { setDialogOpen(false); setEditing(null) }} onDone={reload} />
      <ConfirmDelete
        open={!!deleting}
        title={`حذف کارمند «${deleting?.fullName ?? ''}»`}
        description="کارمندي که به حساب کاربری متصل است قابل حذف نیست؛ ابتدا اتصال را قطع کنید یا وضعیت را غیرفعال کنید."
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={doDelete}
      />
    </div>
  )
}

function EmployeeDialog({ open, editing, onClose, onDone }: {
  open: boolean
  editing: EmployeeRow | null
  onClose: () => void
  onDone: () => void
}) {
  const [form, setForm] = useState({ code: '', fullName: '', phone: '', position: '', userId: '', hireDate: '' })
  const [busy, setBusy] = useState(false)
  const { data: usersData } = useApiData<Array<{ id: string; name: string; phone: string; isActive: boolean }>>(open ? '/api/users' : null)

  useEffect(() => {
    if (open) {
      setForm({
        code: editing?.code ?? '',
        fullName: editing?.fullName ?? '',
        phone: editing?.phone ?? '',
        position: editing?.position ?? '',
        userId: editing?.userId ?? '',
        hireDate: editing?.hireDate ? String(editing.hireDate).slice(0, 10) : '',
      })
    }
  }, [open, editing])

  const submit = async () => {
    setBusy(true)
    try {
      const body = {
        fullName: form.fullName,
        phone: form.phone || null,
        position: form.position || null,
        userId: form.userId || null,
        hireDate: form.hireDate || null,
        ...(editing ? {} : { code: form.code }),
      }
      if (editing) {
        await apiFetch(`/api/admin/employees/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        toast.success('کارمند ویرایش شد')
      } else {
        await apiFetch('/api/admin/employees', { method: 'POST', body: JSON.stringify(body) })
        toast.success('کارمند ایجاد شد')
      }
      onDone()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'ویرایش کارمند' : 'کارمند جدید'}</DialogTitle>
          <DialogDescription>کد پرسنلی یکتاست. اتصال به حساب کاربری برای ویزیتورها لازم است (بازدید و حضور).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="کد پرسنلی" required={!editing}><Input dir="ltr" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} disabled={!!editing} /></Field>
          <Field label="نام کامل" required><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="موبایل"><Input dir="ltr" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="تاریخ استخدام"><Input dir="ltr" type="date" value={form.hireDate} onChange={e => setForm(f => ({ ...f, hireDate: e.target.value }))} /></Field>
          </div>
          <Field label="سمت"><Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} /></Field>
          <Field label="اتصال به حساب کاربری (اختیاری)">
            <Select value={form.userId || 'none'} onValueChange={v => setForm(f => ({ ...f, userId: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="بدون اتصال" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون اتصال</SelectItem>
                {(usersData ?? []).map(u => <SelectItem key={u.id} value={u.id}>{u.name} — <span dir="ltr">{u.phone}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>انصراف</Button>
            <Button onClick={submit} disabled={busy || (!editing && !form.code.trim()) || form.fullName.trim().length < 2}>{busy ? 'در حال ثبت…' : 'ذخیره'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── تنظیمات ───

function SettingsTab() {
  const { data, loading, reload } = useApiData<SettingRow[]>('/api/admin/settings')
  const [editing, setEditing] = useState<SettingRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const counters = (data ?? []).filter(s => s.isSystemCounter)
  const appSettings = (data ?? []).filter(s => !s.isSystemCounter)

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 ml-1" /> کلید جدید</Button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b bg-stone-50 text-sm font-bold">تنظیمات برنامه</div>
        <div className="divide-y">
          {loading && <p className="text-sm text-muted-foreground p-4">در حال بارگذاری…</p>}
          {appSettings.map(s => (
            <div key={s.key} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium" dir="ltr">{s.key}</div>
                <div className="text-xs text-muted-foreground mt-0.5 break-all" dir="auto">{s.value}</div>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0"><JDate d={s.updatedAt} time /></span>
              <Button variant="ghost" size="sm" onClick={() => setEditing(s)} aria-label="ویرایش"><Pencil className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          {!loading && appSettings.length === 0 && <p className="text-sm text-muted-foreground p-4">کلیدی ثبت نشده است</p>}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-stone-50 text-sm font-bold flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-stone-400" aria-hidden />
          شمارنده‌های داخلی اسناد (فقط‌خواندنی)
        </div>
        <div className="divide-y max-h-72 overflow-y-auto">
          {counters.map(s => (
            <div key={s.key} className="flex items-center gap-3 px-4 py-2.5 opacity-70">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium" dir="ltr">{s.key}</span>
                <span className="text-xs text-muted-foreground mr-3" dir="ltr">{s.value}</span>
              </div>
            </div>
          ))}
          {!loading && counters.length === 0 && <p className="text-sm text-muted-foreground p-4">هنوز سند numbering ثبت نشده است</p>}
        </div>
      </div>

      <SettingDialog open={!!editing || addOpen} setting={editing} isNew={addOpen} onClose={() => { setEditing(null); setAddOpen(false) }} onDone={reload} />
    </div>
  )
}

function SettingDialog({ open, setting, isNew, onClose, onDone }: {
  open: boolean
  setting: SettingRow | null
  isNew: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const isEdit = !isNew && !!setting

  useEffect(() => {
    if (open) {
      setKey(isEdit ? setting?.key ?? '' : '')
      setValue(isEdit ? setting?.value ?? '' : '')
    }
  }, [open, isEdit, setting])

  const submit = async () => {
    setBusy(true)
    try {
      await apiFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ key, value }) })
      toast.success('تنظیم ذخیره شد')
      onDone()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ویرایش تنظیم' : 'کلید تنظیم جدید'}</DialogTitle>
          <DialogDescription>{isEdit ? 'مقدار کلید را ویرایش کنید.' : 'کلید با حروف لاتین/عدد/نقطه/دونقطه؛ کلیدهای seq:* داخلی هستند و قابل ساخت نیستند.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="کلید" required={isNew}>
            <Input dir="ltr" value={key} onChange={e => setKey(e.target.value)} disabled={isEdit} placeholder="store.name" />
          </Field>
          <Field label="مقدار" required><Textarea rows={3} value={value} onChange={e => setValue(e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>انصراف</Button>
            <Button onClick={submit} disabled={busy || !key.trim() || !value}>{busy ? 'در حال ثبت…' : 'ذخیره'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── تنظیمات وب‌سایت (نام، شعار، لوگو، فایوآیکون) ───

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon'

function SiteSettingsTab() {
  const { data, loading, reload } = useApiData<SiteIdentity>('/api/site-settings')
  const [name, setName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null)
  const logoInput = useRef<HTMLInputElement>(null)
  const faviconInput = useRef<HTMLInputElement>(null)

  // مقادیر اولیه از سرور — تا وقتی کاربر چیزی تایپ نکرده، با داده سرور همگام می‌ماند
  useEffect(() => {
    if (data && !dirty) {
      setName(data.name)
      setSlogan(data.slogan)
    }
  }, [data, dirty])

  const saveText = async () => {
    setBusy(true)
    try {
      await apiFetch('/api/site-settings', {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim(), slogan: slogan.trim() }),
      })
      toast.success('تنظیمات وب‌سایت ذخیره شد')
      setDirty(false)
      reload()
      notifySiteChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در ذخیره تنظیمات')
    } finally { setBusy(false) }
  }

  const uploadImage = async (kind: 'logo' | 'favicon', file: File) => {
    setUploading(kind)
    try {
      const form = new FormData()
      form.append('kind', kind)
      form.append('file', file)
      const res = await apiUpload<{ url: string }>('/api/uploads', form)
      await apiFetch('/api/site-settings', {
        method: 'PUT',
        body: JSON.stringify(kind === 'logo' ? { logoUrl: res.url } : { faviconUrl: res.url }),
      })
      toast.success(kind === 'logo' ? 'لوگو به‌روزرسانی شد' : 'فایوآیکون به‌روزرسانی شد')
      reload()
      notifySiteChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در بارگذاری تصویر')
    } finally { setUploading(null) }
  }

  const resetImage = async (field: 'logoUrl' | 'faviconUrl') => {
    setUploading(field === 'logoUrl' ? 'logo' : 'favicon')
    try {
      await apiFetch('/api/site-settings', { method: 'PUT', body: JSON.stringify({ [field]: null }) })
      toast.success('به پیش‌فرض بازگشت')
      reload()
      notifySiteChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'خطا در بازنشانی تصویر')
    } finally { setUploading(null) }
  }

  const nameValid = name.trim().length >= 2 && name.trim().length <= 60

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* نام و شعار */}
      <div className="rounded-xl border bg-card p-4 grid gap-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Globe className="h-4 w-4 text-emerald-700" aria-hidden />
          <span className="text-sm font-bold">نام و شعار وب‌سایت</span>
        </div>
        <Field label="نام وب‌سایت" required hint="در هدر برنامه، صفحه ورود و عنوان تب مرورگر نمایش داده می‌شود (حداکثر ۶۰ کاراکتر)">
          <Input
            value={name}
            onChange={e => { setName(e.target.value); setDirty(true) }}
            maxLength={60}
            placeholder="بنکداری هوشمند"
            disabled={loading}
          />
        </Field>
        <Field label="شعار (Slogan)" hint="زیر نام در صفحه ورود نمایش داده می‌شود (حداکثر ۱۲۰ کاراکتر)">
          <Input
            value={slogan}
            onChange={e => { setSlogan(e.target.value); setDirty(true) }}
            maxLength={120}
            placeholder="سامانه مدیریت B2B بنکداری مواد غذایی"
            disabled={loading}
          />
        </Field>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveText} disabled={busy || !dirty || !nameValid}>
            {busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
          </Button>
        </div>
      </div>

      {/* لوگو و فایوآیکون */}
      <div className="rounded-xl border bg-card p-4 grid gap-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <ImagePlus className="h-4 w-4 text-emerald-700" aria-hidden />
          <span className="text-sm font-bold">لوگو و فایوآیکون</span>
        </div>

        <input
          ref={logoInput}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage('logo', f); e.target.value = '' }}
        />
        <input
          ref={faviconInput}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage('favicon', f); e.target.value = '' }}
        />

        {/* لوگو */}
        <div className="grid gap-2">
          <div className="text-xs font-medium text-muted-foreground">لوگو — در هدر و صفحه ورود نمایش داده می‌شود (حداکثر ۲ مگابایت)</div>
          <div className="flex items-center gap-3">
            <div className="h-20 w-28 rounded-lg border bg-stone-50 grid place-items-center overflow-hidden shrink-0">
              {data?.logoUrl
                ? <img src={data.logoUrl} alt="لوگوی فعلی" className="max-h-16 max-w-24 object-contain" />
                : <span className="grid place-items-center h-10 w-10 rounded-lg bg-primary text-primary-foreground font-black">ب</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => logoInput.current?.click()} disabled={uploading !== null}>
                {uploading === 'logo' ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <ImagePlus className="h-4 w-4 ml-1" />}
                {data?.logoUrl ? 'تغییر لوگو' : 'بارگذاری لوگو'}
              </Button>
              {data?.logoUrl && (
                <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => resetImage('logoUrl')} disabled={uploading !== null}>
                  <Trash2 className="h-4 w-4 ml-1" /> حذف
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t" />

        {/* فایوآیکون */}
        <div className="grid gap-2">
          <div className="text-xs font-medium text-muted-foreground">فایوآیکون — آیکون تب مرورگر (حداکثر ۲ مگابایت)</div>
          <div className="flex items-center gap-3">
            <div className="h-20 w-28 rounded-lg border bg-stone-50 grid place-items-center overflow-hidden shrink-0">
              {data?.faviconUrl ? (
                <span className="flex items-end gap-3">
                  <img src={data.faviconUrl} alt="فایوآیکون" className="h-12 w-12 object-contain" />
                  <img src={data.faviconUrl} alt="" aria-hidden className="h-4 w-4 object-contain" />
                </span>
              ) : (
                <img src="/logo.svg" alt="فایوآیکون پیش‌فرض" className="h-12 w-12 object-contain" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => faviconInput.current?.click()} disabled={uploading !== null}>
                {uploading === 'favicon' ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <ImagePlus className="h-4 w-4 ml-1" />}
                {data?.faviconUrl ? 'تغییر فایوآیکون' : 'بارگذاری فایوآیکون'}
              </Button>
              {data?.faviconUrl && (
                <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => resetImage('faviconUrl')} disabled={uploading !== null}>
                  <Trash2 className="h-4 w-4 ml-1" /> حذف
                </Button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            پس از ذخیره، عنوان و آیکون تب مرورگر بلافاصله به‌روز می‌شود؛ در صورت ناپدید شدن تصویر، صفحه را یک‌بار بازخوانی کنید.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── تأیید حذف مشترک ───

function ConfirmDelete({ open, title, description, busy, onCancel, onConfirm }: {
  open: boolean
  title: string
  description: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={v => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={busy}>انصراف</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={busy} className="bg-rose-600 hover:bg-rose-700 text-white">
            {busy ? 'در حال حذف…' : 'حذف'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
