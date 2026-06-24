import { NextResponse }                          from 'next/server'
import { getToken }                              from 'next-auth/jwt'
import { Redis }                                 from '@upstash/redis'
import { getBottleByUpc, getBottleByName, searchBottles } from '../../../lib/whiskey-db.js'
import { findBottle }                                     from '../../../lib/bottle-db.js'

async function authed(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  return !!token?.email
}

let _redis = null
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

function normName(s) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Pull bottles that were saved dynamically (AI suggestions a user confirmed).
// Returns names that fuzzy-match the query; merged with seed search results.
async function searchDynamicBottles(query, limit = 5) {
  try {
    const norm = normName(query)
    if (!norm) return []
    const index = await getRedis().hgetall('wh:bottle-index')
    if (!index) return []
    const qWords = norm.split(/\s+/).filter(w => w.length >= 2)
    const matches = []
    for (const [normKey, displayName] of Object.entries(index)) {
      const cWords = normKey.split(/\s+/)
      const hits   = qWords.filter(w => cWords.some(c => c.includes(w) || w.includes(c))).length
      if (hits === 0) continue
      const score = hits / Math.max(qWords.length, cWords.length)
      const exact = normKey.includes(norm) || norm.includes(normKey)
      matches.push({ name: displayName, score: exact ? Math.max(score, 0.8) : score })
    }
    return matches
      .filter(m => m.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(m => m.name)
  } catch { return [] }
}

/**
 * GET /api/lookup?upc=xxx        — barcode scan lookup
 * GET /api/lookup?name=xxx       — name-based lookup (best match)
 * GET /api/lookup?search=xxx     — name search (returns top 5 for autocomplete)
 */
export async function GET(req) {
  if (!await authed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const upc    = searchParams.get('upc')?.trim()
  const name   = searchParams.get('name')?.trim()
  const search = searchParams.get('search')?.trim()

  if (upc) {
    // Canonical store first — a user-corrected record (saved with this UPC)
    // must win over the seed/upcitemdb fallback, so corrections show on scans.
    const clean = upc.replace(/\D/g, '')
    const canon = await findBottle({ upc: clean }).catch(() => null)
    if (canon) return NextResponse.json({ found: true, bottle: { ...canon, source: 'canonical' } })

    const result = await getBottleByUpc(upc)
    if (!result) return NextResponse.json({ found: false })
    return NextResponse.json({ found: true, bottle: result })
  }

  if (name) {
    const canon = await findBottle({ name }).catch(() => null)
    if (canon) return NextResponse.json({ found: true, bottle: { ...canon, source: 'canonical' } })

    const result = getBottleByName(name)
    if (!result) return NextResponse.json({ found: false })
    return NextResponse.json({ found: true, bottle: result })
  }

  if (search) {
    // Merge static seed matches with the dynamic Redis-backed index of
    // AI-confirmed bottles.  Seed wins on tie since its data is richer.
    const seed    = searchBottles(search, 5)
    const dynamic = await searchDynamicBottles(search, 5)
    const seenLow = new Set(seed.map(b => (b.name ?? '').toLowerCase()))
    const merged  = [...seed]
    for (const name of dynamic) {
      if (!seenLow.has(name.toLowerCase())) {
        merged.push({ name, source: 'dynamic' })
        seenLow.add(name.toLowerCase())
      }
    }
    return NextResponse.json({ results: merged.slice(0, 10) })
  }

  return NextResponse.json({ error: 'Provide upc, name, or search param' }, { status: 400 })
}
