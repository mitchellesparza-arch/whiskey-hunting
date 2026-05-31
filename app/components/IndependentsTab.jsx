'use client'
import dynamic      from 'next/dynamic'
import { useState, useEffect, useMemo } from 'react'
import { MapPin, RefreshCw, ExternalLink, ChevronDown, ChevronUp, AlertCircle, BookOpen } from 'lucide-react'

// ─── How It Works guide ───────────────────────────────────────────────────────

const GUIDE_SECTIONS = [
  {
    icon: '🟢',
    title: 'Live inventory',
    body: 'Most stores here use Shopify or City Hive — both track stock in real-time as items sell. When a bottle shows "in stock," Shopify\'s own engine has verified the count is above zero. It\'s the same signal that controls whether the Add to Cart button is active on their website. If we say it\'s in stock, you can buy it right now.',
  },
  {
    icon: '🟡',
    title: 'Multi-location stores',
    body: 'Some stores (like Liquor Barn) run a single shared catalog across multiple locations. "In stock" means it exists somewhere across their network — but we can\'t tell which specific store. When you see the amber Multi-location badge, call ahead to your nearest location before making the trip.',
  },
  {
    icon: '⬛',
    title: 'Catalog listings',
    body: 'A handful of stores list bottles without real-time stock counts. These show "Ask in store" instead of a price. It means they\'re known to carry the bottle — but it might not be on the shelf today. Always call ahead for catalog-listed bottles.',
  },
  {
    icon: '🔢',
    title: 'Stock quantities',
    body: 'Where visible, we show the total units in the store\'s network (e.g. "34 in network"). For high-value bottles, some stores deliberately hide the count — that doesn\'t mean they\'re out, it just means they don\'t want to advertise scarcity. If availability shows true but no count appears, assume they have at least one.',
  },
  {
    icon: '✗',
    title: 'Zero matches',
    body: 'When a store shows no bottles found, we still checked their full catalog — you\'ll see "X products checked, 0 matched." This means we looked and nothing from our tracked list was available at that moment. Check back later; allocated bottles move in and out of stock quickly.',
  },
]

