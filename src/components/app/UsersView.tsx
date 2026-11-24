'use client'
// کاربران و نقش‌ها — مدیریت RBAC + ماتریس دسترسی
import { useEffect, useState } from 'react'
import { apiFetch, useApiData, DataTable, JDate, PageHeader, Field, UserAvatar } from './kit'
import type { SessionUserLike } from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type UserRow = {
  id: string; phone: string; name: string; isActive: boolean
  phoneVerified: boolean; lastLoginAt: string | null; createdAt: string
  avatarUrl: string | null
  roles: Array<{ name: string; label: string }>; isSelf: boolean
}
type RolesData = {
  roles: Array<{ id: string; name: string; label: string; isSystem: boolean; usersCount: number; permissions: string[] }>
  permissions: Array<{ code: string; label: string }>
}

export default function UsersView({ user }: { user: SessionUserLike }) {
  const [refresh, setRefresh] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const { data, loading, error, reload } = useApiData<UserRow[]>(refresh >= 0 ? '/api/users' : null)
  const { data: rolesData, reload: reloadRoles } = useApiData<RolesData>('/api/roles')

  const toggleActive = async (u: UserRow) => {
    try {
      await apiFetch(`/api/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !u.isActive }) })
      toast.success(!u.isActive ? 'کاربر فعال شد و نشست‌ها باقی ماند' : 'کاربر غیرفعال شد و نشست‌های او لغو شد')
      reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'خطا') }
  }

  return (
    <div>
      <PageHeader
        title="کاربران و نقش‌ها"
        desc="کنترل دسترسی RBAC — نقش‌های سیستمی با مجوزهای دقیق؛ تغییر وضعیت کاربر، نشست‌های او را لغو می‌کند"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reload}><RefreshCw className="h-4 w-4 ml-1" /> به‌روزرسانی</Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 ml-1" /> کاربر جدید</Button>
          </>
        }
      />

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">کاربران</TabsTrigger>
          <TabsTrigger value="roles">ماتریس نقش‌ها و مجوزها</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          {error ? (
            <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
          ) : (
            <DataTable
              columns={[
                {
                  key: 'avatar', header: '', cell: (u: UserRow) => (
                    <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="h-8 w-8 text-xs" />
                  ),
                },
                {
                  key: 'name', header: 'کاربر', cell: (u: UserRow) => (
                    <div>
                      <div className="text-sm font-medium">{u.name} {u.isSelf && <Badge variant="outline" className="text-[9px]">شما</Badge>}</div>
                      <div className="text-[11px] text-muted-foreground" dir="ltr">{u.phone}</div>
                    </div>
                  ),
                },
                {
                  key: 'roles', header: 'نقش‌ها', cell: (u: UserRow) => (
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map(r => <Badge key={r.name} variant="secondary" className="text-[10px]">{r.label}</Badge>)}
                    </div>
                  ),
                },
                { key: 'lastLogin', header: 'آخرین ورود', cell: (u: UserRow) => <span className="text-xs">{u.lastLoginAt ? <JDate d={u.lastLoginAt} time /> : '—'}</span> },
                {
                  key: 'active', header: 'فعال', cell: (u: UserRow) => (
                    <Switch checked={u.isActive} onCheckedChange={() => toggleActive(u)} disabled={u.isSelf} aria-label="فعال/غیرفعال" />
                  ),
                },
                { key: 'actions', header: '', cell: (u: UserRow) => <Button variant="ghost" size="sm" onClick={() => setEditUser(u)}>ویرایش</Button> },
              ]}
              rows={data ?? []}
              loading={loading}
              rowKey={(u: UserRow) => u.id}
              empty="کاربری ثبت نشده است"
            />
          )}
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="sticky right-0 bg-stone-50 min-w-32">مجوز</TableHead>
                    {rolesData?.roles.map(r => <TableHead key={r.id} className="text-center text-[10px] min-w-16">{r.label}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolesData?.permissions.map(p => (
                    <TableRow key={p.code}>
                      <TableCell className="sticky right-0 bg-card text-xs min-w-32">{p.label}</TableCell>
                      {rolesData.roles.map(r => (
                        <TableCell key={r.id} className="text-center">
                          {r.permissions.includes(p.code) ? <span className="text-emerald-600 font-bold">✓</span> : <span className="text-stone-300">—</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <UserDialog open={createOpen} onOpenChange={setCreateOpen} onDone={() => { reload(); reloadRoles() }} rolesData={rolesData} editUser={editUser} onEditClosed={() => setEditUser(null)} />
    </div>
  )
}

function UserDialog({ open, onOpenChange, onDone, rolesData, editUser, onEditClosed }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
  rolesData: RolesData | null
  editUser: UserRow | null
  onEditClosed: () => void
}) {
  const [form, setForm] = useState({ phone: '', name: '', password: '', roleNames: [] as string[] })
  const [busy, setBusy] = useState(false)
  const isEdit = !!editUser

  useEffect(() => {
    if (editUser) {
      setForm({ phone: editUser.phone, name: editUser.name, password: '', roleNames: editUser.roles.map(r => r.name) })
    }
  }, [editUser])

  const toggleRole = (name: string) => {
    setForm(f => ({ ...f, roleNames: f.roleNames.includes(name) ? f.roleNames.filter(r => r !== name) : [...f.roleNames, name] }))
  }

  const close = (v: boolean) => {
    if (!v) {
      onEditClosed()
      setForm({ phone: '', name: '', password: '', roleNames: [] })
    }
    onOpenChange(v)
  }

  const submit = async () => {
    if (isEdit && editUser) {
      setBusy(true)
      try {
        await apiFetch(`/api/users/${editUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            roleNames: form.roleNames,
            ...(form.password ? { password: form.password } : {}),
          }),
        })
        toast.success('کاربر به‌روزرسانی شد')
        onDone(); close(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'خطا')
      } finally { setBusy(false) }
    } else {
      if (!/^09\d{9}$/.test(form.phone) || !form.name || form.password.length < 6 || form.roleNames.length === 0) {
        toast.error('شماره معتبر، نام، رمز (حداقل ۶ کاراکتر) و حداقل یک نقش الزامی است')
        return
      }
      setBusy(true)
      try {
        await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(form) })
        toast.success('کاربر ایجاد شد')
        onDone(); close(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'خطا')
      } finally { setBusy(false) }
    }
  }

  return (
    <Dialog open={open || !!editUser} onOpenChange={close}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ویرایش کاربر' : 'کاربر جدید'}</DialogTitle>
          <DialogDescription>{isEdit ? 'برای تغییر رمز، فیلد رمز را پر کنید؛ در غیر این صورت خالی بگذارید.' : 'رمز عبور حداقل ۶ کاراکتر؛ پس از ایجاد، کاربر می‌تواند ورود کند.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="شماره موبایل" required={isEdit}>
            <Input dir="ltr" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} disabled={isEdit} />
          </Field>
          <Field label="نام" required><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label={isEdit ? 'رمز جدید (اختیاری)' : 'رمز عبور'} required={!isEdit}>
            <Input dir="ltr" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </Field>
          <Field label="نقش‌ها" required>
            <div className="rounded-lg border max-h-44 overflow-y-auto p-2 grid gap-1.5">
              {rolesData?.roles.map(r => (
                <label key={r.id} className="flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-stone-50">
                  <input
                    type="checkbox"
                    checked={form.roleNames.includes(r.name)}
                    onChange={() => toggleRole(r.name)}
                    className="accent-emerald-600"
                  />
                  {r.label} <span className="text-[10px] text-muted-foreground" dir="ltr">{r.name}</span>
                </label>
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => close(false)}>انصراف</Button>
            <Button onClick={submit} disabled={busy}>{busy ? 'در حال ثبت…' : isEdit ? 'ذخیره' : 'ایجاد کاربر'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
