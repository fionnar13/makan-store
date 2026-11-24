// ابزارهای مشترک API — قالب پاسخ یکپارچه، خطاها، اعتبارسنجی
import { NextRequest, NextResponse } from 'next/server'
import { ZodSchema } from 'zod'

export class ApiError extends Error {
  status: number
  code: string
  details?: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 })
}

export function fail(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    )
  }
  const msg = err instanceof Error ? err.message : 'خطای ناشناخته سرور'
  console.error('[API_ERROR]', err)
  return NextResponse.json(
    { ok: false, error: { code: 'INTERNAL', message: msg } },
    { status: 500 },
  )
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}

// Wrapper استاندارد هندلرها
export function handler(fn: () => Promise<NextResponse>) {
  return fn().catch(e => fail(e))
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw new ApiError(400, 'BAD_JSON', 'بدنه درخواست JSON معتبر نیست')
  }
  const res = schema.safeParse(raw)
  if (!res.success) {
    throw new ApiError(400, 'VALIDATION', 'اعتبارسنجی ورودی ناموفق بود', res.error.flatten())
  }
  return res.data
}

// محدودسازی نرخ ساده در حافظه (Brute Force مقدماتی)
const rateMap = new Map<string, { count: number; resetAt: number }>()
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const entry = rateMap.get(key)
  if (!entry || entry.resetAt < now) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  entry.count++
  if (entry.count > limit) {
    throw new ApiError(429, 'RATE_LIMIT', 'تعداد درخواست‌ها بیش از حد مجاز است؛ کمی بعد تلاش کنید')
  }
}