function HowItWorksGuide() {
  const LS_KEY = 'wh:indie-guide-open'
  const [open, setOpen] = useState(false)

  // Restore collapsed state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      // Default open on first visit (stored === null), collapsed after
      setOpen(stored === null ? true : stored === 'true')
    } catch {}
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem(LS_KEY, String(next)) } catch {}
  }

  return (
    <div style={{
      background:   'var(--bg-elev-1)',
      border:       '1px solid var(--hairline)',
      borderRadius: 'var(--r-md)',
      overflow:     'hidden',
      marginBottom: 'var(--sp-4)',
    }}>
      {/* Header — always visible */}
      <button
        onClick={toggle}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            10,
          padding:        'var(--sp-3) var(--sp-4)',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          textAlign:      'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOpen size={14} color="var(--copper-400)" />
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>
            How inventory tracking works
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--copper-400)',
            background: 'rgba(217,126,44,0.10)', padding: '1px 6px', borderRadius: 'var(--r-sm)',
          }}>
            Guide
          </span>
        </div>
        <div style={{ color: 'var(--text-dim)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Expandable body */}
      {open && (
        <div style={{ borderTop: '1px solid var(--hairline)' }}>
          {GUIDE_SECTIONS.map((s, i) => (
            <div
              key={s.title}
              style={{
                display:      'flex',
                gap:          12,
                padding:      'var(--sp-3) var(--sp-4)',
                borderBottom: i < GUIDE_SECTIONS.length - 1 ? '1px solid var(--hairline)' : 'none',
              }}
            >
              {/* Icon */}
              <div style={{
                flexShrink:     0,
                width:          28,
                height:         28,
                borderRadius:   'var(--r-sm)',
                background:     'var(--bg-elev-2)',
                border:         '1px solid var(--hairline)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       14,
                marginTop:      1,
              }}>
                {s.icon}
              </div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight:   700,
                  fontSize:     'var(--fs-body)',
                  color:        'var(--text-primary)',
                  marginBottom: 4,
                }}>
                  {s.title}
                </div>
                <div style={{
                  fontSize:   'var(--fs-meta)',
                  color:      'var(--text-muted)',
                  lineHeight: 1.6,
                }}>
                  {s.body}
                </div>
              </div>
            </div>
          ))}

          {/* Dismiss link */}
          <div style={{
            padding:    'var(--sp-2) var(--sp-4)',
            background: 'var(--bg-elev-2)',
            display:    'flex',
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={toggle}
              style={{
                background: 'none', border: 'none',
                color:      'var(--text-dim)', cursor: 'pointer',
                fontSize:   'var(--fs-meta)', fontFamily: 'inherit',
              }}
            >
              Got it — hide guide ↑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const IndependentsMap = dynamic(() => import('./IndependentsMap.jsx'), {
  ssr:     false,
  loading: () => (
    <div style={{
      height: 220, background: 'var(--bg-elev-2)', borderRadius: 'var(--r-md)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-dim)', fontSize: 'var(--fs-meta)',
    }}>
      Loading map…
    </div>
  ),
})

// ─── Confidence config ────────────────────────────────────────────────────────
// Maps data source to a human-readable confidence label + explanation.
const SOURCE_CONF = {
  shopify: {
    label:  'Live inventory',
    detail: 'Shopify tracks stock in real-time — if it says in stock, you can add it to cart right now.',
    color:  'var(--green)',
    bg:     'rgba(93,211,158,0.10)',
    border: 'rgba(93,211,158,0.20)',
  },
  shopify_multi: {
    label:  'Multi-location',
    detail: 'In stock somewhere across their locations — catalog is shared so we can\'t tell which specific store has it. Call ahead.',
    color:  'var(--amber)',
    bg:     'rgba(217,126,44,0.10)',
    border: 'rgba(217,126,44,0.20)',
  },
  cityhive: {
    label:  'Live inventory',
    detail: 'City Hive updates stock as items sell. Schema.org InStock means it was purchasable when we last checked.',
    color:  'var(--green)',
    bg:     'rgba(93,211,158,0.10)',
    border: 'rgba(93,211,158,0.20)',
  },
  custom: {
    label:  'Catalog listing',
    detail: 'This store lists bottles without real-time stock counts. Call ahead to confirm it\'s on the shelf today.',
    color:  'var(--text-muted)',
    bg:     'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.10)',
  },
  unknown: {
    label:  'Unknown',
    detail: 'Data source confidence unknown.',
    color:  'var(--text-dim)',
    bg:     'rgba(255,255,255,0.03)',
    border: 'var(--hairline)',
  },
}

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60)   return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

// ─── Single bottle row ────────────────────────────────────────────────────────
function BottleRow({ find, isCatalog }) {
  // Quantity display: only for Liquor Barn (scraped from page HTML)
  // null qty + multi-location = likely in-store pickup only (button grays out online)
  const showQty     = find.quantity != null && find.quantity > 0
  const qtyLow      = showQty && find.quantity <= 10
  const isPickupOnly = find.retailer === 'Liquor Barn' && find.quantity == null && find.inStock
  const qtyLabel    = showQty
    ? `${find.quantity} in network`
    : null

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: isCatalog ? 'var(--text-dim)' : 'var(--green)',
        }} />
        <span style={{
          fontSize: 'var(--fs-meta)', fontWeight: 600, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {find.rawName ?? find.bottle}
        </span>
        {/* Stock quantity */}
        {qtyLabel && (
          <span style={{
            fontSize: 9, fontWeight: 700, flexShrink: 0,
            color: qtyLow ? 'var(--amber)' : 'var(--text-dim)',
          }}>
            {qtyLabel}
          </span>
        )}
        {/* In-store pickup only — grays out online but physically on shelf */}
        {isPickupOnly && (<>
          <span style={{
            fontSize: 9, fontWeight: 700, flexShrink: 0,
            color: 'var(--amber)',
          }}
            title="Liquor Barn sells this in-store only — the online cart button will be grayed out."
          >
            not online
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, flexShrink: 0,
            color: 'var(--text-dim)',
          }}
            title="Allocated bottles at Liquor Barn are often kept behind the counter or in the back. Call ahead to confirm availability and which location has it."
          >
            may not be displayed
          </span>
        </>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        {find.price ? (
          <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--copper-400)' }}>
            ${find.price.toFixed(2)}
          </span>
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
  const finds      = allFinds.filter(f => f.retailer === retailer.name)
  const hasStock   = finds.length > 0
  // Use shopify_multi for multi-location Shopify stores (can't pinpoint which store)
  const sourceKey  = retailer.source === 'shopify' && retailer.multiLocation ? 'shopify_multi' : (retailer.source ?? 'unknown')
  const conf       = SOURCE_CONF[sourceKey]
  const isCatalog  = retailer.source === 'custom'
  const isSelected = selected === retailer.name

  const [expanded, setExpanded] = useState(hasStock)
  useEffect(() => setExpanded(hasStock), [hasStock])

  // Build the status subtitle for zero-hit stores
  const zeroHitMsg = useMemo(() => {
    if (hasStock) return null
    if (!retailer.accessible) return { text: 'Catalog unavailable', icon: '⚠', color: 'var(--amber)' }
    if (retailer.catalogSize) return {
      text:  `${retailer.catalogSize} products checked — none matched our watch list`,
      icon:  '✓',
      color: 'var(--text-dim)',
    }
    return { text: 'No matching bottles found', icon: '—', color: 'var(--text-dim)' }
  }, [hasStock, retailer.accessible, retailer.catalogSize])

  return (
    <div style={{
      background:   hasStock ? 'rgba(93,211,158,0.03)' : 'var(--bg-elev-1)',
      border:       `1px solid ${isSelected ? 'var(--copper-500)' : hasStock ? 'rgba(93,211,158,0.2)' : 'var(--hairline)'}`,
      borderRadius: 'var(--r-md)',
      overflow:     'hidden',
      opacity:      !retailer.accessible ? 0.5 : 1,
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
        {/* Left */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {/* Pulse dot */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: hasStock ? 'var(--green)' : 'var(--bg-elev-4)',
                border: `1px solid ${hasStock ? 'rgba(93,211,158,0.5)' : 'var(--hairline)'}`,
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

            {/* Confidence badge */}
            <span
              title={conf.detail}
              style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase', cursor: 'help',
                color: conf.color, background: conf.bg,
                border: `1px solid ${conf.border}`,
                padding: '1px 6px', borderRadius: 'var(--r-sm)',
              }}
            >
              {conf.label}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
            <MapPin size={10} />
            <span style={{ fontSize: 'var(--fs-meta)' }}>{retailer.location}</span>
          </div>

          {/* Multi-location note */}
          {retailer.multiLocation && hasStock && (
            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>📍</span>
              <span>Stock confirmed across {retailer.locationNames?.join(', ')} — call your nearest to confirm on-shelf</span>
            </div>
          )}

          {/* Zero-hit diagnostic */}
          {zeroHitMsg && (
            <div style={{
              marginTop: 5, fontSize: 10,
              color: zeroHitMsg.color, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span>{zeroHitMsg.icon}</span>
              <span>{zeroHitMsg.text}</span>
            </div>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingTop: 2 }}>
          {hasStock ? (
            <span style={{
              fontSize: 'var(--fs-overline)', fontWeight: 700, color: 'var(--green)',
              background: 'rgba(93,211,158,0.10)', border: '1px solid rgba(93,211,158,0.2)',
              borderRadius: 'var(--r-pill)', padding: '2px 8px', whiteSpace: 'nowrap',
            }}>
              {finds.length} bottle{finds.length !== 1 ? 's' : ''}
            </span>
          ) : null}
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

      {/* ── Bottle list ─────────────────────────────────────────────────────── */}
      {hasStock && expanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            borderTop: '1px solid var(--hairline)',
            padding: 'var(--sp-3) var(--sp-4)',
            display: 'flex', flexDirection: 'column', gap: 5,
          }}
        >
          {finds.map((f, i) => <BottleRow key={i} find={f} isCatalog={isCatalog} />)}
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
    return Object.values(map).sort((a, b) => b.stores.length - a.stores.length)
  }, [allFinds])

  if (!grouped.length) return (
    <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0', color: 'var(--text-dim)' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
      <div>No allocated stock found right now</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {grouped.map(({ bottle, stores }) => (
        <div key={bottle} style={{
          background: 'var(--bg-elev-1)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
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
            <span style={{
              fontSize: 'var(--fs-overline)', fontWeight: 700, color: 'var(--green)',
            }}>
              {stores.length} store{stores.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Store rows */}
          {stores.map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                borderBottom: i < stores.length - 1 ? '1px solid var(--hairline)' : 'none',
                textDecoration: 'none', gap: 8,
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                {s.price ? (
                  <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--copper-400)' }}>
                    ${s.price.toFixed(2)}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>Ask</span>
                )}
                <ExternalLink size={10} color="var(--text-dim)" />
              </div>
            </a>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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

  const retailers      = data?.retailers ?? []
  const allFinds       = data?.allFinds  ?? []
  const storesWithStock = new Set(allFinds.map(f => f.retailer)).size
  const storesWithIssue = retailers.filter(r => !r.accessible).length

  return (
    <div>
      {/* Under construction */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: 'var(--r-md)', padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-4)',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>🚧</span>
        <div>
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--amber)' }}>Under Construction </span>
          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
            — Adding more Chicagoland independents. Coverage will grow.
          </span>
        </div>
      </div>

      {/* How it works guide */}
      <HowItWorksGuide />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
        marginBottom: 'var(--sp-4)',
      }}>
        <div>
          {loading ? (
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>Checking {retailers.length || '…'} retailers…</div>
          ) : allFinds.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 'var(--fs-h3)', color: 'var(--text-primary)' }}>
                  {allFinds.length} bottle{allFinds.length !== 1 ? 's' : ''} in stock
                </span>
                <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>
                  across {storesWithStock} store{storesWithStock !== 1 ? 's' : ''}
                </span>
              </div>
              {data?.checkedAt && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
                  Checked {timeAgo(data.checkedAt)}
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
          <div style={{
            display: 'inline-flex', background: 'var(--bg-elev-2)',
            border: '1px solid var(--hairline)', borderRadius: 'var(--r-pill)', padding: 3, gap: 2,
          }}>
            {[{ id: 'store', label: '🏪 By Store' }, { id: 'bottle', label: '🥃 By Bottle' }].map(({ id, label }) => (
              <button key={id} onClick={() => setView(id)} style={{
                padding: '5px 12px', borderRadius: 'var(--r-pill)', border: 'none',
                background: view === id ? 'var(--copper-500)' : 'transparent',
                color:      view === id ? 'var(--text-inverse)' : 'var(--text-muted)',
                fontWeight: view === id ? 700 : 500,
                fontSize: 'var(--fs-meta)', cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
              }}>{label}</button>
            ))}
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            title="Refresh"
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

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{
              height: 64, background: 'var(--bg-elev-1)', border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-md)', animation: 'shimmer 1.4s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {/* Map */}
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

          {/* Confidence legend */}
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap',
            marginBottom: 'var(--sp-3)',
          }}>
            {[
              { label: 'Live inventory',   color: 'var(--green)',    bg: 'rgba(93,211,158,0.10)',  border: 'rgba(93,211,158,0.20)',  tip: 'City Hive or Shopify single-store — updates as items sell' },
              { label: 'Multi-location',   color: 'var(--amber)',    bg: 'rgba(217,126,44,0.10)',  border: 'rgba(217,126,44,0.20)',  tip: 'Shared catalog — stock confirmed across locations but which store is unknown. Call ahead.' },
              { label: 'Catalog listing', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)', tip: 'They carry it — call ahead to confirm on-shelf today' },
            ].map(t => (
              <span key={t.label} title={t.tip} style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                textTransform: 'uppercase', cursor: 'help',
                color: t.color, background: t.bg,
                border: `1px solid ${t.border}`,
                padding: '2px 7px', borderRadius: 'var(--r-sm)',
              }}>
                {t.label}
              </span>
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>
              — hover badge for details
            </span>
          </div>

          {/* Content */}
          {view === 'store' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...retailers]
                .sort((a, b) => {
                  // in-stock stores first, then by find count
                  const aHas = allFinds.some(f => f.retailer === a.name)
                  const bHas = allFinds.some(f => f.retailer === b.name)
                  if (bHas !== aHas) return bHas ? 1 : -1
                  const aCount = allFinds.filter(f => f.retailer === a.name).length
                  const bCount = allFinds.filter(f => f.retailer === b.name).length
                  return bCount - aCount
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
