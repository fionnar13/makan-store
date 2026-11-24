'use client'
// پیام‌رسانی داخلی — گفت‌وگوی خصوصی با polling کوتاه؛ پیام‌ها در Database ذخیره می‌شوند
import { useEffect, useRef, useState } from 'react'
import { apiFetch, useApiData, PageHeader, JDate } from './kit'
import type { SessionUserLike } from './types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

type Contact = { id: string; name: string; lastBody: string | null; lastAt: string | null; unread: number }
type Msg = { id: string; senderUserId: string; recipientUserId: string; body: string; isRead: boolean; createdAt: string }

export default function MessagesView({ user }: { user: SessionUserLike }) {
  const [withUserId, setWithUserId] = useState<string | null>(null)
  const { data: contacts, reload: reloadContacts } = useApiData<Contact[]>('/api/messages')
  const { data: thread, reload: reloadThread } = useApiData<{ other: { id: string; name: string }; messages: Msg[] }>(
    withUserId ? `/api/messages?withUserId=${withUserId}` : null
  )
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // polling گفت‌وگو و مخاطبان
  useEffect(() => {
    if (!withUserId) return
    const t = setInterval(() => { reloadThread(); reloadContacts() }, 5000)
    return () => clearInterval(t)
  }, [withUserId, reloadThread, reloadContacts])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread?.messages.length])

  const send = async () => {
    if (!withUserId || !draft.trim()) return
    setSending(true)
    try {
      await apiFetch('/api/messages', { method: 'POST', body: JSON.stringify({ recipientUserId: withUserId, body: draft.trim() }) })
      setDraft('')
      reloadThread(); reloadContacts()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'ارسال ناموفق بود')
    } finally { setSending(false) }
  }

  return (
    <div>
      <PageHeader title="پیام‌رسانی داخلی" desc="گفت‌وگوی خصوصی بین کاربران سامانه — ذخیره در Database با اعلان خودکار" />
      <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-260px)] min-h-96">
        {/* مخاطبان */}
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 text-sm font-bold border-b bg-stone-50">مخاطبان</div>
          <ScrollArea className="flex-1">
            {(contacts ?? []).map(c => (
              <button
                key={c.id}
                onClick={() => setWithUserId(c.id)}
                className={`w-full text-right px-4 py-3 border-b hover:bg-stone-50 ${withUserId === c.id ? 'bg-emerald-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.unread > 0 && <Badge className="border-transparent bg-rose-500 text-white text-[10px]">{c.unread}</Badge>}
                </div>
                {c.lastBody && <div className="text-[11px] text-muted-foreground truncate mt-0.5">{c.lastBody}</div>}
              </button>
            ))}
            {(contacts ?? []).length === 0 && <p className="text-xs text-muted-foreground text-center py-8">کاربری یافت نشد</p>}
          </ScrollArea>
        </div>

        {/* گفت‌وگو */}
        <div className="rounded-xl border bg-card flex flex-col overflow-hidden">
          {withUserId && thread ? (
            <>
              <div className="px-4 py-2.5 text-sm font-bold border-b bg-stone-50">{thread.other.name}</div>
              <ScrollArea className="flex-1 p-4">
                <div className="grid gap-2">
                  {thread.messages.map(m => {
                    const mine = m.senderUserId === user.id
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'} flex-row-reverse`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-stone-100 text-stone-800 rounded-tl-sm'}`}>
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <div className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-stone-400'}`}>
                            <span dir="ltr"><JDate d={m.createdAt} time /></span> {mine && !m.isRead && '· ارسال‌شده'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
              <div className="border-t p-3 flex gap-2">
                <Input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="پیام خود را بنویسید…"
                  aria-label="متن پیام"
                />
                <Button onClick={send} disabled={sending || !draft.trim()} size="icon" aria-label="ارسال">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">یک گفت‌وگو را انتخاب کنید</div>
          )}
        </div>
      </div>
    </div>
  )
}
