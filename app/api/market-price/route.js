import { NextResponse, after } from 'next/server'
import { getMarketPrice }      from '../../../lib/market-prices.js'
import { getCatalogEntry }     from '../../../lib/catalog.js'
import { getAiEstimatedMsrp }  from '../../../lib/ai-msrp.js'
import { findBottle, upsertBottle } from '../../../lib/bottle-db.js'

/**
 * GET /api/market-price?name=Blanton%27s+Original
 * Returns secondary market price range + bottle metadata.
 *
 * Tiered lookup:
 *   1. Redis live cache → static JSON secondary pricing (getMarketPrice)
 *   2. Catalog metadata (MSRP only, no secondary data)
 *   3. Canonical bottle-db record — catches a durable live/user-confirmed
 *      price that survived past the 7-day Redis cache TTL and has no static
 *      catalog entry (e.g. a live Binny's price written by the weekly refresh).
 *   4. AI-estimated MSRP — only when none of the above has a price. Fired
 *      on-demand for whatever bottle the user is actually looking at, cached
 *      so the same bottle is never re-asked, and always tagged `estimated`.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ price: null })

  // Primary: Redis live cache → static JSON secondary pricing
  const price = await getMarketPrice(name)
  if (price) return NextResponse.json({ price })

  // Fallback: catalog metadata with MSRP only (no secondary data yet)
  const entry = getCatalogEntry(name)
  if (entry?.msrp != null) {
    return NextResponse.json({
      price: {
        msrp:        entry.msrp,
        rarity:      entry.rarity,
        distillery:  entry.distillery,
        proof:       entry.proof,
        age:         entry.age,
        type:        entry.category,
        origin:      entry.origin,
        region:      entry.region,
        sizes:       entry.sizes,
        source:      'Catalog — no secondary data yet',
        lastUpdated: entry.lastUpdated ?? '2025-05',
        // secondary fields absent — UI will hide the secondary price block
      },
    })
  }

  // Canonical record may already carry a durable price the Redis cache lost
  // (TTL expired) and no static catalog entry has — don't fall to AI first.
  const canonical = await findBottle({ name }).catch(() => null)
  if (canonical?.msrp != null) {
    const meta = canonical._fieldMeta?.msrp
    return NextResponse.json({
      price: {
        msrp:        canonical.msrp,
        rarity:      canonical.rarity     ?? entry?.rarity     ?? null,
        distillery:  canonical.distillery ?? entry?.distillery ?? null,
        proof:       canonical.proof      ?? entry?.proof      ?? null,
        age:         canonical.age        ?? entry?.age        ?? null,
        type:        canonical.category   ?? entry?.category   ?? null,
        origin:      canonical.origin     ?? entry?.origin     ?? null,
        region:      canonical.region     ?? entry?.region     ?? null,
        sizes:       canonical.sizes      ?? entry?.sizes      ?? null,
        source:      meta?.source === 'algolia' ? "Binny's (live)"
                    : meta?.source === 'user'   ? 'User-confirmed'
                    :                             'Catalog record',
        lastUpdated: meta?.updatedAt ? new Date(meta.updatedAt).toISOString().slice(0, 7) : null,
        estimated:   meta?.source === 'ai',
      },
    })
  }

  // Last resort: on-demand AI estimate. Only fires when we have genuinely no
  // priced source for this bottle.
  const ai = await getAiEstimatedMsrp(name)
  if (ai?.msrp != null) {
    // Persist into the canonical record (if one exists) so it's tagged with
    // proper provenance and won't be re-guessed on the next request. Runs
    // after the response is sent — never blocks the user-facing lookup.
    after(async () => {
      try {
        const existing = await findBottle({ name })
        if (existing) {
          await upsertBottle(
            { name: existing.name, msrp: ai.msrp, proof: ai.proof, category: ai.category },
            'ai',
            { skipFuzzy: true }
          )
        }
      } catch {}
    })

    return NextResponse.json({
      price: {
        msrp:        ai.msrp,
        rarity:      entry?.rarity     ?? null,
        distillery:  entry?.distillery ?? null,
        proof:       entry?.proof      ?? ai.proof     ?? null,
        age:         entry?.age        ?? null,
        type:        entry?.category   ?? ai.category  ?? null,
        origin:      entry?.origin     ?? null,
        region:      entry?.region     ?? null,
        sizes:       entry?.sizes      ?? null,
        source:      'Estimated · AI',
        lastUpdated: new Date().toISOString().slice(0, 7),
        estimated:   true,
      },
    })
  }

  if (!entry) return NextResponse.json({ price: null })

  // Catalog entry exists (distillery/proof/etc) but genuinely no MSRP anywhere
  return NextResponse.json({
    price: {
      msrp:        null,
      rarity:      entry.rarity,
      distillery:  entry.distillery,
      proof:       entry.proof,
      age:         entry.age,
      type:        entry.category,
      origin:      entry.origin,
      region:      entry.region,
      sizes:       entry.sizes,
      source:      'Catalog — no secondary data yet',
      lastUpdated: entry.lastUpdated ?? '2025-05',
    },
  })
}
