'use client'
import { useSession }     from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState }  from 'react'
import { ChevronLeft, Eye, Check, Plus, MapPin, Search, ArrowLeftRight, DollarSign, BarChart2 } from 'lucide-react'
import Sparkline           from '../../components/Sparkline.jsx'
import PriceHistoryChart   from '../../components/PriceHistoryChart.jsx'
import Button              from '../../components/ui/Button.jsx'
import SectionHeader       from '../../components/ui/SectionHeader.jsx'
import EmptyState          from '../../components/ui/EmptyState.jsx'
import Chip                from '../../components/ui/Chip.jsx'

const RARITY_COLOR = {
  'Unicorn':          'var(--violet)',
  'Tier 1':           'var(--red)',
  'Tier 1 Allocated': 'var(--red)',
  'Allocated':        'var(--red)',
  'Tier 2':           'var(--amber)',
  'Worth Watching':   'var(--amber)',
}

const RARITY_TONE = {
  'Unicorn':          'violet',
  'Tier 1':           'red',
  'Tier 1 Allocated': 'red',
  'Allocated':        'red',
  'Tier 2':           'amber',
  'Worth Watching':   'amber',
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

// ── Fair Price Widget ─────────────────────────────────────────────────────────

function FairPriceWidget({ price, low, high, avg }) {
  const totalSpan = (high * 1.5) || 1
  const fairStart = Math.round((low  / totalSpan) * 100)
  const fairWidth = Math.round(((high - low) / totalSpan) * 100)
  const markerPct = Math.min(100, Math.max(0, Math.round((price / totalSpan) * 100)))

  let verdict, verdictColor
  if (price < low)        { verdict = 'Great deal';       verdictColor = 'var(--green)' }
  else if (price <= high) { verdict = 'Fair market price'; verdictColor = 'var(--amber)' }
  else                    { verdict = 'Above market';      verdictColor = 'var(--red)'   }

  return (
    <div style={{ marginTop: 'var(--sp-2)' }}>
      <div style={{ fontWeight: 700, color: verdictColor, fontSize: 'var(--fs-body)', marginBottom: 'var(--sp-3)' }}>
        {verdict}
      </div>
      {/* Bar */}
      <div style={{ position: 'relative', height: 8, background: 'var(--bg-elev-2)', borderRadius: 4, marginBottom: 'var(--sp-3)' }}>
        <div style={{
          position:     'absolute',
          left:         `${fairStart}%`,
          width:        `${fairWidth}%`,
          height:       '100%',
          background:   'rgba(93,211,158,0.35)',
          borderRadius: 2,
        }} />
        <div style={{
          position:     'absolute',
          left:         `${markerPct}%`,
          top:          '50%',
          transform:    'translate(-50%, -50%)',
          width:        12,
          height:       12,
          borderRadius: '50%',
          background:   verdictColor,
          border:       '2px solid var(--bg-base)',
          boxShadow:    `0 0 0 1px ${verdictColor}44`,
        }} />
      </div>
      {/* Scale labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
        <span>${low} low</span>
        {avg != null && <span>${avg} avg</span>}
        <span>${high} high</span>
      </div>
    </div>
  )
}

const divider = { borderBottom: '1px solid var(--hairline)', padding: 'var(--sp-4) var(--sp-4)' }
const overlineStyle = {
  fontSize: 'var(--fs-overline)', fontWeight: 700, color: 'var(--text-dim)',
  textTransform: 'uppercase', letterSpacing: 'var(--tracking-overline)', marginBottom: 'var(--sp-3)',
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
  const [review,   setReview]   = useState(null)
  const [listings, setListings] = useState([])
  const [holders,  setHolders]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [watched,      setWatched]      = useState(false)
  const [watching,     setWatching]     = useState(false)
  const [yearVariants, setYearVariants] = useState([])
  const [fairInput,    setFairInput]    = useState('')
  const [fairOpen,     setFairOpen]     = useState(false)

  useEffect(() => {
    if (!bottleName) return
    const enc = encodeURIComponent(bottleName)
    // Derive base name for year-variant lookup (strip trailing 4-digit year)
    const baseName = bottleName.replace(/\s+\d{4}$/, '').trim()
    const baseEnc  = encodeURIComponent(baseName)

    Promise.all([
      fetch(`/api/market-price?name=${enc}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/price-history?name=${enc}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/algolia-image?name=${enc}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/finds`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/reviews/breaking-bourbon?name=${enc}`).then(r => r.json()).catch(() => ({ found: false })),
      fetch(`/api/marketplace?activeOnly=1`).then(r => r.json()).catch(() => ({ listings: [] })),
      fetch(`/api/bottles/holders?name=${enc}`).then(r => r.json()).catch(() => ({ holders: [] })),
      fetch(`/api/catalog/search?q=${baseEnc}&limit=25`).then(r => r.json()).catch(() => ({ results: [] })),
    ]).then(([priceRes, histRes, imgRes, findsRes, reviewRes, mktRes, holdRes, catRes]) => {
      setPrice(priceRes.price ?? null)
      setHistory(histRes.history ?? [])
      setImageUrl(imgRes.imageUrl ?? (reviewRes?.found ? reviewRes.image : null) ?? null)
      setFinds(findsRes.finds ?? [])
      setArchived(findsRes.archived ?? [])
      setReview(reviewRes?.found ? reviewRes : null)
      const all = mktRes?.listings ?? []
      setListings(all.filter(l => (l.bottles ?? []).some(b => nameMatches(b?.name ?? '', bottleName))))
      setHolders(holdRes?.holders ?? [])
      // Year variants: catalog entries that have a `year` field and share the same base name
      const variants = (catRes.results ?? []).filter(r => r.year != null)
      if (variants.length > 1) setYearVariants(variants)
    }).finally(() => setLoading(false))
  }, [bottleName])

  const allFinds   = [...finds, ...archived]
  const sightings  = allFinds
    .filter(f => nameMatches(f.bottleName, bottleName))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
  const storeHist  = deriveStoreHistory(allFinds, bottleName).slice(0, 5)

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
      minHeight:     '100dvh',
      background:    'var(--bg-base)',
      paddingBottom: 'calc(var(--tab-h) + env(safe-area-inset-bottom))',
    }}>

      {/* Sticky header */}
      <div style={{
        position:     'sticky',
        top:          0,
        zIndex:       50,
        background:   'rgba(12,8,5,0.96)',
        borderBottom: '1px solid var(--hairline-2)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding:      'var(--sp-3) var(--sp-4)',
        paddingTop:   'calc(var(--sp-3) + env(safe-area-inset-top))',
        display:      'flex',
        alignItems:   'center',
        gap:          'var(--sp-3)',
        height:       'var(--header-h)',
      }}>
        <button
          onClick={() => router.back()}
          aria-label="Back"
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          style={{
            background:   'none',
            border:       'none',
            color:        'var(--copper-400)',
            cursor:       'pointer',
            padding:      'var(--sp-1)',
            lineHeight:   1,
            flexShrink:   0,
            display:      'grid',
            placeItems:   'center',
            borderRadius: 'var(--r-sm)',
            transition:   'transform var(--t-fast) var(--ease-out)',
          }}
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
        <div style={{
          flex:         1,
          minWidth:     0,
          fontSize:     'var(--fs-body)',
          fontWeight:   700,
          color:        'var(--text-primary)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {bottleName}
        </div>
      </div>

      {/* Hero */}
      <div style={{
        ...divider,
        textAlign:  'center',
        padding:    'var(--sp-5) var(--sp-4) var(--sp-4)',
      }}>
        <div style={{
          width:          imageUrl ? 140 : 80,
          height:         imageUrl ? 200 : 80,
          margin:         `0 auto var(--sp-4)`,
          background:     'var(--bg-elev-1)',
          borderRadius:   'var(--r-lg)',
          border:         '1px solid var(--hairline-2)',
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
        <div style={{
          fontWeight:    800,
          fontSize:      'var(--fs-h2)',
          color:         'var(--text-primary)',
          lineHeight:    1.25,
          marginBottom:  'var(--sp-3)',
        }}>
          {bottleName}
        </div>
        {price?.rarity && (
          <Chip tone={RARITY_TONE[price.rarity] ?? 'neutral'}>
            {price.rarity}
          </Chip>
        )}
      </div>

      {/* Quick actions */}
      <div style={{
        ...divider,
        display: 'flex',
        gap:     'var(--sp-3)',
      }}>
        <Button
          variant={watched ? 'secondary' : 'ghost'}
          fullWidth
          onClick={handleWatch}
          disabled={watched || watching}
          style={watched ? { color: 'var(--blue)', borderColor: 'rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)' } : {}}
        >
          {watched ? <><Check size={16} /> Watching</> : watching ? 'Adding…' : <><Eye size={16} /> Watch</>}
        </Button>
        <Button
          variant="ghost"
          fullWidth
          onClick={() => router.push('/profile/collection')}
        >
          <Plus size={16} /> Collection
        </Button>
      </div>

      {/* Year / Vintage selector */}
      {yearVariants.length > 1 && (
        <div style={divider}>
          <div style={overlineStyle}>Vintage</div>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            {yearVariants.map(v => (
              <button
                key={v.year}
                onClick={() => router.push(`/bottle/${encodeURIComponent(v.name)}`)}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
                onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
                style={{
                  padding:      'var(--sp-1) var(--sp-3)',
                  borderRadius: 'var(--r-pill)',
                  border:       'none',
                  cursor:       'pointer',
                  fontWeight:   700,
                  fontSize:     'var(--fs-body)',
                  background:   v.name === bottleName ? 'var(--copper-500)' : 'var(--bg-elev-2)',
                  color:        v.name === bottleName ? 'var(--text-inverse)' : 'var(--text-muted)',
                  transition:   'background var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out)',
                }}
              >
                {v.year}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      <div style={divider}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
          <div style={{ ...overlineStyle, margin: 0 }}>Pricing</div>
          <button
            onClick={() => router.push('/market')}
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        'var(--sp-1)',
              background: 'none',
              border:     'none',
              color:      'var(--text-dim)',
              fontSize:   'var(--fs-overline)',
              cursor:     'pointer',
              padding:    'var(--sp-1)',
            }}
          >
            <BarChart2 size={11} strokeWidth={1.75} /> Market Index
          </button>
        </div>
        {loading ? (
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>Loading price data…</div>
        ) : price ? (
          <>
            <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {price.msrp != null && (
                <div>
                  <div style={overlineStyle}>MSRP</div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-h2)', color: 'var(--copper-400)', lineHeight: 1 }}>
                    ${price.msrp}
                  </div>
                </div>
              )}
              {price.low != null && price.high != null && (
                <div>
                  <div style={overlineStyle}>Secondary</div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-h2)', color: 'var(--green)', lineHeight: 1 }}>
                    ${price.low}–${price.high}
                  </div>
                  {price.avg != null && (
                    <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
                      avg ${price.avg}
                    </div>
                  )}
                </div>
              )}
              {history.length >= 2 && history.length < 3 && (
                <div style={{ marginLeft: 'auto', paddingBottom: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--sp-1)' }}>
                  <div style={overlineStyle}>{history.length}mo trend</div>
                  <Sparkline data={history} width={90} height={30} />
                </div>
              )}
            </div>

            {/* Price history chart */}
            {history.length >= 3 && (
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <div style={{ ...overlineStyle, marginBottom: 'var(--sp-2)' }}>
                  {history.length}-month price history
                  {history.some(h => h.source === 'auction') && (
                    <span style={{ marginLeft: 'var(--sp-2)', color: 'var(--copper-400)', fontWeight: 600 }}>
                      · Unicorn Auctions data
                    </span>
                  )}
                  {history.some(h => h.source === 'marketplace') && (
                    <span style={{ marginLeft: 'var(--sp-2)', color: 'var(--green)', fontWeight: 600 }}>
                      · Confirmed sales
                    </span>
                  )}
                </div>
                <PriceHistoryChart data={history} />
              </div>
            )}

            {/* Source + data confidence */}
            <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', marginTop: 'var(--sp-3)' }}>
              {price.source} · updated {price.lastUpdated}
            </div>

            {/* Is this price fair? widget */}
            {price.low != null && price.high != null && (
              <div style={{ marginTop: 'var(--sp-4)', borderTop: '1px solid var(--hairline)', paddingTop: 'var(--sp-4)' }}>
                <button
                  onClick={() => { setFairOpen(v => !v); setFairInput('') }}
                  style={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        'var(--sp-2)',
                    background: 'none',
                    border:     '1px solid var(--hairline-2)',
                    borderRadius: 'var(--r-md)',
                    color:      'var(--text-muted)',
                    fontSize:   'var(--fs-body)',
                    fontWeight: 600,
                    cursor:     'pointer',
                    padding:    'var(--sp-2) var(--sp-3)',
                    fontFamily: 'inherit',
                    width:      '100%',
                    justifyContent: 'center',
                    transition: 'background var(--t-base) var(--ease-out)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elev-1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  Is this price fair?
                </button>
                {fairOpen && (
                  <div style={{ marginTop: 'var(--sp-3)' }}>
                    <input
                      type="number"
                      min="0"
                      value={fairInput}
                      onChange={e => setFairInput(e.target.value)}
                      placeholder="Enter a price…"
                      autoFocus
                      style={{
                        width:        '100%',
                        padding:      'var(--sp-2) var(--sp-3)',
                        background:   'var(--bg-elev-1)',
                        border:       '1px solid var(--hairline-2)',
                        borderRadius: 'var(--r-md)',
                        color:        'var(--text-primary)',
                        fontSize:     'var(--fs-body)',
                        fontFamily:   'inherit',
                        outline:      'none',
                        boxSizing:    'border-box',
                      }}
                    />
                    {fairInput && Number(fairInput) > 0 && (
                      <FairPriceWidget
                        price={Number(fairInput)}
                        low={price.low}
                        high={price.high}
                        avg={price.avg}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No secondary market data yet for this bottle.
          </div>
        )}
      </div>

      {/* Bottle Info */}
      {price && (price.distillery || price.proof || price.age || price.type) && (
        <div style={divider}>
          <div style={overlineStyle}>Bottle Info</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2) var(--sp-4)' }}>
            {price.distillery && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={overlineStyle}>Distillery</div>
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--copper-400)', fontWeight: 600 }}>{price.distillery}</div>
              </div>
            )}
            {[
              { label: 'Type',   val: price.type },
              { label: 'Proof',  val: price.proof ? (typeof price.proof === 'number' ? `${price.proof}°` : price.proof) : null },
              { label: 'Age',    val: price.age },
              { label: 'Origin', val: price.origin },
              { label: 'Region', val: price.region },
              { label: 'Sizes',  val: price.sizes?.length > 0 ? price.sizes.join(', ') : null },
            ].filter(x => x.val).map(({ label, val }) => (
              <div key={label}>
                <div style={overlineStyle}>{label}</div>
                <div style={{ fontSize: 'var(--fs-body)', color: 'var(--copper-400)', fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editorial Review */}
      {review && (
        <div style={divider}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
            <div style={overlineStyle}>Editorial Review</div>
            <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-overline)' }}>
              Breaking Bourbon
            </div>
          </div>
          {review.title && (
            <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>
              {review.title}
            </div>
          )}
          {review.verdict && (
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 'var(--sp-3)' }}>
              "{review.verdict}"
            </div>
          )}
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', marginBottom: 'var(--sp-3)', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
            {review.author && <span>by {review.author}</span>}
            {review.date && <span>· {review.date}</span>}
            {review.proof && <span>· {review.proof} proof</span>}
            {review.msrp && <span>· MSRP {review.msrp}</span>}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(review.url, '_blank', 'noopener,noreferrer')}
          >
            Read full review →
          </Button>
        </div>
      )}

      {/* Marketplace listings */}
      {listings.length > 0 && (
        <div style={divider}>
          <div style={overlineStyle}>Live in Marketplace · {listings.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {listings.slice(0, 5).map(l => {
              const TypeIcon = l.type === 'iso' ? Search : l.type === 'trading' ? ArrowLeftRight : DollarSign
              return (
                <a
                  key={l.id}
                  href="/marketplace"
                  style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'center',
                    padding:        'var(--sp-3)',
                    background:     'var(--bg-elev-2)',
                    border:         '1px solid var(--hairline)',
                    borderRadius:   'var(--r-md)',
                    textDecoration: 'none',
                    color:          'inherit',
                    transition:     'background var(--t-fast) var(--ease-out)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elev-3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-elev-2)'}
                >
                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                    <TypeIcon size={14} strokeWidth={1.75} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                        {l.submitterName ?? 'Member'}
                      </div>
                      <div style={{
                        fontSize: 'var(--fs-overline)', color: 'var(--text-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {(l.bottles ?? []).map(b => b?.name).filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {l.binPrice != null && (
                      <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--green)' }}>BIN ${l.binPrice}</div>
                    )}
                    {l.askingPrice != null && (
                      <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--copper-500)' }}>${l.askingPrice}</div>
                    )}
                  </div>
                </a>
              )
            })}
          </div>
          {listings.length > 5 && (
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', textAlign: 'center', marginTop: 'var(--sp-2)' }}>
              + {listings.length - 5} more — see Marketplace tab
            </div>
          )}
        </div>
      )}

      {/* Friends who own this */}
      {holders.length > 0 && (
        <div style={divider}>
          <div style={overlineStyle}>Friends who have it · {holders.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {holders.slice(0, 8).map((h, i) => (
              <div
                key={h.email}
                style={{
                  padding:      'var(--sp-2) 0',
                  borderBottom: i < Math.min(holders.length, 8) - 1 ? '1px solid var(--hairline)' : 'none',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          'var(--sp-3)',
                }}
              >
                <div style={{
                  width:          30,
                  height:         30,
                  borderRadius:   '50%',
                  background:     'var(--grad-copper)',
                  color:          'var(--text-inverse)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       'var(--fs-meta)',
                  fontWeight:     700,
                  flexShrink:     0,
                }}>
                  {(h.name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 600, color: 'var(--text-primary)' }}>{h.name}</div>
                  {h.addedAt > 0 && (
                    <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
                      added {fmtTimeAgo(h.addedAt)}
                    </div>
                  )}
                </div>
                {h.qty > 1 && (
                  <div style={{ fontSize: 'var(--fs-meta)', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                    ×{h.qty}
                  </div>
                )}
              </div>
            ))}
          </div>
          {holders.length > 8 && (
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', textAlign: 'center', marginTop: 'var(--sp-2)' }}>
              + {holders.length - 8} more
            </div>
          )}
        </div>
      )}

      {/* Store History */}
      <div style={divider}>
        <div style={overlineStyle}>Where it's been spotted</div>
        {loading ? (
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>Loading…</div>
        ) : storeHist.length === 0 ? (
          <EmptyState
            icon="MapPin"
            title="No sightings yet"
            body="No community sightings recorded for this bottle."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {storeHist.map((s, i) => (
              <div
                key={i}
                style={{
                  padding:        'var(--sp-3) 0',
                  borderBottom:   i < storeHist.length - 1 ? '1px solid var(--hairline)' : 'none',
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  gap:            'var(--sp-2)',
                }}
              >
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <MapPin size={14} strokeWidth={1.75} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{
                      fontSize: 'var(--fs-body)', color: 'var(--text-primary)', fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.store?.name ?? 'Unknown store'}
                    </div>
                    <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', marginTop: 2 }}>
                      {s.count} sighting{s.count !== 1 ? 's' : ''} · last {fmtTimeAgo(s.lastSeen)}
                    </div>
                  </div>
                </div>
                {s.medianPrice != null && (
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--copper-500)', flexShrink: 0 }}>
                    ${s.medianPrice}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sightings */}
      <div style={divider}>
        <div style={overlineStyle}>Recent Sightings</div>
        {loading ? (
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>Loading…</div>
        ) : sightings.length === 0 ? (
          <EmptyState
            icon="MapPin"
            title="No recent finds"
            body="No community finds for this bottle yet."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sightings.map((f, i) => (
              <div
                key={f.id ?? i}
                style={{
                  padding:        'var(--sp-2) 0',
                  borderBottom:   i < sightings.length - 1 ? '1px solid var(--hairline)' : 'none',
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  gap:            'var(--sp-2)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--fs-meta)', color: 'var(--text-primary)', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.store?.name ?? 'Unknown store'}
                  </div>
                  <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', marginTop: 2 }}>
                    by {f.submitterName} · {fmtTimeAgo(f.timestamp)}
                    {f.status === 'archived' && (
                      <span style={{ color: 'var(--text-dim)', marginLeft: 'var(--sp-1)' }}>· archived</span>
                    )}
                  </div>
                </div>
                {f.price != null && (
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--copper-500)', flexShrink: 0 }}>
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
