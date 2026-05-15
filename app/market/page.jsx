'use client'
import { useSession }  from 'next-auth/react'
import { useRouter }   from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronLeft, TrendingUp, BarChart2, ExternalLink } from 'lucide-react'
import Chip from '../components/ui/Chip.jsx'
import ProGate from '../components/ProGate.jsx'
import { isPro } from '../../lib/tier.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n) {
  if (n == null) return '—'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtPct(n) {
  if (n == null) return '—'
  return `+${n.toLocaleString()}%`
}

const RARITY_TONE = {
  'Unicorn':          'violet',
  'Tier 1':           'red',
  'Tier 1 Allocated': 'red',
  'Allocated':        'red',
  'Tier 2':           'amber',
  'Worth Watching':   'amber',
}

const CATEGORY_ICONS = {
  Bourbon:  '🥃',
  Rye:      '🌾',
  Scotch:   '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Japanese: '🗾',
  Irish:    '☘️',
  American: '🇺🇸',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const divider = {
  borderBottom: '1px solid var(--hairline)',
  padding: 'var(--sp-4)',
}

const overline = {
  fontSize: 'var(--fs-overline)',
  fontWeight: 700,
  color: 'var(--text-dim)',
  textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-overline)',
  marginBottom: 'var(--sp-3)',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PremiumBar({ premium, max }) {
  const pct = Math.min(100, (premium / max) * 100)
  return (
    <div style={{ height: 4, background: 'var(--bg-elev-2)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: 'var(--grad-copper)',
        borderRadius: 2,
        transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

function BottleRow({ item, rank, onNavigate }) {
  const [pressed, setPressed] = useState(false)
  return (
    <div
      onClick={() => onNavigate(item.name)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        padding:        'var(--sp-3) 0',
        borderBottom:   '1px solid var(--hairline)',
        display:        'flex',
        alignItems:     'flex-start',
        gap:            'var(--sp-3)',
        cursor:         'pointer',
        transform:      pressed ? 'scale(0.98)' : 'scale(1)',
        transition:     'transform var(--t-fast) var(--ease-out)',
      }}
    >
      {rank != null && (
        <div style={{
          width:          28,
          flexShrink:     0,
          fontWeight:     800,
          fontSize:       'var(--fs-body)',
          color:          rank <= 3 ? 'var(--copper-400)' : 'var(--text-dim)',
          textAlign:      'right',
          paddingTop:     2,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {rank}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:     'var(--fs-body)',
          fontWeight:   700,
          color:        'var(--text-primary)',
          lineHeight:   1.3,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {item.name}
        </div>
        {item.distillery && (
          <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', marginTop: 2 }}>
            {item.distillery}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--green)', lineHeight: 1 }}>
          {fmt$(item.avg)}
        </div>
        {item.low != null && item.high != null && (
          <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', marginTop: 2 }}>
            {fmt$(item.low)}–{fmt$(item.high)}
          </div>
        )}
        {item.premium != null && (
          <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--copper-400)', marginTop: 2 }}>
            {fmtPct(item.premium)} vs MSRP
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketIndexPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('premiums') // 'premiums' | 'unicorns'

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  // Gate: market index is Pro-only
  if (status === 'authenticated' && !isPro(session?.user?.tier)) {
    return (
      <ProGate
        feature="The Market Index"
        icon="📊"
        bullets={[
          'Secondary market pricing for 100+ allocated bottles',
          'Premium-over-MSRP percentages and trend data',
          'Unicorn and top-tier bottle valuations',
        ]}
      />
    )
  }

  useEffect(() => {
    fetch('/api/market-index')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function navigateTo(name) {
    router.push(`/bottle/${encodeURIComponent(name)}`)
  }

  if (status === 'loading') return null

  const maxPremium = data?.topPremiums?.[0]?.premium ?? 1

  return (
    <div style={{
      minHeight:     '100dvh',
      background:    'var(--bg-base)',
      paddingBottom: 'calc(var(--tab-h) + env(safe-area-inset-bottom))',
    }}>

      {/* Sticky header */}
      <div style={{
        position:             'sticky',
        top:                  0,
        zIndex:               50,
        background:           'rgba(12,8,5,0.96)',
        borderBottom:         '1px solid var(--hairline-2)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding:              'var(--sp-3) var(--sp-4)',
        paddingTop:           'calc(var(--sp-3) + env(safe-area-inset-top))',
        display:              'flex',
        alignItems:           'center',
        gap:                  'var(--sp-3)',
      }}>
        <button
          onClick={() => router.back()}
          aria-label="Back"
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
          onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
          style={{
            background:   'none',
            border:       'none',
            color:        'var(--copper-400)',
            cursor:       'pointer',
            padding:      'var(--sp-1)',
            lineHeight:   1,
            display:      'grid',
            placeItems:   'center',
            borderRadius: 'var(--r-sm)',
            transition:   'transform var(--t-fast) var(--ease-out)',
          }}
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 800,
            fontSize:   'var(--fs-body)',
            color:      'var(--text-primary)',
            display:    'flex',
            alignItems: 'center',
            gap:        'var(--sp-2)',
          }}>
            <BarChart2 size={16} strokeWidth={2} color="var(--copper-400)" />
            Market Index
          </div>
          <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)' }}>
            {data ? `${data.total} bottles with secondary pricing` : 'Loading…'}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--fs-body)' }}>
          Loading market data…
        </div>
      ) : !data ? (
        <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--fs-body)' }}>
          Failed to load market data.
        </div>
      ) : (
        <>
          {/* Category grid */}
          <div style={{ ...divider }}>
            <div style={overline}>By Category</div>
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap:                 'var(--sp-2)',
            }}>
              {data.categories.map(cat => (
                <div
                  key={cat.name}
                  style={{
                    background:   'var(--bg-elev-1)',
                    border:       '1px solid var(--hairline-2)',
                    borderRadius: 'var(--r-md)',
                    padding:      'var(--sp-3)',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 'var(--sp-1)' }}>
                    {CATEGORY_ICONS[cat.name] ?? '🥃'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', marginBottom: 2 }}>
                    {cat.name}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-h2)', color: 'var(--green)', lineHeight: 1, marginBottom: 2 }}>
                    {fmt$(cat.avgSecondary)}
                  </div>
                  <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
                    avg secondary · {cat.count} bottles
                  </div>
                  {cat.premium > 0 && (
                    <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--copper-400)', marginTop: 'var(--sp-1)', fontWeight: 600 }}>
                      {fmtPct(cat.premium)} vs MSRP
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section toggle */}
          <div style={{ padding: 'var(--sp-3) var(--sp-4)', display: 'flex', gap: 'var(--sp-2)' }}>
            {[
              { key: 'premiums', icon: <TrendingUp size={13} strokeWidth={2} />, label: 'Top Premiums' },
              { key: 'unicorns', icon: '🦄',                                     label: 'Unicorn Prices' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
                style={{
                  flex:         1,
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  gap:          'var(--sp-1)',
                  padding:      'var(--sp-2) 0',
                  borderRadius: 'var(--r-md)',
                  border:       'none',
                  cursor:       'pointer',
                  background:   section === s.key ? 'var(--copper-500)' : 'var(--bg-elev-2)',
                  color:        section === s.key ? 'var(--text-inverse)' : 'var(--text-dim)',
                  fontWeight:   700,
                  fontSize:     'var(--fs-body)',
                  transition:   'background var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out)',
                }}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* Top Premiums */}
          {section === 'premiums' && (
            <div style={{ padding: '0 var(--sp-4)' }}>
              <div style={{ ...overline, marginTop: 'var(--sp-2)' }}>
                Highest secondary-to-MSRP premium
              </div>
              {data.topPremiums.map((item, i) => (
                <div key={item.name}>
                  <div
                    onClick={() => navigateTo(item.name)}
                    style={{
                      padding:    'var(--sp-3) 0',
                      borderBottom: i < data.topPremiums.length - 1 ? '1px solid var(--hairline)' : 'none',
                      display:    'flex',
                      alignItems: 'flex-start',
                      gap:        'var(--sp-3)',
                      cursor:     'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    {/* Rank */}
                    <div style={{
                      width:    28,
                      flexShrink: 0,
                      fontWeight: 800,
                      fontSize:   'var(--fs-body)',
                      color:      i < 3 ? 'var(--copper-400)' : 'var(--text-dim)',
                      textAlign:  'right',
                      paddingTop: 2,
                    }}>
                      {i + 1}
                    </div>

                    {/* Name + bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize:     'var(--fs-body)',
                        fontWeight:   700,
                        color:        'var(--text-primary)',
                        lineHeight:   1.3,
                        overflow:     'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace:   'nowrap',
                      }}>
                        {item.name}
                      </div>
                      {item.distillery && (
                        <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', marginTop: 2 }}>
                          {item.distillery}
                        </div>
                      )}
                      <PremiumBar premium={item.premium} max={maxPremium} />
                    </div>

                    {/* Prices */}
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--copper-400)', lineHeight: 1 }}>
                        {fmtPct(item.premium)}
                      </div>
                      <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', marginTop: 2 }}>
                        {fmt$(item.msrp)} → {fmt$(item.avg)}
                      </div>
                      {item.rarity && (
                        <div style={{ marginTop: 3 }}>
                          <Chip tone={RARITY_TONE[item.rarity] ?? 'neutral'} size="sm">{item.rarity}</Chip>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Unicorn Prices */}
          {section === 'unicorns' && (
            <div style={{ padding: '0 var(--sp-4)' }}>
              <div style={{ ...overline, marginTop: 'var(--sp-2)' }}>
                Unicorn bottles — avg secondary price
              </div>
              {data.unicorns.map((item, i) => (
                <BottleRow
                  key={item.name}
                  item={item}
                  rank={i + 1}
                  onNavigate={navigateTo}
                />
              ))}
            </div>
          )}

          {/* Footer note */}
          <div style={{
            padding:   'var(--sp-6) var(--sp-4) var(--sp-4)',
            fontSize:  'var(--fs-overline)',
            color:     'var(--text-dim)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            Prices are secondary market estimates based on our catalog.
            Live auction data from Unicorn Auctions is incorporated as sales are confirmed.
          </div>
        </>
      )}
    </div>
  )
}
