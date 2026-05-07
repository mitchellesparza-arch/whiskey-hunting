import { NextResponse } from 'next/server'
import { getToken }    from 'next-auth/jwt'

const ALGOLIA_APP_ID  = process.env.ALGOLIA_APP_ID
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY
const ALGOLIA_INDEX   = 'Products_Production_AB_Test'

/**
 * GET /api/algolia-search?q=blanton
 * Server-side proxy to Binny's Algolia index — keeps keys off the client.
 * Returns up to 10 spirit product names matching the query.
 */
export async function GET(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
    return NextResponse.json({ results: [] })
  }

  try {
    const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'X-Algolia-Application-Id': ALGOLIA_APP_ID,
        'X-Algolia-API-Key':        ALGOLIA_API_KEY,
        'Content-Type':             'application/json',
      },
      body: JSON.stringify({
        query:               q,
        hitsPerPage:         15,
        attributesToRetrieve: ['productName', 'objectID', 'productUrl'],
      }),
    })

    if (!res.ok) return NextResponse.json({ results: [] })

    const data = await res.json()
    const results = (data.hits ?? [])
      .map(h => h.productName)
      .filter(Boolean)
      .filter((n, i, arr) => arr.indexOf(n) === i) // dedupe

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
