// ورود با گوگل (OAuth 2.0 + PKCE) — خواندن پیکربندی از env یا پنل مدیریت
// اولویت: متغیرهای محیطی GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET؛ در نبود آن‌ها از Setting خوانده می‌شود
import { db } from '@/lib/db'

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

export const GOOGLE_ENABLED_KEY = 'auth.google.enabled'
export const GOOGLE_CLIENT_ID_KEY = 'auth.google.clientId'
export const GOOGLE_CLIENT_SECRET_KEY = 'auth.google.clientSecret'

export type GoogleConfig = {
  clientId: string
  clientSecret: string
  source: 'env' | 'db'
}

export async function isGoogleLoginEnabled(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: GOOGLE_ENABLED_KEY } })
  return row?.value === '1'
}

export async function getGoogleOAuthConfig(): Promise<GoogleConfig | null> {
  const envId = process.env.GOOGLE_CLIENT_ID?.trim()
  const envSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (envId && envSecret) return { clientId: envId, clientSecret: envSecret, source: 'env' }

  const rows = await db.setting.findMany({
    where: { key: { in: [GOOGLE_CLIENT_ID_KEY, GOOGLE_CLIENT_SECRET_KEY] } },
  })
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
  const id = map[GOOGLE_CLIENT_ID_KEY]?.trim()
  const secret = map[GOOGLE_CLIENT_SECRET_KEY]?.trim()
  if (id && secret) return { clientId: id, clientSecret: secret, source: 'db' }
  return null
}
