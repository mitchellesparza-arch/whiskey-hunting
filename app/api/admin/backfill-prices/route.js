import { NextResponse }          from 'next/server'
import { Redis }                 from '@upstash/redis'
import { listBottleSlugs, bottleCount } from '../../../../lib/bottle-db.js'

/**
 * POST /api/admin/backfill-prices
 * Authorization: Bearer CRON_SECRET
 *
 * Reads every canonical bottle record, looks up its market price from
 * wh:market-prices:live:{normName}, and writes it back into the canonical
 * record.  Fills the MSRP + secondary market gaps for UA-sourced bottles.
 *
 * Safe to re-run — only updates records where live price data exists and
 * the canonical record is missing or has lower-confidence market data.
 */

function normName(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  const auth  = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const redis   = Redis.fromEnv()
  const total   = await bottleCount()
  const BATCH   = 100
  let updated   = 0
  let skipped   = 0
  let noPrice   = 0

  for (let offset = 0; offset < total; offset += BATCH) {
    const slugs = await listBottleSlugs(offset, BATCH)
    if (!slugs.length) break

    // Fetch all canonical records + their market price keys in one pipeline
    const p1 = redis.pipeline()
    for (const s of slugs) p1.get(`wh:bottle:${s}`)
    const records = await p1.exec()

    // Build list of normNames to look up
    const parsed = records.map(r => r ? (typeof r === 'string' ? JSON.parse(r) : r) : null)
    const norms  = parsed.map(b => b ? normName(b.name) : null)

    // Fetch all market prices in one pipeline
    const p2 = redis.pipeline()
    for (const n of norms) {
      if (n) p2.get(`wh:market-prices:live:${n}`)
      else   p2.get('wh:__null__')   // placeholder to keep indexes aligned
    }
    const prices = await p2.exec()

    // Write updates in one pipeline
    const p3 = redis.pipeline()
    let batchUpdates = 0

    for (let i = 0; i < slugs.length; i++) {
      const bottle = parsed[i]
      const raw    = prices[i]
      if (!bottle) { skipped++; continue }
      if (!raw)    { noPrice++; continue }

      const price = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!price)  { noPrice++; continue }

      // Only write if we're adding new data
      const hasMarket = bottle.market?.avg != null
      const hasMsrp   = bottle.msrp != null

      const newMarket = {
        low:  price.low  ?? null,
        avg:  price.avg  ?? null,
        high: price.high ?? null,
      }
      const newMsrp = price.msrp ?? null

      // Skip if canonical already has richer data from a higher-confidence source
      if (hasMarket && hasMsrp) { skipped++; continue }

      const updatedBottle = {
        ...bottle,
        market:     hasMarket  ? bottle.market : (newMarket.avg ? newMarket : bottle.market),
        msrp:       hasMsrp   ? bottle.msrp   : newMsrp,
        rarity:     bottle.rarity   ?? price.rarity     ?? null,
        distillery: bottle.distillery ?? price.distillery ?? null,
        proof:      bottle.proof     ?? price.proof      ?? null,
        age:        bottle.age       ?? price.age        ?? null,
        updatedAt:  Date.now(),
      }

      p3.set(`wh:bottle:${slugs[i]}`, JSON.stringify(updatedBottle))
      batchUpdates++
    }

    if (batchUpdates > 0) {
      await p3.exec()
      updated += batchUpdates
    }
  }

  return NextResponse.json({
    ok:      true,
    total,
    updated,
    skipped,
    noPrice,
  })
}
