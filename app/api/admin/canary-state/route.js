import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import { getLastState } from '../../../../lib/history.js'
import { canaryBottles } from '../../../../lib/bottles.js'

async function isOwner(req) {
  const token      = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const ownerEmail = process.env.ALERT_EMAIL?.trim().toLowerCase()
  return ownerEmail && token?.email?.toLowerCase() === ownerEmail
}

/**
 * GET /api/admin/canary-state?distributor=Breakthru+Beverage&store=Bolingbrook
 *
 * Reads the Redis state snapshot and returns the last-known inStock + quantity
 * for every canary, optionally filtered by distributor and/or store name.
 * Useful for diagnosing why a specific store isn't generating truck events.
 */
export async function GET(request) {
  if (!await isOwner(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const distFilter  = searchParams.get('distributor')?.toLowerCase() ?? null
  const storeFilter = searchParams.get('store')?.toLowerCase() ?? null

  const state = await getLastState()

  // canaryBottles defines the full set; use it to know which keys to look for
  const targetBottles = distFilter
    ? canaryBottles.filter(b => b.distributor.toLowerCase().includes(distFilter))
    : canaryBottles

  // Collect all matching entries from the state snapshot
  const rows = []
  for (const [key, val] of Object.entries(state)) {
    // key format: "{storeCode}:{bottleName}"
    const colonIdx   = key.indexOf(':')
    if (colonIdx === -1) continue
    const storeCode  = key.slice(0, colonIdx)
    const bottleName = key.slice(colonIdx + 1)

    if (!targetBottles.find(b => b.name === bottleName)) continue
    if (storeFilter && !val.storeName?.toLowerCase().includes(storeFilter)) continue

    rows.push({
      store:     val.storeName ?? storeCode,
      storeCode,
      bottle:    bottleName,
      inStock:   val.inStock,
      quantity:  val.quantity,   // null = Algolia returned no per-store count
      checkedAt: val.checkedAt,
    })
  }

  // Sort: store name → bottle name
  rows.sort((a, b) => a.store.localeCompare(b.store) || a.bottle.localeCompare(b.bottle))

  // Summary: how many entries have null quantity (can never trigger quantity-jump)
  const nullQty  = rows.filter(r => r.quantity === null).length
  const hasQty   = rows.filter(r => r.quantity !== null).length
  const inStock  = rows.filter(r => r.inStock).length

  return NextResponse.json({
    count:        rows.length,
    inStock,
    withQuantity: hasQty,
    nullQuantity: nullQty,
    rows,
  })
}
