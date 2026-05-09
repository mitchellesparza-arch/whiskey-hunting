'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Link           from 'next/link'
import { ChevronLeft, RefreshCw, Check, Dices } from 'lucide-react'

import Button     from '../../components/ui/Button'
import Card       from '../../components/ui/Card'
import Chip       from '../../components/ui/Chip'
import EmptyState from '../../components/ui/EmptyState'

export default function PickMyPourPage() {
  const { data: session, status } = useSession()
  const router  = useRouter()

  const [bottles,   setBottles]   = useState([])
  const [loaded,    setLoaded]    = useState(false)
  const [phase,     setPhase]     = useState('idle')   // idle | spinning | result
  const [pick,      setPick]      = useState(null)
  const [spinLabel, setSpinLabel] = useState('')
  const spinRef = useRef(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status])

  useEffect(() => {
    fetch('/api/collection')
      .then(r => r.json())
      .then(d => setBottles((d.bottles ?? []).filter(b => (b.qty ?? 1) > 0)))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  function spin() {
    if (!bottles.length) return
    setPhase('spinning')
    setPick(null)

    // Cycle through names for 1100ms
    let i = 0
    spinRef.current = setInterval(() => {
      const idx = Math.floor(Math.random() * bottles.length)
      setSpinLabel(bottles[idx].name)
      i++
    }, 80)

    setTimeout(() => {
      clearInterval(spinRef.current)
      const chosen = bottles[Math.floor(Math.random() * bottles.length)]
      setPick(chosen)
      setSpinLabel(chosen.name)
      setPhase('result')
    }, 1100)
  }

  function reroll() {
    setPhase('idle')
    setPick(null)
  }

  async function logTasting() {
    if (!pick) return
    try {
      await fetch('/api/collection', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: pick.id, tastings: (pick.tastings ?? 0) + 1 }),
      })
    } catch {}
    router.push('/profile')
  }

  if (status === 'loading') return null

  const eligible = bottles.filter(b => (b.qty ?? 1) > 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>

      {/* Header */}
      <div style={{
        position:             'sticky',
        top:                  0,
        zIndex:               50,
        background:           'var(--bg-elev-1)',
        borderBottom:         '1px solid var(--hairline)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding:              'var(--sp-3) var(--sp-4)',
        display:              'flex',
        alignItems:           'center',
        gap:                  'var(--sp-3)',
      }}>
        <Link
          href="/profile"
          style={{
            color:          'var(--text-muted)',
            textDecoration: 'none',
            display:        'flex',
            alignItems:     'center',
            lineHeight:     1,
            transition:     'color var(--t-fast) var(--ease-out)',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <ChevronLeft size={20} strokeWidth={1.75} />
        </Link>
        <div>
          <div style={{
            fontWeight:    800,
            fontSize:      'var(--fs-body)',
            color:         'var(--text-primary)',
            display:       'flex',
            alignItems:    'center',
            gap:           'var(--sp-2)',
          }}>
            <Dices size={16} strokeWidth={1.75} color="var(--copper-400)" />
            Pick My Pour
          </div>
          <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)' }}>
            Random bottle picker
          </div>
        </div>
      </div>

      {/* Main content — centered */}
      <div style={{
        maxWidth:  480,
        margin:    '0 auto',
        padding:   'var(--sp-10) var(--sp-4)',
        textAlign: 'center',
      }}>

        {!loaded ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-meta)' }}>
            Loading your collection…
          </p>

        ) : eligible.length === 0 ? (
          <EmptyState
            icon="wine"
            title="Your collection is empty"
            body="Add some bottles to your collection first"
            ctaLabel="Go to My Collection"
            ctaHref="/profile/collection"
          />

        ) : phase === 'idle' ? (
          <div style={{ animation: 'fadeUp 0.3s var(--ease-out)' }}>
            <div style={{ fontSize: 52, marginBottom: 'var(--sp-4)' }}>🥃</div>
            <div style={{
              fontWeight:    800,
              fontSize:      'var(--fs-h2)',
              color:         'var(--text-primary)',
              marginBottom:  'var(--sp-2)',
              lineHeight:    'var(--lh-snug)',
            }}>
              Can&apos;t decide what to pour tonight?
            </div>
            <div style={{
              fontSize:     'var(--fs-meta)',
              color:        'var(--text-muted)',
              marginBottom: 'var(--sp-8)',
            }}>
              {eligible.length} bottle{eligible.length !== 1 ? 's' : ''} in your collection
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={<Dices size={18} strokeWidth={1.75} />}
              onClick={spin}
            >
              Pick for me
            </Button>
          </div>

        ) : phase === 'spinning' ? (
          <div>
            <div style={{ fontSize: 52, marginBottom: 'var(--sp-5)' }}>🎲</div>
            <div style={{
              fontWeight:     800,
              fontSize:       'var(--fs-h2)',
              color:          'var(--text-primary)',
              minHeight:      60,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              filter:         'blur(1.5px)',
              transition:     'all 0.08s',
              lineHeight:     1.3,
              padding:        '0 var(--sp-4)',
            }}>
              {spinLabel}
            </div>
          </div>

        ) : (
          // Result
          <div style={{ animation: 'scaleIn 0.3s var(--ease-out)' }}>
            <div style={{ fontSize: 52, marginBottom: 'var(--sp-4)' }}>🥃</div>

            <Card hover={false} style={{ marginBottom: 'var(--sp-5)', textAlign: 'center' }}>
              <div style={{
                fontSize:      'var(--fs-overline)',
                fontWeight:    700,
                color:         'var(--copper-400)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom:  'var(--sp-2)',
              }}>
                Tonight&apos;s Pour
              </div>

              <div style={{
                fontWeight:   800,
                fontSize:     'var(--fs-h1)',
                color:        'var(--text-primary)',
                lineHeight:   'var(--lh-snug)',
                marginBottom: 'var(--sp-2)',
              }}>
                {pick.name}
              </div>

              {pick.distillery && (
                <div style={{
                  fontSize:     'var(--fs-meta)',
                  color:        'var(--text-muted)',
                  marginBottom: 'var(--sp-3)',
                }}>
                  {pick.distillery}
                </div>
              )}

              <div style={{
                display:        'flex',
                justifyContent: 'center',
                gap:            'var(--sp-3)',
                flexWrap:       'wrap',
              }}>
                {pick.proof > 0 && (
                  <Chip tone="neutral" size="sm">{pick.proof}°</Chip>
                )}
                {pick.msrp > 0 && (
                  <Chip tone="neutral" size="sm">${pick.msrp}</Chip>
                )}
                {pick.tastings > 0 && (
                  <Chip tone="copper" size="sm">
                    Blind score: {(pick.blindScore ?? 75).toFixed(1)}
                  </Chip>
                )}
              </div>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                icon={<RefreshCw size={18} strokeWidth={1.75} />}
                onClick={spin}
              >
                Re-roll
              </Button>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                icon={<Check size={18} strokeWidth={1.75} />}
                onClick={logTasting}
              >
                Pour it — log this tasting
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
