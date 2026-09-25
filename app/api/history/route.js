import { NextResponse }                            from 'next/server'
import { getToken }                                from 'next-auth/jwt'
import { getHistory, getLastCheckedAt, logEvent } from '../../../lib/history.js'
import { hotlineBottles }                          from '../../../lib/bottles.js'

/**
 * GET /api/history
 *
 * Returns truck delivery events, newest first.
 * Public read-only — no auth required. CDN-cached briefly: the underlying
 * data only changes on the hourly cron or a manual report, and each uncached
 * hit reads every store's event list from Redis.
 */
export async function GET() {
  try {
    const [events, lastCheckedAt] = await Promise.all([getHistory(), getLastCheckedAt()])

    // checkFor is the same hotline checklist repeated on every event from a
    // distributor (~85% of the payload). Send each unique list once and have
    // events reference it by index; the tracker page rehydrates.
    const checkForLists = []
    const listIdx       = new Map()
    const slimEvents    = events.map(({ checkFor, ...e }) => {
      if (!checkFor) return e
      const key = JSON.stringify(checkFor)
      if (!listIdx.has(key)) { listIdx.set(key, checkForLists.length); checkForLists.push(checkFor) }
      return { ...e, checkForIdx: listIdx.get(key) }
    })

    return NextResponse.json({ events: slimEvents, checkForLists, lastCheckedAt }, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    })
  } catch (err) {
    console.error('[history] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/history
 *
 * Manually report a truck sighting.
 * Requires auth + approval.
 * Body: { storeName, storeCode?, distributor }
 */
function hotlineCheckList(distributor) {
  const groups = []
  let currentTier = null
  for (const b of hotlineBottles) {
    if (b.divider) { currentTier = b.divider; continue }
    if (b.distributor !== distributor) continue
    const last = groups[groups.length - 1]
    if (last?.tier === currentTier) {
      last.names.push(b.name)
    } else {
      groups.push({ tier: currentTier, names: [b.name] })
    }
  }
  return groups
}

export async function POST(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const { storeName, storeCode, distributor } = await request.json()
    if (!storeName?.trim() || !distributor?.trim()) {
      return NextResponse.json({ error: 'storeName and distributor are required' }, { status: 400 })
    }

    const reporterName = token.name ?? token.email ?? 'Club member'
    const code = storeCode || storeName.toLowerCase().replace(/[^a-z0-9]/g, '-')

    const event = {
      type:        'truck_detected',
      storeCode:   code,
      storeName:   storeName.trim(),
      distributor: distributor.trim(),
      triggeredBy: [`👤 Reported by ${reporterName}`],
      checkFor:    hotlineCheckList(distributor.trim()),
      timestamp:   new Date().toISOString(),
      manual:      true,
    }

    await logEvent(event)
    return NextResponse.json({ ok: true, event })
  } catch (err) {
    console.error('[history] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
