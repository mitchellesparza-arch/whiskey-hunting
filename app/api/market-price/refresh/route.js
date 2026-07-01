import { NextResponse, after } from 'next/server'
import { readFileSync }        from 'fs'
import path                    from 'path'
import { Redis }               from '@upstash/redis'
import { runMarketRefresh }    from '../../../../lib/market-refresh.js'

export const maxDuration = 300

const DATA_PATH = path.join(process.cwd(), 'lib', 'market-prices-data.json')

/**
 * GET/POST /api/market-price/refresh
 * Authorization: Bearer CRON_SECRET
 *
 * Weekly cron — pulls Unicorn Auctions hammer prices (secondary market) and
 * auto-discovered Binny's live MSRP over the static catalog, writes merged
 * results to Redis. See lib/market-refresh.js for the shared pipeline (also
 * used by scripts/refresh-market-prices.mjs for manual/local runs).
 */
async function handleRefresh() {
  const start   = Date.now()
  const redis   = Redis.fromEnv()
  const entries = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  const result  = await runMarketRefresh(entries, redis)
  return { ...result, ms: Date.now() - start }
}

function withAfter(request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth  = request.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  after(async () => {
    try {
      const result = await handleRefresh()
      console.log('[market-price/refresh]', JSON.stringify(result))
    } catch (err) {
      console.error('[market-price/refresh] failed:', err)
    }
  })
  return NextResponse.json({ ok: true, status: 'processing' })
}

export async function GET(request)  { return withAfter(request) }
export async function POST(request) { return withAfter(request) }
