'use client'
import dynamic       from 'next/dynamic'
import { useState, useEffect, useMemo } from 'react'
import { MapPin, RefreshCw, ExternalLink, ChevronDown, ChevronUp, Info } from 'lucide-react'

const IndependentsMap = dynamic(() => import('./IndependentsMap.jsx'), {
  ssr:     false,
  loading: () => (
    <div style={{
      height: 220, background: 'var(--bg-elev-2)', borderRadius: 'var(--r-md)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-dim)', fontSize: 'var(--fs-meta)',
    }}>Loading map…</div>
  ),
})

// ─── MSRP reference prices (Illinois typical retail) ─────────────────────────
// Used purely for price-context badges — not a guarantee.
const MSRP = {
  'Eagle Rare 10yr':                      40,
  'Eagle Rare 12yr':                      50,
  'Eagle Rare Liquor Barn Single Barrel': 45,
  'Eagle Rare Keg N Bottle Barrel Pick':  45,
  "Blanton's Original Single Barrel":     65,
  "Blanton's Gold Edition":               90,
  "Blanton's Straight From The Barrel":  125,
  'Weller Special Reserve':               30,
  'Weller 12yr':                          50,
  'Weller Antique 107':                   40,
  'Weller Full Proof':                    55,
  'Weller CYPB':                          55,
  'George T. Stagg (BTAC)':             100,
  'William Larue Weller (BTAC)':         130,
  'Thomas H. Handy (BTAC)':             100,
  'Sazerac 18yr (BTAC)':               100,
  'E.H. Taylor Small Batch':             70,
  'E.H. Taylor':                          70,
  'Buffalo Trace Bourbon':               30,
  'Old Fitzgerald 9yr BIB':             100,
  'Old Fitzgerald BIB':                  70,
  'Four Roses Limited Edition':          150,
  "Parker's Heritage":                   120,
  "Booker's Bourbon":                     90,
  'Pappy Van Winkle':                    300,
  'Van Winkle':                          200,
  'Old Rip Van Winkle 10yr':            120,
  'Stagg Jr.':                            60,
  'Larceny Barrel Proof':                 45,
  'Elijah Craig Barrel Proof':            60,
  "Angel's Envy Cask Strength":          200,
}

/**
 * Price context for a bottle.
 * Returns { label, color, bg } — or null if no MSRP reference.
 */
function priceContext(bottleName, price) {
  if (!price) return null
  const msrp = MSRP[bottleName]
  if (!msrp) return null
  const ratio = price / msrp
  if (ratio <= 1.15)  return { label: 'Near MSRP',    color: 'var(--green)',  bg: 'rgba(93,211,158,0.10)' }
  if (ratio <= 1.75)  return { label: 'Above MSRP',   color: 'var(--amber)',  bg: 'rgba(217,126,44,0.10)' }
  return               { label: 'Market Rate',   color: 'var(--red)',    bg: 'rgba(248,113,113,0.10)' }
}

