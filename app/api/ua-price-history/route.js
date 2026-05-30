import { NextResponse } from 'next/server'

const GQL_URL = 'https://graphql.beta.unicornauctions.com/graphql'

const GQL_HEADERS = {
  'Content-Type':  'application/json',
  'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Origin':        'https://www.unicornauctions.com',
  'Referer':       'https://www.unicornauctions.com/',
}

const SEARCH_QUERY = `
  query PriceHistory($input: SearchLotInput!) {
    searchLots(input: $input) {
      count
      results {
        uuid title state
        currentBid { amount }
        endDatetime
      }
    }
  }
`

function norm(s) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function similarity(a, b) {
  const wa = norm(a).split(/\s+/).filter(w => w.length >= 3)
  const wb = new Set(norm(b).split(/\s+/).filter(w => w.length >= 3))
  if (!wa.length || !wb.size) return 0
  return wa.filter(w => wb.has(w)).length / Math.max(wa.length, wb.size)
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const title  = searchParams.get('title')?.trim()
  const period = searchParams.get('period') ?? 'all'

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  try {
    const res = await fetch(GQL_URL, {
      method:  'POST',
      headers: GQL_HEADERS,
      body:    JSON.stringify({
        operationName: 'PriceHistory',
        query:         SEARCH_QUERY,
        variables:     { input: { state: 'SOLD', term: title, limit: 200 } },
      }),
      cache: 'no-store',
    })

    const json = await res.json()
    const results = json.data?.searchLots?.results ?? []

    let sales = results
      .filter(r => r.state === 'ENDED' && r.currentBid?.amount > 0 && r.endDatetime)
      .filter(r => similarity(r.title, title) >= 0.5)
      .map(r => ({
        date:  r.endDatetime.slice(0, 10),
        price: r.currentBid.amount,
        title: r.title,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))

    if (period !== 'all') {
      const months  = period === '3m' ? 3 : period === '6m' ? 6 : 12
      const cutoff  = new Date()
      cutoff.setMonth(cutoff.getMonth() - months)
      const cutoffStr = cutoff.toISOString().slice(0, 10)
      sales = sales.filter(s => s.date >= cutoffStr)
    }

    if (!sales.length) return NextResponse.json({ sales: [], stats: null, total: 0 })

    const prices = sales.map(s => s.price)
    const sorted  = [...sales].sort((a, b) => b.date.localeCompare(a.date))
    const stats = {
      avg:  Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      low:  Math.min(...prices),
      high: Math.max(...prices),
      last: sorted[0].price,
    }

    return NextResponse.json({ sales, stats, total: sales.length })
  } catch (err) {
    console.error('[ua-price-history]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
