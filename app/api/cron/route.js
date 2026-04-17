import { NextResponse } from 'next/server'
import { checkAllBottles }                    from '../../../lib/checker.js'
import { sendAlertEmail }                     from '../../../lib/email.js'
import { getLastState, saveState, logEvent }  from '../../../lib/history.js'
import { alertBottles, hotlineBottles }        from '../../../lib/bottles.js'

/**
 * Builds the grouped list of non-API-trackable hotline bottles to check when a
 * delivery from `distributor` is detected.
 *
 * Returns [{tier, names}] — one entry per tier divider that has at least one
 * matching bottle.  Empty array if the distributor has no hotline bottles.
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

  return groups  // [{tier, names}], empty array means nothing to flag
}

/**
 * GET /api/cron
 *
 * Runs 4× per day via Vercel Cron (see vercel.json).
 * Protected by CRON_SECRET Bearer token.
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-app.vercel.app/api/cron
 */
export async function GET(request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('CRON_SECRET is not set — endpoint is unprotected!')
  }

  console.log('[cron] Starting bottle sweep — calling Algolia directly')

  try {
    // ── Run all checks ────────────────────────────────────────────────────────
    const { alertResults, trackResults, alertsInStock, checkedAt } =
      await checkAllBottles()

    console.log(
      `[cron] Done. Alert in-stock: ${alertsInStock.length}/${alertResults.length}  ` +
      `Track checked: ${trackResults.length}`
    )

    // ── State diff — detect in/out-of-stock transitions ───────────────────────
    const allResults = [...alertResults, ...trackResults]
    const lastState  = await getLastState()
    const stockEvents = []  // type: in_stock | out_of_stock | quantity_increase
    // Threshold: a count jump of this many bottles or more signals a truck restock
    const RESTOCK_THRESHOLD = 5

    for (const r of allResults) {
      if (r.error) continue
      const prev        = lastState[r.name]
      const wasInStock  = prev?.inStock  ?? null   // null = first time seeing this bottle
      const prevQty     = prev?.quantity ?? null

      if (wasInStock === false && r.inStock === true) {
        // Binary out → in transition
        stockEvents.push({
          type:        'in_stock',
          name:        r.name,
          objectID:    r.objectID,
          distributor: r.distributor,
          url:         r.url,
          price:       r.price,
          quantity:    r.quantity,
          timestamp:   checkedAt,
        })
      } else if (wasInStock === true && r.inStock === false) {
        stockEvents.push({
          type:        'out_of_stock',
          name:        r.name,
          objectID:    r.objectID,
          distributor: r.distributor,
          url:         r.url,
          price:       r.price,
          quantity:    0,
          timestamp:   checkedAt,
        })
      } else if (
        r.inStock &&
        r.quantity != null &&
        prevQty != null &&
        r.quantity - prevQty >= RESTOCK_THRESHOLD
      ) {
        // Bottle was already in stock but count jumped — strong truck signal
        stockEvents.push({
          type:        'quantity_increase',
          name:        r.name,
          objectID:    r.objectID,
          distributor: r.distributor,
          url:         r.url,
          price:       r.price,
          quantity:    r.quantity,
          prevQuantity: prevQty,
          timestamp:   checkedAt,
        })
      }
    }

    for (const event of stockEvents) {
      await logEvent(event)
    }
    if (stockEvents.length) {
      console.log('[cron] Stock events:', stockEvents.map((e) => `${e.type}:${e.name}`).join(', '))
    }

    // ── Truck detection ───────────────────────────────────────────────────────
    // Triggered by two signals, both meaning "a truck just came in":
    //   1. Binary out→in transition (in_stock)
    //   2. Quantity jump of ≥5 on a bottle already in stock (quantity_increase)
    // Group by distributor — one truck event per distributor per run.
    const truckTriggers = stockEvents.filter(
      (e) => e.type === 'in_stock' || e.type === 'quantity_increase'
    )
    const byDistributor = new Map()
    for (const e of truckTriggers) {
      if (!e.distributor) continue
      if (!byDistributor.has(e.distributor)) byDistributor.set(e.distributor, [])
      const label = e.type === 'quantity_increase'
        ? `${e.name} (${e.prevQuantity}→${e.quantity})`
        : e.name
      byDistributor.get(e.distributor).push(label)
    }

    const truckEvents = []
    for (const [distributor, triggeredBy] of byDistributor) {
      const checkFor = hotlineCheckList(distributor)
      if (checkFor.length === 0) continue  // nothing untrackable to flag for this distributor
      const truck = { type: 'truck_detected', distributor, triggeredBy, checkFor, timestamp: checkedAt }
      truckEvents.push(truck)
      await logEvent(truck)
    }
    if (truckEvents.length) {
      console.log('[cron] Truck events:', truckEvents.map((t) => t.distributor).join(', '))
    }

    // ── Persist new state snapshot ────────────────────────────────────────────
    const newState = {}
    for (const r of allResults) {
      if (!r.error) {
        newState[r.name] = { objectID: r.objectID, distributor: r.distributor, inStock: r.inStock, price: r.price, quantity: r.quantity, checkedAt }
      }
    }
    for (const [name, val] of Object.entries(lastState)) {
      if (!newState[name]) newState[name] = val
    }
    await saveState(newState)

    // ── Email — only send when something NEW happened ─────────────────────────
    // Use stock transitions (out→in) for alert bottles rather than "currently in
    // stock", so a bottle sitting in stock all day doesn't trigger repeated emails.
    const alertNames = new Set(alertBottles.map((b) => b.name))
    const newAlertInStock = stockEvents.filter(
      (e) => e.type === 'in_stock' && alertNames.has(e.name)
    )
    const shouldEmail = newAlertInStock.length > 0 || truckEvents.length > 0
    if (shouldEmail) {
      console.log('[cron] Sending email — new alerts:', newAlertInStock.map((e) => e.name), '  trucks:', truckEvents.map((t) => t.distributor))
      await sendAlertEmail(newAlertInStock, truckEvents, checkedAt)
    } else {
      console.log('[cron] No new transitions or truck activity — no email sent.')
    }

    // ── Summary response ──────────────────────────────────────────────────────
    const errors = allResults.filter((r) => r.error)
    return NextResponse.json({
      ok: true,
      checkedAt,
      alertsInStock:  alertsInStock.map((b) => b.name),
      alertsChecked:  alertResults.length,
      trackChecked:   trackResults.length,
      errors:         errors.length,
      errorDetails:   errors.slice(0, 5).map((r) => `${r.name}: ${r.error}`),
      emailSent:      shouldEmail,
      newAlertEvents: newAlertInStock.map((e) => e.name),
      stockEvents:    stockEvents.map((e) => `${e.type}:${e.name}`),
      truckEvents:    truckEvents.map((t) => ({ distributor: t.distributor, triggeredBy: t.triggeredBy })),
    })
  } catch (err) {
    console.error('[cron] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
