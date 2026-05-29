/**
 * Canonical bottle database — single write path for all data sources.
 *
 * Redis keys:
 *   wh:bottle:{slug}      JSON record (the canonical bottle)
 *   wh:bottle-slugs       sorted set  slug → createdAt (for pagination/scan)
 *   wh:bottle-aliases     hash        normalizedAlias → canonicalSlug
 *   wh:bottle-upc         hash        upc → canonicalSlug
 *   wh:bottle-objid       hash        algoliaObjectId → canonicalSlug
 *
 * Sources and their confidence (higher wins on field conflicts):
 *   algolia  70  Binny's catalog — authoritative for price, URL, objectId
 *   ua       70  Unicorn Auctions — authoritative for image, auction prices
 *   seed     40  Hand-curated seed data
 *   ai       50  Claude vision / search-fallback
 *   upc-api  45  upcitemdb / Open Food Facts
 *   user     35  User-submitted corrections
 */

import { Redis } from '@upstash/redis'

function getRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

// ── Confidence ────────────────────────────────────────────────────────────────

const CONFIDENCE = {
  algolia:  70,
  ua:       70,
  ai:       50,
  'upc-api': 45,
  seed:     40,
  user:     35,
}

function conf(source) {
  return CONFIDENCE[source] ?? 30
}

// ── Slug / normalization ──────────────────────────────────────────────────────

/**
 * Canonical slug: lowercase, apostrophes stripped, non-alphanumeric → hyphen.
 * Numbers (year, age, proof) are preserved — "12-year" ≠ "15-year".
 */
