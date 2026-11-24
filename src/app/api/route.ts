// Health Check
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await db.$queryRawUnsafe('SELECT 1')
    return NextResponse.json({ ok: true, service: 'بنکداری هوشمند', db: 'up', time: new Date().toISOString() })
  } catch {
    return NextResponse.json({ ok: false, db: 'down' }, { status: 500 })
  }
}
