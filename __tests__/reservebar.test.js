/**
 * Unit tests for lib/reservebar.js signal evaluation logic.
 *
 * Covers:
 *   A — "staged but not live": Gold Foil present in __NEXT_DATA__ but unbuyable, $0
 *   B — "live": Gold Foil with available=true, price=$400, on collection page
 *   C — negative match: "Cheesy Gold Foil 1990" should be rejected outright
 *
 * Run: npm test
 */

import { describe, it, expect } from 'vitest'
import {
  matchesGoldFoil,
  extractNextData,
  parseCollectionPage,
  evaluateSignals,
  shouldFire,
  collectProducts,
  SIGNAL_ON_COLLECTION,
  SIGNAL_URL_200,
  SIGNAL_BUYABLE,
  SIGNAL_NONZERO_PRICE,
  SIGNAL_SEARCH_HIT,
} from '../lib/reservebar.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Helper to wrap a product array in a minimal Next.js page HTML structure.
function makeNextDataHtml(pageProps) {
  const nextData = { props: { pageProps } }
  return `<html><head><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></head><body></body></html>`
}

// Fixture A — staged/coming-soon: product in data but NOT available, price $0
const STAGED_PRODUCT = {
  title: 'Wild Turkey Austin Nichols Archives Gold Foil Edition 16 Year Old Bourbon Whiskey',
  handle: 'wild-turkey-austin-nichols-archives-gold-foil-edition-bourbon-whiskey/GROUPING-3001234',
  available: false,
  availableForSale: false,
  inventoryQuantity: 0,
  price: 0,
  priceRange: {
    minVariantPrice: { amount: '0.00', currencyCode: 'USD' },
    maxVariantPrice: { amount: '0.00', currencyCode: 'USD' },
  },
  variants: [{ price: { amount: '0.00' }, availableForSale: false, inventoryQuantity: 0 }],
}

// Fixture B — live: product with real availability and $400 price
const LIVE_PRODUCT = {
  title: 'Wild Turkey Austin Nichols Archives Gold Foil Edition 16 Year Old Bourbon Whiskey',
  handle: 'wild-turkey-austin-nichols-archives-gold-foil-edition-bourbon-whiskey/GROUPING-3001234',
  url: '/products/wild-turkey-austin-nichols-archives-gold-foil-edition-bourbon-whiskey/GROUPING-3001234',
  available: true,
  availableForSale: true,
  inventoryQuantity: 12,
  price: 400,
  priceRange: {
    minVariantPrice: { amount: '400.00', currencyCode: 'USD' },
    maxVariantPrice: { amount: '400.00', currencyCode: 'USD' },
  },
  variants: [{ price: { amount: '400.00' }, availableForSale: true, inventoryQuantity: 12 }],
}

// Fixture C — negative match: vintage "Cheesy Gold Foil" listing (1980s–90s bottle)
const CHEESY_PRODUCT = {
  title: 'Wild Turkey Cheesy Gold Foil 1990 Kentucky Straight Bourbon Whiskey',
  available: true,
  availableForSale: true,
  price: 1200,
  inventoryQuantity: 1,
}

// Fixture D — unrelated product that should never match
const UNRELATED_PRODUCT = {
  title: 'Makers Mark Cask Strength Bourbon',
  available: true,
  availableForSale: true,
  price: 60,
}

// ── matchesGoldFoil ───────────────────────────────────────────────────────────

describe('matchesGoldFoil', () => {
  it('matches "Gold Foil Edition"', () => {
    expect(matchesGoldFoil('Wild Turkey Austin Nichols Archives Gold Foil Edition')).toBe(true)
  })

  it('matches "Austin Nichols Archives Gold Foil"', () => {
    expect(matchesGoldFoil('Wild Turkey Austin Nichols Archives Gold Foil 16yr')).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(matchesGoldFoil('GOLD FOIL EDITION 16 YEAR')).toBe(true)
    expect(matchesGoldFoil('austin nichols archives gold foil')).toBe(true)
  })

  it('rejects "Cheesy Gold Foil"', () => {
    expect(matchesGoldFoil('Wild Turkey Cheesy Gold Foil 1990 Kentucky Straight Bourbon Whiskey')).toBe(false)
  })

  it('rejects "White Foil"', () => {
    expect(matchesGoldFoil('Pol Roger White Foil Champagne')).toBe(false)
  })

  it('rejects an unrelated product', () => {
    expect(matchesGoldFoil('Makers Mark Cask Strength')).toBe(false)
  })

  it('returns false for empty/null input', () => {
    expect(matchesGoldFoil('')).toBe(false)
    expect(matchesGoldFoil(null)).toBe(false)
    expect(matchesGoldFoil(undefined)).toBe(false)
  })
})

// ── extractNextData ───────────────────────────────────────────────────────────

describe('extractNextData', () => {
  it('extracts JSON from a __NEXT_DATA__ script tag', () => {
    const html = makeNextDataHtml({ products: [LIVE_PRODUCT] })
    const result = extractNextData(html)
    expect(result).not.toBeNull()
    expect(result.props.pageProps.products[0].title).toContain('Gold Foil')
  })

  it('returns null when no __NEXT_DATA__ tag is present', () => {
    expect(extractNextData('<html><body>nothing here</body></html>')).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{bad json}</script>'
    expect(extractNextData(html)).toBeNull()
  })
})

// ── parseCollectionPage ───────────────────────────────────────────────────────

