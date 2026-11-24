'use client'

import dynamic from 'next/dynamic'

// اپ تک‌صفحه‌ای — همه ماژول‌ها داخل همین مسیر رندر می‌شوند
const App = dynamic(() => import('@/components/app/App'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" aria-hidden />
        <p className="text-sm text-stone-500">در حال بارگذاری سامانه…</p>
      </div>
    </div>
  ),
})

export default function Home() {
  return <App />
}
