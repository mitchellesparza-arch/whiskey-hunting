import { NextResponse }            from 'next/server'
import { getToken }                from 'next-auth/jwt'
import { findBottle, getBottle }   from '../../../../lib/bottle-db.js'
import { getMarketPrice }          from '../../../../lib/market-prices.js'

/**
 * GET /api/bottle/lookup?name=<bottleName>
 * GET /api/bottle/lookup?slug=<slug>
 *
 * Returns the canonical bottle record merged with live market price data.
 * Authenticated users only.
 */
export async function GET(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  const slug = searchParams.get('slug')

  if (!name && !slug) return NextResponse.json({ error: 'name or slug required' }, { status: 400 })

  try {
    const record = slug
      ? await getBottle(slug)
      : await findBottle({ name })

    if (!record) return NextResponse.json({ found: false })

    // Merge live market price on top of canonical record's stored market data
    let market = record.market ?? null
    try {
      const live = await getMarketPrice(record.name)
      if (live) {
        market = {
          low:         live.low  ?? market?.low,
          avg:         live.avg  ?? market?.avg,
          high:        live.high ?? market?.high,
          msrp:        live.msrp ?? record.msrp,
          source:      live.source,
          lastUpdated: live.lastUpdated,
        }
      }
    } catch {}

    return NextResponse.json({
      found: true,
      bottle: {
        ...record,
        market,
        // Convenience flat fields the bottle page already uses
        msrp:       market?.msrp  ?? record.msrp,
        imageUrl:   record.imageUrl ?? null,
      },
    })
  } catch (err) {
    console.error('[bottle/lookup]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