export function toSlug(name) {
  return (name ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Normalized token string for alias/fuzzy matching. */
function normalize(name) {
  return (name ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Fuzzy similarity ──────────────────────────────────────────────────────────

/**
 * Jaccard-based similarity between two bottle names.
 * Numbers (age/year/proof) must match exactly or score is 0 — prevents
 * "Pappy 15 Year" from matching "Pappy 20 Year".
 *
 * Returns 0–1.
 */
function similarity(a, b) {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1

  const aTokens = na.split(' ').filter(Boolean)
  const bTokens = nb.split(' ').filter(Boolean)

  // Numbers must match exactly
  const aNums = aTokens.filter(t => /^\d+$/.test(t))
  const bNums = bTokens.filter(t => /^\d+$/.test(t))
  if (aNums.sort().join(',') !== bNums.sort().join(',')) return 0

  const aSet = new Set(aTokens)
  const bSet = new Set(bTokens)
  const intersection = [...aSet].filter(t => bSet.has(t)).length
  const union = new Set([...aSet, ...bSet]).size
  return union === 0 ? 0 : intersection / union
}

const FUZZY_THRESHOLD = 0.72  // tuned: "blantons original single barrel" ≡ "blanton's original single barrel" ≈ 0.75

// ── Resolve slug from any signal ──────────────────────────────────────────────

/**
 * Find the canonical slug for an incoming bottle using all available signals.
 * Returns { slug, matchType } or null if no existing record matches.
 *
 * Match priority:
 *  1. exact slug (name → toSlug)
 *  2. alias index (normalized name)
 *  3. UPC index (if upc provided)
 *  4. Algolia objectID index (if algoliaObjectId provided)
 *  5. Fuzzy scan of all known slugs (last resort, most expensive)
 */
async function resolveSlug(redis, { name, upc, algoliaObjectId }, skipFuzzy = false) {
  // 1. Exact slug
  const slug = toSlug(name)
  if (await redis.exists(`wh:bottle:${slug}`)) {
    return { slug, matchType: 'exact' }
  }

  // 2. Alias index
  const fromAlias = await redis.hget('wh:bottle-aliases', normalize(name))
  if (fromAlias) return { slug: fromAlias, matchType: 'alias' }

  // 3. UPC index
  if (upc) {
    const clean = upc.replace(/\D/g, '')
    const fromUpc = await redis.hget('wh:bottle-upc', clean)
    if (fromUpc) return { slug: fromUpc, matchType: 'upc' }
  }

  // 4. ObjectID index
  if (algoliaObjectId) {
    const fromObjId = await redis.hget('wh:bottle-objid', String(algoliaObjectId))
    if (fromObjId) return { slug: fromObjId, matchType: 'objectId' }
  }

  // 5. Fuzzy scan — skipped in bulk/fast mode to avoid O(n²) cost
  if (!skipFuzzy) {
    const allSlugs = await redis.zrange('wh:bottle-slugs', 0, -1)
    for (const s of allSlugs) {
      const record = await redis.get(`wh:bottle:${s}`)
      if (!record) continue
      const parsed = typeof record === 'string' ? JSON.parse(record) : record

      const candidates = [parsed.name, ...(parsed.nameAliases ?? [])]
      for (const candidate of candidates) {
        if (similarity(name, candidate) >= FUZZY_THRESHOLD) {
          return { slug: s, matchType: 'fuzzy' }
        }
      }
    }
  }

  return null
}

// ── Field merge ───────────────────────────────────────────────────────────────

/**
 * Merge incoming fields into existing record using confidence rules.
 * - Never overwrites a non-null value with null.
 * - Only overwrites when incoming source confidence >= existing field confidence.
 * - Some fields always update (prices, timestamps, stock state).
 */
function mergeRecord(existing, incoming, source) {
  const inConf   = conf(source)
  const fieldMeta = existing._fieldMeta ?? {}
  const merged    = { ...existing }

  const ALWAYS_UPDATE = new Set([
    'lastSeenBinnys', 'lastSeenUA', 'binnysPrice', 'binnysInStock',
    'market', 'updatedAt',
  ])

  for (const [key, value] of Object.entries(incoming)) {
    if (key.startsWith('_') || key === 'slug') continue
    if (value === null || value === undefined) continue

    if (ALWAYS_UPDATE.has(key)) {
      merged[key] = value
      fieldMeta[key] = { source, conf: inConf, updatedAt: Date.now() }
      continue
    }

    const existingConf = fieldMeta[key]?.conf ?? 0
    const existingVal  = existing[key]

    // Write if: field is empty, or incoming has >= confidence
    if (existingVal === null || existingVal === undefined || inConf >= existingConf) {
      merged[key] = value
      fieldMeta[key] = { source, conf: inConf, updatedAt: Date.now() }
    }
  }

  // Track all contributing sources
  const sources = new Set(existing.sources ?? [])
  sources.add(source)
  merged.sources    = [...sources]
  merged._fieldMeta = fieldMeta
  merged.updatedAt  = Date.now()

  return merged
}

// ── Index updates ─────────────────────────────────────────────────────────────

async function updateIndexes(redis, slug, { name, upc, algoliaObjectId, nameAliases = [] }) {
  const pipeline = redis.pipeline()

  // Alias index: canonical name + any variants passed in
  const allNames = [name, ...nameAliases].filter(Boolean)
  for (const n of allNames) {
    pipeline.hset('wh:bottle-aliases', { [normalize(n)]: slug })
  }

  if (upc) {
    const clean = upc.replace(/\D/g, '')
    if (clean) pipeline.hset('wh:bottle-upc', { [clean]: slug })
  }

  if (algoliaObjectId) {
    pipeline.hset('wh:bottle-objid', { [String(algoliaObjectId)]: slug })
  }

  await pipeline.exec()
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upsert a bottle record from any data source.
 *
 * @param {object} incoming
 *   name           string   required — canonical display name
 *   slug           string   optional — override auto-derived slug
 *   distillery     string
 *   category       string   Bourbon | Rye | Scotch | Irish | Japanese | Canadian | American | Other
 *   proof          number
 *   age            string   e.g. "12 Year" | "NAS"
 *   msrp           number
 *   imageUrl       string
 *   upc            string   will be cleaned to digits only
 *   upcs           string[] multiple UPCs (e.g. 750ml and 1.75L)
 *   algoliaObjectId string
 *   binnysUrl      string
 *   binnysPrice    number
 *   binnysInStock  boolean
 *   lastSeenBinnys number   ms timestamp
 *   lastSeenUA     number   ms timestamp
 *   market         object   { low, avg, high }
 *   nameAliases    string[] additional name variants to index (not stored as canonical)
 *   rarity         string
 *   region         string
 *   origin         string
 *   sizes          string[]
 *   releaseYear    number
 *
 * @param {string} source  'algolia' | 'ua' | 'seed' | 'ai' | 'upc-api' | 'user'
 * @returns {object} { slug, created: boolean }
 */
export async function upsertBottle(incoming, source = 'user', { skipFuzzy = false } = {}) {
  if (!incoming?.name?.trim()) throw new Error('upsertBottle: name is required')

  const redis = getRedis()
  const now   = Date.now()

  // Resolve primary UPC (first of upcs[] or upc field)
  const primaryUpc = incoming.upc ?? incoming.upcs?.[0] ?? null
  const allUpcs    = [
    ...(incoming.upcs ?? []),
    ...(incoming.upc ? [incoming.upc] : []),
  ].map(u => u.replace(/\D/g, '')).filter(Boolean)

  const match = await resolveSlug(redis, {
    name:            incoming.name,
    upc:             primaryUpc,
    algoliaObjectId: incoming.algoliaObjectId,
  }, skipFuzzy)

  if (match) {
    // ── Update existing record ───────────────────────────────────────────────
    const raw      = await redis.get(`wh:bottle:${match.slug}`)
    const existing = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {}

    // Merge any new UPCs into the existing list
    const existingUpcs = new Set(existing.upcs ?? [])
    for (const u of allUpcs) existingUpcs.add(u)

    const merged = mergeRecord(existing, {
      ...incoming,
      upcs: [...existingUpcs],
      // Accumulate nameAliases so we never lose previously stored variants
      nameAliases: [...new Set([
        ...(existing.nameAliases ?? []),
        ...(incoming.nameAliases ?? []),
        incoming.name,
      ])].filter(n => n !== existing.name),
    }, source)

    await redis.set(`wh:bottle:${match.slug}`, JSON.stringify(merged))
    await updateIndexes(redis, match.slug, {
      name:            incoming.name,
      upc:             primaryUpc,
      algoliaObjectId: incoming.algoliaObjectId,
      nameAliases:     incoming.nameAliases ?? [],
    })

    // Register any additional UPCs
    if (allUpcs.length > 1) {
      const p = redis.pipeline()
      for (const u of allUpcs) p.hset('wh:bottle-upc', { [u]: match.slug })
      await p.exec()
    }

    return { slug: match.slug, created: false }
  }

  // ── Create new record ──────────────────────────────────────────────────────
  const slug   = incoming.slug ?? toSlug(incoming.name)
  const record = {
    name:        incoming.name,
    slug,
    distillery:  incoming.distillery  ?? null,
    category:    incoming.category    ?? null,
    proof:       incoming.proof       ?? null,
    age:         incoming.age         ?? null,
    msrp:        incoming.msrp        ?? null,
    imageUrl:    incoming.imageUrl    ?? null,
    upcs:        allUpcs,
    algoliaObjectId: incoming.algoliaObjectId ?? null,
    binnysUrl:   incoming.binnysUrl   ?? null,
    binnysPrice: incoming.binnysPrice ?? null,
    binnysInStock: incoming.binnysInStock ?? null,
    lastSeenBinnys: incoming.lastSeenBinnys ?? null,
    lastSeenUA:  incoming.lastSeenUA  ?? null,
    market:      incoming.market      ?? null,
    rarity:      incoming.rarity      ?? null,
    region:      incoming.region      ?? null,
    origin:      incoming.origin      ?? null,
    sizes:       incoming.sizes       ?? null,
    releaseYear: incoming.releaseYear ?? null,
    nameAliases: [...new Set(incoming.nameAliases ?? [])],
    sources:     [source],
    _fieldMeta:  {},
    createdAt:   now,
    updatedAt:   now,
  }

  // Populate _fieldMeta for all non-null initial fields
  for (const [key, val] of Object.entries(record)) {
    if (key.startsWith('_') || key === 'slug' || key === 'sources' || val === null) continue
    record._fieldMeta[key] = { source, conf: conf(source), updatedAt: now }
  }

  await redis.set(`wh:bottle:${slug}`, JSON.stringify(record))
  await redis.zadd('wh:bottle-slugs', { score: now, member: slug })
  await updateIndexes(redis, slug, {
    name:            incoming.name,
    upc:             primaryUpc,
    algoliaObjectId: incoming.algoliaObjectId,
    nameAliases:     incoming.nameAliases ?? [],
  })

  if (allUpcs.length > 1) {
    const p = redis.pipeline()
    for (const u of allUpcs) p.hset('wh:bottle-upc', { [u]: slug })
    await p.exec()
  }

  return { slug, created: true }
}

/**
 * Read a single canonical bottle record by slug.
 * @returns {object|null}
 */
export async function getBottle(slug) {
  const redis = getRedis()
  const raw   = await redis.get(`wh:bottle:${slug}`)
  if (!raw) return null
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

/**
 * Find a canonical bottle by any signal: name, UPC, or Algolia objectID.
 * Returns the record or null.
 */
export async function findBottle({ name, upc, algoliaObjectId }) {
  const redis = getRedis()
  const match = await resolveSlug(redis, { name: name ?? '', upc, algoliaObjectId })
  if (!match) return null
  return getBottle(match.slug)
}

/**
 * List all bottle slugs, newest first, with optional pagination.
 * @param {number} offset
 * @param {number} limit
 * @returns {string[]}
 */
export async function listBottleSlugs(offset = 0, limit = 100) {
  const redis = getRedis()
  return redis.zrange('wh:bottle-slugs', offset, offset + limit - 1, { rev: true })
}

/**
 * Total count of canonical bottle records.
 */
export async function bottleCount() {
  const redis = getRedis()
  return redis.zcard('wh:bottle-slugs')
}

/**
 * Search canonical bottle records by name query.
 * Uses the alias index for fast lookup, falls back to slug scan for fuzzy hits.
 * @param {string} query
 * @param {number} limit
 * @returns {object[]}
 */
export async function searchBottleDb(query, limit = 10) {
  if (!query?.trim()) return []
  const redis  = getRedis()
  const norm   = normalize(query)
  const slugs  = await redis.zrange('wh:bottle-slugs', 0, -1, { rev: true })

  const results = []
  for (const slug of slugs) {
    const raw = await redis.get(`wh:bottle:${slug}`)
    if (!raw) continue
    const record = typeof raw === 'string' ? JSON.parse(raw) : raw

    const candidates = [record.name, ...(record.nameAliases ?? [])]
    const best = Math.max(...candidates.map(c => similarity(query, c)))
    if (best >= 0.4) results.push({ record, score: best })
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(r => r.record)
}
