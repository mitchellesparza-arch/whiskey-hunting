'use client'
import { useEffect, useState } from 'react'
import Sparkline from './Sparkline.jsx'

const RARITY_COLOR = {
  'Unicorn':          '#c084fc',
  'Tier 1':           '#f87171',
  'Tier 1 Allocated': '#f87171',
  'Allocated':        '#f87171',
  'Tier 2':           '#fb923c',
  'Worth Watching':   '#fbbf24',
}

function fmtTimeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function nameMatches(a, b) {
  const al = a.toLowerCase()
  const bl = b.toLowerCase()
  return al.includes(bl) || bl.includes(al)
}

/**
 * BottleDetailSheet — bottom sheet with pricing, sparkline, and recent community sightings.
 *
 * Props:
 *   bottleName  string       — the bottle to look up
 *   finds       Find[]       — active finds (already loaded on the page)
 *   archived    Find[]       — archived finds (already loaded on the page)
 *   onClose     () => void
 */
export default function BottleDetailSheet({ bottleName, finds = [], archived = [], onClose }) {
  const [price,    setPrice]    = useState(null)
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [watched,  setWatched]  = useState(false)
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    if (!bottleName) return
    const enc = encodeURIComponent(bottleName)
    Promise.all([
      fetch(`/api/market-price?name=${enc}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/price-history?name=${enc}`).then(r => r.json()).catch(() => ({})),
    ]).then(([priceRes, histRes]) => {
      setPrice(priceRes.price ?? null)
      setHistory(histRes.history ?? [])
    }).finally(() => setLoading(false))
  }, [bottleName])

  const sightings = [...finds, ...archived]
    .filter(f => nameMatches(f.bottleName, bottleName))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)

  async function handleWatch() {
    setWatching(true)
    try {
      const res = await fetch('/api/watchlist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: bottleName }),
      })
      if (res.ok) setWatched(true)
    } catch {}
    setWatching(false)
  }

  const rarityColor = price?.rarity ? (RARITY_COLOR[price.rarity] ?? '#9a7c55') : null

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 299 }}
      />
      <div style={{
        position:      'fixed',
        bottom:        0,
        left:          0,
        right:         0,
        zIndex:        300,
        background:    '#1a1008',
        borderRadius:  '16px 16px 0 0',
        borderTop:     '1px solid #3d2b10',
        maxHeight:     '85vh',
        overflowY:     'auto',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        animation:     'fadeUp 0.22s ease',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#3d2b10' }} />
        </div>

        {/* Title row */}
        <div style={{ padding: '12px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#f5e6cc', lineHeight: 1.2, marginBottom: 8 }}>
              🥃 {bottleName}
            </div>
            {rarityColor && (
              <span style={{
                display:      'inline-block',
                fontSize:     11,
                fontWeight:   700,
                padding:      '2px 9px',
                borderRadius: 999,
                color:        rarityColor,
                background:   `${rarityColor}22`,
                border:       `1px solid ${rarityColor}44`,
              }}>
                {price.rarity}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#6b5030', fontSize: 20, cursor: 'pointer', padding: 0, flexShrink: 0 }}
          >✕</button>
        </div>

        {/* Price block */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a1c08' }}>
          {loading ? (
            <div style={{ fontSize: 13, color: '#6b5030' }}>Loading price data…</div>
          ) : price ? (
            <>
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>MSRP</div>
                  <div style={{ fontWeight: 700, fontSize: 22, color: '#c9a87a', lineHeight: 1 }}>${price.msrp}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Secondary</div>
                  <div style={{ fontWeight: 700, fontSize: 22, color: '#4ade80', lineHeight: 1 }}>
                    ${price.low}–${price.high}
                  </div>
                  <div style={{ fontSize: 11, color: '#9a7c55', marginTop: 2 }}>avg ${price.avg}</div>
                </div>
                {history.length >= 2 && (
                  <div style={{ marginLeft: 'auto', paddingBottom: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <div style={{ fontSize: 9, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {history.length}mo trend
                    </div>
                    <Sparkline data={history} width={90} height={30} />
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#3d2b10', marginTop: 8 }}>
                {price.source} · updated {price.lastUpdated}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#6b5030', fontStyle: 'italic' }}>
              No secondary market data available for this bottle
            </div>
          )}
        </div>

        {/* Recent sightings */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a1c08' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Recent Sightings
          </div>
          {sightings.length === 0 ? (
            <div style={{ fontSize: 13, color: '#6b5030', fontStyle: 'italic' }}>
              No recent community finds for this bottle
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sightings.map((f, i) => (
                <div
                  key={f.id}
                  style={{
                    padding:      '8px 0',
                    borderBottom: i < sightings.length - 1 ? '1px solid #1f1308' : 'none',
                    display:      'flex',
                    justifyContent: 'space-between',
                    alignItems:   'center',
                    gap:          8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, color: '#f5e6cc', fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {f.store?.name ?? 'Unknown store'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b5030', marginTop: 2 }}>
                      by {f.submitterName} · {fmtTimeAgo(f.timestamp)}
                      {f.status === 'archived' && (
                        <span style={{ color: '#3d2b10', marginLeft: 4 }}>· archived</span>
                      )}
                    </div>
                  </div>
                  {f.price != null && (
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#e8943a', flexShrink: 0 }}>
                      ${Number(f.price).toFixed(2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ padding: '14px 16px', display: 'flex', gap: 10 }}>
          <button
            onClick={handleWatch}
            disabled={watched || watching}
            style={{
              flex:         1,
              padding:      '10px 0',
              background:   watched ? 'rgba(96,165,250,0.12)' : '#1f1308',
              border:       `1px solid ${watched ? '#3b82f6' : '#3d2b10'}`,
              borderRadius: 8,
              cursor:       watched ? 'default' : 'pointer',
              color:        watched ? '#60a5fa' : '#9a7c55',
              fontWeight:   700,
              fontSize:     13,
              fontFamily:   'inherit',
            }}
          >
            {watched ? '✓ Watching' : watching ? '⏳' : '👀 Watch'}
          </button>
          <a
            href="/profile/collection"
            style={{
              flex:           1,
              padding:        '10px 0',
              background:     '#1f1308',
              border:         '1px solid #3d2b10',
              borderRadius:   8,
              color:          '#e8943a',
              fontWeight:     700,
              fontSize:       13,
              textDecoration: 'none',
              textAlign:      'center',
              display:        'block',
            }}
          >
            ＋ Collection
          </a>
        </div>
      </div>
    </>
  )
}
