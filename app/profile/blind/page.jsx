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
import { useEffect, useState } from 'react'
import {
  ChevronLeft, Check, RefreshCw, Trophy,
  Shuffle, Eye, Flame, Award, Handshake,
  Lightbulb, ArrowRight, Loader,
} from 'lucide-react'

import Button       from '../../components/ui/Button'
import Card         from '../../components/ui/Card'
import EmptyState   from '../../components/ui/EmptyState'
import StatTile     from '../../components/ui/StatTile'
import SectionHeader from '../../components/ui/SectionHeader'

// ── ELO ──────────────────────────────────────────────────────────────────────
// CRITICAL: do not touch any of the ELO / matchmaking logic below

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

// ── Constants ─────────────────────────────────────────────────────────────────

const POS_LABELS = ['A', 'B', 'C', 'D', 'E']

// rank medal emoji — pure content, not UI icon
const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']

// ── Press-state helpers ───────────────────────────────────────────────────────

function pressHandlers(scale = 0.97) {
  return {
    onMouseDown:  e => { e.currentTarget.style.transform = `scale(${scale})` },
    onMouseUp:    e => { e.currentTarget.style.transform = 'scale(1)' },
    onMouseLeave: e => { e.currentTarget.style.transform = 'scale(1)' },
    onTouchStart: e => { e.currentTarget.style.transform = `scale(${scale})` },
    onTouchEnd:   e => { e.currentTarget.style.transform = 'scale(1)' },
  }
}

// ── Step 0 — Intro ────────────────────────────────────────────────────────────

function StepIntro({ onStart }) {
  const steps = [
    { n: '1', t: 'Mark your glens',   d: 'Write 1–5 on the bottoms of your glasses with a dry-erase marker.' },
    { n: '2', t: 'Pour blind',         d: 'The app tells you which bottle goes in which glen. Pour each.' },
    { n: '3', t: 'Shuffle',            d: "Slide the glasses around until you can't remember which is which." },
    { n: '4', t: 'Taste & compare',    d: 'The app presents position matchups. Pick your favorite, blind.' },
    { n: '5', t: 'Reveal',             d: 'Flip each glass, enter the glen number you see. The app decodes the results.' },
  ]

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-8) var(--sp-4)', animation: 'fadeUp 0.3s var(--ease-out)' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-7)' }}>
        <div style={{ fontSize: 52, marginBottom: 'var(--sp-3)', lineHeight: 1 }}>🙈</div>
        <h1 style={{
          margin: 0,
          fontSize: 'var(--fs-h1)',
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: 'var(--sp-2)',
        }}>
          Battle of the Blinds
        </h1>
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-muted)', lineHeight: 'var(--lh-body)' }}>
          A whiskey matchmaking system that rates your bottles without any tater influence.
        </p>
      </div>

      {/* Steps card */}
      <Card hover={false} style={{ marginBottom: 'var(--sp-5)' }}>
        {steps.map(({ n, t, d }, i) => (
          <div key={n} style={{
            display: 'flex',
            gap: 'var(--sp-3)',
            padding: 'var(--sp-3) 0',
            borderBottom: i < steps.length - 1 ? '1px solid var(--hairline)' : 'none',
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 'var(--r-pill)',
              background: 'var(--copper-500)',
              color: 'var(--text-inverse)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 'var(--fs-overline)', flexShrink: 0,
            }}>{n}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', marginBottom: 'var(--sp-1)' }}>{t}</div>
              <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', lineHeight: 'var(--lh-body)' }}>{d}</div>
            </div>
          </div>
        ))}
      </Card>

      {/* ELO guide */}
      <div style={{
        background: 'var(--bg-elev-1)',
        border: '1px solid var(--hairline-2)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-3) var(--sp-4)',
        marginBottom: 'var(--sp-5)',
      }}>
        <p style={{
          margin: '0 0 var(--sp-2)',
          fontSize: 'var(--fs-overline)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-overline)',
          color: 'var(--text-muted)',
        }}>ELO Score Guide</p>
        {[
          ['90+',   'One of the best bottles you own'],
          ['80–89', 'Reliably excellent'],
          ['70–79', 'Solid, enjoyable'],
          ['< 70',  'Fine, rarely your first pick'],
        ].map(([r, d]) => (
          <div key={r} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: 'var(--sp-1) 0',
            borderBottom: '1px solid var(--hairline)',
            gap: 'var(--sp-3)',
          }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-meta)', color: 'var(--copper-500)', flexShrink: 0 }}>{r}</span>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', textAlign: 'right' }}>{d}</span>
          </div>
        ))}
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        iconRight={<ArrowRight size={18} strokeWidth={1.75} />}
        onClick={onStart}
      >
        Set Up a Session
      </Button>
    </div>
  )
}

