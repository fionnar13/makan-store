// قالب‌بندی مبالغ و تاریخ‌ها — Client-safe
// مبالغ در سیستم به ریال (Integer) ذخیره می‌شوند؛ نمایش تومان در UI انجام می‌شود.

export function formatFaNumber(n: number | string): string {
  const v = typeof n === 'string' ? parseInt(n, 10) : n
  if (Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('fa-IR').format(v)
}

export function formatRial(rls: number | string): string {
  return `${formatFaNumber(rls)} ریال`
}

export function formatToman(rls: number | string): string {
  const v = typeof rls === 'string' ? parseInt(rls, 10) : rls
  if (Number.isNaN(v)) return '—'
  return `${formatFaNumber(Math.round(v / 10))} تومان`
}

// تاریخ شمسی
const jalaliFmt = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian', year: 'numeric', month: '2-digit', day: '2-digit',
})
const jalaliLongFmt = new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian', year: 'numeric', month: 'long', day: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat('fa-IR', {
  hour: '2-digit', minute: '2-digit',
})

export function jalaliDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return '—'
  return jalaliFmt.format(date)
}

export function jalaliDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return '—'
  return `${jalaliDate(date)} — ${timeFmt.format(date)}`
}

export function jalaliLong(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return '—'
  return jalaliLongFmt.format(date)
}

// برچسب‌های ثابت
export const GROUP_LABELS: Record<string, string> = {
  REGULAR: 'معمولی',
  GOLD: 'طلایی',
  WHOLESALE: 'عمده',
}

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  GROCERY: 'خواربارفروشی',
  SUPERMARKET: 'سوپرمارکت',
  OTHER: 'سایر',
}

export const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  PRODUCER: 'تولیدکننده',
  IMPORTER: 'واردکننده',
  WHOLESALER: 'بازرگانی/عمده‌فروش',
}

export const SCOPE_LABELS: Record<string, string> = {
  DEFAULT: 'عمومی',
  CUSTOMER: 'اختصاصی مشتری',
  GROUP: 'گروه مشتری',
  TERRITORY: 'منطقه فروش',
  VOLUME: 'مقدار خرید',
}

export const ENTRY_TYPE_LABELS: Record<string, string> = {
  INVOICE: 'فاکتور فروش',
  RECEIPT: 'دریافت',
  CREDIT_NOTE: 'سند اعتبار',
  ADJUST: 'سند اصلاحی',
  PURCHASE: 'خرید از تأمین‌کننده',
  PAYMENT: 'پرداخت',
}

export const VISIT_RESULT_LABELS: Record<string, string> = {
  ORDERED: 'سفارش گرفته شد',
  PAYMENT_COLLECTED: 'وصول وجه',
  NO_ORDER: 'بدون سفارش',
  NOT_PRESENT: 'عدم حضور',
}

export const MOVEMENT_LABELS: Record<string, string> = {
  RECEIVE: 'ورود کالا',
  OUT: 'خروج کالا',
  RESERVE: 'رزرو',
  RELEASE: 'آزادسازی رزرو',
  ADJUST: 'تعدیل',
  TRANSFER_OUT: 'انتقال خروجی',
  TRANSFER_IN: 'انتقال ورودی',
  RETURN_IN: 'ورود مرجوعی',
  SCRAP: 'ضایعات',
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'ثبت‌شده',
  RESERVED: 'رزرو شده',
  CONFIRMED: 'تأیید شده',
  CREDIT_APPROVED: 'اعتبار تأیید شده',
  PAID: 'پرداخت شده',
  PICKING: 'در حال آماده‌سازی',
  READY_FOR_DISPATCH: 'آماده ارسال',
  DISPATCHED: 'ارسال شده',
  DELIVERED: 'تحویل شده',
  COMPLETED: 'کامل شده',
  CANCELLED: 'لغو شده',
  REJECTED: 'رد شده',
}

export const PAY_METHOD_LABELS: Record<string, string> = {
  CASH: 'نقدی',
  CREDIT: 'اعتباری',
  TRANSFER: 'انتقالی/کارت',
}

export const RETURN_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'درخواست‌شده',
  REVIEWED: 'در حال بررسی',
  CLOSED: 'بسته‌شده',
}

export const DISPOSITION_LABELS: Record<string, string> = {
  PENDING: 'در انتظار بررسی',
  RESTOCK: 'ورود مجدد به انبار',
  SCRAP: 'ضایعات',
  QUARANTINE: 'قرنطینه',
}

export const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: 'حاضر',
  LEAVE: 'مرخصی',
  MISSION: 'مأموریت',
}

export const STATUS_BADGE_CLASS: Record<string, string> = {
  SUBMITTED: 'bg-amber-100 text-amber-800',
  RESERVED: 'bg-teal-100 text-teal-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  CREDIT_APPROVED: 'bg-lime-100 text-lime-800',
  PAID: 'bg-emerald-600 text-white',
  PICKING: 'bg-orange-100 text-orange-800',
  READY_FOR_DISPATCH: 'bg-yellow-100 text-yellow-800',
  DISPATCHED: 'bg-violet-100 text-violet-800',
  DELIVERED: 'bg-emerald-100 text-emerald-900',
  COMPLETED: 'bg-green-100 text-green-900',
  CANCELLED: 'bg-rose-100 text-rose-800',
  REJECTED: 'bg-red-100 text-red-800',
  REQUESTED: 'bg-amber-100 text-amber-800',
  REVIEWED: 'bg-teal-100 text-teal-800',
  CLOSED: 'bg-stone-200 text-stone-700',
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-stone-200 text-stone-600',
  BLOCKED: 'bg-rose-100 text-rose-800',
  OK: 'bg-emerald-100 text-emerald-800',
  NEAR_EXPIRY: 'bg-amber-100 text-amber-800',
  EXPIRED: 'bg-rose-100 text-rose-800',
}
