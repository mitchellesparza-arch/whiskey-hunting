/**
 * lib/reservebar.js — ReserveBar Gold Foil Edition monitor
 *
 * Watches for Wild Turkey Austin Nichols Archives Gold Foil Edition (~$400)
 * transitioning from "staged/coming-soon" to "live for purchase" on ReserveBar.
 *
 * Redis keys (wh: prefix):
 *   wh:reservebar:state   — JSON monitor state (phase, last poll, alert flag, etc.)
 */

import { Redis } from '@upstash/redis'

// ── Match constants ───────────────────────────────────────────────────────────

export const ALIASES = [
  'gold foil edition',
  'austin nichols archives gold foil',
  'archives gold foil',
  'gold foil',
]

// Any candidate whose title contains one of these is rejected outright.
export const NEGATIVE_ALIASES = [
  'cheesy gold foil',
  'white foil',
]

// Expected SRP — used as a corroborating signal when present.
const EXPECTED_PRICE_MIN = 299
const EXPECTED_PRICE_MAX = 600

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

// ── Name matching ─────────────────────────────────────────────────────────────

/**
 * Returns true if the product title matches the Gold Foil aliases and does NOT
 * match any negative alias.
 */
export function matchesGoldFoil(title) {
  if (!title) return false
  const lower = title.toLowerCase()

  for (const neg of NEGATIVE_ALIASES) {
    if (lower.includes(neg.toLowerCase())) return false
  }

  for (const alias of ALIASES) {
    if (lower.includes(alias.toLowerCase())) return true
  }

  return false
}

// ── __NEXT_DATA__ parsing ─────────────────────────────────────────────────────

/**
 * Extract the __NEXT_DATA__ JSON blob from a raw HTML string.
 * Returns parsed object or null.
 */
export function extractNextData(html) {
  // Match <script id="__NEXT_DATA__" type="application/json">…</script>
  const m = html.match(
    /<script\s+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
  )
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

/**
 * Recursively walk an arbitrary object and collect all product-like nodes —
 * i.e. objects with a `title` (string) or `name` (string) field.
 * Caps at 200 items to avoid runaway recursion on huge payloads.
 */
export function collectProducts(node, found = [], depth = 0) {
  if (depth > 10 || found.length >= 200) return found
  if (!node || typeof node !== 'object') return found

  if (Array.isArray(node)) {
    for (const item of node) collectProducts(item, found, depth + 1)
    return found
  }

  const title = node.title ?? node.name ?? node.productName ?? null
  if (typeof title === 'string' && title.length > 2) {
    found.push(node)
  }

  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') collectProducts(v, found, depth + 1)
  }

  return found
}

/**
 * Parse the collection page HTML and return matching Gold Foil candidate
 * objects (raw product nodes from __NEXT_DATA__).
 * Returns { candidates: [], allProducts: [], nextData: {}|null }.
 */
export function parseCollectionPage(html) {
  const nextData = extractNextData(html)
  if (!nextData) return { candidates: [], allProducts: [], nextData: null }

  const allProducts = collectProducts(nextData)
  const candidates  = allProducts.filter(p => {
    const name = p.title ?? p.name ?? p.productName ?? ''
    return matchesGoldFoil(name)
  })

  return { candidates, allProducts, nextData }
}

// ── Signal evaluation ─────────────────────────────────────────────────────────

/**
 * Signals (bitmask values for readability in logs):
 *   SIGNAL_ON_COLLECTION  = 1  — product appears in collection page product list
 *   SIGNAL_URL_200        = 2  — direct product URL returns 200 + product data
 *   SIGNAL_BUYABLE        = 4  — available / availableForSale / inventoryQuantity > 0
 *   SIGNAL_NONZERO_PRICE  = 8  — price near $400
 *   SIGNAL_SEARCH_HIT     = 16 — appears in /search?q=gold+foil results
 */
export const SIGNAL_ON_COLLECTION = 1
export const SIGNAL_URL_200       = 2
export const SIGNAL_BUYABLE       = 4
export const SIGNAL_NONZERO_PRICE = 8
export const SIGNAL_SEARCH_HIT   = 16

/**
 * Evaluate signals for a single candidate product node.
 *
 * @param {object} candidate  - raw product node from __NEXT_DATA__
 * @param {object} ctx        - { onCollectionPage, directUrl200, searchHit }
 * @returns {{ signals: number, price: number|null, buyable: boolean, details: {} }}
 */
