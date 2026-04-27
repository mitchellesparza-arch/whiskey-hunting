'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Link           from 'next/link'

export default function PickMyPourPage() {
  const { data: session, status } = useSession()
  const router  = useRouter()

  const [bottles,  setBottles]  = useState([])
  const [loaded,   setLoaded]   = useState(false)
  const [phase,    setPhase]    = useState('idle')   // idle | spinning | result
  const [pick,     setPick]     = useState(null)
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
        background:           'rgba(15,10,5,0.95)',
        borderBottom:         '1px solid #3d2b10',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding:              '11px 16px',
        display:              'flex',
        alignItems:           'center',
        gap:                  12,
      }}>
        <Link href="/profile" style={{ color: '#9a7c55', textDecoration: 'none', fontSize: 20, lineHeight: 1 }}>←</Link>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc' }}>🎲 Pick My Pour</div>
          <div style={{ fontSize: 11, color: '#9a7c55' }}>Random bottle picker</div>
        </div>
      </div>

      {/* Main content — centered */}
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>

        {!loaded ? (
          <p style={{ color: '#9a7c55', fontSize: 13 }}>Loading your collection…</p>
        ) : eligible.length === 0 ? (
          <div>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🥃</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#f5e6cc', marginBottom: 10 }}>
              Your collection is empty
            </div>
            <div style={{ fontSize: 14, color: '#9a7c55', marginBottom: 24 }}>
              Add some bottles to your collection first
            </div>
            <Link href="/profile/collection" style={{
              display:      'inline-block',
              padding:      '10px 24px',
              background:   '#e8943a',
              borderRadius: 8,
              color:        '#fff',
              fontWeight:   700,
              textDecoration:'none',
              fontSize:     14,
            }}>
              Go to My Collection →
            </Link>
          </div>
        ) : phase === 'idle' ? (
          <div style={{ animation: 'fadeUp 0.3s ease' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🥃</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: '#f5e6cc', marginBottom: 8 }}>
              Can&apos;t decide what to pour tonight?
            </div>
            <div style={{ fontSize: 14, color: '#9a7c55', marginBottom: 32 }}>
              {eligible.length} bottle{eligible.length !== 1 ? 's' : ''} in your collection
            </div>
            <button
              onClick={spin}
              style={{
                width:        '100%',
                padding:      '14px',
                background:   '#e8943a',
                border:       'none',
                borderRadius: 10,
                color:        '#fff',
                fontWeight:   800,
                fontSize:     17,
                cursor:       'pointer',
                letterSpacing:'-0.01em',
              }}
            >
              🎲 Pick for me
            </button>
          </div>

        ) : phase === 'spinning' ? (
          <div>
            <div style={{ fontSize: 52, marginBottom: 20 }}>🎲</div>
            <div style={{
              fontWeight:  800,
              fontSize:    20,
              color:       '#f5e6cc',
              minHeight:   60,
              display:     'flex',
              alignItems:  'center',
              justifyContent:'center',
              filter:      'blur(1.5px)',
              transition:  'all 0.08s',
              lineHeight:  1.3,
              padding:     '0 16px',
            }}>
              {spinLabel}
            </div>
          </div>

        ) : (
          // Result
          <div style={{ animation: 'scaleIn 0.3s ease' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🥃</div>

            <div style={{
              fontSize:      10,
              fontWeight:    700,
              color:         '#e8943a',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom:  8,
            }}>
              Tonight&apos;s Pour
            </div>

            <div style={{ fontWeight: 800, fontSize: 24, color: '#f5e6cc', lineHeight: 1.2, marginBottom: 6 }}>
              {pick.name}
            </div>

            {pick.distillery && (
              <div style={{ fontSize: 13, color: '#9a7c55', marginBottom: 12 }}>
                {pick.distillery}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              {pick.proof > 0 && (
                <span style={{ fontSize: 12, color: '#c9a87a' }}>{pick.proof}°</span>
              )}
              {pick.msrp > 0 && (
                <span style={{ fontSize: 12, color: '#c9a87a' }}>${pick.msrp}</span>
              )}
              {pick.tastings > 0 && (
                <span style={{
                  fontSize:     12,
                  color:        '#e8943a',
                  background:   'rgba(232,148,58,0.12)',
                  border:       '1px solid rgba(232,148,58,0.25)',
                  borderRadius: 999,
                  padding:      '2px 10px',
                }}>
                  Blind score: {(pick.blindScore ?? 75).toFixed(1)}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={spin}
                style={{
                  width:        '100%',
                  padding:      '13px',
                  background:   '#e8943a',
                  border:       'none',
                  borderRadius: 10,
                  color:        '#fff',
                  fontWeight:   800,
                  fontSize:     16,
                  cursor:       'pointer',
                }}
              >
                ↺ Re-roll
              </button>
              <button
                onClick={logTasting}
                style={{
                  width:        '100%',
                  padding:      '13px',
                  background:   'transparent',
                  border:       '1px solid #3d2b10',
                  borderRadius: 10,
                  color:        '#c9a87a',
                  fontWeight:   700,
                  fontSize:     14,
                  cursor:       'pointer',
                }}
              >
                ✓ Pour it — log this tasting
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
