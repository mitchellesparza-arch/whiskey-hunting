import { NextResponse } from 'next/server'
import {
  pollReserveBar,
  markAlertFired,
  getMonitorState,
  shouldPollNow,
  isExpired,
  desiredIntervalSeconds,
} from '../../../lib/reservebar.js'
import { sendBroadcast }    from '../../../lib/push.js'
import { postGoldFoilAlert } from '../../../lib/discord.js'

/**
 * GET /api/reservebar-monitor
 *
 * Called by Vercel cron every minute (see vercel.json: * * * * *)
 * Protected by CRON_SECRET Bearer token (Vercel injects this automatically).
 *
 * Feature flag: set RESERVEBAR_MONITOR_ENABLED=true to activate.
 * Kill switch: unset or set to anything other than "true" to disable without
 * redeploying.
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://whiskey-hunter.vercel.app/api/reservebar-monitor
 *
 * Force a test notification (does NOT check ReserveBar, just fires push):
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        "https://whiskey-hunter.vercel.app/api/reservebar-monitor?test_notify=1"
 */
export async function GET(request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth  = request.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── Feature flag ──────────────────────────────────────────────────────────
  if (process.env.RESERVEBAR_MONITOR_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'monitor disabled' })
  }

  const url    = new URL(request.url)
  const isTest = url.searchParams.get('test_notify') === '1'

  // ── Test notification path ────────────────────────────────────────────────
  if (isTest) {
    const testUrl = 'https://www.reservebar.com/collections/wild-turkey'
    await Promise.allSettled([
      sendBroadcast({
        title: '🥃 [TEST] Gold Foil Monitor — For Kevin',
        body:  'This is a test notification — push delivery confirmed.',
        url:   testUrl,
        tag:   'reservebar-gold-foil-test',
      }, null),
      postGoldFoilAlert({ productUrl: testUrl, price: null, isTest: true }),
    ])
    return NextResponse.json({ ok: true, testNotificationSent: true })
  }

  // ── 30-day expiry guard ───────────────────────────────────────────────────
  const state = await getMonitorState()

  if (isExpired(state.activeSince)) {
    console.log('[reservebar] monitor expired (30-day window passed) — skipping')
    return NextResponse.json({ ok: true, skipped: 'monitor expired after 30 days' })
  }

  // ── Rate limit — respect peak/off-peak intervals ──────────────────────────
  // Vercel fires this every minute; we gate on elapsed time ourselves so that
  // off-peak runs only execute every 5 minutes without changing the cron expr.
  if (!shouldPollNow(state.lastPollAt)) {
    const interval = desiredIntervalSeconds()
    return NextResponse.json({ ok: true, skipped: `rate limited (interval=${interval}s)` })
  }

  // ── Poll ReserveBar ───────────────────────────────────────────────────────
  const result = await pollReserveBar()

  // ── Fire notification ─────────────────────────────────────────────────────
  if (result.shouldFire && !result.alreadyFired) {
    const buyUrl = state.directProductUrl
      ?? 'https://www.reservebar.com/collections/wild-turkey'

    await Promise.allSettled([
      sendBroadcast({
        title: '🥃 Gold Foil is LIVE on ReserveBar',
        body:  'Wild Turkey Austin Nichols Archives Gold Foil Edition — ~$400 — Open ReserveBar and check out now.',
        url:   buyUrl,
        tag:   'reservebar-gold-foil',
      }, null),
      postGoldFoilAlert({ productUrl: buyUrl, price: result.price ?? null }),
    ])

    await markAlertFired()
    console.log('[reservebar] ALERT FIRED — push + Discord sent')
  }

  return NextResponse.json({
    ok:         true,
    polledAt:   result.polledAt,
    phase:      result.phase,
    signals:    result.signals,
    candidates: result.candidates,
    fired:      result.shouldFire,
    error:      result.error ?? null,
  })
}
