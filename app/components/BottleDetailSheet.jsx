'use client'
import { useEffect, useState } from 'react'
import Sparkline from './Sparkline.jsx'
import Sheet from './ui/Sheet.jsx'

const RARITY_COLOR = {
  'Unicorn':          'var(--violet)',
  'Tier 1':           'var(--red)',
  'Tier 1 Allocated': 'var(--red)',
  'Allocated':        'var(--red)',
  'Tier 2':           'var(--amber)',
  'Worth Watching':   'var(--amber)',
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

  const rarityColor = price?.rarity ? (RARITY_COLOR[price.rarity] ?? 'var(--text-muted)') : null

  return (
    <Sheet open={true} onClose={onClose} title={`🥃 ${bottleName}`}>
      {/* Rarity chip */}
      {rarityColor && (
        <div style={{ padding: '0 16px 12px' }}>
          <span style={{
            display:      'inline-block',
            fontSize:     11,
            fontWeight:   700,
            padding:      '2px 9px',
            borderRadius: 'var(--r-pill)',
            color:        rarityColor,
            background:   `${rarityColor}22`,
            border:       `1px solid ${rarityColor}44`,
          }}>
            {price.rarity}
          </span>
        </div>
      )}

      {/* Price block */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--hairline)' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Loading price data…</div>
        ) : price ? (
          <>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>MSRP</div>
                <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--text-2)', lineHeight: 1 }}>${price.msrp}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Secondary</div>
                <div style={{ fontWeight: 700, fontSize: 22, color: 'var(--green)', lineHeight: 1 }}>
                  ${price.low}–${price.high}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>avg ${price.avg}</div>
              </div>
              {history.length >= 2 && (
                <div style={{ marginLeft: 'auto', paddingBottom: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {history.length}mo trend
                  </div>
                  <Sparkline data={history} width={90} height={30} />
                </div>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--hairline-2)', marginTop: 8 }}>
              {price.source} · updated {price.lastUpdated}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No secondary market data available for this bottle
          </div>
        )}
      </div>

      {/* Bottle Info */}
      {price && (price.distillery || price.proof || price.age || price.type) && (
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--hairline)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Bottle Info
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {price.distillery && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 9, color: 'var(--hairline-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Distillery</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{price.distillery}</div>
              </div>
            )}
            {price.type && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--hairline-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Type</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{price.type}</div>
              </div>
            )}
            {price.proof && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--hairline-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Proof</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{typeof price.proof === 'number' ? `${price.proof}°` : price.proof}</div>
              </div>
            )}
            {price.age && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--hairline-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Age</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{price.age}</div>
              </div>
            )}
            {price.origin && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--hairline-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Origin</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{price.origin}</div>
              </div>
            )}
            {price.region && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--hairline-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Region</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{price.region}</div>
              </div>
            )}
            {price.sizes?.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: 'var(--hairline-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Sizes</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{price.sizes.join(', ')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent sightings */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--hairline)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Recent Sightings
        </div>
        {sightings.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No recent community finds for this bottle
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sightings.map((f, i) => (
              <div
                key={f.id}
                style={{
                  padding:      '8px 0',
                  borderBottom: i < sightings.length - 1 ? '1px solid var(--bg-elev-3)' : 'none',
                  display:      'flex',
                  justifyContent: 'space-between',
                  alignItems:   'center',
                  gap:          8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: 'var(--text-primary)', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.store?.name ?? 'Unknown store'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    by {f.submitterName} · {fmtTimeAgo(f.timestamp)}
                    {f.status === 'archived' && (
                      <span style={{ color: 'var(--hairline-2)', marginLeft: 4 }}>· archived</span>
                    )}
                  </div>
                </div>
                {f.price != null && (
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--copper-400)', flexShrink: 0 }}>
                    ${Number(f.price).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ padding: 'var(--sp-4)', display: 'flex', gap: 10 }}>
        <button
          onClick={handleWatch}
          disabled={watched || watching}
          style={{
            flex:         1,
            padding:      '10px 0',
            background:   watched ? 'var(--blue-bg)' : 'var(--bg-elev-3)',
            border:       watched ? '1px solid var(--blue)' : '1px solid var(--hairline-2)',
            borderRadius: 'var(--r-md)',
            cursor:       watched ? 'default' : 'pointer',
            color:        watched ? 'var(--blue)' : 'var(--text-muted)',
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
            background:     'var(--bg-elev-3)',
            border:         '1px solid var(--hairline-2)',
            borderRadius:   'var(--r-md)',
            color:          'var(--copper-400)',
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
    </Sheet>
  )
}
