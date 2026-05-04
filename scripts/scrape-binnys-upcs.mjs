/**
 * Scrape all Binny's products from Algolia and populate Redis UPC cache.
 *
 * Uses the Algolia Browse API (/1/indexes/{index}/browse) which iterates
 * every record in the index without search-result limits.
 *
 * Writes:  wh:upc:{upc} → { name, imageUrl, objectID, price }
 *
 * Run:
 *   node scripts/scrape-binnys-upcs.mjs
 *   node scripts/scrape-binnys-upcs.mjs --dry-run   (prints stats, no writes)
 */

import { createInterface } from 'readline'

const ALG_APP   = process.env.ALGOLIA_APP_ID  || 'Z25A2A928M'
const ALG_KEY   = process.env.ALGOLIA_API_KEY || '88b6125855a0bbd845447e35de8d51c5'
const ALG_INDEX = 'Products_Production_AB_Test'

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Algolia browse ───────────────────────────────────────────────────────────

async function* browseAlgolia() {
  let cursor = null
  let page   = 0

  do {
    const body = {
      hitsPerPage: 1000,
      attributesToRetrieve: [
        'objectID', 'productName', 'upc', 'barcode', 'sku',
        'images', 'prices', 'categories',
      ],
    }
    if (cursor) body.cursor = cursor

    const res = await fetch(
      `https://${ALG_APP}-dsn.algolia.net/1/indexes/${ALG_INDEX}/browse`,
      {
        method:  'POST',
        headers: {
          'Content-Type':            'application/json',
          'X-Algolia-Application-Id': ALG_APP,
          'X-Algolia-API-Key':        ALG_KEY,
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      console.error(`Algolia browse failed: ${res.status} ${await res.text()}`)
      break
    }

    const data = await res.json()
    cursor = data.cursor ?? null
    page++

    if (page === 1) {
      // Print field names from the first hit so we can verify the UPC field name
      const sample = data.hits?.[0]
      if (sample) {
        console.log('\nSample record fields:', Object.keys(sample).join(', '))
        console.log('Sample UPC fields:',
          JSON.stringify({ upc: sample.upc, barcode: sample.barcode, sku: sample.sku, objectID: sample.objectID })
        )
        console.log('Sample name:', sample.productName)
        console.log()
      }
    }

    if (page % 10 === 0) process.stdout.write(`  page ${page} (${page * 1000} records)...\r`)

    yield* (data.hits ?? [])
  } while (cursor)
}

// ─── Redis write ──────────────────────────────────────────────────────────────

async function redisPipeline(pairs) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('Missing UPSTASH_REDIS_REST_URL / TOKEN')

  // Upstash supports pipeline via POST /pipeline — array of [cmd, ...args]
  const commands = pairs.flatMap(([key, value]) => [
    ['SET', key, JSON.stringify(value)],
  ])

  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(commands),
  })

  if (!res.ok) throw new Error(`Redis pipeline failed: ${res.status}`)
  return res.json()
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Binny's UPC scraper — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Algolia index: ${ALG_INDEX}\n`)

  let total    = 0
  let withUpc  = 0
  let noUpc    = 0
  let spirits  = 0

  const BATCH_SIZE = 500
  let batch        = []
  let batchNum     = 0

  async function flushBatch() {
    if (!batch.length) return
    batchNum++
    if (!DRY_RUN) {
      try {
        await redisPipeline(batch)
      } catch (e) {
        console.warn(`  Batch ${batchNum} write error:`, e.message)
      }
    }
    batch = []
  }

  for await (const hit of browseAlgolia()) {
    total++

    // Binny's may use 'upc', 'barcode', or 'sku' for the UPC field
    const upc = (hit.upc || hit.barcode || hit.sku || '').toString().replace(/\D/g, '')

    // Only care about spirits/whiskey category products
    const cats = (hit.categories ?? []).join(' ').toLowerCase()
    const isSpirit = cats.includes('whiskey') || cats.includes('whisky')
                  || cats.includes('bourbon') || cats.includes('scotch')
                  || cats.includes('spirit')  || cats.includes('brandy')
                  || cats.includes('cognac')  || cats.includes('rum')
                  || cats.includes('vodka')   || cats.includes('gin')
                  || cats.includes('tequila') || cats.includes('mezcal')
                  || cats.includes('liqueur')

    if (!isSpirit && cats) {
      noUpc++
      continue
    }
    spirits++

    if (!upc || upc.length < 8) {
      noUpc++
      continue
    }
    withUpc++

    const name     = (hit.productName ?? '').trim()
    const imageUrl = hit.images?.[0] ?? null
    const price    = hit.prices?.bestPrice ?? null

    const value = { name, imageUrl, objectID: hit.objectID, price }
    batch.push([`wh:upc:${upc}`, value])

    if (batch.length >= BATCH_SIZE) await flushBatch()
  }

  await flushBatch()

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Total records scanned:  ${total.toLocaleString()}`)
  console.log(`Spirit/whiskey records: ${spirits.toLocaleString()}`)
  console.log(`With UPC (written):     ${withUpc.toLocaleString()}`)
  console.log(`Without UPC (skipped):  ${noUpc.toLocaleString()}`)
  console.log(`Redis batches:          ${batchNum}`)
  if (DRY_RUN) console.log('\n⚠  Dry run — nothing written to Redis')
  else          console.log('\n✓  Done — Redis UPC cache populated')
}

main().catch(err => { console.error(err); process.exit(1) })
