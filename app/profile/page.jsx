'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState } from 'react'
import Link           from 'next/link'
import AppHeader      from '../components/AppHeader.jsx'

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function StatBox({ label, value }) {
  return (
    <div style={{
      flex:         1,
      textAlign:    'center',
      padding:      '14px 8px',
      background:   '#1f1308',
      borderRadius: 10,
      border:       '1px solid #2a1c08',
    }}>
      <div style={{ fontWeight: 800, fontSize: 22, color: '#f5e6cc', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#9a7c55', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

const TILES = [
  {
    icon:     '📦',
    title:    'My Collection',
    subtitle: 'Track your bottles with prices and scores',
    href:     '/profile/collection',
  },
  {
    icon:     '🎲',
    title:    'Pick My Pour',
    subtitle: "Can't decide? Let the app choose",
    href:     '/profile/pour',
  },
  {
    icon:     '🫣',
    title:    'Pick My Blind',
    subtitle: 'Run a blind tasting and rank by ELO',
    href:     '/profile/blind',
  },
  {
    icon:     '📊',
    title:    'Taste Scores',
    subtitle: 'Coming soon',
    href:     null,
  },
]

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [collection,    setCollection]    = useState([])
  const [collectionLoaded, setCollectionLoaded] = useState(false)
  const [joinDate,      setJoinDate]      = useState(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.approved === false) router.replace('/pending')
  }, [status, session])

  useEffect(() => {
    fetch('/api/collection')
      .then(r => r.json())
      .then(d => setCollection(d.bottles ?? []))
      .catch(() => {})
      .finally(() => setCollectionLoaded(true))
  }, [])

  // Compute stats
  const totalBottles  = collection.reduce((s, b) => s + (b.qty ?? 1), 0)
  const totalTastings = collection.reduce((s, b) => s + (b.tastings ?? 0), 0)
  const estValue      = collection.reduce((s, b) => s + ((b.secondary ?? 0) * (b.qty ?? 1)), 0)
  const topScore      = collection.length ? Math.max(...collection.map(b => b.blindScore ?? 75)) : 0
  const topBottle     = collection.reduce((best, b) =>
    (b.blindScore ?? 75) > (best?.blindScore ?? 0) ? b : best, null)

  const displayName = session?.user?.name ?? 'Member'

  if (status === 'loading') return null

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader sub="Your Collection & Tastings" />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>

        {/* Profile Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{
            width:          60,
            height:         60,
            borderRadius:   '50%',
            background:     'linear-gradient(135deg, #e8943a, #b05a10)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontWeight:     800,
            fontSize:       22,
            color:          '#fff',
            flexShrink:     0,
          }}>
            {initials(displayName)}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#f5e6cc', lineHeight: 1.2 }}>
              {displayName}
            </div>
            <div style={{ fontSize: 12, color: '#9a7c55', marginTop: 3 }}>
              Jon and the Juice · Member
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <StatBox label="Bottles"   value={collectionLoaded ? totalBottles  : '—'} />
          <StatBox label="Tastings"  value={collectionLoaded ? totalTastings : '—'} />
          <StatBox label="Est. Value" value={collectionLoaded ? (estValue > 0 ? `$${Math.round(estValue).toLocaleString()}` : '$0') : '—'} />
          <StatBox label="Top Score" value={collectionLoaded && topScore > 0 ? topScore.toFixed(0) : '—'} />
        </div>

        {/* Top Bottle Callout */}
        {collectionLoaded && topBottle && topBottle.tastings > 0 && (
          <div style={{
            background:   'linear-gradient(135deg, #2a1505 0%, #1a1008 100%)',
            border:       '1px solid #7c3a0a',
            borderRadius: 12,
            padding:      '14px 16px',
            marginBottom: 20,
            display:      'flex',
            alignItems:   'center',
            gap:          14,
          }}>
            <span style={{ fontSize: 28 }}>🏆</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#e8943a', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                Your Top Bottle
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc' }}>{topBottle.name}</div>
              <div style={{ fontSize: 12, color: '#9a7c55', marginTop: 2 }}>
                Blind score: {topBottle.blindScore?.toFixed(1)}
              </div>
            </div>
          </div>
        )}

        {/* Feature Tile Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {TILES.map(tile => {
            const content = (
              <div style={{
                background:   '#1a1008',
                border:       '1px solid #3d2b10',
                borderRadius: 12,
                padding:      '18px 16px',
                height:       '100%',
                display:      'flex',
                flexDirection:'column',
                gap:          6,
                cursor:       tile.href ? 'pointer' : 'default',
                opacity:      tile.href ? 1 : 0.5,
                transition:   'border-color 0.15s',
              }}
              onMouseEnter={e => { if (tile.href) e.currentTarget.style.borderColor = '#e8943a' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#3d2b10' }}
              >
                <div style={{ fontSize: 30 }}>{tile.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#f5e6cc' }}>{tile.title}</div>
                <div style={{ fontSize: 12, color: '#9a7c55', lineHeight: 1.4 }}>{tile.subtitle}</div>
                {tile.href && (
                  <div style={{ marginTop: 'auto', fontSize: 12, color: '#e8943a', fontWeight: 600 }}>
                    Open →
                  </div>
                )}
                {!tile.href && (
                  <div style={{ marginTop: 'auto', fontSize: 11, color: '#6b5030' }}>Coming soon</div>
                )}
              </div>
            )

            return tile.href ? (
              <Link key={tile.title} href={tile.href} style={{ textDecoration: 'none' }}>
                {content}
              </Link>
            ) : (
              <div key={tile.title}>{content}</div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
