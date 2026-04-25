import { NextResponse }              from 'next/server'
import { fetchChicagolandStores }   from '../../../lib/stores.js'
import { checkAllCanaries }          from '../../../lib/checker.js'
import { hotlineBottles }            from '../../../lib/bottles.js'
import { getLastState, saveState, logEvent } from '../../../lib/history.js'
import { sendTruckEmail }            from '../../../lib/email.js'

const RESTOCK_THRESHOLD = 5   // quantity jump of ≥5 = truck signal

/**
 * Build the tiered "check for" list for a given distributor.
 * Returns [{tier, names}] — one group per hotline tier that has bottles
 * from this distributor.  Empty array = nothing to flag.
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

/**
 * GET /api/cron
 *
 * Runs 6× per day via Vercel Cron (see vercel.json: 7 AM, 9 AM, 11 AM, 1 PM, 3 PM, 5 PM CDT).
 * Protected by CRON_SECRET Bearer token.
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
 *        https://whiskey-hunter.vercel.app/api/cron
 */
export async function GET(request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth  = request.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[cron] CRON_SECRET not set — endpoint is unprotected!')
  }

  const checkedAt = new Date().toISOString()

  try {
    // ── Discover all Chicagoland stores ───────────────────────────────────────
    const stores = await fetchChicagolandStores()
    console.log(`[cron] ${stores.length} stores · ${5} canaries`)

    // ── Load previous state ───────────────────────────────────────────────────
    // State key format: "{storeCode}:{bottleName}"
    const lastState = await getLastState()

    // ── Check all canaries across all stores ──────────────────────────────────
    const canaryResults = await checkAllCanaries(stores)

    // ── Detect truck arrivals ─────────────────────────────────────────────────
    // trucksByStore: Map(storeCode → Map(distributor → triggeredBy[]))
    const trucksByStore = new Map()
    const newState      = {}

    for (const { bottle, byStore } of canaryResults) {
      for (const store of stores) {
        const stateKey = `${store.code}:${bottle.name}`
        const curr     = byStore[store.code]
        const prev     = lastState[stateKey]

        // Always persist the latest reading
        newState[stateKey] = {
          inStock:     curr?.inStock  ?? false,
          quantity:    curr?.quantity ?? null,
          distributor: bottle.distributor,
          storeName:   store.name,
          checkedAt,
        }

        if (!curr) continue

        const wasInStock = prev?.inStock  ?? null   // null = first time we've ever seen this
        const prevQty    = prev?.quantity ?? null

        let triggered = false
        let label     = bottle.name

        if (wasInStock === false && curr.inStock === true) {
          // Out → in transition: clear truck signal
          triggered = true
        } else if (
          curr.inStock &&
          curr.quantity != null &&
          prevQty      != null &&
          curr.quantity - prevQty >= RESTOCK_THRESHOLD
        ) {
          // Already in stock but quantity jumped: restock signal
          triggered = true
          label     = `${bottle.name} (${prevQty}→${curr.quantity})`
        }

        if (triggered) {
          if (!trucksByStore.has(store.code)) trucksByStore.set(store.code, new Map())
          const byDist = trucksByStore.get(store.code)
          if (!byDist.has(bottle.distributor)) byDist.set(bottle.distributor, [])
          byDist.get(bottle.distributor).push(label)
        }
      }
    }

    // ── Log truck events & send email ─────────────────────────────────────────
    const truckEvents = []

    for (const [storeCode, byDist] of trucksByStore) {
      const store = stores.find(s => s.code === storeCode)

      for (const [distributor, triggeredBy] of byDist) {
        const checkFor = hotlineCheckList(distributor)
        if (!checkFor.length) continue  // no hotline bottles for this distributor

        const event = {
          type:        'truck_detected',
          storeCode,
          storeName:   store?.name ?? storeCode,
          distributor,
          triggeredBy,
          checkFor,
          timestamp:   checkedAt,
        }

        truckEvents.push(event)
        await logEvent(event)
      }
    }

    if (truckEvents.length) {
      console.log('[cron] Truck events:', truckEvents.map(e => `${e.storeName}/${e.distributor}`).join(', '))
      await sendTruckEmail(truckEvents, checkedAt)
    } else {
      console.log('[cron] No truck activity detected')
    }

    // ── Persist new state (preserve keys we didn't check this run) ────────────
    for (const [k, v] of Object.entries(lastState)) {
      if (!newState[k]) newState[k] = v
    }
    await saveState(newState)

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      ok:          true,
      checkedAt,
      stores:      stores.length,
      canaries:    canaryResults.length,
      truckEvents: truckEvents.map(e => ({ store: e.storeName, distributor: e.distributor, triggeredBy: e.triggeredBy })),
      emailSent:   truckEvents.length > 0,
    })

  } catch (err) {
    console.error('[cron] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
