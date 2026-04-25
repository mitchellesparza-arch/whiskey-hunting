/**
 * Diagnostic: compare last Redis state snapshot against live Algolia inventory.
 * Read-only — does NOT modify state.
 *
 * Run: node scripts/diagnose-state.mjs
 */

const REDIS_URL   = 'https://arriving-hornet-93859.upstash.io'
const REDIS_TOKEN = 'gQAAAAAAAW6jAAIncDJjZjc0MTVlOGQ3ZmM0Y2RjYThmNDY4ZTYxNzFmNjhjMHAyOTM4NTk'
const ALG_APP     = 'Z25A2A928M'
const ALG_KEY     = '88b6125855a0bbd845447e35de8d51c5'
const ALG_INDEX   = 'Products_Production_AB_Test'
const RESTOCK_THR = 5

const canaryBottles = [
  { name: 'Old Forester 86° Bourbon',                    objectID: '195257', distributor: 'Breakthru Beverage' },
  { name: 'Old Forester 1920 Prohibition Style',          objectID: '948174', distributor: 'Breakthru Beverage' },
  { name: 'Benchmark Full Proof',                         objectID: '152774', distributor: 'Breakthru Beverage' },
  { name: 'Ancient Age Kentucky Straight Bourbon',        objectID: '190011', distributor: 'Breakthru Beverage' },
  { name: 'Sazerac Straight Rye',                         objectID: '196996', distributor: 'Breakthru Beverage' },
  { name: 'Jim Beam Bourbon',                             objectID: '190665', distributor: "Southern Glazer's" },
  { name: 'Knob Creek Kentucky Straight Bourbon',         objectID: '194471', distributor: "Southern Glazer's" },
  { name: 'Elijah Craig Small Batch',                     objectID: '192384', distributor: "Southern Glazer's" },
  { name: 'Rittenhouse Rye BIB 100 Proof',               objectID: '196941', distributor: "Southern Glazer's" },
  { name: 'Wild Turkey Rare Breed Bourbon',               objectID: '197773', distributor: "Southern Glazer's" },
  { name: "Angel's Envy Port Barrel Finished Bourbon",   objectID: '190031', distributor: "Southern Glazer's" },
  { name: 'Four Roses Bourbon',                           objectID: '192651', distributor: 'RNDC' },
  { name: 'Four Roses Small Batch',                       objectID: '192661', distributor: 'RNDC' },
  { name: 'Four Roses Small Batch Select',                objectID: '101259', distributor: 'RNDC' },
  { name: 'Barrell Bourbon Batch 037',                    objectID: '168970', distributor: 'BC Merchants' },
  { name: 'Barrell Craft Spirits 12yr French Oak Finished Bourbon', objectID: '173557', distributor: 'BC Merchants' },
]

// ── Redis GET ────────────────────────────────────────────────────────────────

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  })
  const { result } = await res.json()
  if (!result) return null
  try { return JSON.parse(result) } catch { return result }
}

// ── Algolia fetch ────────────────────────────────────────────────────────────

async function fetchCanary(bottle) {
  const url = `https://${ALG_APP}-dsn.algolia.net/1/indexes/${encodeURIComponent(ALG_INDEX)}/${encodeURIComponent(bottle.objectID)}`
  const res = await fetch(url, {
    headers: { 'X-Algolia-Application-Id': ALG_APP, 'X-Algolia-API-Key': ALG_KEY },
  })
  if (!res.ok) return null
  return res.json()
}

// ── Main ─────────────────────────────────────────────────────────────────────

const lastState = await redisGet('wh:state:last') ?? {}
const stateKeys = Object.keys(lastState)
console.log(`\n📦 Redis state: ${stateKeys.length} store×bottle entries`)

const stateCheckedAt = Object.values(lastState)[0]?.checkedAt
console.log(`   Last cron run: ${stateCheckedAt ? new Date(stateCheckedAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Chicago' }) + ' CDT' : 'unknown'}\n`)

if (!stateKeys.length) {
  console.log('⚠️  State is empty — cron has never run or Redis key is missing.')
  process.exit(0)
}