// ─── Confidence tiers ─────────────────────────────────────────────────────────
// Assigned per-retailer based on data source reliability.
const RETAILER_CONFIDENCE = {
  'Liquor Barn':              { tier: 'high',    label: 'Live stock',      tip: 'Shopify inventory — Liquor Barn actively tracks stock' },
  'Keg N Bottle':             { tier: 'high',    label: 'Live stock',      tip: 'Shopify inventory — but many items are at market pricing' },
  '20 West Wine & Spirits':   { tier: 'catalog', label: 'In catalog',      tip: '"Ask In-Store" — confirmed they carry it, call ahead to verify on-hand' },
  "Joe's Beverage Warehouse": { tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock — updated with sales' },
  "John's Beverage Warehouse":{ tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
  'Greene Valley Wine & Spirits': { tier: 'high', label: 'Live stock',     tip: 'City Hive schema.org InStock' },
  "Malloy's Finest":          { tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
  "Sal's Beverage World":     { tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
  'Uncork It Chicago':        { tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
  'Archer Liquors':           { tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
  'Liquor Expo Chicago':      { tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
  'Kenwood Liquors':          { tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
  'Northshore Wine & Spirits':{ tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
  'Gold Eagle Wine & Spirits':{ tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
  'D&D Smoke & Spirits':      { tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
  'Elgin Liquor & Wine':      { tier: 'high',    label: 'Live stock',      tip: 'City Hive schema.org InStock' },
}

const CONF_STYLE = {
  high:    { color: 'var(--green)',    bg: 'rgba(93,211,158,0.08)',  border: 'rgba(93,211,158,0.2)'  },
  catalog: { color: 'var(--text-dim)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
}

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  return `${Math.floor(s/3600)}h ago`
}

// ─── Single bottle row within a store card ────────────────────────────────────
function BottleRow({ find }) {
  const ctx  = priceContext(find.bottle, find.price)
  const conf = RETAILER_CONFIDENCE[find.retailer]
  const isCatalog = conf?.tier === 'catalog'

  return (
    <a
      href={find.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            8,
        padding:        '7px 10px',
        background:     'var(--bg-elev-2)',
        border:         '1px solid var(--hairline)',
        borderRadius:   'var(--r-sm)',
        textDecoration: 'none',
        transition:     'background 0.12s',
      }}
    >
      {/* Left: dot + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: isCatalog ? 'var(--text-dim)' : 'var(--green)',
        }} />
        <span style={{
          fontSize: 'var(--fs-meta)', fontWeight: 600,
          color: 'var(--text-primary)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {find.bottle}
        </span>
      </div>

      {/* Right: price + context badge + link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {find.price ? (
          <>
            <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--text-secondary)' }}>
              ${find.price.toFixed(2)}
            </span>
            {ctx && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: ctx.color, background: ctx.bg,
                padding: '2px 5px', borderRadius: 'var(--r-sm)',
              }}>
                {ctx.label}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>Ask in store</span>
        )}
        <ExternalLink size={10} color="var(--text-dim)" />
      </div>
    </a>
  )
}

// ─── Retailer card ────────────────────────────────────────────────────────────
function RetailerCard({ retailer, allFinds, selected, onSelect }) {
  const finds   = allFinds.filter(f => f.retailer === retailer.name)
  const hasStock = finds.length > 0
  const conf    = RETAILER_CONFIDENCE[retailer.name] ?? { tier: 'high', label: 'Live stock', tip: '' }
  const confStyle = CONF_STYLE[conf.tier] ?? CONF_STYLE.high
  const [expanded, setExpanded] = useState(hasStock)
  useEffect(() => setExpanded(hasStock), [hasStock])

  // Count near-MSRP vs above-MSRP finds
  const nearMsrp  = finds.filter(f => { const c = priceContext(f.bottle, f.price); return c?.label === 'Near MSRP' })
  const aboveMsrp = finds.filter(f => { const c = priceContext(f.bottle, f.price); return c && c.label !== 'Near MSRP' })
  const askStore  = finds.filter(f => !f.price)

  const isSelected = selected === retailer.name

  return (
    <div style={{
      background:   hasStock ? 'rgba(93,211,158,0.03)' : 'var(--bg-elev-1)',
      border:       `1px solid ${isSelected ? 'var(--copper-500)' : hasStock ? 'rgba(93,211,158,0.2)' : 'var(--hairline)'}`,
      borderRadius: 'var(--r-md)',
      overflow:     'hidden',
    }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        onClick={() => { onSelect(isSelected ? null : retailer.name); if (!isSelected) setExpanded(true) }}
        style={{
          padding: 'var(--sp-3) var(--sp-4)',
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 8,
          cursor: 'pointer',
        }}
      >
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {/* Pulse dot */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background:   hasStock ? 'var(--green)' : 'var(--bg-elev-4)',
                border:       `1px solid ${hasStock ? 'rgba(93,211,158,0.5)' : 'var(--hairline)'}`,
              }} />
              {hasStock && (
                <div style={{
                  position: 'absolute', inset: -3, borderRadius: '50%',
                  border: '1.5px solid rgba(93,211,158,0.25)',
                  animation: 'pulse 2s ease-out infinite',
                }} />
              )}
            </div>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {retailer.name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <MapPin size={10} />{retailer.location}
            </span>
            {/* Confidence badge */}
            <span
              title={conf.tip}
              style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: confStyle.color, background: confStyle.bg,
                border: `1px solid ${confStyle.border}`,
                padding: '1px 5px', borderRadius: 'var(--r-sm)',
                cursor: 'help',
              }}
            >
              {conf.label}
            </span>
          </div>
        </div>

        {/* Right column — bottle count summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingTop: 2 }}>
          {hasStock ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 'var(--fs-overline)', fontWeight: 700,
                color: 'var(--green)',
              }}>
                {finds.length} bottle{finds.length !== 1 ? 's' : ''}
              </div>
              {nearMsrp.length > 0 && (
                <div style={{ fontSize: 9, color: 'var(--green)', fontWeight: 600 }}>
                  {nearMsrp.length} near MSRP
                </div>
              )}
              {askStore.length > 0 && nearMsrp.length === 0 && (
                <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>ask in store</div>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
              Nothing now
            </span>
          )}

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <a
              href={retailer.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
            >
              <ExternalLink size={12} />
            </a>
            {hasStock && (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, display: 'flex' }}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottle list ─────────────────────────────────────────────────────── */}
      {hasStock && expanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ borderTop: '1px solid var(--hairline)', padding: 'var(--sp-3) var(--sp-4)' }}
        >
          {/* Near MSRP group */}
          {nearMsrp.length > 0 && (
            <div style={{ marginBottom: aboveMsrp.length + askStore.length > 0 ? 10 : 0 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--green)',
                marginBottom: 5,
              }}>
                ● Near MSRP
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {nearMsrp.map((f, i) => <BottleRow key={i} find={f} />)}
              </div>
            </div>
          )}

          {/* Ask in store group */}
          {askStore.length > 0 && (
            <div style={{ marginBottom: aboveMsrp.length > 0 ? 10 : 0 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--text-dim)',
                marginBottom: 5,
              }}>
                ● Ask In Store
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {askStore.map((f, i) => <BottleRow key={i} find={f} />)}
              </div>
            </div>
          )}

          {/* Above MSRP group */}
          {aboveMsrp.length > 0 && (
            <div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--amber)',
                marginBottom: 5,
              }}>
                ● Above MSRP
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {aboveMsrp.map((f, i) => <BottleRow key={i} find={f} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── By-Bottle view ───────────────────────────────────────────────────────────
function BottleView({ allFinds }) {
  const grouped = useMemo(() => {
    const map = {}
    allFinds.forEach(f => {
      if (!map[f.bottle]) map[f.bottle] = { bottle: f.bottle, stores: [] }
      map[f.bottle].stores.push(f)
    })
    // Sort: near-MSRP bottles first, then by number of stores
    return Object.values(map).sort((a, b) => {
      const aNear = a.stores.some(s => priceContext(s.bottle, s.price)?.label === 'Near MSRP')
      const bNear = b.stores.some(s => priceContext(s.bottle, s.price)?.label === 'Near MSRP')
      if (aNear && !bNear) return -1
      if (!aNear && bNear) return 1
      return b.stores.length - a.stores.length
    })
  }, [allFinds])

  if (!grouped.length) return (
    <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0', color: 'var(--text-dim)' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
      <div>No allocated stock found right now</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {grouped.map(({ bottle, stores }) => {
        const bestFind  = stores.find(s => priceContext(s.bottle, s.price)?.label === 'Near MSRP') ?? stores[0]
        const ctx       = priceContext(bestFind.bottle, bestFind.price)

        return (
          <div key={bottle} style={{
            background:   'var(--bg-elev-1)',
            border:       '1px solid var(--hairline)',
            borderRadius: 'var(--r-md)',
            overflow:     'hidden',
          }}>
            {/* Bottle header */}
            <div style={{
              padding: 'var(--sp-3) var(--sp-4)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 8,
              borderBottom: '1px solid var(--hairline)',
              background: 'var(--bg-elev-2)',
            }}>
              <span style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>
                🥃 {bottle}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 'var(--fs-overline)', fontWeight: 700, color: 'var(--green)',
                }}>
                  {stores.length} store{stores.length !== 1 ? 's' : ''}
                </span>
                {ctx && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: ctx.color, background: ctx.bg,
                    padding: '2px 5px', borderRadius: 'var(--r-sm)',
                  }}>
                    {ctx.label}
                  </span>
                )}
              </div>
            </div>

            {/* Store rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {stores.map((s, i) => {
                const sCtx = priceContext(s.bottle, s.price)
                const conf = RETAILER_CONFIDENCE[s.retailer]
                return (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'space-between',
                      padding:        '8px 16px',
                      borderBottom:   i < stores.length - 1 ? '1px solid var(--hairline)' : 'none',
                      textDecoration: 'none',
                      gap:            8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <MapPin size={11} color="var(--text-dim)" />
                      <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {s.retailer}
                      </span>
                      <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
                        {s.location}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {s.price ? (
                        <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: sCtx?.color ?? 'var(--text-secondary)' }}>
                          ${s.price.toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>Ask</span>
                      )}
                      {sCtx && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                          textTransform: 'uppercase', color: sCtx.color,
                          background: sCtx.bg, padding: '1px 5px', borderRadius: 'var(--r-sm)',
                        }}>
                          {sCtx.label}
                        </span>
                      )}
                      {conf?.tier === 'catalog' && (
                        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>call ahead</span>
                      )}
                      <ExternalLink size={10} color="var(--text-dim)" />
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function IndependentsTab() {
  const [data,        setData]       = useState(null)
  const [loading,     setLoading]    = useState(true)
  const [refreshing,  setRefreshing] = useState(false)
  const [view,        setView]       = useState('store')
  const [selectedPin, setSelectedPin] = useState(null)
  const [showMap,     setShowMap]    = useState(true)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/independents')
      setData(await res.json())
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const retailers    = data?.retailers ?? []
  const allFinds     = data?.allFinds  ?? []
  const nearMsrpCount = allFinds.filter(f => priceContext(f.bottle, f.price)?.label === 'Near MSRP').length
  const storesWithStock = new Set(allFinds.map(f => f.retailer)).size

  return (
    <div>
      {/* ── Under construction banner ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: 'var(--r-md)', padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>🚧</span>
        <div>
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--amber)' }}>Under Construction </span>
          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
            — We're actively adding more Chicagoland independents. Inventory coverage will grow.
          </span>
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
        marginBottom: 'var(--sp-4)',
      }}>
        <div>
          {loading ? (
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>Checking retailers…</div>
          ) : allFinds.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 'var(--fs-h3)', color: 'var(--text-primary)' }}>
                  {allFinds.length} bottle{allFinds.length !== 1 ? 's' : ''} in stock
                </span>
                <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>
                  across {storesWithStock} store{storesWithStock !== 1 ? 's' : ''}
                </span>
                {nearMsrpCount > 0 && (
                  <span style={{
                    fontSize: 'var(--fs-overline)', fontWeight: 700, color: 'var(--green)',
                    background: 'rgba(93,211,158,0.10)', border: '1px solid rgba(93,211,158,0.2)',
                    borderRadius: 'var(--r-pill)', padding: '2px 8px',
                  }}>
                    {nearMsrpCount} near MSRP
                  </span>
                )}
              </div>
              {data?.checkedAt && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
                  Last checked {timeAgo(data.checkedAt)}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
              No allocated stock found right now
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{
            display: 'inline-flex', background: 'var(--bg-elev-2)',
            border: '1px solid var(--hairline)', borderRadius: 'var(--r-pill)', padding: 3, gap: 2,
          }}>
            {[{ id: 'store', label: '🏪 By Store' }, { id: 'bottle', label: '🥃 By Bottle' }].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                style={{
                  padding: '5px 12px', borderRadius: 'var(--r-pill)', border: 'none',
                  background: view === id ? 'var(--copper-500)' : 'transparent',
                  color:      view === id ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontWeight: view === id ? 700 : 500,
                  fontSize: 'var(--fs-meta)', cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
                }}
              >{label}</button>
            ))}
          </div>
          {/* Refresh */}
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            title="Refresh retailer inventory"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 'var(--r-full)',
              border: '1px solid var(--hairline)', background: 'var(--bg-elev-2)',
              color: 'var(--text-muted)', cursor: refreshing || loading ? 'not-allowed' : 'pointer',
              opacity: refreshing || loading ? 0.6 : 1, padding: 0,
            }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── Loading skeletons ─────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{
              height: 68, background: 'var(--bg-elev-1)', border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-md)', animation: 'shimmer 1.4s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {/* ── Map ──────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <button
              onClick={() => setShowMap(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', color: 'var(--text-dim)',
                cursor: 'pointer', fontSize: 'var(--fs-meta)', fontWeight: 600,
                padding: '0 0 var(--sp-2)',
              }}
            >
              <MapPin size={12} />
              {showMap ? 'Hide map' : 'Show map'}
              {showMap ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showMap && (
              <IndependentsMap
                retailers={retailers}
                allFinds={allFinds}
                selected={selectedPin}
                onSelect={setSelectedPin}
              />
            )}
          </div>

          {/* ── MSRP legend ──────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', gap: 10, flexWrap: 'wrap',
            marginBottom: 'var(--sp-3)',
            fontSize: 10, color: 'var(--text-dim)',
          }}>
            {[
              { label: 'Near MSRP', color: 'var(--green)',  bg: 'rgba(93,211,158,0.10)' },
              { label: 'Above MSRP', color: 'var(--amber)', bg: 'rgba(217,126,44,0.10)' },
              { label: 'Market Rate', color: 'var(--red)',  bg: 'rgba(248,113,113,0.10)' },
              { label: 'Ask In Store', color: 'var(--text-dim)', bg: 'rgba(255,255,255,0.05)' },
            ].map(t => (
              <span key={t.label} style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase', color: t.color,
                background: t.bg, padding: '2px 7px', borderRadius: 'var(--r-sm)',
              }}>
                {t.label}
              </span>
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>— price vs. Illinois reference</span>
          </div>

          {/* ── Content ──────────────────────────────────────────────────── */}
          {view === 'store' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...retailers]
                .sort((a, b) => {
                  const aFinds = allFinds.filter(f => f.retailer === a.name)
                  const bFinds = allFinds.filter(f => f.retailer === b.name)
                  // Near-MSRP stores first, then by total finds, then empty
                  const aNear = aFinds.filter(f => priceContext(f.bottle, f.price)?.label === 'Near MSRP').length
                  const bNear = bFinds.filter(f => priceContext(f.bottle, f.price)?.label === 'Near MSRP').length
                  if (bNear !== aNear) return bNear - aNear
                  return bFinds.length - aFinds.length
                })
                .map(r => (
                  <RetailerCard
                    key={r.name}
                    retailer={r}
                    allFinds={allFinds}
                    selected={selectedPin}
                    onSelect={setSelectedPin}
                  />
                ))
              }
            </div>
          ) : (
            <BottleView allFinds={allFinds} />
          )}

          {/* ── Footer ───────────────────────────────────────────────────── */}
          <div style={{
            marginTop: 'var(--sp-6)', padding: 'var(--sp-3) var(--sp-4)',
            background: 'var(--bg-elev-1)', border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-md)', fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--text-muted)' }}>How it works</strong>
            {' '}— We check the live catalog of {retailers.length} independent Chicagoland retailers every hour.
            <strong style={{ color: 'var(--green)' }}> Live stock</strong> stores update in real-time with sales.
            <strong style={{ color: 'var(--text-dim)' }}> In catalog</strong> stores confirm they carry the bottle — call ahead to verify it's on the shelf today.
            Price badges compare against Illinois typical retail; allocated bottles are rarely sold at distillery MSRP.
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse   { 0%{transform:scale(1);opacity:0.8} 100%{transform:scale(1.8);opacity:0} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
      `}</style>
    </div>
  )
}
