'use client'
/**
 * Battle of the Blinds — Physical Glen Tasting System
 *
 * Flow:
 *  0. Intro
 *  1. Select bottles (2-5)
 *  2. Glen assignment — app tells user which bottle goes in each glen (numbered glass bottom)
 *  3. Shuffle — user mixes glens eyes-closed into positions A-E on the table
 *  4. Pairwise compare — app asks "Position A vs Position C" (user doesn't know which glen)
 *  5. Reveal — user flips each glass, enters glen number seen on the bottom
 *  6. Results — app resolves position→glen→bottle, computes ELO, shows ranking
 */

import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

// ── ELO ──────────────────────────────────────────────────────────────────────

function eloUpdate(aScore, bScore, result) {
  const K = 12
  const ea = 1 / (1 + Math.pow(10, (bScore - aScore) / 25))
  const aa = result === 'a' ? 1 : result === 'tie' ? 0.5 : 0
  return {
    newA: +Math.max(0, Math.min(100, aScore + K * (aa - ea))).toFixed(1),
    newB: +Math.max(0, Math.min(100, bScore + K * ((1 - aa) - (1 - ea)))).toFixed(1),
  }
}

function genPairs(n) {
  const p = []
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      p.push([i, j])
  return p
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const POS_LABELS = ['A', 'B', 'C', 'D', 'E']
const MEDALS     = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']

// ── Shared styles ─────────────────────────────────────────────────────────────

const accentBtn = {
  width: '100%', padding: '13px',
  background: '#e8943a', border: 'none', borderRadius: 10,
  color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer',
}

const grayBtn = {
  width: '100%', padding: '13px',
  background: '#1f1308', border: 'none', borderRadius: 10,
  color: '#6b5030', fontWeight: 800, fontSize: 15, cursor: 'not-allowed',
}

// ── Step 0 — Intro ────────────────────────────────────────────────────────────

function StepIntro({ onStart }) {
  const steps = [
    { n: '1', t: 'Mark your glens', d: 'Write 1–5 on the bottoms of your glasses with a dry-erase marker.' },
    { n: '2', t: 'Pour blind',      d: 'The app tells you which bottle goes in which glen. Pour each.' },
    { n: '3', t: 'Shuffle',         d: 'Slide the glasses around until you can\'t remember which is which.' },
    { n: '4', t: 'Taste & compare', d: 'The app presents position matchups. Pick your favorite, blind.' },
    { n: '5', t: 'Reveal',          d: 'Flip each glass, enter the glen number you see. The app decodes the results.' },
  ]

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px', animation: 'fadeUp 0.3s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🫣</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: '#f5e6cc', marginBottom: 8 }}>
          Battle of the Blinds
        </div>
        <div style={{ fontSize: 14, color: '#9a7c55', lineHeight: 1.6 }}>
          A physical blind tasting using the glen system — your glasses never know what&apos;s in them.
        </div>
      </div>

      <div className="card" style={{ padding: '16px', marginBottom: 20 }}>
        {steps.map(({ n, t, d }, i) => (
          <div key={n} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < steps.length - 1 ? '1px solid #1f1308' : 'none' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: '#e8943a', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 12, flexShrink: 0,
            }}>{n}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#f5e6cc', marginBottom: 2 }}>{t}</div>
              <div style={{ fontSize: 12, color: '#9a7c55', lineHeight: 1.5 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: '#1a1008', border: '1px solid #3d2b10', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9a7c55', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          ELO Score Guide
        </div>
        {[['90+','One of the best bottles you own'],['80–89','Reliably excellent'],['70–79','Solid, enjoyable'],['< 70','Fine, rarely your first pick']].map(([r, d]) => (
          <div key={r} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1f1308', gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#e8943a', flexShrink: 0 }}>{r}</span>
            <span style={{ fontSize: 12, color: '#9a7c55' }}>{d}</span>
          </div>
        ))}
      </div>

      <button onClick={onStart} style={accentBtn}>Set Up a Session →</button>
    </div>
  )
}

// ── Step 1 — Select Bottles ───────────────────────────────────────────────────

