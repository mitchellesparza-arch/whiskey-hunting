import { NextResponse } from 'next/server'
import { getToken }    from 'next-auth/jwt'
import { Redis }       from '@upstash/redis'

const ALGOLIA_APP_ID  = process.env.ALGOLIA_APP_ID
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY
const ALGOLIA_INDEX   = 'Products_Production_AB_Test'

function algoliaHeaders() {
  return {
    'X-Algolia-Application-Id': ALGOLIA_APP_ID,
    'X-Algolia-API-Key':        ALGOLIA_API_KEY,
  }
}

// Rough name similarity — both sides normalized, check word overlap
function nameSimilar(a, b) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const wordsA = norm(a).split(' ').filter(w => w.length > 2)
  const wordsB = norm(b).split(' ').filter(w => w.length > 2)
  if (!wordsA.length || !wordsB.length) return false
  const hits = wordsA.filter(w => wordsB.includes(w)).length
  return hits / Math.max(wordsA.length, wordsB.length) >= 0.6
}

// Directional match: are most of the query's significant words present in the catalog key?
// Catalog lot names are often longer/fuller than collection bottle names, so we check
// coverage from the query's perspective rather than symmetric overlap.
function nameMatch(query, catalogKey) {
  const sig = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 2)
  const qWords = sig(query)
  const cWords = sig(catalogKey)
  if (qWords.length < 2 || !cWords.length) return 0
  const hits = qWords.filter(w => cWords.includes(w)).length
  return hits / qWords.length  // coverage score 0–1
}

function normName(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Fallback: check UA catalog and UA image cache for a bottle image.
// Returns { imageUrl, source } or null.
async function uaImageFallback(name) {
  if (!name) return null
  const nk = normName(name)
  try {
    const redis = Redis.fromEnv()

    // 1. UA catalog stored imageUrl — exact key match
    const catalogVal = await redis.hget('wh:ua:catalog', nk)
    if (catalogVal) {
      const meta = typeof catalogVal === 'string' ? JSON.parse(catalogVal) : catalogVal
      if (meta?.imageUrl) return { imageUrl: meta.imageUrl, source: 'ua-catalog' }
    }

    // 2. UA image cache — exact key match (populated by /api/ua-image og:image scraping)
    const [cached, cachedCandidates] = await Promise.all([
      redis.get(`wh:ua:img:${nk}`),
      redis.get(`wh:ua:imgs:${nk}`),
    ])
    if (cached) {
      const candidates = cachedCandidates
        ? (typeof cachedCandidates === 'string' ? JSON.parse(cachedCandidates) : cachedCandidates)
        : null
      return { imageUrl: cached, source: 'ua-cache', candidates }
    }

    // 3. Fuzzy scan of catalog keys — catches cases where the collection bottle name
    //    is shorter/different than the full auction lot name stored as a catalog key
    //    (e.g. "Pappy Van Winkle 15 Year" vs "pappy van winkle s family reserve 15 year old bourbon")
    const catalogKeys = await redis.hkeys('wh:ua:catalog')
    if (catalogKeys.length) {
      let bestKey = null
      let bestScore = 0
      for (const k of catalogKeys) {
        const score = nameMatch(nk, k)
        if (score > bestScore) { bestScore = score; bestKey = k }
      }
      if (bestKey && bestScore >= 0.75) {
        const val = await redis.hget('wh:ua:catalog', bestKey)
        if (val) {
          const meta = typeof val === 'string' ? JSON.parse(val) : val
          if (meta?.imageUrl) return { imageUrl: meta.imageUrl, source: 'ua-catalog' }
        }
      }
    }
  } catch { /* non-critical — fall through */ }

  return null
}

/**
 * GET /api/algolia-image?name=elijah+craig+barrel+proof
 * GET /api/algolia-image?objectID=104979
 *
 * Returns { imageUrl, productName, objectID } for the best-matching Binny's
 * product, or { imageUrl: null } if no confident match is found.
 */
export async function GET(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ imageUrl: null }, { status: 401 })

  if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
    return NextResponse.json({ imageUrl: null })
  }

  const { searchParams } = new URL(request.url)
  const objectID = searchParams.get('objectID')?.trim()
  const name     = searchParams.get('name')?.trim()

  if (!objectID && (!name || name.length < 2)) {
    return NextResponse.json({ imageUrl: null })
  }

  // Direct objectID lookup — most reliable, no name-matching needed, no cycling required
  if (objectID) {
    try {
      const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/${encodeURIComponent(objectID)}`
      const res = await fetch(url, { headers: algoliaHeaders(), cache: 'no-store' })
      if (res.ok) {
        const hit = await res.json()
        if (hit.imageUrl) {
          return NextResponse.json({ imageUrl: hit.imageUrl, productName: hit.productName ?? null, objectID: hit.objectID ?? objectID, source: 'algolia' })
        }
      }
    } catch {}
    // objectID miss — fall through to name-based lookup if name also provided
    if (!name) return NextResponse.json({ imageUrl: null })
  }

  // Name-based lookup: run Algolia text search and UA catalog in parallel so
  // both sources contribute to the candidates pool regardless of which finds something.
  const [algoliaData, ua] = await Promise.all([
    (async () => {
      if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) return null
      try {
        const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`
        const res = await fetch(url, {
          method:  'POST',
          headers: { ...algoliaHeaders(), 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            query:                name,
            hitsPerPage:          10,
            attributesToRetrieve: ['productName', 'objectID', 'imageUrl'],
          }),
        })
        return res.ok ? res.json() : null
      } catch { return null }
    })(),
    uaImageFallback(name),
  ])

  // Build ordered candidates pool:
  //   1. nameSimilar Algolia hits (Binny's catalog, good for tracked bottles)
  //   2. UA auction images (covers rare/allocated bottles not in Binny's)
  //   3. Other Algolia hits that didn't pass nameSimilar (still possibly useful)
  const algoliaHits  = (algoliaData?.hits ?? []).filter(h => h.imageUrl)
  const similar      = algoliaHits.filter(h =>  nameSimilar(name ?? '', h.productName ?? ''))
  const dissimilar   = algoliaHits.filter(h => !nameSimilar(name ?? '', h.productName ?? ''))
  const uaImages     = ua?.candidates ?? (ua?.imageUrl ? [ua.imageUrl] : [])

  const seen = new Set()
  const candidates = [...similar.map(h => h.imageUrl), ...uaImages, ...dissimilar.map(h => h.imageUrl)]
    .filter(u => { if (!u || seen.has(u)) return false; seen.add(u); return true })

  if (!candidates.length) return NextResponse.json({ imageUrl: null })

  const primarySource = similar.length ? 'algolia' : ua ? (ua.source ?? 'ua-catalog') : 'algolia'
  return NextResponse.json({
    imageUrl:    candidates[0],
    productName: similar[0]?.productName ?? null,
    objectID:    similar[0]?.objectID    ?? null,
    source:      primarySource,
    candidates:  candidates.length > 1 ? candidates : null,
  })
}
