// بارگذاری تصاویر و ویدیو (لوگو، فایوآیکون، تصویر پروفایل، بنر، پس‌زمینه صفحه ورود)
// اعتبارسنجی نوع واقعی فایل با امضای بایت (Magic Bytes) + محدودیت حجم + ذخیره در public/uploads
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { ApiError } from '@/lib/api'

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // ۲ مگابایت
export const MAX_LOGIN_IMAGE_BYTES = 8 * 1024 * 1024 // ۸ مگابایت — پس‌زمینه صفحه ورود
export const MAX_LOGIN_VIDEO_BYTES = 50 * 1024 * 1024 // ۵۰ مگابایت — ویدیوی پس‌زمینه

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

// امضای بایتی برای اطمینان از نوع واقعی فایل (نه صرفاً MIME اعلامی کلاینت)
function detectExt(buf: Buffer, declaredExt: string): string | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
  if (buf.length >= 6) {
    const head = buf.subarray(0, 6).toString('ascii')
    if (head === 'GIF87a' || head === 'GIF89a') return 'gif'
  }
  if (buf.length >= 4 && buf.subarray(0, 4).toString('hex') === '00000100') return 'ico'
  // ویدیو — MP4: رشته ftyp در بایت ۴ تا ۸ / WebM: سرآیند EBML
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'mp4'
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm'
  // SVG متن است — با بررسی محتوایی در مسیر خودش اعتبارسنجی می‌شود
  if (declaredExt === 'svg') return 'svg'
  return null
}

export type UploadKind = 'site' | 'avatars' | 'banners' | 'login'

// محدودیت حجم هر نوع — بنرهای هیرو تصویر بزرگ‌تر دارند (۵ مگابایت)
const MAX_BYTES_BY_KIND: Record<UploadKind, number> = {
  site: MAX_IMAGE_BYTES,
  avatars: MAX_IMAGE_BYTES,
  banners: 5 * 1024 * 1024,
  login: MAX_LOGIN_IMAGE_BYTES,
}

// ذخیره تصویر و برگرداندن مسیر عمومی آن مثل /uploads/site/xxxx.png
export async function saveUploadImage(file: File, kind: UploadKind): Promise<string> {
  const maxBytes = MAX_BYTES_BY_KIND[kind] ?? MAX_IMAGE_BYTES
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError(400, 'EMPTY_FILE', 'فایلی انتخاب نشده است')
  }
  if (file.size > maxBytes) {
    throw new ApiError(400, 'TOO_LARGE', `حجم تصویر باید حداکثر ${Math.round(maxBytes / (1024 * 1024))} مگابایت باشد`)
  }
  const declaredExt = EXT_BY_MIME[file.type]
  if (!declaredExt) {
    throw new ApiError(400, 'BAD_TYPE', 'فرمت پشتیبانی نمی‌شود؛ از PNG، JPEG، WEBP، GIF، SVG یا ICO استفاده کنید')
  }
  const buf = Buffer.from(await file.arrayBuffer())
  const ext = detectExt(buf, declaredExt)
  if (!ext) {
    throw new ApiError(400, 'BAD_TYPE', 'محتوای فایل با فرمت اعلام‌شده مطابقت ندارد')
  }
  if (ext === 'svg') {
    // SVG حاوی اسکریپت خطرناک است (XSS از طریق <img>/مستقیم)
    const text = buf.toString('utf8')
    if (/<script[\s>]/i.test(text) || /\son\w+\s*=/i.test(text) || /javascript\s*:/i.test(text)) {
      throw new ApiError(400, 'BAD_SVG', 'فایل SVG حاوی کد اجرایی است و مجاز نیست')
    }
    if (text.length > MAX_IMAGE_BYTES) {
      throw new ApiError(400, 'TOO_LARGE', 'حجم تصویر باید حداکثر ۲ مگابایت باشد')
    }
  }
  const dir = path.join(process.cwd(), 'public', 'uploads', kind)
  await mkdir(dir, { recursive: true })
  const name = `${Date.now().toString(36)}-${randomBytes(5).toString('hex')}.${ext}`
  await writeFile(path.join(dir, name), buf)
  return `/uploads/${kind}/${name}`
}

const MEDIA_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
])

// ذخیره تصویر یا ویدیوی پس‌زمینه صفحه ورود — تصویر تا ۸ و ویدیو تا ۵۰ مگابایت
// خروجی مثل /uploads/login/xxxx.mp4 یا /uploads/login/xxxx.jpg
export async function saveUploadMedia(file: File, kind: UploadKind): Promise<string> {
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError(400, 'EMPTY_FILE', 'فایلی انتخاب نشده است')
  }
  const isVideoMime = file.type.startsWith('video/')
  const maxBytes = isVideoMime ? MAX_LOGIN_VIDEO_BYTES : MAX_LOGIN_IMAGE_BYTES
  if (file.size > maxBytes) {
    throw new ApiError(400, 'TOO_LARGE', isVideoMime
      ? 'حجم ویدیو باید حداکثر ۵۰ مگابایت باشد'
      : 'حجم تصویر باید حداکثر ۸ مگابایت باشد')
  }
  if (!MEDIA_MIMES.has(file.type)) {
    throw new ApiError(400, 'BAD_TYPE', 'فرمت پشتیبانی نمی‌شود؛ از PNG، JPEG، WEBP، GIF (تصویر) یا MP4، WEBM (ویدیو) استفاده کنید')
  }
  const buf = Buffer.from(await file.arrayBuffer())
  const ext = detectExt(buf, file.type)
  if (!ext) {
    throw new ApiError(400, 'BAD_TYPE', 'محتوای فایل با فرمت اعلام‌شده مطابقت ندارد')
  }
  const isVideoExt = ext === 'mp4' || ext === 'webm'
  if (isVideoExt !== isVideoMime) {
    throw new ApiError(400, 'BAD_TYPE', 'نوع فایل با محتوای آن مطابقت ندارد')
  }
  const dir = path.join(process.cwd(), 'public', 'uploads', kind)
  await mkdir(dir, { recursive: true })
  const name = `${Date.now().toString(36)}-${randomBytes(5).toString('hex')}.${ext}`
  await writeFile(path.join(dir, name), buf)
  return `/uploads/${kind}/${name}`
}
