'use client'
import dynamic       from 'next/dynamic'
import { useState, useEffect, useMemo } from 'react'
import { MapPin, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

// Leaflet map — SSR disabled
const IndependentsMap = dynamic(() => import('./IndependentsMap.jsx'), {
  ssr:     false,
  loading: () => (
    <div style={{
      height:         220,
      background:     'var(--bg-elev-2)',
      borderRadius:   'var(--r-md)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      color:          'var(--text-dim)',
      fontSize:       'var(--fs-meta)',
    }}>
      Loading map…
    </div>
  ),
})

// ─── Tier badge colours ───────────────────────────────────────────────────────
const TIER_STYLE = {
  '🦄 Unicorn Tier':                        { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  '🔴 Tier 1 — Highly Allocated':           { color: 'var(--red)',   bg: 'rgba(248,113,113,0.10)' },
  '🟠 Tier 2 — Allocated':                  { color: 'var(--amber)', bg: 'rgba(217,126,44,0.10)'  },
  '⬛ Worth Watching — In-Store Allocation': { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60)  return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  return `${Math.floor(s/3600)}h ago`
}

function BottlePill({ find }) {
  const tier  = find.tier ?? ''
  const style = TIER_STYLE[tier] ?? TIER_STYLE['⬛ Worth Watching — In-Store Allocation']
  return (
    <a
      href={find.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        padding:        '5px 10px',
        background:     'rgba(93,211,158,0.07)',
        border:         '1px solid rgba(93,211,158,0.2)',
        borderRadius:   'var(--r-sm)',
        textDecoration: 'none',
        flexShrink:     0,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
      <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--text-primary)' }}>
        {find.bottle}
      </span>
      {find.price && (
        <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--copper-400)', fontWeight: 700 }}>
          ${find.price.toFixed(2)}
        </span>
      )}
      <ExternalLink size={10} color="var(--text-dim)" />
    </a>
  )
}

// ─── Retailer card ────────────────────────────────────────────────────────────

function RetailerCard({ retailer, allFinds, selected, onSelect }) {
  const finds   = allFinds.filter(f => f.retailer === retailer.name)
  const hasStock = finds.length > 0
  const [expanded, setExpanded] = useState(hasStock)

  useEffect(() => { setExpanded(hasStock) }, [hasStock])

  return (
    <div
      onClick={() => onSelect(retailer.name === selected ? null : retailer.name)}
      style={{
        background:   hasStock ? 'rgba(93,211,158,0.04)' : 'var(--bg-elev-1)',
        border:       `1px solid ${selected === retailer.name
          ? 'var(--copper-500)'
          : hasStock ? 'rgba(93,211,158,0.25)' : 'var(--hairline)'}`,
        borderRadius: 'var(--r-md)',
        overflow:     'hidden',
        cursor:       'pointer',
        transition:   'border-color 0.15s',
      }}
    >
      {/* Header */}
      <div style={{
        padding:        'var(--sp-3) var(--sp-4)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {/* Stock pulse indicator */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width:        10, height: 10, borderRadius: '50%',
              background:   hasStock ? 'var(--green)' : 'var(--bg-elev-4)',
              border:       `1px solid ${hasStock ? 'rgba(93,211,158,0.5)' : 'var(--hairline)'}`,
            }} />
            {hasStock && (
              <div style={{
                position:  'absolute',
                inset:     -3,
                borderRadius: '50%',
                border:    '1.5px solid rgba(93,211,158,0.3)',
                animation: 'pulse 2s ease-out infinite',
              }} />
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {retailer.name}
            </div>
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={10} />
              {retailer.location}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {hasStock ? (
            <span style={{
              fontSize:     'var(--fs-overline)',
              fontWeight:   700,
              color:        'var(--green)',
              background:   'rgba(93,211,158,0.12)',
              border:       '1px solid rgba(93,211,158,0.25)',
              borderRadius: 'var(--r-pill)',
              padding:      '2px 8px',
              whiteSpace:   'nowrap',
            }}>
              {finds.length} in stock
            </span>
          ) : (
            <span style={{
              fontSize:   'var(--fs-overline)',
              color:      'var(--text-dim)',
              fontWeight: 500,
            }}>
              Nothing now
            </span>
          )}

          <a
            href={retailer.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
          >
            <ExternalLink size={13} />
          </a>

          {hasStock && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      </div>

      {/* Bottle list */}
      {hasStock && expanded && (
        <div style={{
          padding:    '0 var(--sp-4) var(--sp-3)',
          display:    'flex',
          flexWrap:   'wrap',
          gap:        6,
          borderTop:  '1px solid var(--hairline)',
          paddingTop: 'var(--sp-3)',
        }}
          onClick={e => e.stopPropagation()}
        >
          {finds.map((f, i) => <BottlePill key={i} find={f} />)}
        </div>
      )}
    </div>
  )
}

// ─── Bottle-first view ────────────────────────────────────────────────────────

function BottleView({ allFinds, allBottles }) {
  // Group by bottle name
  const grouped = useMemo(() => {
    const map = {}
    allFinds.forEach(f => {
      if (!map[f.bottle]) map[f.bottle] = { ...f, stores: [] }
      map[f.bottle].stores.push({ retailer: f.retailer, price: f.price, url: f.url, location: f.location })
    })
    return Object.values(map).sort((a, b) => b.stores.length - a.stores.length)
  }, [allFinds])

  if (grouped.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0', color: 'var(--text-dim)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
        <div style={{ fontSize: 'var(--fs-body)', marginBottom: 4 }}>Nothing in stock right now</div>
        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>
          Retailers are checked every hour. Check back soon.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {grouped.map(item => (
        <div
          key={item.bottle}
          style={{
            background:   'rgba(93,211,158,0.04)',
            border:       '1px solid rgba(93,211,158,0.2)',
            borderRadius: 'var(--r-md)',
            padding:      'var(--sp-3) var(--sp-4)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', marginBottom: 8 }}>
            🥃 {item.bottle}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {item.stores.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '5px 10px',
                  background:     'var(--bg-elev-2)',
                  borderRadius:   'var(--r-sm)',
                  textDecoration: 'none',
                  gap:            8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={11} color="var(--text-dim)" />
                  <span style={{ fontSize: 'var(--fs-meta)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {s.retailer}
                  </span>
                  <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
                    {s.location}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {s.price && (
                    <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--copper-400)', fontWeight: 700 }}>
                      ${s.price.toFixed(2)}
                    </span>
                  )}
                  <ExternalLink size={11} color="var(--text-dim)" />
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IndependentsTab() {
  const [data,         setData]        = useState(null)
  const [loading,      setLoading]     = useState(true)
  const [refreshing,   setRefreshing]  = useState(false)
  const [view,         setView]        = useState('store')   // 'store' | 'bottle'
  const [selectedPin,  setSelectedPin] = useState(null)
  const [showMap,      setShowMap]     = useState(true)

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/independents')
      const d   = await res.json()
      setData(d)
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const retailers = data?.retailers ?? []
  const allFinds  = data?.allFinds  ?? []
  const totalStock = allFinds.length
  const storesWithStock = retailers.filter(r => (data?.allFinds ?? []).some(f => f.retailer === r.name)).length

  return (
    <div>
      {/* ── Under construction banner ────────────────────────────────────── */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          10,
        background:   'rgba(251,191,36,0.07)',
        border:       '1px solid rgba(251,191,36,0.25)',
        borderRadius: 'var(--r-md)',
        padding:      'var(--sp-3) var(--sp-4)',
        marginBottom: 'var(--sp-4)',
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>🚧</span>
        <div>
          <span style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--amber)' }}>
            Under Construction
          </span>
          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginLeft: 6 }}>
            We're actively adding more Chicagoland independents. Inventory coverage will grow.
          </span>
        </div>
      </div>

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginBottom:   'var(--sp-4)',
        gap:            8,
        flexWrap:       'wrap',
      }}>
        <div>
          {loading ? (
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>Checking retailers…</div>
          ) : totalStock > 0 ? (
            <div>
              <span style={{ fontWeight: 800, fontSize: 'var(--fs-h3)', color: 'var(--green)' }}>
                {totalStock} bottle{totalStock !== 1 ? 's' : ''} in stock
              </span>
              <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginLeft: 8 }}>
                across {storesWithStock} store{storesWithStock !== 1 ? 's' : ''}
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
              No allocated stock found right now
            </div>
          )}
          {data?.checkedAt && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
              Last checked {timeAgo(data.checkedAt)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{
            display:      'inline-flex',
            background:   'var(--bg-elev-2)',
            border:       '1px solid var(--hairline)',
            borderRadius: 'var(--r-pill)',
            padding:      3,
            gap:          2,
          }}>
            {[
              { id: 'store',  label: '🏪 By Store'  },
              { id: 'bottle', label: '🥃 By Bottle' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                style={{
                  padding:    '5px 12px',
                  borderRadius: 'var(--r-pill)',
                  border:     'none',
                  background: view === id ? 'var(--copper-500)' : 'transparent',
                  color:      view === id ? 'var(--text-inverse)' : 'var(--text-muted)',
                  fontWeight: view === id ? 700 : 500,
                  fontSize:   'var(--fs-meta)',
                  cursor:     'pointer',
                  transition: 'all 0.12s',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            title="Refresh retailer inventory"
            style={{
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              width:        32, height: 32,
              borderRadius: 'var(--r-full)',
              border:       '1px solid var(--hairline)',
              background:   'var(--bg-elev-2)',
              color:        'var(--text-muted)',
              cursor:       refreshing || loading ? 'not-allowed' : 'pointer',
              opacity:      refreshing || loading ? 0.6 : 1,
              padding:      0,
            }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{
              height:       68,
              background:   'var(--bg-elev-1)',
              border:       '1px solid var(--hairline)',
              borderRadius: 'var(--r-md)',
              animation:    'shimmer 1.4s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {!loading && (
        <>
          {/* ── Map ─────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <button
              onClick={() => setShowMap(v => !v)}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        6,
                background: 'none',
                border:     'none',
                color:      'var(--text-dim)',
                cursor:     'pointer',
                fontSize:   'var(--fs-meta)',
                fontWeight: 600,
                padding:    '0 0 var(--sp-2)',
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

          {/* ── Content ─────────────────────────────────────────────────── */}
          {view === 'store' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Sort: in-stock first */}
              {[...retailers]
                .sort((a, b) => {
                  const aHas = allFinds.some(f => f.retailer === a.name)
                  const bHas = allFinds.some(f => f.retailer === b.name)
                  return (bHas ? 1 : 0) - (aHas ? 1 : 0)
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

          {/* ── Footer note ─────────────────────────────────────────────── */}
          <div style={{
            marginTop:  'var(--sp-6)',
            padding:    'var(--sp-3) var(--sp-4)',
            background: 'var(--bg-elev-1)',
            border:     '1px solid var(--hairline)',
            borderRadius: 'var(--r-md)',
            fontSize:   'var(--fs-meta)',
            color:      'var(--text-dim)',
            lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--text-muted)' }}>How it works</strong>
            — we check the live product catalog of {retailers.length} independent Chicagoland retailers every hour.
            If an allocated bottle appears in stock, it shows up here with a direct link.
            Prices reflect the retailer's listed price and may differ from MSRP.
          </div>
        </>
      )}

      {/* Animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0;   }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
