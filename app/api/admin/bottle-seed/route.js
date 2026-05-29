import { NextResponse }   from 'next/server'
import { SEED_BOTTLES }   from '../../../../lib/whiskey-db.js'
import { UPC_MAP }        from '../../../../lib/whiskey-db.js'
import { upsertBottle, bottleCount } from '../../../../lib/bottle-db.js'
import catalogData        from '../../../../lib/market-prices-data.json'

/**
 * POST /api/admin/bottle-seed
 * Authorization: Bearer CRON_SECRET
 *
 * One-time backfill of seed + catalog data into the canonical bottle DB.
 * Safe to re-run — upsertBottle is idempotent and confidence-aware, so
 * existing Redis data from higher-confidence sources won't be overwritten.
 */
export async function POST(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  const auth  = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Build UPC → name reverse map from UPC_MAP
  const upcByName = {}
  for (const [upc, { name }] of Object.entries(UPC_MAP)) {
    if (!upcByName[name]) upcByName[name] = []
    upcByName[name].push(upc)
  }

  const results = { seed: 0, catalog: 0, errors: [] }

  // 1. Seed bottles (256 entries — name, distillery, category, proof, msrp)
  for (const bottle of SEED_BOTTLES) {
    try {
      await upsertBottle({
        name:       bottle.name,
        distillery: bottle.distillery ?? null,
        category:   bottle.category   ?? null,
        proof:      bottle.proof      ?? null,
        msrp:       bottle.msrp       ?? null,
        upcs:       upcByName[bottle.name] ?? [],
      }, 'seed')
      results.seed++
    } catch (err) {
      results.errors.push(`seed:${bottle.name}: ${err.message}`)
    }
  }

  // 2. Catalog entries (400+ — richer: aliases, secondary market, age, origin)
  for (const entry of catalogData) {
    try {
      await upsertBottle({
        name:        entry.name,
        distillery:  entry.distillery ?? null,
        category:    entry.type       ?? null,
        proof:       entry.proof      ?? null,
        age:         entry.age        ?? null,
        msrp:        entry.msrp       ?? null,
        market:      entry.secondary  ?? null,
        rarity:      entry.rarity     ?? null,
        region:      entry.region     ?? null,
        origin:      entry.origin     ?? null,
        sizes:       entry.sizes      ?? null,
        nameAliases: entry.aliases    ?? [],
        upcs:        upcByName[entry.name] ?? [],
      }, 'seed')
      results.catalog++
    } catch (err) {
      results.errors.push(`catalog:${entry.name}: ${err.message}`)
    }
  }

  const total = await bottleCount()

  return NextResponse.json({
    ok: true,
    seeded:  results.seed,
    catalog: results.catalog,
    errors:  results.errors.length,
    errorSample: results.errors.slice(0, 5),
    totalInDb: total,
  })
}
