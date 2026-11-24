// احراز هویت مبتنی بر نشست (Session) — scrypt + توکن تصادفی + Hash در DB
import { NextRequest } from 'next/server'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'
import { db } from '@/lib/db'
import { ApiError, clientIp } from '@/lib/api'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'bwh_session'
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000 // ۷ روز

// تشخیص HTTPS «از دید مرورگر» — حتی وقتی پراکسی هدر x-forwarded-proto را نمی‌فرستد،
// کلاینت از طریق هدر x-bwh-proto پروتکل واقعی خودش را اعلام می‌کند
export function isHttpsRequest(req: NextRequest): boolean {
  const fwd = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase()
  if (fwd === 'https') return true
  const client = req.headers.get('x-bwh-proto')?.trim().toLowerCase()
  if (client === 'https') return true
  try {
    return req.nextUrl.protocol === 'https:'
  } catch {
    return false
  }
}

// گزینه‌های کوکی نشست — در HTTPS از SameSite=None; Secure; Partitioned استفاده می‌کنیم
// تا کوکی حتی وقتی برنامه داخل iframe (پیش‌نمایش) اجرا شود توسط مرورگر ذخیره و ارسال شود (CHIPS)
export function sessionCookieOptions(req: NextRequest, maxAge: number): Partial<ResponseCookie> {
  const https = isHttpsRequest(req)
  const opts: Partial<ResponseCookie> = {
    httpOnly: true,
    sameSite: https ? 'none' : 'lax',
    secure: https,
    path: '/',
    maxAge,
  }
  if (https) opts.partitioned = true
  return opts
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, salt, hash] = stored.split('$')
    if (algo !== 'scrypt' || !salt || !hash) return false
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex')
}

export type SessionUser = {
  id: string
  phone: string
  name: string
  avatarUrl: string | null
  roles: string[]
  roleLabels: string[]
  permissions: string[]
}

export async function createSession(userId: string, ip: string, userAgent: string | null): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip,
      userAgent,
    },
  })
  return token
}

export async function revokeSession(token: string) {
  await db.session.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { roles: { include: { role: true } } } } },
  })
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null
  const u = session.user
  if (!u.isActive) return null
  const permissions = new Set<string>()
  const roleLabels: string[] = []
  for (const ur of u.roles) {
    roleLabels.push(ur.role.label)
    const perms = await db.rolePermission.findMany({
      where: { roleId: ur.role.id },
      include: { permission: true },
    })
    for (const rp of perms) permissions.add(rp.permission.code)
  }
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    avatarUrl: u.avatarUrl,
    roles: u.roles.map(ur => ur.role.name),
    roleLabels,
    permissions: [...permissions],
  }
}

export async function requireAuth(req: NextRequest): Promise<SessionUser> {
  const user = await getSessionUser(req)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'ورود لازم است')
  return user
}

export async function requirePerm(req: NextRequest, ...codes: string[]): Promise<SessionUser> {
  const user = await requireAuth(req)
  for (const c of codes) {
    if (!user.permissions.includes(c)) {
      throw new ApiError(403, 'FORBIDDEN', 'دسترسی لازم برای این عملیات را ندارید', { need: c })
    }
  }
  return user
}

export async function recordLogin(userId: string, ip: string) {
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
}

export { clientIp }
