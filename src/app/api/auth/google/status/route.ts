// وضعیت ورود با گوگل — عمومی (صفحه ورود با این تصمیم می‌گیرد دکمه گوگل را نشان دهد یا نه)
import { handler, ok } from '@/lib/api'
import { getGoogleOAuthConfig, isGoogleLoginEnabled } from '@/lib/google-auth'

export async function GET() {
  return handler(async () => {
    const [enabled, config] = await Promise.all([isGoogleLoginEnabled(), getGoogleOAuthConfig()])
    return ok({ enabled, configured: !!config })
  })
}
