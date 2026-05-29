import { NextResponse } from 'next/server'
import { SEED_BOTTLES, UPC_MAP } from '../../../../lib/whiskey-db.js'
import { toSlug, bottleCount }   from '../../../../lib/bottle-db.js'
import { Redis }                 from '@upstash/redis'
import catalogData               from '../../../../lib/market-prices-data.json'

/**
 * POST /api/admin/bottle-seed
 * Authorization: Bearer CRON_SECRET
 *
 * Fast bulk seed — writes directly to Redis via pipeline instead of going
 * through upsertBottle's de-dup logic (which does multiple round-trips per
 * bottle). Safe to re-run; existing keys are overwritten only for seed-level
 * confidence fields. Higher-confidence data (algolia/ua) written by the crons
 * is not affected because those keys are set separately.
 */
export async function POST(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  const auth  = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const redis = Redis.fromEnv()
  const now   = Date.now()

  // Build UPC → name reverse map
  const upcByName = {}
  for (const [upc, { name }] of Object.entries(UPC_MAP)) {
    if (!upcByName[name]) upcByName[name] = []
    upcByName[name].push(upc)
  }

  // Merge seed + catalog into one map keyed by slug.
  // Catalog wins over seed (richer data: aliases, age, secondary market).
  const merged = new Map()

  for (const b of SEED_BOTTLES) {
    const slug = toSlug(b.name)
    merged.set(slug, {
      name:       b.name,
      slug,
      distillery: b.distillery ?? null,
      category:   b.category   ?? null,
      proof:      b.proof      ?? null,
      age:        null,
      msrp:       b.msrp       ?? null,
      upcs:       upcByName[b.name] ?? [],
      nameAliases: [],
      sources:    ['seed'],
      createdAt:  now,
      updatedAt:  now,
    })
  }

  for (const e of catalogData) {
    const slug    = toSlug(e.name)
    const existing = merged.get(slug) ?? {}
    merged.set(slug, {
      ...existing,
      name:        e.name,
      slug,
      distillery:  e.distillery  ?? existing.distillery  ?? null,
      category:    e.type        ?? existing.category    ?? null,
      proof:       e.proof       ?? existing.proof       ?? null,
      age:         e.age         ?? existing.age         ?? null,
      msrp:        e.msrp        ?? existing.msrp        ?? null,
      market:      e.secondary   ?? null,
      rarity:      e.rarity      ?? null,
      region:      e.region      ?? null,
      origin:      e.origin      ?? null,
      sizes:       e.sizes       ?? null,
      upcs:        [...new Set([...(existing.upcs ?? []), ...(upcByName[e.name] ?? [])])],
      nameAliases: e.aliases     ?? [],
      sources:     ['seed'],
      createdAt:   existing.createdAt ?? now,
      updatedAt:   now,
    })
  }

  // Write in batches of 50 via pipeline to stay well under Vercel's 10s limit
  const BATCH = 50
  const bottles = [...merged.values()]
  let written = 0, aliasesWritten = 0, upcLinked = 0

  for (let i = 0; i < bottles.length; i += BATCH) {
    const batch = bottles.slice(i, i + BATCH)
    const p = redis.pipeline()

    for (const b of batch) {
      // Canonical record
      p.set(`wh:bottle:${b.slug}`, JSON.stringify(b))
      // Slug index (score = createdAt for newest-first pagination)
      p.zadd('wh:bottle-slugs', { score: b.createdAt, member: b.slug, nx: true })
      // Alias index — canonical name + all declared aliases
      const allNames = [b.name, ...b.nameAliases]
      for (const n of allNames) {
        const norm = n.toLowerCase().replace(/['''''']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
        p.hset('wh:bottle-aliases', { [norm]: b.slug })
        aliasesWritten++
      }
      // UPC index
      for (const upc of b.upcs) {
        p.hset('wh:bottle-upc', { [upc]: b.slug })
        upcLinked++
      }
    }

    await p.exec()
    written += batch.length
  }

  const total = await bottleCount()

  return NextResponse.json({
    ok:            true,
    written,
    aliasesWritten,
    upcLinked,
    totalInDb:     total,
  })
}
