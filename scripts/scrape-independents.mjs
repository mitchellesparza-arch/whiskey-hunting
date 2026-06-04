/**
 * scripts/scrape-independents.mjs
 *
 * Runs the full independents scan from your home machine (residential IP),
 * bypassing the Cloudflare blocks that affect Vercel's datacenter IPs.
 * Results are pushed to Vercel → Redis → served by /api/independents.
 *
 * Usage:
 *   npm run scrape:independents
 *   npm run scrape:independents -- --debug    (logs all unmatched City Hive product names)
 *
 * Windows Task Scheduler (hourly):
 *   Program:  node
 *   Args:     "C:\Users\mitch\Documents\Whiskey Hunting\scripts\scrape-independents.mjs"
 *   Start in: C:\Users\mitch\Documents\Whiskey Hunting
 */

import { readFileSync, appendFileSync, mkdirSync } from 'fs'
import { join, dirname }      from 'path'
import { fileURLToPath }      from 'url'

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOG_DIR = join(ROOT, 'logs')

// ── Logging — write to console AND a rolling daily log file ──────────────────
try { mkdirSync(LOG_DIR, { recursive: true }) } catch {}
const LOG_FILE = join(LOG_DIR, `scrape-${new Date().toISOString().slice(0, 10)}.log`)

function log(...args) {
  const line = args.join(' ')
  console.log(line)
  try { appendFileSync(LOG_FILE, line + '\n') } catch {}
}

// ── Load .env.local before importing any module that reads env vars ───────────
try {
  const lines = readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    if (!process.env[k]) process.env[k] = v
  }
} catch { /* env vars already set in shell */ }

// Enable debug mode if --debug flag passed
if (process.argv.includes('--debug')) {
  process.env.DEBUG_CITYHIVE = 'true'
  log('[debug] City Hive debug mode enabled — unmatched product names will be logged')
}

// ── Dynamic imports — env vars must be set first ──────────────────────────────
const { checkAllRetailers, RETAILERS } = await import('../lib/independents/index.js')

const BASE_URL    = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://whiskey-hunter.vercel.app'
const CRON_SECRET = process.env.CRON_SECRET

if (!CRON_SECRET) {
  log('ERROR: CRON_SECRET not set — add it to .env.local')
  process.exit(1)
}

log(`\n[${new Date().toISOString()}] ── Independents scrape starting ──`)
log(`Target: ${BASE_URL}`)
const start = Date.now()

// ── Run all checks ────────────────────────────────────────────────────────────
const { finds, diagnostics } = await checkAllRetailers()

// ── Build cache payload ───────────────────────────────────────────────────────
const byRetailer = {}
for (const f of finds) {
  if (!byRetailer[f.retailer]) byRetailer[f.retailer] = []
  byRetailer[f.retailer].push(f)
}

const retailers = RETAILERS.filter(r => r.lat).map(meta => {
  const bottles = byRetailer[meta.name] ?? []
  const diag    = diagnostics[meta.name] ?? {}
  return {
    ...meta,
    bottles,
    inStockCount: bottles.filter(b => b.inStock).length,
    catalogSize:  diag.catalogSize ?? null,
    accessible:   diag.accessible  ?? true,
    source:       diag.source      ?? 'unknown',
  }
})

const allFinds = finds.filter(f => f.inStock)

const payload = {
  retailers,
  allFinds,
  checkedAt: new Date().toISOString(),
}

// ── Print summary ─────────────────────────────────────────────────────────────
const elapsed        = ((Date.now() - start) / 1000).toFixed(1)
const accessible     = retailers.filter(r => r.accessible).length
const storesWithHits = new Set(allFinds.map(f => f.retailer)).size

log(`\n── Results (${elapsed}s) ─────────────────────────────────────────────────────`)
log(`Stores: ${accessible}/${retailers.length} accessible  |  ${allFinds.length} bottles in stock at ${storesWithHits} stores`)
log('')

// Per-store breakdown — every store, not just City Hive
for (const r of retailers) {
  const inStock = r.inStockCount
  if (inStock > 0) {
    log(`  ✓ ${r.name.padEnd(38)} ${inStock} FOUND`)
    if (process.env.DEBUG_CITYHIVE === 'true') {
      byRetailer[r.name]?.filter(b => b.inStock).forEach(b =>
        log(`      • ${b.rawName ?? b.bottle}${b.price ? ` — $${b.price.toFixed(2)}` : ''}`)
      )
    }
  } else if (!r.accessible) {
    log(`  ✗ ${r.name.padEnd(38)} BLOCKED`)
  } else if (r.catalogSize != null) {
    log(`  – ${r.name.padEnd(38)} ${r.catalogSize} products scanned, 0 matches`)
  } else {
    log(`  – ${r.name.padEnd(38)} checked`)
  }
}

// ── Push to Vercel ────────────────────────────────────────────────────────────
log(`\nPushing to ${BASE_URL}/api/admin/push-independents ...`)

let pushRes
try {
  pushRes = await fetch(`${BASE_URL}/api/admin/push-independents`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${CRON_SECRET}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
} catch (err) {
  log(`PUSH FAILED (network error): ${err.message}`)
  process.exit(1)
}

if (!pushRes.ok) {
  const body = await pushRes.text().catch(() => '')
  log(`PUSH FAILED (${pushRes.status}): ${body}`)
  process.exit(1)
}

const json = await pushRes.json()
log(`Push OK — ${json.inStockCount} in-stock bottles, ${json.storesWithStock} stores with stock`)
log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s\n`)