// Fetch all canaries live
console.log('🔍 Fetching live Algolia inventory for all 16 canaries...\n')
const hits = await Promise.all(canaryBottles.map(b => fetchCanary(b)))

// Collect all store codes that appear in state
const storeCodes = [...new Set(stateKeys.map(k => k.split(':')[0]))]
console.log(`   Stores in state: ${storeCodes.length}\n`)

const UP   = []   // stock went up   — should have fired
const SAME = []   // unchanged
const DOWN = []   // stock went down
const NEW  = []   // no prior state (first time seen)
const ERR  = []   // Algolia fetch failed

for (let i = 0; i < canaryBottles.length; i++) {
  const bottle = canaryBottles[i]
  const hit    = hits[i]

  if (!hit) {
    ERR.push(bottle.name)
    continue
  }

  const inStockStores  = hit.inStockStores          ?? []
  const storeInventory = hit.storesPriceAndInventory ?? []

  for (const code of storeCodes) {
    const stateKey   = `${code}:${bottle.name}`
    const prev       = lastState[stateKey]
    const nowInStock = inStockStores.includes(code)
    const entry      = storeInventory.find(s => s.storeCode === code)
    const nowQty     = entry?.purchaseAvailability ?? null

    if (!prev) {
      NEW.push({ bottle: bottle.name, store: code })
      continue
    }

    const wasInStock = prev.inStock  ?? null
    const prevQty    = prev.quantity ?? null
    const storeName  = prev.storeName ?? code

    // Out → in
    if (wasInStock === false && nowInStock === true) {
      UP.push({ trigger: 'out→IN', bottle: bottle.name, store: storeName, dist: bottle.distributor, prev: `out`, curr: `IN qty:${nowQty}` })
      continue
    }

    // Quantity jump
    if (nowInStock && nowQty != null && prevQty != null && nowQty - prevQty >= RESTOCK_THR) {
      UP.push({ trigger: 'qty jump', bottle: bottle.name, store: storeName, dist: bottle.distributor, prev: `${prevQty}`, curr: `${nowQty}` })
      continue
    }

    // Down or same
    const qtyStr = prevQty != null && nowQty != null ? `${prevQty}→${nowQty}` : `${wasInStock?'in':'out'}→${nowInStock?'in':'out'}`
    if (nowQty < prevQty || (!nowInStock && wasInStock)) {
      DOWN.push({ bottle: bottle.name, store: storeName, qty: qtyStr })
    } else {
      SAME.push({ bottle: bottle.name, store: storeName, qty: qtyStr })
    }
  }
}

// ── Results ──────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════')

if (UP.length) {
  console.log(`\n🚨 STOCK INCREASES DETECTED (should have fired): ${UP.length}`)
  for (const u of UP) {
    console.log(`   [${u.trigger}] ${u.bottle}`)
    console.log(`              store: ${u.store}  dist: ${u.dist}`)
    console.log(`              ${u.prev} → ${u.curr}`)
  }
} else {
  console.log('\n✅ No stock increases detected vs. last state snapshot.')
  console.log('   The cron correctly found nothing to fire on.')
}

if (ERR.length) {
  console.log(`\n⚠️  Algolia fetch failed for: ${ERR.join(', ')}`)
}

console.log(`\n📊 Summary across ${storeCodes.length} stores × ${canaryBottles.length} canaries:`)
console.log(`   ↑ increases : ${UP.length}`)
console.log(`   ↔ unchanged : ${SAME.length}`)
console.log(`   ↓ decreases : ${DOWN.length}`)
console.log(`   ✦ new (no prior): ${NEW.length}`)
console.log(`   ✗ fetch errors : ${ERR.length}`)

// Show a sample of down moves to confirm it's actually seeing real data
if (DOWN.length) {
  console.log(`\n📉 Sample stock decreases (confirming real data flowing):`)
  for (const d of DOWN.slice(0, 10)) {
    console.log(`   ${d.bottle} @ ${d.store}: ${d.qty}`)
  }
}

console.log()
