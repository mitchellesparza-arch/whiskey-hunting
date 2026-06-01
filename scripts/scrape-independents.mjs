/**
 * scrape-independents.mjs
 *
 * Runs the full independents scan from your home machine (residential IP),
 * which bypasses the Cloudflare blocks that affect Vercel's datacenter IPs.
 * Results are pushed to Vercel and stored in Redis — the UI reads from there.
 *
 * Setup:
 *   node scripts/scrape-independents.mjs
 *
 * Schedule with Windows Task Scheduler (runs hourly):
 *   Program:  node
 *   Args:     "C:\Users\mitch\Documents\Whiskey Hunting\scripts\scrape-independents.mjs"
 *   Start in: C:\Users\mitch\Documents\Whiskey Hunting
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// ── Load .env.local before importing anything that reads env vars ────────────
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
} catch { /* env vars already set in shell, or .env.local not present */ }

// Tell retailers.js to use the full REST API (works from residential IP)
process.env.CITY_HIVE_MODE = 'api'

// ── Dynamic import ensures env vars are set before any module reads them ─────
const { checkAllRetailers, RETAILERS } = await import('../lib/retailers.js')

const BASE_URL    = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://whiskey-hunter.vercel.app'
const CRON_SECRET = process.env.CRON_SECRET

if (!CRON_SECRET) {
  console.error('ERROR: CRON_SECRET not found in .env.local')
  process.exit(1)
}

console.log(`[${new Date().toISOString()}] Starting independents scrape...`)
const start = Date.now()

const { finds, diagnostics } = await checkAllRetailers()

// Build cache payload — same shape the UI expects
const byRetailer = {}
for (const f of finds) {
  if (!byRetailer[f.retailer]) byRetailer[f.retailer] = []
  byRetailer[f.retailer].push(f)
}

const retailers = RETAILERS.filter(r => r.lat).map(meta => {
  const bottles = byRetailer[meta.name] ?? []
  const diag    = diagnostics[meta.name]  ?? {}
  return {
    ...meta,
    bottles,
    inStockCount: bottles.filter(b => b.inStock).length,
    catalogSize:  diag.catalogSize ?? null,
    accessible:   diag.accessible  ?? true,
    source:       diag.source      ?? 'unknown',
  }
})

const payload = {
  retailers,
  allFinds:  finds.filter(f => f.inStock),
  checkedAt: new Date().toISOString(),
}

// Log summary
const accessible    = retailers.filter(r => r.accessible).length
const totalInStock  = payload.allFinds.length
const storesHit     = new Set(payload.allFinds.map(f => f.retailer)).size
console.log(`${accessible}/${retailers.length} stores accessible — ${totalInStock} in-stock bottles across ${storesHit} stores`)
for (const r of retailers) {
  if (r.catalogSize != null) {
    const tag = r.inStockCount > 0 ? ` ← ${r.inStockCount} FOUND` : ''
    console.log(`  ${r.name}: ${r.catalogSize} products${tag}`)
  }
}

// Push to Vercel
process.stdout.write(`Pushing to ${BASE_URL}... `)
const res = await fetch(`${BASE_URL}/api/admin/push-independents`, {
  method:  'POST',
  headers: { 'Authorization': `Bearer ${CRON_SECRET}`, 'Content-Type': 'application/json' },
  body:    JSON.stringify(payload),
})

if (!res.ok) {
  const body = await res.text().catch(() => '')
  console.error(`FAILED (${res.status}): ${body}`)
  process.exit(1)
}

const json = await res.json()
console.log(`OK — ${json.storesWithStock} stores with stock, ${json.inStockCount} in-stock bottles`)
console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`)
