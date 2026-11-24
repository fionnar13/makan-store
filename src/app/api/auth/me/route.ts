import { NextRequest } from 'next/server'
import { handler, ok } from '@/lib/api'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  return handler(async () => {
    const user = await requireAuth(req)
    return ok(user)
  })
}
