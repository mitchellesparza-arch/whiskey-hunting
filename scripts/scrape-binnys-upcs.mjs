/**
 * Scrape Binny's product catalog from Algolia and populate Redis name cache.
 *
 * Binny's Algolia records do NOT contain UPC/barcode fields — only productName,
 * objectID, and pricing. So instead of a UPC map, we build a product name catalog
 * that the /api/upc route uses to normalize and confirm bottle names returned by
 * UPC Item DB.
 *
 * Writes:
 *   wh:binnys-catalog  — Redis hash: normalized(productName) → JSON{ name, objectID, price }
 *
 * Run:
 *   node scripts/scrape-binnys-upcs.mjs
 *   node scripts/scrape-binnys-upcs.mjs --dry-run
 */

const ALG_APP   = process.env.ALGOLIA_APP_ID  || 'Z25A2A928M'
const ALG_KEY   = process.env.ALGOLIA_API_KEY || '88b6125855a0bbd845447e35de8d51c5'
const ALG_INDEX = 'Products_Production_AB_Test'

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

const DRY_RUN = process.argv.includes('--dry-run')

const SEARCH_TERMS = [
  'bourbon', 'whiskey', 'whisky', 'scotch', 'rye',
  'irish whiskey', 'japanese whisky', 'tennessee whiskey',
  'single malt', 'canadian whisky',
  'vodka', 'gin', 'rum', 'tequila', 'mezcal',
  'brandy', 'cognac', 'armagnac', 'calvados',
  'liqueur', 'amaro', 'aperitif', 'vermouth',
  "blanton's", 'pappy van winkle', 'weller', 'eagle rare', 'buffalo trace',
  'elijah craig', 'four roses', 'wild turkey', 'woodford', 'knob creek',
  "maker's mark", "booker's", "michter's", "angel's envy", "whistlepig",
  'heaven hill', 'old forester', 'old fitzgerald', 'stagg', 'taylor',
]

function normName(s) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function searchAlgolia(query, page = 0) {
  const res = await fetch(
    `https://${ALG_APP}-dsn.algolia.net/1/indexes/${ALG_INDEX}/query`,
    {
      method:  'POST',
      headers: {
        'Content-Type':            'application/json',
        'X-Algolia-Application-Id': ALG_APP,
        'X-Algolia-API-Key':        ALG_KEY,
      },
      body: JSON.stringify({
        query,
        hitsPerPage: 1000,
        page,
        attributesToRetrieve: ['objectID', 'productName', 'prices', 'storesPriceAndInventory'],
      }),
    }
  )
  if (!res.ok) throw new Error(`Algolia ${res.status}: ${await res.text()}`)
  return res.json()
}

async function redisHmset(hash, fields) {
  if (!REDIS_URL || !REDIS_TOKEN) throw new Error('Missing Redis env vars')
  // Upstash pipeline: one HSET per field pair
  const commands = Object.entries(fields).map(([k, v]) => ['HSET', hash, k, JSON.stringify(v)])
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(commands),
  })
  if (!res.ok) throw new Error(`Redis pipeline failed: ${res.status}`)
}

async function main() {
  console.log(`Binny's catalog scraper — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Note: Binny's Algolia has no UPC fields — building name catalog instead.\n`)

  const seen    = new Set()
  const catalog = {}   // normName → { name, objectID, price }

  for (const term of SEARCH_TERMS) {
    let page = 0, nbPages = 1
    while (page < nbPages) {
      let data
      try { data = await searchAlgolia(term, page) }
      catch (e) { console.warn(`  ✗ "${term}":`, e.message); break }

      nbPages = Math.min(data.nbPages ?? 1, 10)
      for (const hit of (data.hits ?? [])) {
        if (seen.has(hit.objectID)) continue
        seen.add(hit.objectID)
        const name = (hit.productName ?? '').trim()
        if (!name) continue
        const price = hit.prices?.bestPrice
          ?? hit.storesPriceAndInventory?.find(s => s.storeCode === '47')?.prices?.bestPrice
          ?? null
        catalog[normName(name)] = { name, objectID: hit.objectID, price }
      }
      page++
    }
    process.stdout.write(`  ✓ "${term}" — ${seen.size} products\n`)
    await new Promise(r => setTimeout(r, 150))
  }

  const total = Object.keys(catalog).length
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Unique products: ${seen.size.toLocaleString()}`)
  console.log(`Catalog entries: ${total.toLocaleString()}`)

  if (DRY_RUN) {
    console.log('\n⚠  Dry run — nothing written to Redis')
    console.log('\nSample entries:')
    Object.entries(catalog).slice(0, 15).forEach(([k, v]) =>
      console.log(`  "${v.name}" → objectID ${v.objectID}${v.price ? ` ($${v.price})` : ''}`)
    )
    return
  }

  // Write in batches of 200 fields per pipeline call
  const entries   = Object.entries(catalog)
  const BATCH     = 200
  let written     = 0
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = Object.fromEntries(entries.slice(i, i + BATCH))
    try {
      await redisHmset('wh:binnys-catalog', chunk)
      written += Object.keys(chunk).length
      process.stdout.write(`  Writing… ${written}/${total}\r`)
    } catch (e) {
      console.warn(`\n  Batch error at ${i}:`, e.message)
    }
  }
  console.log(`\n\n✓  Done — ${written.toLocaleString()} products in wh:binnys-catalog`)
}

main().catch(err => { console.error(err); process.exit(1) })
