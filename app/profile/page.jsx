'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState } from 'react'
import Link           from 'next/link'
import { ShelvingUnit, Users, ListTodo, Dices, EyeOff, BarChart2 } from 'lucide-react'
import AppHeader      from '../components/AppHeader.jsx'
import StatTile       from '../components/ui/StatTile.jsx'
import Card           from '../components/ui/Card.jsx'
import { isPro }      from '../../lib/tier.js'

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

const TILES = [
  {
    Icon:     ShelvingUnit,
    title:    'My Collection',
    subtitle: 'Track your bottles with prices and scores',
    href:     '/profile/collection',
  },
  {
    Icon:     Users,
    title:    'Friends',
    subtitle: 'See the club, view collections, compare scores',
    href:     '/profile/friends',
  },
  {
    Icon:     ListTodo,
    title:    'Wishlist',
    subtitle: 'Track bottles you\'re hunting with rarity and price targets',
    href:     '/profile/wishlist',
  },
  {
    Icon:     Dices,
    title:    'Pick My Pour',
    subtitle: "Can't decide? Let the app choose",
    href:     '/profile/pour',
  },
  {
    Icon:     EyeOff,
    title:    'Battle of the Blinds',
    subtitle: 'Run a blind tasting and rank by ELO',
    href:     '/profile/blind',
  },
  {
    Icon:     BarChart2,
    title:    'Market Index',
    subtitle: 'Secondary market prices by category, top premiums, unicorn values',
    href:     '/market',
  },
]

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [collection,       setCollection]       = useState([])
  const [collectionLoaded, setCollectionLoaded] = useState(false)
  const [friendCount,      setFriendCount]      = useState(null)
  const [pendingRequests,  setPendingRequests]  = useState(0)
  const [muleBoard,        setMuleBoard]        = useState([])
  const [storedName,       setStoredName]       = useState(null)

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

    fetch('/api/friends')
      .then(r => r.json())
      .then(d => {
        setFriendCount((d.friends ?? []).length)
        setPendingRequests((d.requests ?? []).length)
      })
      .catch(() => {})

    fetch('/api/mule')
      .then(r => r.json())
      .then(d => setMuleBoard(d.leaderboard ?? []))
      .catch(() => {})

    fetch('/api/profile')
      .then(r => r.json())
      .then(d => { if (d.profile?.name) setStoredName(d.profile.name) })
      .catch(() => {})
  }, [])

  // Compute stats
  const totalBottles  = collection.reduce((s, b) => s + Number(b.qty ?? 1), 0)
  const totalTastings = collection.reduce((s, b) => s + (b.tastings ?? 0), 0)
  const estValue      = collection.reduce((s, b) => s + ((b.secondary ?? 0) * Number(b.qty ?? 1)), 0)
  const scoredBottles = collection.filter(b => b.blindScore != null)
  const topScore      = scoredBottles.length ? Math.max(...scoredBottles.map(b => b.blindScore)) : 0
  const topBottle     = scoredBottles.reduce((best, b) =>
    b.blindScore > (best?.blindScore ?? -1) ? b : best, null)

  const displayName = storedName ?? session?.user?.name ?? 'Member'

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
            background:     'var(--grad-copper)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontWeight:     800,
            fontSize:       22,
            color:          'var(--text-inverse)',
            flexShrink:     0,
          }}>
            {initials(displayName)}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {displayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Tater Tracker ·{' '}
                {session?.user?.tier === 'grandfathered' ? 'Grandfathered' :
                 isPro(session?.user?.tier) ? 'Pro' : 'Free'}
              </div>
              {isPro(session?.user?.tier) && session?.user?.tier !== 'grandfathered' && (
                <Link href="/upgrade" style={{
                  fontSize: 11, color: 'var(--text-dim)', textDecoration: 'none',
                  borderBottom: '1px solid var(--hairline-2)',
                }}>
                  manage
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <StatTile label="Bottles"   value={collectionLoaded ? totalBottles  : '—'} />
          <StatTile label="Friends"   value={friendCount !== null ? friendCount : '—'} />
          <StatTile label="Tastings"  value={collectionLoaded ? totalTastings : '—'} />
          <StatTile label="Top Score" value={collectionLoaded && topScore > 0 ? topScore.toFixed(0) : '—'} />
        </div>

        {/* Top Bottle Callout */}
        {collectionLoaded && topBottle && topBottle.tastings > 0 && (
          <div style={{
            background:   'linear-gradient(135deg, var(--copper-900) 0%, var(--bg-elev-2) 100%)',
            border:       '1px solid var(--copper-700)',
            borderRadius: 12,
            padding:      '14px 16px',
            marginBottom: 20,
            display:      'flex',
            alignItems:   'center',
            gap:          14,
          }}>
            <span style={{ fontSize: 28 }}>🏆</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--copper-400)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                Your Top Bottle
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{topBottle.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Blind score: {topBottle.blindScore?.toFixed(1)}
              </div>
            </div>
          </div>
        )}

        {/* Feature Tile Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {TILES.map(tile => {
            const isFriends = tile.title === 'Friends'
            const badge     = isFriends && pendingRequests > 0 ? pendingRequests : 0

            const content = (
              <Card
                hover={!!tile.href}
                style={{ height: '100%', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', ...(tile.href ? {} : { opacity: 0.5 }) }}
              >
                {/* Pending request badge on Friends tile */}
                {badge > 0 && (
                  <div style={{
                    position:     'absolute',
                    top:          10,
                    right:        10,
                    background:   'var(--red)',
                    color:        'var(--text-inverse)',
                    fontSize:     10,
                    fontWeight:   700,
                    borderRadius: 999,
                    padding:      '2px 7px',
                    lineHeight:   1.3,
                  }}>
                    {badge} new
                  </div>
                )}
                <tile.Icon size={28} strokeWidth={1.5} color="var(--copper-400)" />
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{tile.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{tile.subtitle}</div>
                {tile.href && (
                  <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--copper-400)', fontWeight: 600 }}>
                    Open →
                  </div>
                )}
                {!tile.href && (
                  <div style={{ marginTop: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>Coming soon</div>
                )}
              </Card>
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

        {/* Mule Scoreboard */}
        {muleBoard.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 'var(--fs-h3)', color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              🫏 Mule Scoreboard
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>— who&apos;s delivered the most samples</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {muleBoard.slice(0, 5).map(({ name, count }, i) => (
                <div key={name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-elev-2)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{name}</span>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: 'var(--copper-400)',
                    background: 'rgba(217,126,44,0.10)',
                    border: '1px solid rgba(217,126,44,0.25)',
                    borderRadius: 999, padding: '2px 10px',
                  }}>
                    {count} mule{count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