describe('parseCollectionPage — Fixture A (staged/not live)', () => {
  const html = makeNextDataHtml({ products: [STAGED_PRODUCT, UNRELATED_PRODUCT] })

  it('finds the Gold Foil candidate', () => {
    const { candidates } = parseCollectionPage(html)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].title).toContain('Gold Foil Edition')
  })

  it('does not include unrelated products as candidates', () => {
    const { candidates } = parseCollectionPage(html)
    expect(candidates.every(c => matchesGoldFoil(c.title ?? c.name ?? ''))).toBe(true)
  })
})

describe('parseCollectionPage — Fixture B (live)', () => {
  const html = makeNextDataHtml({ products: [LIVE_PRODUCT] })

  it('finds the live Gold Foil candidate', () => {
    const { candidates } = parseCollectionPage(html)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].available).toBe(true)
  })
})

describe('parseCollectionPage — Fixture C (Cheesy Gold Foil negative match)', () => {
  const html = makeNextDataHtml({ products: [CHEESY_PRODUCT] })

  it('returns zero candidates for the Cheesy Gold Foil vintage', () => {
    const { candidates } = parseCollectionPage(html)
    expect(candidates).toHaveLength(0)
  })
})

describe('parseCollectionPage — empty page', () => {
  it('handles pages with no __NEXT_DATA__', () => {
    const { candidates, nextData } = parseCollectionPage('<html><body></body></html>')
    expect(candidates).toHaveLength(0)
    expect(nextData).toBeNull()
  })
})

// ── evaluateSignals ───────────────────────────────────────────────────────────

describe('evaluateSignals — Fixture A (staged/not live)', () => {
  it('returns no buyable or price signals', () => {
    const { signals, buyable, price } = evaluateSignals(STAGED_PRODUCT, {
      onCollectionPage: false,
      directUrl200: false,
      searchHit: false,
    })
    expect(signals & SIGNAL_BUYABLE).toBe(0)
    expect(signals & SIGNAL_NONZERO_PRICE).toBe(0)
    expect(buyable).toBe(false)
    expect(price).toBeNull()  // $0 is parsed as 0 which fails > 0 check
  })

  it('does not trigger shouldFire for staged product with no context signals', () => {
    const { signals } = evaluateSignals(STAGED_PRODUCT, {
      onCollectionPage: false,
      directUrl200: false,
      searchHit: false,
    })
    expect(shouldFire(signals)).toBe(false)
  })
})

describe('evaluateSignals — Fixture B (live)', () => {
  it('sets BUYABLE and NONZERO_PRICE signals', () => {
    const { signals } = evaluateSignals(LIVE_PRODUCT, {
      onCollectionPage: true,
      directUrl200: true,
      searchHit: false,
    })
    expect(signals & SIGNAL_BUYABLE).toBeTruthy()
    expect(signals & SIGNAL_NONZERO_PRICE).toBeTruthy()
    expect(signals & SIGNAL_ON_COLLECTION).toBeTruthy()
    expect(signals & SIGNAL_URL_200).toBeTruthy()
  })

  it('sets the price to 400', () => {
    const { price } = evaluateSignals(LIVE_PRODUCT, {})
    expect(price).toBe(400)
  })

  it('triggers shouldFire', () => {
    const { signals } = evaluateSignals(LIVE_PRODUCT, {
      onCollectionPage: true,
      directUrl200: false,
      searchHit: false,
    })
    expect(shouldFire(signals)).toBe(true)  // BUYABLE + PRICE ≥ 2 signals
  })
})

// ── shouldFire edge cases ─────────────────────────────────────────────────────

describe('shouldFire', () => {
  it('fires on URL_200 + NONZERO_PRICE alone (decisive signal)', () => {
    expect(shouldFire(SIGNAL_URL_200 | SIGNAL_NONZERO_PRICE)).toBe(true)
  })

  it('fires on any 2 signals', () => {
    expect(shouldFire(SIGNAL_ON_COLLECTION | SIGNAL_BUYABLE)).toBe(true)
    expect(shouldFire(SIGNAL_BUYABLE | SIGNAL_SEARCH_HIT)).toBe(true)
  })

  it('does NOT fire on a single non-decisive signal', () => {
    expect(shouldFire(SIGNAL_ON_COLLECTION)).toBe(false)
    expect(shouldFire(SIGNAL_BUYABLE)).toBe(false)
    expect(shouldFire(SIGNAL_SEARCH_HIT)).toBe(false)
    // URL_200 alone (without PRICE) is not sufficient
    expect(shouldFire(SIGNAL_URL_200)).toBe(false)
  })

  it('does not fire on 0 signals', () => {
    expect(shouldFire(0)).toBe(false)
  })
})

// ── collectProducts ───────────────────────────────────────────────────────────

describe('collectProducts', () => {
  it('finds products nested inside a collection wrapper', () => {
    const node = {
      collection: {
        products: {
          edges: [
            { node: LIVE_PRODUCT },
            { node: UNRELATED_PRODUCT },
          ]
        }
      }
    }
    const products = collectProducts(node)
    // Should find objects with titles at any depth
    const titles = products.map(p => p.title ?? p.name ?? '').filter(Boolean)
    expect(titles.some(t => t.includes('Gold Foil'))).toBe(true)
  })

  it('handles empty input gracefully', () => {
    expect(collectProducts(null)).toHaveLength(0)
    expect(collectProducts({})).toHaveLength(0)
    expect(collectProducts([])).toHaveLength(0)
  })
})
