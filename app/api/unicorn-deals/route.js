import { NextResponse } from 'next/server'
import path from 'path'
import fs   from 'fs'

const REDIS_KEY = 'wh:unicorn:deals'
const JSON_PATH = path.join(process.cwd(), 'unicorn_scraper', 'latest_deals.json')

async function loadFromRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/get/${REDIS_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache:   'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    if (!json.result) return null
    return typeof json.result === 'string' ? JSON.parse(json.result) : json.result
  } catch (err) {
    console.warn('[unicorn-deals] Redis fetch failed:', err.message)
    return null
  }
}

async function loadData() {
  // 1. Try Redis (populated hourly by GitHub Actions)
  const redisData = await loadFromRedis()
  if (redisData) return redisData

  // 2. Fall back to committed JSON snapshot
  if (!fs.existsSync(JSON_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'))
  } catch {
    return null
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const limit    = Math.min(parseInt(searchParams.get('limit')  ?? '20'), 100)
  const category = searchParams.get('category') ?? ''
  const minBid   = parseFloat(searchParams.get('minBid') ?? '0')
  const sort     = searchParams.get('sort') ?? 'discount'  // 'discount' | 'closing'

  const data = await loadData()

  if (!data) {
    return NextResponse.json(
      { error: 'No scrape data yet. Run the scraper first: python scraper.py --now' },
      { status: 404 }
    )
  }

  let deals = data.deals ?? []

  if (category) {
    deals = deals.filter(d => d.category === category)
  }
  if (minBid > 0) {
    deals = deals.filter(d => (d.current_bid ?? 0) >= minBid)
  }

  if (sort === 'closing') {
    deals = [...deals].sort((a, b) => {
      const aTime = a.end_datetime ? new Date(a.end_datetime).getTime() : Infinity
      const bTime = b.end_datetime ? new Date(b.end_datetime).getTime() : Infinity
      return aTime - bTime
    })
  }

  return NextResponse.json({
    scraped_at:           data.scraped_at,
    run_id:               data.run_id,
    total_lots:           data.total_lots,
    total_with_discount:  data.total_with_discount,
    category_counts:      data.category_counts,
    deals:                deals.slice(0, limit),
    total_filtered:       deals.length,
  })
}