// ── Step 1 — Select Bottles ───────────────────────────────────────────────────

function StepSelect({ bottles, selected, onToggle, onNext }) {
  const eligible = bottles.filter(b => (b.qty ?? 1) > 0)
  const comparisons = selected.length >= 2 ? selected.length * (selected.length - 1) / 2 : 0

  if (!eligible.length) {
    return (
      <div style={{ padding: 'var(--sp-8) var(--sp-4)' }}>
        <EmptyState
          icon="Shuffle"
          title="Add bottles to your collection first"
          body="You need at least 2 bottles with quantity > 0 to run a blind tasting."
          ctaLabel="Go to Collection"
          ctaHref="/profile"
        />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-4)', animation: 'fadeUp 0.2s var(--ease-out)' }}>
      <SectionHeader
        overline={selected.length >= 2 ? `${comparisons} comparison${comparisons !== 1 ? 's' : ''}` : 'Need at least 2'}
        title="Select Bottles"
        style={{ marginBottom: 'var(--sp-4)' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
        {eligible.map((bottle, i) => {
          const selIdx     = selected.indexOf(i)
          const isSelected = selIdx !== -1
          const glenNum    = isSelected ? selIdx + 1 : null
          const disabled   = !isSelected && selected.length >= 5

          return (
            <button
              key={bottle.id}
              onClick={() => !disabled && onToggle(i)}
              disabled={disabled}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                padding: 'var(--sp-3) var(--sp-4)',
                background: isSelected ? 'rgba(217,126,44,0.10)' : 'var(--bg-elev-2)',
                border: `1px solid ${isSelected ? 'var(--copper-500)' : 'var(--hairline-2)'}`,
                borderRadius: 'var(--r-md)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                textAlign: 'left', width: '100%',
                transition: `background var(--t-base) var(--ease-out), border-color var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-spring)`,
              }}
              {...(!disabled ? pressHandlers(0.98) : {})}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--r-sm)',
                background: isSelected ? 'var(--copper-500)' : 'var(--bg-elev-3)',
                border: `1px solid ${isSelected ? 'var(--copper-500)' : 'var(--hairline-2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 'var(--fs-meta)',
                color: isSelected ? 'var(--text-inverse)' : 'var(--text-dim)', flexShrink: 0,
                transition: 'background var(--t-base) var(--ease-out)',
              }}>
                {isSelected ? `G${glenNum}` : '○'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)',
                  marginBottom: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
                }}>
                  {bottle.name}
                </div>
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
                  {bottle.blindScore != null
                    ? <span style={{ color: 'var(--copper-500)', fontWeight: 700 }}>ELO {bottle.blindScore.toFixed(1)}</span>
                    : <span>Unscored</span>}
                </div>
              </div>
              {isSelected && <Check size={18} strokeWidth={1.75} color="var(--copper-500)" />}
            </button>
          )
        })}
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={selected.length < 2}
        iconRight={<ArrowRight size={18} strokeWidth={1.75} />}
        onClick={onNext}
      >
        Start with {selected.length} bottle{selected.length !== 1 ? 's' : ''}
      </Button>
    </div>
  )
}

// ── Step 2 — Glen Assignment ──────────────────────────────────────────────────

function StepGlenAssign({ bottles, glenAssignment, onReady }) {
  const n = glenAssignment.length

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-8) var(--sp-4)', animation: 'fadeUp 0.2s var(--ease-out)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-5)' }}>
        <div style={{ fontSize: 52, marginBottom: 'var(--sp-3)', lineHeight: 1 }}>🥃</div>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>
          Pour into Glens
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-muted)', lineHeight: 'var(--lh-body)' }}>
          Pour each bottle into the numbered glen below.<br />
          Do <strong style={{ color: 'var(--text-primary)' }}>not</strong> memorise the pairings — let the shuffle hide them.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        {glenAssignment.map((bottleIdx, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
            padding: 'var(--sp-3) var(--sp-4)',
            background: 'rgba(217,126,44,0.06)',
            border: '1px solid rgba(217,126,44,0.2)',
            borderRadius: 'var(--r-md)',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 'var(--r-md)',
              background: 'var(--copper-500)',
              color: 'var(--text-inverse)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, lineHeight: 1, flexShrink: 0,
            }}>
              <span style={{ fontSize: 'var(--fs-overline)', opacity: 0.8, letterSpacing: '0.05em' }}>GLEN</span>
              <span style={{ fontSize: 'var(--fs-h2)', lineHeight: 1.1 }}>{i + 1}</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>
                {bottles[bottleIdx]?.name}
              </div>
              <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
                Pour this bottle into Glen {i + 1}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start',
        background: 'var(--bg-elev-1)',
        border: '1px solid var(--hairline-2)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-3) var(--sp-4)',
        marginBottom: 'var(--sp-5)',
      }}>
        <Lightbulb size={18} strokeWidth={1.75} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 'var(--lh-body)' }}>
          Pour all {n} glasses, then slide them around until you can&apos;t remember which is which.
        </p>
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        icon={<Check size={18} strokeWidth={1.75} />}
        onClick={onReady}
      >
        I&apos;ve poured all {n} bottles
      </Button>
    </div>
  )
}

// ── Step 3 — Shuffle ──────────────────────────────────────────────────────────

function StepShuffle({ n, onDone }) {
  const posLabels = POS_LABELS.slice(0, n)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-8) var(--sp-4)', animation: 'fadeUp 0.2s var(--ease-out)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
        <div style={{
          width: 72, height: 72,
          borderRadius: 'var(--r-xl)',
          background: 'var(--bg-elev-3)',
          border: '1px solid var(--hairline-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto var(--sp-4)',
          boxShadow: 'var(--shadow-2)',
        }}>
          <Shuffle size={32} strokeWidth={1.75} color="var(--copper-400)" />
        </div>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>
          Shuffle Your Glens
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-muted)', lineHeight: 'var(--lh-body)' }}>
          Slide the {n} glasses around until you can&apos;t remember which is which.
          Once shuffled, the glasses are in positions:
        </p>
      </div>

      {/* Position labels visual */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        {posLabels.map(p => (
          <div key={p} style={{
            width: 52, height: 52, borderRadius: 'var(--r-md)',
            background: 'var(--bg-elev-3)',
            border: '1px solid var(--hairline-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 'var(--fs-h2)', color: 'var(--copper-500)',
            boxShadow: 'var(--shadow-1)',
          }}>{p}</div>
        ))}
      </div>

      <div style={{
        display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start',
        background: 'var(--bg-elev-1)',
        border: '1px solid var(--hairline-2)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-3) var(--sp-4)',
        marginBottom: 'var(--sp-5)',
      }}>
        <Lightbulb size={18} strokeWidth={1.75} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-2)', lineHeight: 'var(--lh-body)' }}>
          Left is A · Right is {posLabels[posLabels.length - 1]}.
          The glen numbers are now hidden on the bottom of each glass.
        </p>
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        icon={<Check size={18} strokeWidth={1.75} />}
        onClick={onDone}
      >
        I&apos;ve shuffled — Start Tasting
      </Button>
    </div>
  )
}

// ── Step 4 — Compare Positions ────────────────────────────────────────────────

function StepCompare({ pairs, pairIdx, onVote }) {
  const [ai, bi] = pairs[pairIdx]
  const posA     = POS_LABELS[ai]
  const posB     = POS_LABELS[bi]
  const progress = pairIdx / pairs.length

  function ChoiceCard({ pos, side }) {
    return (
      <button
        onClick={() => onVote(side)}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          padding: 'var(--sp-7) var(--sp-3)',
          background: 'var(--bg-elev-3)',
          border: '2px solid var(--hairline-2)',
          borderRadius: 'var(--r-xl)',
          cursor: 'pointer',
          outline: 'none',
          transition: `border-color var(--t-base) var(--ease-out), background var(--t-base) var(--ease-out), box-shadow var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-spring)`,
          boxShadow: 'var(--shadow-1)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--copper-500)'
          e.currentTarget.style.background  = 'var(--bg-elev-4)'
          e.currentTarget.style.boxShadow   = 'var(--shadow-glow)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--hairline-2)'
          e.currentTarget.style.background  = 'var(--bg-elev-3)'
          e.currentTarget.style.boxShadow   = 'var(--shadow-1)'
          e.currentTarget.style.transform   = 'scale(1)'
        }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
        onMouseUp={e   => { e.currentTarget.style.transform = 'scale(1)' }}
        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
        onTouchEnd={e   => { e.currentTarget.style.transform = 'scale(1)'; onVote(side) }}
      >
        <span style={{
          fontSize: 'var(--fs-overline)',
          fontWeight: 700,
          letterSpacing: 'var(--tracking-overline)',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>Position</span>
        <span style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontWeight: 600,
          fontSize: 72,
          color: 'var(--copper-500)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}>{pos}</span>
        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>Prefer this one</span>
      </button>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-4)', animation: 'fadeUp 0.15s var(--ease-out)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
        <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
          Comparison {pairIdx + 1} of {pairs.length}
        </span>
        {/* Progress bar */}
        <div style={{
          height: 3, background: 'var(--bg-elev-3)', borderRadius: 'var(--r-pill)',
          overflow: 'hidden', margin: 'var(--sp-2) 0 var(--sp-4)',
        }}>
          <div style={{
            height: '100%',
            width: `${progress * 100}%`,
            background: 'var(--grad-copper)',
            borderRadius: 'var(--r-pill)',
            transition: 'width var(--t-slow) var(--ease-out)',
          }} />
        </div>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--text-primary)' }}>
          Which do you prefer?
        </h2>
        <p style={{ margin: 'var(--sp-1) 0 0', fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
          You&apos;re comparing two glasses — you don&apos;t know which bottle is which.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <ChoiceCard pos={posA} side="a" />
        <ChoiceCard pos={posB} side="b" />
      </div>

      <Button
        variant="ghost"
        size="md"
        fullWidth
        icon={<Handshake size={18} strokeWidth={1.75} />}
        onClick={() => onVote('tie')}
      >
        Too close to call — tie
      </Button>
    </div>
  )
}

// ── Step 5 — Reveal ───────────────────────────────────────────────────────────

function StepReveal({ n, posToGlen, onGlenChange, onSubmit }) {
  const posLabels  = POS_LABELS.slice(0, n)
  const glenValues = Object.values(posToGlen).filter(Boolean).map(Number)
  const glenNums   = Array.from({ length: n }, (_, i) => i + 1)

  const isValid = posLabels.every(p => posToGlen[p]) &&
    glenNums.every(g => glenValues.includes(g)) &&
    new Set(glenValues).size === n

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-8) var(--sp-4)', animation: 'fadeUp 0.2s var(--ease-out)' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-5)' }}>
        <div style={{
          width: 72, height: 72,
          borderRadius: 'var(--r-xl)',
          background: 'var(--bg-elev-3)',
          border: '1px solid var(--hairline-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto var(--sp-4)',
          boxShadow: 'var(--shadow-2)',
        }}>
          <Eye size={32} strokeWidth={1.75} color="var(--copper-400)" />
        </div>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>
          Reveal the Glens
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-muted)', lineHeight: 'var(--lh-body)' }}>
          Flip each glass and read the number on the bottom.<br />
          Enter the glen number for each position.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
        {posLabels.map(pos => {
          const val   = posToGlen[pos] ?? ''
          const isDup = val && glenValues.filter(v => v === Number(val)).length > 1

          return (
            <div key={pos} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
              padding: 'var(--sp-3) var(--sp-4)',
              background: 'var(--bg-elev-2)',
              border: `1px solid ${isDup ? 'var(--red)' : 'var(--hairline-2)'}`,
              borderRadius: 'var(--r-md)',
              transition: 'border-color var(--t-base) var(--ease-out)',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--r-md)',
                background: 'var(--bg-elev-3)',
                border: '1px solid var(--hairline-2)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>POS</span>
                <span style={{ fontWeight: 800, fontSize: 'var(--fs-h2)', color: 'var(--copper-500)', lineHeight: 1 }}>{pos}</span>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--sp-2)' }}>
                  Flip Position {pos} — enter the glen number:
                </label>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  {glenNums.map(g => (
                    <button
                      key={g}
                      onClick={() => onGlenChange(pos, String(g))}
                      style={{
                        width: 38, height: 38,
                        borderRadius: 'var(--r-sm)',
                        border: Number(val) === g ? '2px solid var(--copper-500)' : '1px solid var(--hairline-2)',
                        cursor: 'pointer',
                        fontWeight: 800, fontSize: 'var(--fs-body)',
                        background: Number(val) === g ? 'var(--copper-500)' : 'var(--bg-elev-3)',
                        color:      Number(val) === g ? 'var(--text-inverse)' : 'var(--text-dim)',
                        outline:    isDup && Number(val) === g ? '2px solid var(--red)' : 'none',
                        transition: `background var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-spring)`,
                      }}
                      {...pressHandlers(0.92)}
                    >{g}</button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!isValid && (
        <p style={{
          color: 'var(--red)',
          fontSize: 'var(--fs-meta)',
          textAlign: 'center',
          marginBottom: 'var(--sp-3)',
        }}>
          Each glen number (1–{n}) must appear exactly once.
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!isValid}
        icon={<RefreshCw size={18} strokeWidth={1.75} />}
        onClick={onSubmit}
      >
        Decode &amp; Show Results
      </Button>
    </div>
  )
}

// ── Step 6 — Results ──────────────────────────────────────────────────────────

function StepResults({ ranked, onSave, saving }) {
  const winner = ranked[0]

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--sp-8) var(--sp-4)', animation: 'fadeUp 0.3s var(--ease-out)' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
        <div style={{
          width: 72, height: 72,
          borderRadius: 'var(--r-xl)',
          background: 'var(--bg-elev-3)',
          border: '1px solid var(--hairline-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto var(--sp-4)',
          boxShadow: 'var(--shadow-glow)',
        }}>
          <Trophy size={32} strokeWidth={1.75} color="var(--copper-400)" />
        </div>
        <h2 style={{ margin: 0, fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>
          Results
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-muted)' }}>
          Your honest preferences, decoded from the blind.
        </p>
      </div>

      {/* Winner stat tiles */}
      {winner && (
        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
          <StatTile
            label="Winner ELO"
            value={winner.newScore.toFixed(1)}
            delta={winner.oldScore != null ? `${winner.newScore - winner.oldScore >= 0 ? '+' : ''}${(winner.newScore - winner.oldScore).toFixed(1)}` : undefined}
            deltaPositive={winner.oldScore != null ? winner.newScore >= winner.oldScore : true}
          />
          <StatTile
            label="Tastings"
            value={ranked.length}
          />
        </div>
      )}

      <SectionHeader overline="Rankings" style={{ marginBottom: 'var(--sp-3)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-6)' }}>
        {ranked.map(({ bottle, glen, newScore, oldScore }, i) => {
          const delta    = newScore - (oldScore ?? newScore)
          const isWinner = i === 0

          return (
            <div key={bottle.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
              padding: 'var(--sp-3) var(--sp-4)',
              background:  isWinner
                ? 'linear-gradient(135deg, rgba(217,126,44,0.12) 0%, rgba(217,126,44,0.04) 100%)'
                : 'var(--bg-elev-2)',
              border: `1px solid ${isWinner ? 'var(--copper-500)' : 'var(--hairline-2)'}`,
              borderRadius: 'var(--r-lg)',
              boxShadow:   isWinner ? 'var(--shadow-glow)' : 'var(--shadow-1)',
              transition:  `opacity var(--t-base) var(--ease-out)`,
              animation:   `fadeUp ${0.1 + i * 0.06}s var(--ease-out) both`,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{MEDALS[i]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)',
                  textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
                }}>
                  {bottle.name}
                </div>
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)' }}>
                  Glen {glen}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontWeight: 600,
                  fontSize: 'var(--fs-h2)',
                  color: 'var(--copper-500)',
                  lineHeight: 1,
                }}>
                  {newScore.toFixed(1)}
                </div>
                {oldScore != null && (
                  <div style={{
                    fontSize: 'var(--fs-overline)', fontWeight: 600, marginTop: 'var(--sp-1)',
                    color: delta >= 0 ? 'var(--green)' : 'var(--red)',
                  }}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={saving}
        icon={saving
          ? <Loader size={18} strokeWidth={1.75} style={{ animation: 'spin 1s linear infinite' }} />
          : <Check size={18} strokeWidth={1.75} />}
        onClick={onSave}
      >
        {saving ? 'Saving…' : 'Save scores to collection'}
      </Button>
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
  const [step,        setStep]       = useState(0)
  const [selected,    setSelected]   = useState([])   // indices into eligible[]
  const [glenAssign,  setGlenAssign] = useState([])   // [glen1bottleIdx, glen2bottleIdx, ...]
  const [pairs,       setPairs]      = useState([])   // [[posA, posB], ...] 0-indexed positions
  const [pairIdx,     setPairIdx]    = useState(0)
  const [posVotes,    setPosVotes]   = useState([])   // [{posA, posB, result}] per pair
  const [posToGlen,   setPosToGlen]  = useState({})   // { 'A': '3', 'B': '1', ... }
  const [ranked,      setRanked]     = useState([])
  const [saving,      setSaving]     = useState(false)

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

    setRanked(rankedList)
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
    <div className="min-h-screen" style={{
      background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-3)',
    }}>
      <Loader size={18} strokeWidth={1.75} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-body)' }}>Loading…</span>
    </div>
  )

  const stepLabels = ['Intro', 'Select', 'Glen Setup', 'Shuffle', 'Tasting', 'Reveal', 'Results']
  const canGoBack  = step <= 3

  function handleBack() {
    if (step === 0) { router.push('/profile'); return }
    if (canGoBack)  { setStep(s => s - 1); return }
    // Don't allow back during tasting (steps 4-6) — would break ELO integrity
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(var(--bg-base-rgb, 15,10,5), 0.92)',
        borderBottom: '1px solid var(--hairline-2)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        padding: 'var(--sp-3) var(--sp-4)',
        display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      }}>
        <button
          onClick={handleBack}
          disabled={!canGoBack && step !== 0}
          style={{
            background: 'none', border: 'none',
            color: 'var(--text-muted)',
            cursor: canGoBack || step === 0 ? 'pointer' : 'not-allowed',
            opacity: !canGoBack && step !== 0 ? 0.3 : 1,
            display: 'flex', alignItems: 'center', padding: 'var(--sp-1)',
            borderRadius: 'var(--r-sm)',
            transition: 'opacity var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-spring)',
          }}
          {...(canGoBack || step === 0 ? pressHandlers(0.9) : {})}
        >
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>
            🙈 Battle of the Blinds
          </div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>{stepLabels[step]}</div>
        </div>

        {/* Step progress dots */}
        <div style={{ display: 'flex', gap: 'var(--sp-1)', alignItems: 'center' }}>
          {[1, 2, 3, 4, 5, 6].map(s => (
            <div key={s} style={{
              width: s === step ? 16 : 6,
              height: 6,
              borderRadius: 'var(--r-pill)',
              background: step >= s ? 'var(--copper-500)' : 'var(--bg-elev-3)',
              transition: `width var(--t-base) var(--ease-spring), background var(--t-base) var(--ease-out)`,
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

      {/* Spin keyframe for loader */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
