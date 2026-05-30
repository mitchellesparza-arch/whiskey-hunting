/**
 * express-scout.mjs  v2
 *
 * Headless Chromium scout for express.binnys.com (Instacart-powered).
 * Intercepts ALL network traffic to find the real API endpoint and
 * detect whether allocated whiskey appears there.
 *
 * Run: node scripts/express-scout.mjs
 */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = join(__dirname, 'scout-output')
mkdirSync(OUT_DIR, { recursive: true })

const ALLOCATED_SEARCHES = [
  "blanton's",
  'eagle rare',
  'weller special reserve',
  'weller 12',
  'weller antique 107',
  'pappy van winkle',
  'george t stagg',
  'buffalo trace antique',
  'old fitzgerald bottled in bond',
]

const BASE = 'https://express.binnys.com/store/binnys'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('Launching Chromium…')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  })

  // Capture ALL POST requests + any JSON responses — find the real API endpoint
  const allApiCalls = []

  context.on('request', req => {
    const url    = req.url()
    const method = req.method()
    // Capture anything that looks like an API call (POST, or JSON-bearing GET)
    if (method === 'POST' || url.includes('/api/') || url.includes('graphql') || url.includes('/v3/')) {
      try {
        const body = req.postData()
        allApiCalls.push({
          type: 'request', ts: Date.now(), method, url,
          body: body ? (body.startsWith('{') ? JSON.parse(body) : body) : null,
        })
      } catch { /* ignore */ }
    }
  })

  context.on('response', async resp => {
    const url    = resp.url()
    const method = resp.request().method()
    if (method === 'POST' || url.includes('/api/') || url.includes('graphql') || url.includes('/v3/')) {
      try {
        const ct = resp.headers()['content-type'] ?? ''
        if (ct.includes('json')) {
          const body = await resp.json()
          allApiCalls.push({ type: 'response', ts: Date.now(), url, status: resp.status(), body })
        }
      } catch { /* ignore */ }
    }
  })

  const page = await context.newPage()

  // ── 1. Warm up session ────────────────────────────────────────────────────
  console.log('\n[warm-up] Loading storefront…')
  try {
    await page.goto(`${BASE}/storefront`, { waitUntil: 'load', timeout: 45000 })
    await sleep(4000)
    await page.screenshot({ path: join(OUT_DIR, '00-storefront.png'), fullPage: false })
    console.log('  Storefront loaded.')
  } catch (e) {
    console.log('  Storefront timeout (continuing):', e.message.split('\n')[0])
  }

  // ── 2. Run each search ────────────────────────────────────────────────────
  const results = {}

  for (const [i, term] of ALLOCATED_SEARCHES.entries()) {
    console.log(`\n[search ${i+1}/${ALLOCATED_SEARCHES.length}] "${term}"`)
    const encoded = encodeURIComponent(term)
    const callsBefore = allApiCalls.length

    try {
      await page.goto(`${BASE}/search?query=${encoded}`, {
        waitUntil: 'load', timeout: 30000,
      })
      await sleep(3500)

      // Screenshot for debugging
      const screenshotFile = join(OUT_DIR, `${String(i+1).padStart(2,'0')}-${term.replace(/[^a-z0-9]/gi, '_')}.png`)
      await page.screenshot({ path: screenshotFile, fullPage: false })

      // ── Detect "no results" ──────────────────────────────────────────────
      const pageText = await page.evaluate(() => document.body.innerText)
      const noResults = /no results|no items|couldn.t find|0 results|nothing here/i.test(pageText)
      const hasAllocated = /blanton|eagle.?rare|weller|pappy|stagg|george.*stagg|william.*larue|thomas.*handy|sazerac|van.?winkle|fitzgerald/i.test(pageText)

      // ── Scrape product links ─────────────────────────────────────────────
      const products = await page.evaluate(() => {
        const results = []
        // Primary: product links in the main search result grid
        const links = document.querySelectorAll('a[href*="/products/"]')
        const seen  = new Set()
        links.forEach(a => {
          const href = a.href
          if (seen.has(href)) return
          seen.add(href)
          // Walk up to find a container with name + price
          let el = a
          let name  = null
          let price = null
          // Try to find text within the same card
          for (let depth = 0; depth < 6 && el; depth++) {
            const txt = el.innerText?.trim()
            if (txt && txt.length > 3 && txt.length < 200) {
              name = txt.split('\n')[0].trim()
              break
            }
            el = el.parentElement
          }
          results.push({ name, price, href })
        })
        return results
      })

      const newCalls = allApiCalls.slice(callsBefore)

      results[term] = { noResults, hasAllocated, productCount: products.length, products: products.slice(0, 10), apiCallCount: newCalls.length }

      if (hasAllocated) {
        console.log(`  ⭐ ALLOCATED BOTTLE TEXT FOUND ON PAGE`)
      }
      if (noResults) {
        console.log(`  → "no results" detected`)
      } else {
        console.log(`  → ${products.length} product links found (no-results: ${noResults})`)
      }
    } catch (err) {
      console.log(`  ✗ Error: ${err.message.split('\n')[0]}`)
      results[term] = { error: err.message }
    }
  }

  // ── 3. Browse bourbon collection ─────────────────────────────────────────
  console.log('\n[collection] Loading bourbon collection…')
  try {
    await page.goto(`${BASE}/collections/rc-bourbon-14543`, {
      waitUntil: 'load', timeout: 30000,
    })
    await sleep(4000)
    // Scroll to load lazy items
    for (let i = 0; i < 5; i++) {
      await page.evaluate(n => window.scrollTo(0, n * document.body.scrollHeight / 5), i+1)
      await sleep(800)
    }
    await sleep(1500)
    await page.screenshot({ path: join(OUT_DIR, '99-bourbon-collection.png'), fullPage: false })

    const pageText   = await page.evaluate(() => document.body.innerText)
    const hasAllocated = /blanton|eagle.?rare|weller.?(special|12|antique)|pappy|stagg|van.?winkle|fitzgerald/i.test(pageText)

    const products = await page.evaluate(() => {
      const results = []
      const links = document.querySelectorAll('a[href*="/products/"]')
      const seen  = new Set()
      links.forEach(a => {
        const href = a.href
        if (seen.has(href)) return
        seen.add(href)
        let el = a, name = null
        for (let d = 0; d < 6 && el; d++) {
          const txt = el.innerText?.trim()
          if (txt && txt.length > 3 && txt.length < 200) { name = txt.split('\n')[0].trim(); break }
          el = el.parentElement
        }
        results.push({ name, href })
      })
      return results
    })

    const allocatedProducts = products.filter(p =>
      /blanton|eagle.?rare|weller.?(special|12|antique)|pappy|stagg|van.?winkle|fitzgerald/i.test(p.name ?? '')
    )

    results['__bourbon_collection__'] = { productCount: products.length, hasAllocated, allocatedProducts, products }

    if (hasAllocated || allocatedProducts.length > 0) {
      console.log(`  ⭐ ALLOCATED BOTTLES IN COLLECTION:`, allocatedProducts.map(p => p.name))
    } else {
      console.log(`  → ${products.length} products, none are allocated targets`)
    }
  } catch (err) {
    console.log(`  ✗ Error:`, err.message.split('\n')[0])
    results['__bourbon_collection__'] = { error: err.message }
  }

  await browser.close()

  // ── 4. Save everything ────────────────────────────────────────────────────
  // Summarize unique API endpoints seen
  const apiEndpoints = [...new Set(allApiCalls.filter(c => c.type === 'request').map(c => c.url))]

  const output = { ts: new Date().toISOString(), apiEndpoints, allApiCalls, searchResults: results }
  const outPath = join(OUT_DIR, 'results.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2))

  console.log(`\n✅ Done. Results → ${outPath}`)
  console.log(`📡 Captured ${allApiCalls.length} API calls across ${apiEndpoints.length} endpoints`)
  console.log('\n── API endpoints seen ──')
  apiEndpoints.forEach(ep => console.log(' ', ep))

  // ── Final verdict ──────────────────────────────────────────────────────
  console.log('\n══ VERDICT ══')
  for (const [term, data] of Object.entries(results)) {
    if (term.startsWith('__')) continue
    const verdict = data.hasAllocated ? '⭐ FOUND' : data.noResults ? '✗ NO RESULTS' : `? ${data.productCount} products (check screenshots)`
    console.log(`  "${term}": ${verdict}`)
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
