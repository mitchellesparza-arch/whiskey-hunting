import { NextResponse } from 'next/server'
import { getToken }    from 'next-auth/jwt'

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

  try {
    // Direct objectID lookup — most reliable, no matching needed
    if (objectID) {
      const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/${encodeURIComponent(objectID)}`
      const res = await fetch(url, { headers: algoliaHeaders(), cache: 'no-store' })
      if (!res.ok) return NextResponse.json({ imageUrl: null })
      const hit = await res.json()
      return NextResponse.json({
        imageUrl:    hit.imageUrl    ?? null,
        productName: hit.productName ?? null,
        objectID:    hit.objectID    ?? objectID,
      })
    }

    // Text search by name — take first hit with similar enough name
    const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`
    const res = await fetch(url, {
      method:  'POST',
      headers: { ...algoliaHeaders(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        query:               name,
        hitsPerPage:         5,
        attributesToRetrieve: ['productName', 'objectID', 'imageUrl'],
      }),
    })

    if (!res.ok) return NextResponse.json({ imageUrl: null })
    const data = await res.json()
    const hits  = data.hits ?? []

    // Pick the first hit whose name is sufficiently similar to what was asked
    const best = hits.find(h => h.imageUrl && nameSimilar(name, h.productName ?? ''))

    if (!best) return NextResponse.json({ imageUrl: null })

    return NextResponse.json({
      imageUrl:    best.imageUrl,
      productName: best.productName,
      objectID:    best.objectID,
    })
  } catch {
    return NextResponse.json({ imageUrl: null })
  }
}
