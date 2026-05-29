import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'

const ALLOWED_PATHS = new Set([
  '/api/admin/bottle-seed',
  '/api/admin/backfill-prices',
  '/api/admin/backfill-msrp',
  '/api/admin/backfill-prices',
  '/api/market-price/refresh',
  '/api/cron',
  '/api/cron/algolia-sweep',
  '/api/cron/import-upcs',
  '/api/reservebar-monitor',
  '/api/cron/catalog-audit',
])

async function isOwner(req) {
  const token      = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const ownerEmail = process.env.ALERT_EMAIL?.trim().toLowerCase()
  return ownerEmail && token?.email?.toLowerCase() === ownerEmail
}

/**
 * POST /api/admin/run-cron
 * Body: { path: '/api/cron', method?: 'GET' | 'POST' }
 *
 * Proxy for admin-triggered cron runs. Verifies owner session,
 * then forwards to the target endpoint with CRON_SECRET injected.
 */
export async function POST(request) {
  if (!await isOwner(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { path, method = 'GET' } = await request.json()

  if (!ALLOWED_PATHS.has(path)) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 400 })
  }

  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })

  const base = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const url  = `${base.replace(/\/$/, '')}${path}`

  try {
    const res  = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${secret}` },
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
