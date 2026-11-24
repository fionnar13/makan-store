'use client'
// سوابق سیستم — Audit Log عملیات حساس
import { useApiData, DataTable, JDate, PageHeader } from './kit'
import { Badge } from '@/components/ui/badge'
import type { SessionUserLike } from './types'

type AuditRow = {
  id: string
  user: { name: string; phone: string } | null
  action: string
  entityType: string
  entityId: string | null
  beforeJson: string | null
  afterJson: string | null
  ip: string | null
  result: string
  createdAt: string
}

export default function AuditView({ user }: { user: SessionUserLike }) {
  void user
  const { data, loading, error, reload } = useApiData<AuditRow[]>('/api/audit?take=150')

  return (
    <div>
      <PageHeader
        title="سوابق سیستم (Audit Log)"
        desc="ردپای عملیات حساس — بدون رمز عبور، توکن یا اطلاعات محرمانه"
        actions={<button onClick={reload} className="text-sm underline">به‌روزرسانی</button>}
      />

      {error ? (
        <p className="text-sm text-rose-600 py-6 text-center">{error}</p>
      ) : (
        <DataTable
          columns={[
            { key: 'time', header: 'زمان', cell: (r: AuditRow) => <span className="text-xs"><JDate d={r.createdAt} time /></span> },
            { key: 'user', header: 'کاربر', cell: (r: AuditRow) => <span className="text-xs">{r.user?.name ?? 'سیستم'}</span> },
            { key: 'action', header: 'عملیات', cell: (r: AuditRow) => <span className="font-mono text-[11px]" dir="ltr">{r.action}</span> },
            { key: 'entity', header: 'موجودیت', cell: (r: AuditRow) => <span className="text-xs">{r.entityType}{r.entityId ? <span className="text-muted-foreground" dir="ltr"> ({r.entityId.slice(0, 10)}…)</span> : null}</span> },
            {
              key: 'result', header: 'نتیجه', cell: (r: AuditRow) => (
                <Badge className={`border-transparent ${r.result === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : r.result === 'DENIED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                  {r.result === 'SUCCESS' ? 'موفق' : r.result === 'DENIED' ? 'دسترسی رد شد' : 'خطا'}
                </Badge>
              ),
            },
            { key: 'ip', header: 'IP', cell: (r: AuditRow) => <span className="text-[11px] text-muted-foreground" dir="ltr">{r.ip ?? '—'}</span> },
            {
              key: 'changes', header: 'تغییرات', cell: (r: AuditRow) => (
                <span
                  className="text-[11px] text-muted-foreground line-clamp-1 max-w-56"
                  title={JSON.stringify({ before: r.beforeJson && JSON.parse(r.beforeJson), after: r.afterJson && JSON.parse(r.afterJson) })}
                >
                  {r.beforeJson || r.afterJson ? `${(r.beforeJson ?? '∅').slice(0, 40)} → ${(r.afterJson ?? '∅').slice(0, 40)}` : '—'}
                </span>
              ),
            },
          ]}
          rows={data ?? []}
          loading={loading}
          rowKey={(r: AuditRow) => r.id}
          empty="سابقه‌ای ثبت نشده است"
        />
      )}
    </div>
  )
}
