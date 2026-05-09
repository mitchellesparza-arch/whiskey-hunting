import { NextResponse }       from 'next/server'
import { getToken }           from 'next-auth/jwt'
import { getRecentAlerts }    from '../../../../lib/costco-history.js'

/**
 * GET /api/costco/history
 *
 * Returns the global recent-alerts feed (newest first).  The client uses this
 * for both the live ticker (everything) and the favorites section (filter
 * client-side by storeNumber).
 *
 * Query params:
 *   limit — optional, max 200, defaults to 100
 */
export async function GET(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url   = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200)

  const alerts = await getRecentAlerts(limit)

  return NextResponse.json({
    alerts,
    lastObservedAt: alerts[0]?.observedAt ?? null,
    count: alerts.length,
  })
}
