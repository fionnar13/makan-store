'use client'
// هیرو اسلایدشو صفحه فروشگاه — نمایش بنرهای ارسالی از پنل مدیریت
// چرخش خودکار هر ۵ ثانیه، فلش و نقطه ناوبری، توقف موقت با هاور، سازگار با RTL
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import type { SiteBanner } from './kit'

const AUTOPLAY_MS = 5000

export default function StoreHero({ slides }: { slides: SiteBanner[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = slides.length
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const next = () => setIndex(i => (i + 1) % count)
  const prev = () => setIndex(i => (i - 1 + count) % count)
  const go = (i: number) => setIndex(((i % count) + count) % count)

  // چرخش خودکار — در هاور یا وقتی فقط یک اسلاید است متوقف می‌شود
  useEffect(() => {
    if (count <= 1 || paused) return
    timer.current = setInterval(() => setIndex(i => (i + 1) % count), AUTOPLAY_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [count, paused])

  if (count === 0) return null

  return (
    <section
      aria-label="بنرهای فروشگاه"
      aria-roledescription="اسلایدشو"
      className="relative rounded-2xl overflow-hidden h-44 sm:h-56 md:h-72 group mb-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${i === index ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
          <img
            src={s.imageUrl}
            alt={s.title ?? 'بنر فروشگاه'}
            className="absolute inset-0 h-full w-full object-cover"
            loading={i === 0 ? 'eager' : 'lazy'}
          />
          {/* گرادیان خوانایی متن */}
          <div className="absolute inset-0 bg-gradient-to-l from-black/75 via-black/40 to-black/10" aria-hidden />

          {(s.title || s.subtitle || s.linkUrl) && (
            <div className="absolute inset-y-0 right-0 flex flex-col justify-center gap-2 p-5 md:p-8 max-w-[85%] md:max-w-lg">
              {s.title && (
                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white leading-8 drop-shadow-sm">{s.title}</h2>
              )}
              {s.subtitle && (
                <p className="text-xs md:text-sm text-white/90 leading-6 line-clamp-3">{s.subtitle}</p>
              )}
              {s.linkUrl && (
                <a
                  href={s.linkUrl}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/95 text-stone-900 text-xs font-bold px-4 py-2 hover:bg-emerald-50 transition-colors"
                >
                  {s.linkLabel || 'مشاهده'} <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </div>
          )}
        </div>
      ))}

      {/* فلش‌ها — در RTL: فلش چپ = بعدی، فلش راست = قبلی */}
      {count > 1 && (
        <>
          <button
            onClick={next}
            aria-label="بنر بعدی"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 grid place-items-center h-9 w-9 rounded-full bg-white/25 text-white backdrop-blur-sm hover:bg-white/40 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            onClick={prev}
            aria-label="بنر قبلی"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 grid place-items-center h-9 w-9 rounded-full bg-white/25 text-white backdrop-blur-sm hover:bg-white/40 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>

          {/* نقاط ناوبری */}
          <div className="absolute bottom-3 inset-x-0 z-20 flex justify-center gap-1.5 px-4">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                aria-label={`بنر ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-white' : 'w-3 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
