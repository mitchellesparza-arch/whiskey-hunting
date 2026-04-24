import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

const JSON_PATH = path.join(process.cwd(), 'unicorn_scraper', 'latest_deals.json')

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const limit    = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 100)
  const category = searchParams.get('category') ?? ''
  const minBid   = parseFloat(searchParams.get('minBid') ?? '0')
  const sort     = searchParams.get('sort') ?? 'discount'  // 'discount' | 'closing'

  if (!fs.existsSync(JSON_PATH)) {
    return NextResponse.json(
      { error: 'No scrape data yet. Run the scraper first: python scraper.py --now' },
      { status: 404 }
    )
  }

  let data
  try {
    data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'))
  } catch {
    return NextResponse.json({ error: 'Failed to parse deals data' }, { status: 500 })
  }

  let deals = data.deals ?? []

  // Apply filters
  if (category) {
    deals = deals.filter(d => d.category === category)
  }
  if (minBid > 0) {
    deals = deals.filter(d => (d.current_bid ?? 0) >= minBid)
  }

  // Apply sort
  if (sort === 'closing') {
    deals = [...deals].sort((a, b) => {
      const aTime = a.end_datetime ? new Date(a.end_datetime).getTime() : Infinity
      const bTime = b.end_datetime ? new Date(b.end_datetime).getTime() : Infinity
      return aTime - bTime
    })
  }
  // default sort (discount) is already applied by the scraper

  return NextResponse.json({
    scraped_at:            data.scraped_at,
    run_id:                data.run_id,
    total_lots:            data.total_lots,
    total_with_discount:   data.total_with_discount,
    category_counts:       data.category_counts,
    deals:                 deals.slice(0, limit),
    total_filtered:        deals.length,
  })
}