function StepSelect({ bottles, selected, onToggle, onNext }) {
  const eligible = bottles.filter(b => (b.qty ?? 1) > 0)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px', animation: 'fadeUp 0.2s ease' }}>
      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#f5e6cc' }}>Select Bottles</div>
        <div style={{ fontSize: 12, color: '#9a7c55', marginTop: 4 }}>
          Pick 2–5 · {selected.length >= 2 ? `${selected.length * (selected.length - 1) / 2} comparisons` : 'Need at least 2'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {eligible.map((bottle, i) => {
          const selIdx    = selected.indexOf(i)
          const isSelected = selIdx !== -1
          const glenNum   = isSelected ? selIdx + 1 : null
          const disabled  = !isSelected && selected.length >= 5

          return (
            <button
              key={bottle.id}
              onClick={() => !disabled && onToggle(i)}
              disabled={disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px',
                background: isSelected ? 'rgba(232,148,58,0.1)' : '#1a1008',
                border: `1px solid ${isSelected ? '#e8943a' : '#3d2b10'}`,
                borderRadius: 10,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                textAlign: 'left', width: '100%',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: isSelected ? '#e8943a' : '#1f1308',
                border: `1px solid ${isSelected ? '#e8943a' : '#2a1c08'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 14,
                color: isSelected ? '#fff' : '#6b5030', flexShrink: 0,
              }}>
                {isSelected ? `G${glenNum}` : '○'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#f5e6cc', marginBottom: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {bottle.name}
                </div>
                <div style={{ fontSize: 11, color: '#9a7c55' }}>
                  {bottle.blindScore != null ? `ELO ${bottle.blindScore.toFixed(1)}` : 'Unscored'}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={onNext}
        disabled={selected.length < 2}
        style={selected.length >= 2 ? accentBtn : grayBtn}
      >
        Start with {selected.length} bottle{selected.length !== 1 ? 's' : ''} →
      </button>
    </div>
  )
}

// ── Step 2 — Glen Assignment ──────────────────────────────────────────────────
// glenAssignment: array of bottleIdxs (index in eligible[]), glenAssignment[0] = glen 1, etc.

function StepGlenAssign({ bottles, glenAssignment, onReady }) {
  const n = glenAssignment.length

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px', animation: 'fadeUp 0.2s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#f5e6cc', marginBottom: 6 }}>
          🥃 Pour into Glens
        </div>
        <div style={{ fontSize: 13, color: '#9a7c55', lineHeight: 1.6 }}>
          Pour each bottle into the numbered glen below.<br />
          Do <strong style={{ color: '#f5e6cc' }}>not</strong> memorise the pairings — let the shuffle hide them.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {glenAssignment.map((bottleIdx, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 14px',
            background: 'rgba(232,148,58,0.06)',
            border: '1px solid rgba(232,148,58,0.2)',
            borderRadius: 10,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: '#e8943a', color: '#fff',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, lineHeight: 1, flexShrink: 0,
            }}>
              <div style={{ fontSize: 9, opacity: 0.8, letterSpacing: '0.05em' }}>GLEN</div>
              <div style={{ fontSize: 22 }}>{i + 1}</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#f5e6cc' }}>
                {bottles[bottleIdx]?.name}
              </div>
              <div style={{ fontSize: 11, color: '#9a7c55', marginTop: 2 }}>
                Pour this bottle into Glen {i + 1}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: '#1a0e04', border: '1px solid #4a3010', borderRadius: 10,
        padding: '12px 14px', marginBottom: 20, fontSize: 13, color: '#c9a87a', lineHeight: 1.5,
      }}>
        💡 Tip: Pour all {n} glasses, then slide them around until you can&apos;t remember which is which.
      </div>

      <button onClick={onReady} style={accentBtn}>
        ✓ I&apos;ve poured all {n} bottles →
      </button>
    </div>
  )
}

// ── Step 3 — Shuffle ──────────────────────────────────────────────────────────

function StepShuffle({ n, onDone }) {
  const posLabels = POS_LABELS.slice(0, n)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px', animation: 'fadeUp 0.2s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🔀</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#f5e6cc', marginBottom: 8 }}>
          Shuffle Your Glens
        </div>
        <div style={{ fontSize: 13, color: '#9a7c55', lineHeight: 1.7 }}>
          Slide the {n} glasses around until you can&apos;t remember which is which.
          Once they&apos;re shuffled, the glasses are now in positions:
        </div>
      </div>

      {/* Position labels visual */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
        {posLabels.map(p => (
          <div key={p} style={{
            width: 48, height: 48, borderRadius: 10,
            background: '#1f1308', border: '1px solid #3d2b10',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 22, color: '#e8943a',
          }}>{p}</div>
        ))}
      </div>

      <div style={{
        background: '#1a0e04', border: '1px solid #4a3010', borderRadius: 10,
        padding: '12px 14px', marginBottom: 24, fontSize: 13, color: '#c9a87a', lineHeight: 1.6,
      }}>
        👈 Left is A · Right is {posLabels[posLabels.length - 1]}<br />
        The glen numbers are now hidden on the bottom of each glass. You will not know which bottle is which until the reveal.
      </div>

      <button onClick={onDone} style={accentBtn}>
        ✓ I&apos;ve shuffled — Start Tasting →
      </button>
    </div>
  )
}

// ── Step 4 — Compare Positions ────────────────────────────────────────────────

function StepCompare({ n, pairs, pairIdx, onVote }) {
  const [ai, bi]  = pairs[pairIdx]
  const posA      = POS_LABELS[ai]
  const posB      = POS_LABELS[bi]
  const progress  = pairIdx / pairs.length

  const tapStyle = {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 8, padding: '28px 12px',
    background: '#1f1308', border: '2px solid #2a1c08',
    borderRadius: 12, cursor: 'pointer', outline: 'none',
    transition: 'all 0.12s',
  }

  function hover(e, on) {
    e.currentTarget.style.borderColor = on ? '#e8943a' : '#2a1c08'
    e.currentTarget.style.background  = on ? 'rgba(232,148,58,0.08)' : '#1f1308'
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px', animation: 'fadeUp 0.15s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#9a7c55', marginBottom: 6 }}>
          Comparison {pairIdx + 1} of {pairs.length}
        </div>
        <div style={{ height: 3, background: '#1f1308', borderRadius: 2, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: '#e8943a', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#f5e6cc' }}>Which do you prefer?</div>
        <div style={{ fontSize: 12, color: '#9a7c55', marginTop: 4 }}>
          You&apos;re comparing two glasses — you don&apos;t know which bottle is which.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button style={tapStyle} onClick={() => onVote('a')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#9a7c55', letterSpacing: '0.08em' }}>Position</div>
          <div style={{ fontWeight: 800, fontSize: 56, color: '#e8943a', lineHeight: 1 }}>{posA}</div>
          <div style={{ fontSize: 12, color: '#9a7c55' }}>Prefer this one</div>
        </button>
        <button style={tapStyle} onClick={() => onVote('b')} onMouseEnter={e => hover(e, true)} onMouseLeave={e => hover(e, false)}>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#9a7c55', letterSpacing: '0.08em' }}>Position</div>
          <div style={{ fontWeight: 800, fontSize: 56, color: '#e8943a', lineHeight: 1 }}>{posB}</div>
          <div style={{ fontSize: 12, color: '#9a7c55' }}>Prefer this one</div>
        </button>
      </div>

      <button
        onClick={() => onVote('tie')}
        style={{ width: '100%', background: 'none', border: 'none', color: '#9a7c55', cursor: 'pointer', fontSize: 13, padding: '8px 0' }}
      >
        🤝 Too close to call — tie
      </button>
    </div>
  )
}

// ── Step 5 — Reveal ───────────────────────────────────────────────────────────

function StepReveal({ n, posToGlen, onGlenChange, onSubmit }) {
  const posLabels = POS_LABELS.slice(0, n)
  const glenValues = Object.values(posToGlen).filter(Boolean).map(Number)
  const glenNums   = Array.from({ length: n }, (_, i) => i + 1)

  const isValid = posLabels.every(p => posToGlen[p]) &&
    glenNums.every(g => glenValues.includes(g)) &&
    new Set(glenValues).size === n

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px', animation: 'fadeUp 0.2s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>🔍</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#f5e6cc', marginBottom: 8 }}>
          Reveal the Glens
        </div>
        <div style={{ fontSize: 13, color: '#9a7c55', lineHeight: 1.6 }}>
          Flip each glass and read the number on the bottom.<br />
          Enter the glen number for each position.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {posLabels.map(pos => {
          const val      = posToGlen[pos] ?? ''
          const isDup    = val && glenValues.filter(v => v === Number(val)).length > 1

          return (
            <div key={pos} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 14px',
              background: '#1a1008', border: `1px solid ${isDup ? '#f87171' : '#3d2b10'}`,
              borderRadius: 10,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: '#1f1308', border: '1px solid #3d2b10',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <div style={{ fontSize: 9, color: '#9a7c55', letterSpacing: '0.05em' }}>POS</div>
                <div style={{ fontWeight: 800, fontSize: 22, color: '#e8943a', lineHeight: 1 }}>{pos}</div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#9a7c55', display: 'block', marginBottom: 4 }}>
                  Flip Position {pos} — enter the glen number:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {glenNums.map(g => (
                    <button
                      key={g}
                      onClick={() => onGlenChange(pos, String(g))}
                      style={{
                        width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontWeight: 800, fontSize: 15,
                        background: Number(val) === g ? '#e8943a' : '#1f1308',
                        color:      Number(val) === g ? '#fff'     : '#6b5030',
                        outline:    isDup && Number(val) === g ? '2px solid #f87171' : 'none',
                      }}
                    >{g}</button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!isValid && (
        <p style={{ color: '#f87171', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>
          Each glen number (1–{n}) must appear exactly once.
        </p>
      )}

      <button
        onClick={onSubmit}
        disabled={!isValid}
        style={isValid ? accentBtn : grayBtn}
      >
        🔓 Decode &amp; Show Results →
      </button>
    </div>
  )
}

// ── Step 6 — Results ──────────────────────────────────────────────────────────

function StepResults({ bottles, glenAssignment, ranked, onSave, saving }) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px', animation: 'fadeUp 0.3s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: '#f5e6cc' }}>Results</div>
        <div style={{ fontSize: 13, color: '#9a7c55', marginTop: 4 }}>
          Your honest preferences, decoded from the blind.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {ranked.map(({ bottle, glen, newScore, oldScore }, i) => {
          const delta = newScore - (oldScore ?? newScore)
          return (
            <div key={bottle.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              background:  i === 0 ? 'rgba(232,148,58,0.08)' : '#1a1008',
              border:      `1px solid ${i === 0 ? 'rgba(232,148,58,0.3)' : '#2a1c08'}`,
              borderRadius: 10,
              animation:   `fadeUp ${0.1 + i * 0.05}s ease`,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{MEDALS[i]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#f5e6cc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {bottle.name}
                </div>
                <div style={{ fontSize: 11, color: '#9a7c55', marginTop: 1 }}>Glen {glen}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#f5e6cc' }}>{newScore.toFixed(1)}</div>
                {oldScore != null && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: delta >= 0 ? '#4ade80' : '#f87171' }}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={onSave} disabled={saving} style={saving ? grayBtn : accentBtn}>
        {saving ? '⏳ Saving…' : '✓ Save scores to collection'}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PickMyBlindPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Collection
  const [bottles, setBottles] = useState([])
  const [loaded,  setLoaded]  = useState(false)

  // Session state
  const [step,          setStep]         = useState(0)
  const [selected,      setSelected]     = useState([])   // indices into eligible[]
  const [glenAssign,    setGlenAssign]   = useState([])   // [glen1bottleIdx, glen2bottleIdx, ...]
  const [pairs,         setPairs]        = useState([])   // [[posA, posB], ...] 0-indexed positions
  const [pairIdx,       setPairIdx]      = useState(0)
  const [posVotes,      setPosVotes]     = useState([])   // [{posA, posB, result}] per pair
  const [posToGlen,     setPosToGlen]    = useState({})   // { 'A': '3', 'B': '1', ... }
  const [ranked,        setRanked]       = useState([])
  const [finalScores,   setFinalScores]  = useState({})   // bottleId → newScore
  const [saving,        setSaving]       = useState(false)

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

  const eligible = bottles.filter(b => (b.qty ?? 1) > 0)
  const n        = selected.length

  function toggleBottle(idx) {
    setSelected(prev => {
      if (prev.includes(idx)) return prev.filter(i => i !== idx)
      if (prev.length >= 5)   return prev
      return [...prev, idx]
    })
  }

  function beginGlenSetup() {
    // Randomly assign bottles to glens
    const shuffledSelected = shuffle([...selected])
    setGlenAssign(shuffledSelected)  // glen 1 = shuffledSelected[0] (idx into eligible), etc.
    setPairs(genPairs(n))
    setPairIdx(0)
    setPosVotes([])
    setPosToGlen(Object.fromEntries(POS_LABELS.slice(0, n).map(p => [p, ''])))
    setStep(2)
  }

  function handleVote(result) {
    const [ai, bi] = pairs[pairIdx]
    setPosVotes(prev => [...prev, { posA: ai, posB: bi, result }])
    if (pairIdx + 1 >= pairs.length) {
      setStep(5)  // all comparisons done, go to reveal
    } else {
      setPairIdx(i => i + 1)
    }
  }

  function handleReveal() {
    // Build: positionIdx → glen number (1-based)
    const posIdxToGlen = {}
    for (const [pos, glen] of Object.entries(posToGlen)) {
      posIdxToGlen[POS_LABELS.indexOf(pos)] = Number(glen)
    }

    // glenAssign[g-1] = eligible[] index for glen g
    // posIdxToGlen[posIdx] = glen number at that position
    // So posIdx → eligible[] index = glenAssign[posIdxToGlen[posIdx] - 1]

    // Compute ELO
    const scores = {}  // eligible[] index → current score
    for (const idx of selected) {
      scores[idx] = eligible[idx]?.blindScore ?? 75
    }

    for (const { posA, posB, result } of posVotes) {
      const glenA   = posIdxToGlen[posA]
      const glenB   = posIdxToGlen[posB]
      const idxA    = glenAssign[glenA - 1]
      const idxB    = glenAssign[glenB - 1]
      const { newA, newB } = eloUpdate(scores[idxA], scores[idxB], result)
      scores[idxA] = newA
      scores[idxB] = newB
    }

    // Build ranked results
    const rankedList = selected.map(idx => {
      const glenNum = glenAssign.indexOf(idx) + 1  // 1-based glen number
      return {
        bottle:   eligible[idx],
        glen:     glenNum,
        oldScore: eligible[idx]?.blindScore ?? null,
        newScore: scores[idx],
      }
    }).sort((a, b) => b.newScore - a.newScore)

    const scoresById = {}
    for (const { bottle, newScore } of rankedList) {
      scoresById[bottle.id] = newScore
    }

    setRanked(rankedList)
    setFinalScores(scoresById)
    setStep(6)
  }

  async function saveAndFinish() {
    setSaving(true)
    try {
      await Promise.all(
        ranked.map(({ bottle, newScore }) =>
          fetch('/api/collection', {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
              id:         bottle.id,
              blindScore: newScore,
              tastings:   (bottle.tastings ?? 0) + 1,
            }),
          })
        )
      )
      router.push('/profile')
    } catch {}
    setSaving(false)
  }

  if (status === 'loading' || !loaded) return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#9a7c55', fontSize: 13 }}>Loading…</p>
    </div>
  )

  const stepLabels = ['Intro', 'Select', 'Glen Setup', 'Shuffle', 'Tasting', 'Reveal', 'Results']

  function handleBack() {
    if (step === 0) { router.push('/profile'); return }
    if (step <= 3) { setStep(s => s - 1); return }
    // Don't allow back during tasting (steps 4-6) — would break ELO integrity
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(15,10,5,0.95)', borderBottom: '1px solid #3d2b10',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={handleBack}
          style={{ background: 'none', border: 'none', color: '#9a7c55', cursor: 'pointer', fontSize: 20, lineHeight: 1, opacity: step >= 4 && step < 6 ? 0.3 : 1 }}
          disabled={step >= 4 && step < 6}
        >←</button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc' }}>🫣 Battle of the Blinds</div>
          <div style={{ fontSize: 11, color: '#9a7c55' }}>{stepLabels[step]}</div>
        </div>
        {/* Step dots */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          {[1,2,3,4,5,6].map(s => (
            <div key={s} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: step >= s ? '#e8943a' : '#2a1c08',
            }} />
          ))}
        </div>
      </div>

      {step === 0 && <StepIntro onStart={() => setStep(1)} />}

      {step === 1 && (
        <StepSelect
          bottles={eligible}
          selected={selected}
          onToggle={toggleBottle}
          onNext={beginGlenSetup}
        />
      )}

      {step === 2 && (
        <StepGlenAssign
          bottles={eligible}
          glenAssignment={glenAssign}
          onReady={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepShuffle
          n={n}
          onDone={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <StepCompare
          n={n}
          pairs={pairs}
          pairIdx={pairIdx}
          onVote={handleVote}
        />
      )}

      {step === 5 && (
        <StepReveal
          n={n}
          posToGlen={posToGlen}
          onGlenChange={(pos, glen) => setPosToGlen(prev => ({ ...prev, [pos]: glen }))}
          onSubmit={handleReveal}
        />
      )}

      {step === 6 && (
        <StepResults
          bottles={eligible}
          glenAssignment={glenAssign}
          ranked={ranked}
          onSave={saveAndFinish}
          saving={saving}
        />
      )}
    </div>
  )
}
