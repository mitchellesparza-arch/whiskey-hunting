'use client'
import { useSession }     from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState }  from 'react'
import Sparkline           from '../../components/Sparkline.jsx'
import PriceHistoryChart   from '../../components/PriceHistoryChart.jsx'

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
  if (!a || !b) return false
  const al = a.toLowerCase()
  const bl = b.toLowerCase()
  return al.includes(bl) || bl.includes(al)
}

// Derived view: which stores have stocked this bottle, ordered by most-recent
// sighting, with sighting count + median price per store.  Pulled from the
// existing /api/finds payload — no new endpoint needed.
function deriveStoreHistory(allFinds, bottleName) {
  const byStore = new Map()
  for (const f of allFinds) {
    if (!nameMatches(f.bottleName, bottleName)) continue
    const key = f.store?.placeId ?? f.store?.name
    if (!key) continue
    if (!byStore.has(key)) {
      byStore.set(key, { store: f.store, count: 0, lastSeen: 0, prices: [] })
    }
    const e = byStore.get(key)
    e.count++
    if (f.timestamp > e.lastSeen) e.lastSeen = f.timestamp
    if (f.price != null) e.prices.push(Number(f.price))
  }
  return Array.from(byStore.values())
    .map(e => ({
      ...e,
      medianPrice: e.prices.length
        ? Math.round(e.prices.sort((a, b) => a - b)[Math.floor(e.prices.length / 2)])
        : null,
    }))
    .sort((a, b) => b.lastSeen - a.lastSeen)
}

