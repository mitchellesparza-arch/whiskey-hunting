/**
 * Manual/local trigger for the weekly market-price refresh pipeline.
 * Thin wrapper around lib/market-refresh.js — the same module the Vercel
 * cron (app/api/market-price/refresh/route.js) runs. Keeping one
 * implementation means a fix to matching/scoring applies to both.
 *
 * Run:
 *   node scripts/refresh-market-prices.mjs
 *
 * Requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in the
 * environment (e.g. via `vercel env pull` or a local .env.local + dotenv).
 */

import { readFileSync }     from 'fs'
import { fileURLToPath }    from 'url'
import path                 from 'path'
import { Redis }            from '@upstash/redis'
import { runMarketRefresh } from '../lib/market-refresh.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.join(__dirname, '..', 'lib', 'market-prices-data.json')

async function main() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in environment')
  }

  const redis   = Redis.fromEnv()
  const entries = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  console.log(`Loaded ${entries.length} entries from static JSON`)

  const result = await runMarketRefresh(entries, redis)
  console.log('\nRefresh complete:', JSON.stringify(result, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
