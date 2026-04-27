'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState } from 'react'
import Link           from 'next/link'

// ── ELO scoring ───────────────────────────────────────────────────────────────

function eloUpdate(aScore, bScore, result) {
  const K = 12
  const expectedA = 1 / (1 + Math.pow(10, (bScore - aScore) / 25))
  const actualA   = result === 'a' ? 1 : result === 'tie' ? 0.5 : 0
  return {
    newA: +Math.max(0, Math.min(100, aScore + K * (actualA - expectedA))).toFixed(1),
    newB: +Math.max(0, Math.min(100, bScore + K * ((1 - actualA) - (1 - expectedA)))).toFixed(1),
  }
}

function genPairs(n) {
  const pairs = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      pairs.push([i, j])
  return pairs
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const BLIND_LABELS = ['A', 'B', 'C', 'D', 'E']
const MEDALS       = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']

const scoreDesc = [
  { range: '90+',   desc: 'One of the best bottles you own'  },
  { range: '80–89', desc: 'Reliably excellent'               },
  { range: '70–79', desc: 'Solid, enjoyable'                 },
  { range: '< 70',  desc: 'Fine, but rarely your first pick' },
]

// ── Step 0 — Intro ─────────────────────────────────────────────────────────────

function StepIntro({ onStart }) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px', animation: 'fadeUp 0.3s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🫣</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: '#f5e6cc', marginBottom: 8 }}>
          Blind Tasting Rank
        </div>
        <div style={{ fontSize: 14, color: '#9a7c55', lineHeight: 1.6 }}>
          Select 2–5 bottles, pour them blind, and compare pairs.
          The app calculates your honest preference using ELO scoring.
        </div>
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#f5e6cc', marginBottom: 10 }}>
          Score Guide
        </div>
        {scoreDesc.map(({ range, desc }) => (
          <div key={range} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #1f1308', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#e8943a', flexShrink: 0 }}>{range}</span>
            <span style={{ fontSize: 12, color: '#9a7c55' }}>{desc}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        style={{
          width:        '100%',
          padding:      '14px',
          background:   '#e8943a',
          border:       'none',
          borderRadius: 10,
          color:        '#fff',
          fontWeight:   800,
          fontSize:     16,
          cursor:       'pointer',
        }}
      >
        Start a Session →
      </button>
    </div>
  )
}

// ── Step 1 — Select Bottles ───────────────────────────────────────────────────

function StepSelect({ bottles, selected, onToggle, onNext }) {
  const eligible = bottles.filter(b => (b.qty ?? 1) > 0)
  const selectedIdxInEligible = selected

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px', animation: 'fadeUp 0.2s ease' }}>
      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#f5e6cc' }}>Select Bottles</div>
        <div style={{ fontSize: 12, color: '#9a7c55', marginTop: 4 }}>
          Pick 2–5 · {selected.length > 0 && `${selected.length} selected · `}
          {selected.length >= 2 ? `${selected.length * (selected.length - 1) / 2} comparisons` : 'Need at least 2'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {eligible.map((bottle, i) => {
          const selIdx = selected.indexOf(i)
          const isSelected = selIdx !== -1
          const label = isSelected ? BLIND_LABELS[selIdx] : null
          const disabled = !isSelected && selected.length >= 5

          return (
            <button
              key={bottle.id}
              onClick={() => !disabled && onToggle(i)}
              disabled={disabled}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:            12,
                padding:        '12px 14px',
                background:     isSelected ? 'rgba(232,148,58,0.1)' : '#1a1008',
                border:         `1px solid ${isSelected ? '#e8943a' : '#3d2b10'}`,
                borderRadius:   10,
                cursor:         disabled ? 'not-allowed' : 'pointer',
                opacity:        disabled ? 0.4 : 1,
                textAlign:      'left',
                width:          '100%',
              }}
            >
              <div style={{
                width:          38,
                height:         38,
                borderRadius:   8,
                background:     isSelected ? '#e8943a' : '#1f1308',
                border:         `1px solid ${isSelected ? '#e8943a' : '#2a1c08'}`,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontWeight:     800,
                fontSize:       16,
                color:          isSelected ? '#fff' : '#6b5030',
                flexShrink:     0,
              }}>
                {isSelected ? label : '○'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#f5e6cc', marginBottom: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {bottle.name}
                </div>
                <div style={{ fontSize: 11, color: '#9a7c55' }}>
                  Score: {(bottle.blindScore ?? 75).toFixed(1)}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={onNext}
        disabled={selected.length < 2}
        style={{
          width:        '100%',
          padding:      '13px',
          background:   selected.length >= 2 ? '#e8943a' : '#1f1308',
          border:       'none',
          borderRadius: 10,
          color:        selected.length >= 2 ? '#fff' : '#6b5030',
          fontWeight:   800,
          fontSize:     15,
          cursor:       selected.length >= 2 ? 'pointer' : 'not-allowed',
        }}
      >
        Start ({selected.length} bottles) →
      </button>
    </div>
  )
}

// ── Step 2 — Blind Setup ──────────────────────────────────────────────────────

function StepSetup({ bottles, blindOrder, onStart }) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px', animation: 'fadeUp 0.2s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#f5e6cc', marginBottom: 6 }}>🫣 Blind Setup</div>
        <div style={{ fontSize: 13, color: '#9a7c55' }}>
          Pour these bottles in blind order. Don&apos;t peek at the labels!
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {blindOrder.map((bottleIdx, labelIdx) => (
          <div key={labelIdx} style={{
            display:     'flex',
            alignItems:  'center',
            gap:         14,
            padding:     '12px 14px',
            background:  'rgba(232,148,58,0.06)',
            border:      '1px solid rgba(232,148,58,0.2)',
            borderRadius:10,
          }}>
            <div style={{
              width:          38,
              height:         38,
              borderRadius:   8,
              background:     '#e8943a',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontWeight:     800,
              fontSize:       18,
              color:          '#fff',
              flexShrink:     0,
            }}>
              {BLIND_LABELS[labelIdx]}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#f5e6cc' }}>
              {bottles[bottleIdx]?.name}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        style={{
          width:        '100%',
          padding:      '13px',
          background:   '#e8943a',
          border:       'none',
          borderRadius: 10,
          color:        '#fff',
          fontWeight:   800,
          fontSize:     15,
          cursor:       'pointer',
        }}
      >
        I&apos;ve poured them blind — Start Tasting →
      </button>
    </div>
  )
}

// ── Step 3 — Comparisons ──────────────────────────────────────────────────────

function StepCompare({ bottles, pairs, blindOrder, pairIdx, onVote }) {
  const [ai, bi] = pairs[pairIdx]
  const bottleA  = bottles[blindOrder[ai]]
  const bottleB  = bottles[blindOrder[bi]]
  const labelA   = BLIND_LABELS[ai]
  const labelB   = BLIND_LABELS[bi]
  const progress = pairIdx / pairs.length

  const tapStyle = (letter) => ({
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            8,
    padding:        '28px 16px',
    background:     '#1f1308',
    border:         '2px solid #2a1c08',
    borderRadius:   12,
    cursor:         'pointer',
    transition:     'all 0.15s',
    outline:        'none',
  })

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px', animation: 'fadeUp 0.15s ease' }}>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#9a7c55', marginBottom: 6 }}>
          Comparison {pairIdx + 1} of {pairs.length}
        </div>
        {/* Progress bar */}
        <div style={{ height: 3, background: '#1f1308', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: '#e8943a', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#f5e6cc' }}>
          Which do you prefer?
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          style={tapStyle(labelA)}
          onClick={() => onVote('a')}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#e8943a'; e.currentTarget.style.background = 'rgba(232,148,58,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a1c08'; e.currentTarget.style.background = '#1f1308' }}
        >
          <div style={{ fontWeight: 800, fontSize: 48, color: '#e8943a', lineHeight: 1 }}>{labelA}</div>
          <div style={{ fontSize: 12, color: '#9a7c55' }}>Prefer {labelA}</div>
        </button>
        <button
          style={tapStyle(labelB)}
          onClick={() => onVote('b')}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#e8943a'; e.currentTarget.style.background = 'rgba(232,148,58,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a1c08'; e.currentTarget.style.background = '#1f1308' }}
        >
          <div style={{ fontWeight: 800, fontSize: 48, color: '#e8943a', lineHeight: 1 }}>{labelB}</div>
          <div style={{ fontSize: 12, color: '#9a7c55' }}>Prefer {labelB}</div>
        </button>
      </div>

      <button
        onClick={() => onVote('tie')}
        style={{
          width:      '100%',
          background: 'none',
          border:     'none',
          color:      '#9a7c55',
          cursor:     'pointer',
          fontSize:   13,
          padding:    '8px 0',
        }}
      >
        Too close to call — tie
      </button>
    </div>
  )
}

// ── Step 4 — Results ──────────────────────────────────────────────────────────

function StepResults({ bottles, blindOrder, finalScores, onSave, saving }) {
  const [revealed, setRevealed] = useState(false)

  // Rank by final score descending
  const ranked = blindOrder
    .map((bottleIdx, labelIdx) => ({
      bottle:    bottles[bottleIdx],
      label:     BLIND_LABELS[labelIdx],
      oldScore:  bottles[bottleIdx]?.blindScore ?? 75,
      newScore:  finalScores[bottleIdx] ?? bottles[bottleIdx]?.blindScore ?? 75,
    }))
    .sort((a, b) => b.newScore - a.newScore)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px', animation: 'fadeUp 0.3s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: '#f5e6cc' }}>Blind session complete!</div>
        <div style={{ fontSize: 13, color: '#9a7c55', marginTop: 6 }}>
          {revealed ? 'Your honest preferences, ranked' : "Tap to reveal which bottle is which"}
        </div>
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
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
            marginBottom: 16,
          }}
        >
          🫣 Reveal the bottles →
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {ranked.map(({ bottle, label, oldScore, newScore }, i) => {
              const delta = newScore - oldScore
              return (
                <div key={bottle.id} style={{
                  display:     'flex',
                  alignItems:  'center',
                  gap:         12,
                  padding:     '12px 14px',
                  background:  i === 0 ? 'rgba(232,148,58,0.08)' : '#1a1008',
                  border:      `1px solid ${i === 0 ? 'rgba(232,148,58,0.3)' : '#2a1c08'}`,
                  borderRadius:10,
                  animation:   `fadeUp ${0.1 + i * 0.05}s ease`,
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{MEDALS[i]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#f5e6cc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {bottle.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9a7c55', marginTop: 1 }}>
                      Glass {label}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#f5e6cc' }}>{newScore.toFixed(1)}</div>
                    <div style={{
                      fontSize:   11,
                      fontWeight: 600,
                      color:      delta >= 0 ? '#4ade80' : '#f87171',
                    }}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            style={{
              width:        '100%',
              padding:      '13px',
              background:   saving ? '#3d2b10' : '#e8943a',
              border:       'none',
              borderRadius: 10,
              color:        saving ? '#9a7c55' : '#fff',
              fontWeight:   800,
              fontSize:     15,
              cursor:       saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '⏳ Saving…' : '✓ Save scores & finish'}
          </button>
        </>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PickMyBlindPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [bottles,    setBottles]    = useState([])
  const [loaded,     setLoaded]     = useState(false)
  const [step,       setStep]       = useState(0)
  const [selected,   setSelected]   = useState([])   // indices into eligible
  const [blindOrder, setBlindOrder] = useState([])   // shuffled selected indices
  const [pairs,      setPairs]      = useState([])
  const [pairIdx,    setPairIdx]    = useState(0)
  const [votes,      setVotes]      = useState({})   // "${ai}-${bi}" → 'a'|'b'|'tie'
  const [finalScores,setFinalScores]= useState({})   // bottleIdx → newScore
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
  }, [status])

  useEffect(() => {
    fetch('/api/collection')
      .then(r => r.json())
      .then(d => setBottles(d.bottles ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  function toggleBottle(idx) {
    setSelected(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx)
      if (prev.length >= 5) return prev
      return [...prev, idx]
    })
  }

  function startSetup() {
    const shuffled = shuffle([...Array(selected.length).keys()])
    setBlindOrder(shuffled)   // shuffled[labelIdx] → index into selected
    setPairs(genPairs(selected.length))
    setPairIdx(0)
    setVotes({})
    setStep(2)
  }

  function startCompare() {
    setStep(3)
  }

  function handleVote(result) {
    const [ai, bi] = pairs[pairIdx]
    const key      = `${ai}-${bi}`

    // Work from current running scores (start with original blindScores)
    const running = { ...finalScores }
    for (const idx of selected) {
      if (running[idx] === undefined) running[idx] = bottles[idx]?.blindScore ?? 75
    }

    const idxA = selected[blindOrder[ai]]
    const idxB = selected[blindOrder[bi]]
    const { newA, newB } = eloUpdate(running[idxA], running[idxB], result)

    running[idxA] = newA
    running[idxB] = newB

    setFinalScores(running)
    setVotes(prev => ({ ...prev, [key]: result }))

    if (pairIdx + 1 >= pairs.length) {
      setStep(4)
    } else {
      setPairIdx(i => i + 1)
    }
  }

  async function saveAndFinish() {
    setSaving(true)
    try {
      const promises = Object.entries(finalScores).map(([idxStr, newScore]) => {
        const bottle = bottles[Number(idxStr)]
        if (!bottle) return Promise.resolve()
        return fetch('/api/collection', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            id:         bottle.id,
            blindScore: newScore,
            tastings:   (bottle.tastings ?? 0) + 1,
          }),
        })
      })
      await Promise.all(promises)
      router.push('/profile')
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || !loaded) return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9a7c55', fontSize: 13 }}>Loading…</p>
    </div>
  )

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
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : router.push('/profile')}
          style={{ background: 'none', border: 'none', color: '#9a7c55', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
        >
          ←
        </button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc' }}>🫣 Pick My Blind</div>
          <div style={{ fontSize: 11, color: '#9a7c55' }}>
            {['Intro', 'Select Bottles', 'Blind Setup', 'Tasting', 'Results'][step]}
          </div>
        </div>
      </div>

      {/* Step content */}
      {step === 0 && (
        <StepIntro onStart={() => setStep(1)} />
      )}

      {step === 1 && (
        <StepSelect
          bottles={eligible}
          selected={selected}
          onToggle={toggleBottle}
          onNext={startSetup}
        />
      )}

      {step === 2 && (
        <StepSetup
          bottles={eligible}
          blindOrder={blindOrder}
          onStart={startCompare}
        />
      )}

      {step === 3 && (
        <StepCompare
          bottles={eligible}
          pairs={pairs}
          blindOrder={blindOrder}
          pairIdx={pairIdx}
          onVote={handleVote}
        />
      )}

      {step === 4 && (
        <StepResults
          bottles={eligible}
          blindOrder={blindOrder}
          finalScores={finalScores}
          onSave={saveAndFinish}
          saving={saving}
        />
      )}
    </div>
  )
}