export default function BottleDetailPage() {
  const { data: session, status } = useSession()
  const router    = useRouter()
  const params    = useParams()
  const bottleName = decodeURIComponent(params.name ?? '')

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  const [price,    setPrice]    = useState(null)
  const [history,  setHistory]  = useState([])
  const [imageUrl, setImageUrl] = useState(null)
  const [finds,    setFinds]    = useState([])
  const [archived, setArchived] = useState([])
  const [review,   setReview]   = useState(null)     // Breaking Bourbon
  const [listings, setListings] = useState([])      // matching marketplace listings
  const [holders,  setHolders]  = useState([])      // friends who own it
  const [loading,  setLoading]  = useState(true)
  const [watched,  setWatched]  = useState(false)
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    if (!bottleName) return
    const enc = encodeURIComponent(bottleName)
    Promise.all([
      fetch(`/api/market-price?name=${enc}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/price-history?name=${enc}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/algolia-image?name=${enc}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/finds`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/reviews/breaking-bourbon?name=${enc}`).then(r => r.json()).catch(() => ({ found: false })),
      fetch(`/api/marketplace?activeOnly=1`).then(r => r.json()).catch(() => ({ listings: [] })),
      fetch(`/api/bottles/holders?name=${enc}`).then(r => r.json()).catch(() => ({ holders: [] })),
    ]).then(([priceRes, histRes, imgRes, findsRes, reviewRes, mktRes, holdRes]) => {
      setPrice(priceRes.price ?? null)
      setHistory(histRes.history ?? [])
      setImageUrl(imgRes.imageUrl ?? null)
      setFinds(findsRes.finds ?? [])
      setArchived(findsRes.archived ?? [])
      setReview(reviewRes?.found ? reviewRes : null)
      // Filter all marketplace listings down to those mentioning this bottle
      const all = mktRes?.listings ?? []
      setListings(all.filter(l => (l.bottles ?? []).some(b => nameMatches(b?.name ?? '', bottleName))))
      setHolders(holdRes?.holders ?? [])
    }).finally(() => setLoading(false))
  }, [bottleName])

  const allFinds   = [...finds, ...archived]
  const sightings  = allFinds
    .filter(f => nameMatches(f.bottleName, bottleName))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
  const storeHist  = deriveStoreHistory(allFinds, bottleName).slice(0, 5)
  const rarityColor = price?.rarity ? (RARITY_COLOR[price.rarity] ?? '#9a7c55') : null

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

  if (status === 'loading') return null

  return (
    <div style={{
      minHeight:     '100vh',
      background:    'var(--bg-base)',
      paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
    }}>

      {/* Header — back arrow + truncated bottle name */}
      <div style={{
        position:     'sticky',
        top:          0,
        zIndex:       50,
        background:   '#0f0a05',
        borderBottom: '1px solid #2a1c08',
        padding:      '10px 14px',
        paddingTop:   'calc(10px + env(safe-area-inset-top))',
        display:      'flex',
        alignItems:   'center',
        gap:          10,
      }}>
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{
            background: 'none', border: 'none', color: '#e8943a',
            fontSize: 24, cursor: 'pointer', padding: '0 4px',
            lineHeight: 1, flexShrink: 0,
          }}
        >‹</button>
        <div style={{
          flex:         1,
          minWidth:     0,
          fontSize:     14,
          fontWeight:   700,
          color:        '#f5e6cc',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {bottleName}
        </div>
      </div>

      {/* Hero — image + name + rarity */}
      <div style={{
        padding:    '20px 16px 16px',
        textAlign:  'center',
        borderBottom: '1px solid #2a1c08',
      }}>
        <div style={{
          width:          imageUrl ? 140 : 80,
          height:         imageUrl ? 200 : 80,
          margin:         '0 auto 14px',
          background:     '#0f0a05',
          borderRadius:   12,
          border:         '1px solid #2a1c08',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          overflow:       'hidden',
        }}>
          {imageUrl
            ? <img src={imageUrl} alt={bottleName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <span style={{ fontSize: 36 }}>🥃</span>
          }
        </div>
        <div style={{ fontWeight: 800, fontSize: 19, color: '#f5e6cc', lineHeight: 1.25, marginBottom: 8 }}>
          {bottleName}
        </div>
        {rarityColor && (
          <span style={{
            display:      'inline-block',
            fontSize:     11,
            fontWeight:   700,
            padding:      '3px 10px',
            borderRadius: 999,
            color:        rarityColor,
            background:   `${rarityColor}22`,
            border:       `1px solid ${rarityColor}44`,
          }}>
            {price.rarity}
          </span>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ padding: '14px 16px', display: 'flex', gap: 10, borderBottom: '1px solid #2a1c08' }}>
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

      {/* Pricing */}
      <div style={{ padding: '16px', borderBottom: '1px solid #2a1c08' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Pricing
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: '#6b5030' }}>Loading price data…</div>
        ) : price ? (
          <>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {price.msrp != null && (
                <div>
                  <div style={{ fontSize: 10, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>MSRP</div>
                  <div style={{ fontWeight: 700, fontSize: 22, color: '#c9a87a', lineHeight: 1 }}>${price.msrp}</div>
                </div>
              )}
              {price.low != null && price.high != null && (
                <div>
                  <div style={{ fontSize: 10, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Secondary</div>
                  <div style={{ fontWeight: 700, fontSize: 22, color: '#4ade80', lineHeight: 1 }}>
                    ${price.low}–${price.high}
                  </div>
                  {price.avg != null && (
                    <div style={{ fontSize: 11, color: '#9a7c55', marginTop: 2 }}>avg ${price.avg}</div>
                  )}
                </div>
              )}
              {history.length >= 2 && history.length < 3 && (
                <div style={{ marginLeft: 'auto', paddingBottom: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <div style={{ fontSize: 9, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {history.length}mo trend
                  </div>
                  <Sparkline data={history} width={90} height={30} />
                </div>
              )}
            </div>
            {/* Full-width history chart — replaces the inline sparkline once we
                have enough data points to be informative on a wider canvas. */}
            {history.length >= 3 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  {history.length}-month price history
                </div>
                <PriceHistoryChart data={history} />
              </div>
            )}
            <div style={{ fontSize: 10, color: '#3d2b10', marginTop: 10 }}>
              {price.source} · updated {price.lastUpdated}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: '#6b5030', fontStyle: 'italic' }}>
            No secondary market data yet for this bottle.
          </div>
        )}
      </div>

      {/* Bottle Info */}
      {price && (price.distillery || price.proof || price.age || price.type) && (
        <div style={{ padding: '16px', borderBottom: '1px solid #2a1c08' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Bottle Info
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            {price.distillery && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 9, color: '#3d2b10', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Distillery</div>
                <div style={{ fontSize: 13, color: '#c9a87a', fontWeight: 600 }}>{price.distillery}</div>
              </div>
            )}
            {price.type && (
              <div>
                <div style={{ fontSize: 9, color: '#3d2b10', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Type</div>
                <div style={{ fontSize: 13, color: '#c9a87a', fontWeight: 600 }}>{price.type}</div>
              </div>
            )}
            {price.proof && (
              <div>
                <div style={{ fontSize: 9, color: '#3d2b10', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Proof</div>
                <div style={{ fontSize: 13, color: '#c9a87a', fontWeight: 600 }}>{typeof price.proof === 'number' ? `${price.proof}°` : price.proof}</div>
              </div>
            )}
            {price.age && (
              <div>
                <div style={{ fontSize: 9, color: '#3d2b10', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Age</div>
                <div style={{ fontSize: 13, color: '#c9a87a', fontWeight: 600 }}>{price.age}</div>
              </div>
            )}
            {price.origin && (
              <div>
                <div style={{ fontSize: 9, color: '#3d2b10', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Origin</div>
                <div style={{ fontSize: 13, color: '#c9a87a', fontWeight: 600 }}>{price.origin}</div>
              </div>
            )}
            {price.region && (
              <div>
                <div style={{ fontSize: 9, color: '#3d2b10', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Region</div>
                <div style={{ fontSize: 13, color: '#c9a87a', fontWeight: 600 }}>{price.region}</div>
              </div>
            )}
            {price.sizes?.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: '#3d2b10', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Sizes</div>
                <div style={{ fontSize: 13, color: '#c9a87a', fontWeight: 600 }}>{price.sizes.join(', ')}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reviews — Breaking Bourbon */}
      {review && (
        <div style={{ padding: '16px', borderBottom: '1px solid #2a1c08' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Editorial Review
            </div>
            <div style={{ fontSize: 9, color: '#3d2b10', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Breaking Bourbon
            </div>
          </div>
          {review.title && (
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f5e6cc', marginBottom: 6 }}>
              {review.title}
            </div>
          )}
          {review.verdict && (
            <div style={{ fontSize: 13, color: '#c9a87a', lineHeight: 1.5, fontStyle: 'italic', marginBottom: 10 }}>
              “{review.verdict}”
            </div>
          )}
          <div style={{ fontSize: 11, color: '#6b5030', marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {review.author && <span>by {review.author}</span>}
            {review.date && <span>· {review.date}</span>}
            {review.proof && <span>· {review.proof} proof</span>}
            {review.msrp && <span>· MSRP {review.msrp}</span>}
          </div>
          <a
            href={review.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:        'inline-block',
              padding:        '8px 14px',
              background:     '#1f1308',
              border:         '1px solid #3d2b10',
              borderRadius:   8,
              color:          '#e8943a',
              fontSize:       12,
              fontWeight:     700,
              textDecoration: 'none',
            }}
          >
            Read full review →
          </a>
        </div>
      )}

      {/* Marketplace listings — current BIN/auction listings for this bottle */}
      {listings.length > 0 && (
        <div style={{ padding: '16px', borderBottom: '1px solid #2a1c08' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Live in Marketplace · {listings.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listings.slice(0, 5).map(l => (
              <a
                key={l.id}
                href="/marketplace"
                style={{
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  padding:        '10px 12px',
                  background:     '#1f1308',
                  border:         '1px solid #2a1c08',
                  borderRadius:   8,
                  textDecoration: 'none',
                  color:          'inherit',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f5e6cc', marginBottom: 2 }}>
                    {l.type === 'iso' ? '🔍 ISO' : l.type === 'trading' ? '🔄 Trade' : '💵 Sale'}
                    {' · '}
                    {l.submitterName ?? 'Member'}
                  </div>
                  <div style={{
                    fontSize: 11, color: '#9a7c55',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {(l.bottles ?? []).map(b => b?.name).filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  {l.binPrice != null && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>BIN ${l.binPrice}</div>
                  )}
                  {l.askingPrice != null && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e8943a' }}>${l.askingPrice}</div>
                  )}
                </div>
              </a>
            ))}
          </div>
          {listings.length > 5 && (
            <div style={{ fontSize: 11, color: '#6b5030', textAlign: 'center', marginTop: 8 }}>
              + {listings.length - 5} more — see Marketplace tab
            </div>
          )}
        </div>
      )}

      {/* Friends who own this */}
      {holders.length > 0 && (
        <div style={{ padding: '16px', borderBottom: '1px solid #2a1c08' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Friends who have it · {holders.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {holders.slice(0, 8).map((h, i) => (
              <div
                key={h.email}
                style={{
                  padding:      '8px 0',
                  borderBottom: i < Math.min(holders.length, 8) - 1 ? '1px solid #1f1308' : 'none',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          10,
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: '#3d2b10', color: '#e8943a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {(h.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f5e6cc' }}>{h.name}</div>
                  {h.addedAt > 0 && (
                    <div style={{ fontSize: 11, color: '#6b5030' }}>
                      added {fmtTimeAgo(h.addedAt)}
                    </div>
                  )}
                </div>
                {h.qty > 1 && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#9a7c55', flexShrink: 0 }}>
                    ×{h.qty}
                  </div>
                )}
              </div>
            ))}
          </div>
          {holders.length > 8 && (
            <div style={{ fontSize: 11, color: '#6b5030', textAlign: 'center', marginTop: 8 }}>
              + {holders.length - 8} more
            </div>
          )}
        </div>
      )}

      {/* Store History — derived from finds */}
      <div style={{ padding: '16px', borderBottom: '1px solid #2a1c08' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Where it's been spotted
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: '#6b5030' }}>Loading…</div>
        ) : storeHist.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b5030', fontStyle: 'italic' }}>
            No community sightings recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {storeHist.map((s, i) => (
              <div
                key={i}
                style={{
                  padding:      '10px 0',
                  borderBottom: i < storeHist.length - 1 ? '1px solid #1f1308' : 'none',
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
                    📍 {s.store?.name ?? 'Unknown store'}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b5030', marginTop: 2 }}>
                    {s.count} sighting{s.count !== 1 ? 's' : ''} · last {fmtTimeAgo(s.lastSeen)}
                  </div>
                </div>
                {s.medianPrice != null && (
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#e8943a', flexShrink: 0 }}>
                    ${s.medianPrice}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sightings (flat list) */}
      <div style={{ padding: '16px', borderBottom: '1px solid #2a1c08' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6b5030', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Recent Sightings
        </div>
        {loading ? (
          <div style={{ fontSize: 13, color: '#6b5030' }}>Loading…</div>
        ) : sightings.length === 0 ? (
          <div style={{ fontSize: 13, color: '#6b5030', fontStyle: 'italic' }}>
            No recent community finds for this bottle.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sightings.map((f, i) => (
              <div
                key={f.id ?? i}
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
    </div>
  )
}
