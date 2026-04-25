import { NextResponse }                    from 'next/server'
import { getHistory, getLastCheckedAt }   from '../../../lib/history.js'

/**
 * GET /api/history
 *
 * Returns truck delivery events, newest first.
 * Public read-only — no auth required.
 *
 * Response:
 *   {
 *     events: [{
 *       type:        'truck_detected',
 *       storeCode:   string,
 *       storeName:   string,
 *       distributor: string,
 *       triggeredBy: string[],
 *       checkFor:    [{tier, names}],
 *       timestamp:   ISO string
 *     }, ...]
 *   }
 */
export async function GET() {
  try {
    const [events, lastCheckedAt] = await Promise.all([getHistory(), getLastCheckedAt()])
    return NextResponse.json({ events, lastCheckedAt })
  } catch (err) {
    console.error('[history] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