export function evaluateSignals(candidate, ctx = {}) {
  let signals = 0
  const details = {}

  // Signal 1 — appears on collection page
  if (ctx.onCollectionPage) {
    signals |= SIGNAL_ON_COLLECTION
    details.onCollectionPage = true
  }

  // Signal 2 — direct URL returned 200
  if (ctx.directUrl200) {
    signals |= SIGNAL_URL_200
    details.directUrl200 = true
  }

  // Signal 3 — buyable flag
  const buyable = isBuyable(candidate)
  if (buyable) {
    signals |= SIGNAL_BUYABLE
    details.buyable = true
  }

  // Signal 4 — non-zero price near expected SRP
  const price = extractPrice(candidate)
  if (price !== null && price >= EXPECTED_PRICE_MIN && price <= EXPECTED_PRICE_MAX) {
    signals |= SIGNAL_NONZERO_PRICE
    details.price = price
  } else if (price !== null && price > 0) {
    // Non-zero but outside expected range — weaker signal, log it but don't set bit
    details.priceOther = price
  }

  // Signal 6 — search index hit
  if (ctx.searchHit) {
    signals |= SIGNAL_SEARCH_HIT
    details.searchHit = true
  }

  return { signals, price, buyable, details }
}

/**
 * Decide whether to fire the notification given the signal bitmask.
 *
 * Rules (from brief):
 *   - Signal 2 alone WITH non-zero price → fire
 *   - Any 2+ signals simultaneously → fire
 */
export function shouldFire(signals) {
  // Signal 2 (URL 200) + Signal 4 (non-zero price) alone is decisive
  if ((signals & SIGNAL_URL_200) && (signals & SIGNAL_NONZERO_PRICE)) return true

  // Count set bits; ≥ 2 → fire
  let count = 0
  let s = signals
  while (s) { count += s & 1; s >>= 1 }
  return count >= 2
}

// ── Price / availability extraction ──────────────────────────────────────────

function extractPrice(node) {
  if (!node) return null

  const candidates = [
    node.price,
    node.priceRange?.minVariantPrice?.amount,
    node.priceRange?.maxVariantPrice?.amount,
    node.variants?.[0]?.price?.amount,
    node.variants?.[0]?.price,
    node.originalPrice,
    node.compareAtPrice,
  ]

  for (const raw of candidates) {
    if (raw == null) continue
    const n = parseFloat(String(raw))
    if (!isNaN(n) && n > 0) return n
  }

  return null
}

function isBuyable(node) {
  if (!node) return false

  // Explicit availability fields (various Shopify/Next-commerce shapes)
  if (node.availableForSale === true) return true
  if (node.available === true)        return true

  const qty = node.inventoryQuantity ?? node.totalInventory ?? null
  if (qty !== null && qty > 0) return true

  // Check nested variants
  if (Array.isArray(node.variants)) {
    return node.variants.some(v => v.availableForSale === true || (v.inventoryQuantity ?? 0) > 0)
  }

  return false
}

// ── HTTP fetching ─────────────────────────────────────────────────────────────

/**
 * Fetch a URL with browser UA and automatic exponential backoff on 429/503.
 * Returns { ok, status, text, retryAfter } — never throws.
 */
export async function fetchPage(url, { maxRetries = 2, baseDelay = 2000 } = {}) {
  let attempt = 0
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })

      if (res.status === 429 || res.status === 503) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '0', 10)
        const delay = retryAfter > 0
          ? retryAfter * 1000
          : baseDelay * Math.pow(2, attempt)

        if (attempt < maxRetries) {
          await sleep(Math.min(delay, 30_000))
          attempt++
          continue
        }
        return { ok: false, status: res.status, text: '', retryAfter: delay }
      }

      const text = await res.text()
      return { ok: res.ok, status: res.status, text }
    } catch (err) {
      if (attempt < maxRetries) {
        await sleep(baseDelay * Math.pow(2, attempt))
        attempt++
        continue
      }
      return { ok: false, status: 0, text: '', error: err.message }
    }
  }
}

// ── Redis state ───────────────────────────────────────────────────────────────

const STATE_KEY = 'wh:reservebar:state'

const INITIAL_STATE = {
  phase: 'unknown',      // 'unknown' | 'staged_unbuyable' | 'live'
  lastPollAt: null,
  lastPollSignals: 0,
  alertFiredAt: null,
  consecutiveErrors: 0,
  activeSince: null,     // ISO — when this monitor first ran
  collectionHash: null,  // SHA-256 of last collection page __NEXT_DATA__
  candidateLoggedAt: null, // ISO — when we first logged the raw candidate JSON
  directProductUrl: null, // discovered product URL, if any
}

function getRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

export async function getMonitorState() {
  try {
    const raw = await getRedis().get(STATE_KEY)
    if (!raw) return { ...INITIAL_STATE }
    return typeof raw === 'string' ? { ...INITIAL_STATE, ...JSON.parse(raw) } : { ...INITIAL_STATE, ...raw }
  } catch {
    return { ...INITIAL_STATE }
  }
}

export async function saveMonitorState(state) {
  try {
    await getRedis().set(STATE_KEY, state)
  } catch (err) {
    console.error('[reservebar] saveMonitorState failed (Redis error):', err.message)
  }
}

// ── Main poll ─────────────────────────────────────────────────────────────────

const COLLECTION_URL = 'https://www.reservebar.com/collections/wild-turkey'
const SEARCH_URL     = 'https://www.reservebar.com/search?q=gold+foil'

/**
 * Run one poll cycle: fetch ReserveBar, evaluate signals, update state.
 *
 * Returns a summary object — callers use this to decide whether to fire push.
 */
export async function pollReserveBar() {
  const now   = new Date().toISOString()
  const state = await getMonitorState()

  if (!state.activeSince) state.activeSince = now

  const summary = {
    polledAt: now,
    collectionFetched: false,
    searchFetched: false,
    candidates: [],
    signals: 0,
    price: null,
    phase: state.phase,
    shouldFire: false,
    alreadyFired: false,
    error: null,
  }

  // ── Deduplication guard ───────────────────────────────────────────────────
  if (state.alertFiredAt) {
    const firedMs  = Date.now() - new Date(state.alertFiredAt).getTime()
    const sixHours = 6 * 60 * 60 * 1000
    if (firedMs < sixHours) {
      summary.alreadyFired = true
      summary.phase = 'live'
      return summary
    }
  }

  try {
    // ── Fetch collection page ───────────────────────────────────────────────
    const collRes = await fetchPage(COLLECTION_URL)
    summary.collectionFetched = collRes.ok

    if (!collRes.ok) {
      state.consecutiveErrors++
      state.lastPollAt = now
      await saveMonitorState(state)
      summary.error = `collection fetch failed: HTTP ${collRes.status}`
      return summary
    }

    const { candidates: collCandidates, nextData } = parseCollectionPage(collRes.text)

    // Hash the __NEXT_DATA__ to detect any changes without storing full HTML
    const newHash = nextData ? simpleHash(JSON.stringify(nextData)) : null
    const hashChanged = newHash !== state.collectionHash

    // ── Fetch search page ───────────────────────────────────────────────────
    const searchRes = await fetchPage(SEARCH_URL)
    summary.searchFetched = searchRes.ok

    const searchCandidates = searchRes.ok
      ? parseCollectionPage(searchRes.text).candidates
      : []

    // ── Merge candidates ────────────────────────────────────────────────────
    const seen  = new Set()
    const allCandidates = [...collCandidates, ...searchCandidates].filter(c => {
      const key = JSON.stringify(c).slice(0, 100)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    summary.candidates = allCandidates.map(c => c.title ?? c.name ?? '(unnamed)')

    // ── Log candidate JSON on first sighting (schema discovery) ────────────
    if (allCandidates.length > 0 && !state.candidateLoggedAt) {
      console.log('[reservebar] FIRST CANDIDATE SIGHTING — raw JSON:')
      console.log(JSON.stringify(allCandidates[0], null, 2))
      state.candidateLoggedAt = now
    }

    // ── Warn if candidate found but price unextractable (schema drift) ──────
    if (allCandidates.length > 0) {
      const price = extractPrice(allCandidates[0])
      if (price === null) {
        console.warn('[reservebar] WARNING: Gold Foil candidate found but price could not be extracted — schema may have changed. Check raw JSON above.')
      }
    }

    if (hashChanged && nextData) {
      console.log(`[reservebar] __NEXT_DATA__ hash changed: ${state.collectionHash} → ${newHash}`)
      state.collectionHash = newHash
    }

    // ── Check for direct product URL in __NEXT_DATA__ ───────────────────────
    let directUrl200 = false
    if (allCandidates.length > 0 && !state.directProductUrl) {
      // Try to extract a URL from the candidate
      const url = extractProductUrl(allCandidates[0])
      if (url) {
        const directRes = await fetchPage(url)
        if (directRes.ok) {
          state.directProductUrl = url
          directUrl200 = true
          console.log(`[reservebar] Direct product URL confirmed: ${url}`)
        }
      }
    } else if (state.directProductUrl) {
      const directRes = await fetchPage(state.directProductUrl)
      directUrl200 = directRes.ok
    }

    // ── Evaluate signals ────────────────────────────────────────────────────
    let combinedSignals = 0

    if (allCandidates.length > 0) {
      const onCollection = collCandidates.length > 0
      const searchHit    = searchCandidates.length > 0

      const { signals, price } = evaluateSignals(allCandidates[0], {
        onCollectionPage: onCollection,
        directUrl200,
        searchHit,
      })
      combinedSignals  = signals
      summary.price    = price
    }

    summary.signals = combinedSignals

    // ── State machine ───────────────────────────────────────────────────────
    if (allCandidates.length > 0 && state.phase === 'unknown') {
      state.phase = 'staged_unbuyable'
    }

    if (shouldFire(combinedSignals) && state.phase !== 'live') {
      state.phase = 'live'
      summary.shouldFire = true
    }

    summary.phase = state.phase

    // ── Persist state ───────────────────────────────────────────────────────
    state.consecutiveErrors = 0
    state.lastPollAt        = now
    state.lastPollSignals   = combinedSignals
    await saveMonitorState(state)

    // ── Log one-liner ───────────────────────────────────────────────────────
    const sigNames = signalNames(combinedSignals)
    console.log(
      `[reservebar] ${now} | phase=${state.phase} | signals=[${sigNames || 'none'}]` +
      ` | candidates=${allCandidates.length} | fire=${summary.shouldFire}`
    )

  } catch (err) {
    summary.error = err.message
    console.error('[reservebar] poll error:', err)
    state.consecutiveErrors++
    state.lastPollAt = now
    await saveMonitorState(state)
  }

  return summary
}

/**
 * Mark the alert as fired and persist to Redis.
 */
export async function markAlertFired() {
  const state = await getMonitorState()
  state.alertFiredAt = new Date().toISOString()
  state.phase = 'live'
  await saveMonitorState(state)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/** Very fast non-crypto hash — good enough for change detection. */
function simpleHash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(16)
}

function signalNames(signals) {
  const names = []
  if (signals & SIGNAL_ON_COLLECTION) names.push('COLLECTION')
  if (signals & SIGNAL_URL_200)       names.push('URL_200')
  if (signals & SIGNAL_BUYABLE)       names.push('BUYABLE')
  if (signals & SIGNAL_NONZERO_PRICE) names.push('PRICE')
  if (signals & SIGNAL_SEARCH_HIT)    names.push('SEARCH')
  return names.join(',')
}

function extractProductUrl(node) {
  if (!node) return null

  // ReserveBar URL patterns seen in the wild
  const raw = node.url ?? node.handle ?? node.path ?? node.slug ?? null
  if (!raw) return null

  if (raw.startsWith('http')) return raw
  if (raw.startsWith('/'))    return `https://www.reservebar.com${raw}`
  return `https://www.reservebar.com/products/${raw}`
}

// ── Peak window check ─────────────────────────────────────────────────────────

/**
 * Returns the desired poll interval in seconds based on CT time.
 * Peak:    6 AM–10 PM CT → 60 s
 * Off-peak:               → 300 s
 */
export function desiredIntervalSeconds() {
  // CT = UTC-5 (CST) or UTC-6 (CDT); use UTC-5 as a conservative estimate
  const ctHour = (new Date().getUTCHours() + 19) % 24  // UTC-5
  return (ctHour >= 6 && ctHour < 22) ? 60 : 300
}

/**
 * Returns true if enough time has elapsed since the last poll to warrant
 * running again, given the current peak/off-peak interval.
 */
export function shouldPollNow(lastPollAt) {
  if (!lastPollAt) return true
  const elapsed = (Date.now() - new Date(lastPollAt).getTime()) / 1000
  return elapsed >= desiredIntervalSeconds() - 5  // 5 s tolerance
}

/**
 * Returns true if the monitor has run past its 30-day lifetime.
 */
export function isExpired(activeSince) {
  if (!activeSince) return false
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  return Date.now() - new Date(activeSince).getTime() > thirtyDays
}
