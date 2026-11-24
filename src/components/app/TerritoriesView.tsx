'use client'
// مناطق فروش — ترسیم/ورود رسمی GeoJSON توسط مدیر؛ هیچ داده GIS حدسی ساخته نمی‌شود
import { useState } from 'react'
import { apiFetch, useApiData, DataTable, JDate, PageHeader, Field, formatFaNumber } from './kit'
import type { SessionUserLike } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type Territory = {
  id: string; code: string; name: string
  polygonJson: string | null; isActive: boolean; note: string | null
  visitorId: string | null; visitorName: string | null
  customersCount: number; hasPolygon: boolean; createdAt: string
}

export default function TerritoriesView({ user }: { user: SessionUserLike }) {
  const [refresh, setRefresh] = useState(0)
  const [edit, setEdit] = useState<Territory | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const { data, loading, error, reload } = useApiData<Territory[]>(refresh >= 0 ? '/api/territories' : null)
  const { data: visitorUsers } = useApiData<Array<{ id: string; name: string; phone: string }>>(
    user.permissions.includes('territories.manage') ? '/api/users?role=VISITOR' : null
  )
  const canManage = user.permissions.includes('territories.manage')

  return (
    <div>
      <PageHeader
        title="مناطق فروش"
        desc="قلمروهای فروش اهواز — مرزهای جغرافیایی فقط از طریق ترسیم مدیر یا ورود GeoJSON معتبر ثبت می‌شوند"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 ml-1" /> به‌روزرسانی</Button>
            {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> منطقه جدید</Button>}
          </>
        }
      />

      {error ? (
        <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
      ) : (
        <DataTable
          columns={[
            { key: 'code', header: 'کد', cell: (t: Territory) => <span className="font-mono text-xs" dir="ltr">{t.code}</span> },
            { key: 'name', header: 'نام', cell: (t: Territory) => <span className="text-sm">{t.name}</span> },
            { key: 'visitor', header: 'ویزیتور مسئول', cell: (t: Territory) => <span className="text-sm">{t.visitorName ?? '—'}</span> },
            { key: 'customers', header: 'مشتریان', cell: (t: Territory) => <span className="text-sm">{formatFaNumber(t.customersCount)}</span> },
            {
              key: 'geo', header: 'مرز جغرافیایی', cell: (t: Territory) => t.hasPolygon
                ? <Badge className="border-transparent bg-emerald-100 text-emerald-800">GeoJSON ثبت شده</Badge>
                : <Badge variant="outline" className="text-[10px] text-amber-700">نیازمند ترسیم مدیر</Badge>,
            },
            { key: 'active', header: 'فعال', cell: (t: Territory) => <span className="text-xs">{t.isActive ? 'بله' : 'خیر'}</span> },
            { key: 'created', header: 'ایجاد', cell: (t: Territory) => <span className="text-xs"><JDate d={t.createdAt} /></span> },
            {
              key: 'actions', header: '', cell: (t: Territory) => canManage
                ? <Button variant="ghost" size="sm" onClick={() => setEdit(t)}>ویرایش</Button>
                : null,
            },
          ]}
          rows={data ?? []}
          loading={loading}
          rowKey={(t: Territory) => t.id}
          empty="منطقه‌ای ثبت نشده است"
        />
      )}

      <TerritoryDialog
        open={createOpen || !!edit}
        territory={edit}
        onClose={() => { setCreateOpen(false); setEdit(null) }}
        onDone={() => { reload(); setCreateOpen(false); setEdit(null) }}
        visitorUsers={visitorUsers ?? []}
      />
    </div>
  )
}

function TerritoryDialog({ open, territory, onClose, onDone, visitorUsers }: {
  open: boolean
  territory: Territory | null
  onClose: () => void
  onDone: () => void
  visitorUsers: Array<{ id: string; name: string; phone: string }>
}) {
  const [form, setForm] = useState({ code: '', name: '', visitorId: '', polygonJson: '', note: '' })
  const [busy, setBusy] = useState(false)
  const isEdit = !!territory

  // پر کردن فرم هنگام ویرایش
  const [synced, setSynced] = useState<string | null>(null)
  if (territory && synced !== territory.id) {
    setSynced(territory.id)
    setForm({
      code: territory.code, name: territory.name,
      visitorId: territory.visitorId ?? '', polygonJson: territory.polygonJson ?? '', note: territory.note ?? '',
    })
  }
  if (!territory && synced !== 'new') {
    setSynced('new')
    setForm({ code: '', name: '', visitorId: '', polygonJson: '', note: '' })
  }

  const submit = async () => {
    if (!form.code || !form.name) { toast.error('کد و نام منطقه الزامی است'); return }
    setBusy(true)
    try {
      if (isEdit && territory) {
        await apiFetch('/api/territories', {
          method: 'PATCH',
          body: JSON.stringify({
            id: territory.id, name: form.name, visitorId: form.visitorId || null,
            polygonJson: form.polygonJson || null, note: form.note || null,
          }),
        })
        toast.success('منطقه به‌روزرسانی شد (تاریخچه در Audit ثبت شد)')
      } else {
        await apiFetch('/api/territories', {
          method: 'POST',
          body: JSON.stringify({
            code: form.code, name: form.name, visitorId: form.visitorId || null,
            polygonJson: form.polygonJson || null, note: form.note || null,
          }),
        })
        toast.success('منطقه ثبت شد')
      }
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ثبت ناموفق بود')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ویرایش منطقه' : 'منطقه فروش جدید'}</DialogTitle>
          <DialogDescription>
            مرزهای اهواز را حدس نمی‌زنیم؛ GeoJSON معتبر (Polygon / Feature / FeatureCollection) یا ترسیم رسمی مدیر ملاک است.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="کد منطقه" required={isEdit}>
              <Input dir="ltr" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} disabled={isEdit} />
            </Field>
            <Field label="نام منطقه" required><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          </div>
          <Field label="ویزیتور مسئول">
            <Select value={form.visitorId} onValueChange={v => setForm(f => ({ ...f, visitorId: v }))}>
              <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
              <SelectContent>
                {visitorUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="GeoJSON مرز" hint='نمونه ساختار: {"type":"Polygon","coordinates":[[[ lng,lat ],...]]}'>
            <Textarea dir="ltr" rows={5} className="font-mono text-xs" value={form.polygonJson} onChange={e => setForm(f => ({ ...f, polygonJson: e.target.value }))} />
          </Field>
          <Field label="یادداشت"><Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>انصراف</Button>
            <Button onClick={submit} disabled={busy}>{busy ? 'در حال ثبت…' : isEdit ? 'ذخیره' : 'ثبت منطقه'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
