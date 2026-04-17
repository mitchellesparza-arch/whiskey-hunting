import { NextResponse } from 'next/server'
import { getHistory, getLastState } from '../../../lib/history.js'

/**
 * GET /api/history
 *
 * Returns restock history events and the current persisted state.
 * Public read-only — no auth required.
 *
 * Response:
 *   {
 *     events: [{ type, name, objectID, url, price, timestamp }, ...],   // newest first
 *     lastState: { [bottleName]: { objectID, inStock, price, checkedAt } }
 *   }
 */
export async function GET() {
  try {
    const [events, lastState] = await Promise.all([getHistory(200), getLastState()])
    return NextResponse.json({ events, lastState })
  } catch (err) {
    console.error('[history] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
