/**
 * Unit tests for lib/collection-csv.js — CSV import/export for My Collection.
 */
import { describe, it, expect } from 'vitest'
import {
  parseCsv, rowsToEntries, bottlesToCsv, normalizeCategory,
} from '../lib/collection-csv.js'

describe('parseCsv', () => {
  it('handles quoted fields, escaped quotes, embedded commas/newlines, CRLF and BOM', () => {
    const text = '﻿name,notes\r\n"Weller 12","says ""wheat"", nice"\r\n"Multi\nline",x\r\n\r\n'
    expect(parseCsv(text)).toEqual([
      ['name', 'notes'],
      ['Weller 12', 'says "wheat", nice'],
      ['Multi\nline', 'x'],
    ])
  })
})

describe('normalizeCategory', () => {
  it('maps known categories case-insensitively', () => {
    expect(normalizeCategory('bourbon')).toBe('Bourbon')
    expect(normalizeCategory('RYE')).toBe('Rye')
  })
  it('folds other whiskey types into American', () => {
    expect(normalizeCategory('Wheat')).toBe('American')
    expect(normalizeCategory('Flavored Whiskey')).toBe('American')
    expect(normalizeCategory('Canadian')).toBe('American')
  })
  it('keeps non-whiskey types as-is and defaults blank to Bourbon', () => {
    expect(normalizeCategory('Gin')).toBe('Gin')
    expect(normalizeCategory('')).toBe('Bourbon')
  })
})

describe('rowsToEntries', () => {
  it('maps BarrelBook-style headers and skips finished bottles', () => {
    const rows = parseCsv([
      'status,brand,name,type,distilledBy,proof,quantity,msrp,secondaryPrice,createdAt,tastingNotes',
      'Unopened,Stagg,Stagg Kentucky Straight Bourbon Whiskey,Bourbon,Buffalo Trace Distillery,125.20,1,70.99,110.00,2026-08-20T16:14:50.199Z,',
      'Opened,Cedar Ridge,The Brown No. 9 Iowa Whiskey,Whiskey,,99,2,,,,',
      'Finished,Weller,Weller Special Reserve,Bourbon,,90,1,,,,',
    ].join('\n'))
    const { entries, skipped, unmatchedHeaders } = rowsToEntries(rows)

    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      name: 'Stagg Kentucky Straight Bourbon Whiskey',
      distillery: 'Buffalo Trace Distillery',
      category: 'Bourbon', proof: 125.2, qty: 1, msrp: 70.99, secondary: 110,
      addedAt: '2026-08-20T16:14:50.199Z',
    })
    // Brand prefixed when the name doesn't already contain it; distillery falls back to brand
    expect(entries[1]).toMatchObject({
      name: 'Cedar Ridge The Brown No. 9 Iowa Whiskey',
      distillery: 'Cedar Ridge', category: 'American', qty: 2, msrp: 0,
    })
    expect(skipped).toEqual([{ row: 4, name: 'Weller Special Reserve', reason: 'Status "Finished"' }])
    expect(unmatchedHeaders).toEqual(['tastingNotes'])
  })

  it('derives proof from ABV when proof is missing', () => {
    const { entries } = rowsToEntries(parseCsv('name,abv\nFoo,50'))
    expect(entries[0].proof).toBe(100)
  })

  it('rejects files without a name column', () => {
    expect(() => rowsToEntries(parseCsv('brand,proof\nX,90'))).toThrow(/name/)
  })

  it('skips rows without a name', () => {
    const { entries, skipped } = rowsToEntries(parseCsv('name,proof\n,90\nFoo,100'))
    expect(entries).toHaveLength(1)
    expect(skipped[0]).toMatchObject({ row: 2, reason: 'Missing bottle name' })
  })
})

describe('bottlesToCsv', () => {
  const bottle = {
    id: '1777424355837', name: 'E.H. Taylor, "Small Batch"', distillery: 'Buffalo Trace',
    category: 'Bourbon', proof: 100, qty: 2, msrp: 65, secondary: 90, upc: '088004005498',
    blindScore: 8.5, tastings: 3, flavors: ['caramel', 'oak'], forSale: true, forTrade: false,
    addedAt: '2026-04-29T00:59:15.837Z', photoUrl: 'https://example.com/a.jpg',
  }

  it('round-trips through import', () => {
    const { entries } = rowsToEntries(parseCsv(bottlesToCsv([bottle])))
    const { userId, ...expected } = bottle
    expect(entries[0]).toEqual(expected)
  })

  it('neutralizes spreadsheet formulas', () => {
    const csv = bottlesToCsv([{ name: '=HYPERLINK("x")', proof: -1 }])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain(',-1,')
  })
})
