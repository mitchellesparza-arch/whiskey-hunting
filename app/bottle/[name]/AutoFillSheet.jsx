'use client'
import { useEffect, useState } from 'react'
import { X, Sparkles, Loader } from 'lucide-react'
import Button from '../../components/ui/Button.jsx'

const CATEGORIES = ['Bourbon', 'Rye', 'Scotch', 'Irish', 'Japanese', 'Canadian', 'American', 'Tennessee Whiskey', 'Other']
const RARITIES   = ['Common', 'Worth Watching', 'Allocated', 'Unicorn']

const labelStyle = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-dim)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block',
}
const inputStyle = {
  width: '100%', padding: '9px 11px', background: 'var(--bg-elev-2)',
  border: '1px solid var(--hairline-2)', borderRadius: 8, color: 'var(--text-primary)',
  fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

function Field({ label, children }) {
  return <div style={{ flex: 1, minWidth: 0 }}><span style={labelStyle}>{label}</span>{children}</div>
}

/**
 * Pro "Auto-fill with AI" flow. Fetches a draft from /api/bottles/enrich, lets
 * the user review/edit every field, then saves it as an authoritative ('user')
 * record via /api/bottles/save. The review step is deliberate — AI guesses are
 * never persisted without a human confirming them.
 */
export default function AutoFillSheet({ bottleName, onClose, onSaved }) {
  const [phase, setPhase] = useState('loading')   // loading | review | saving | error
  const [error, setError] = useState(null)
  const [form,  setForm]  = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/bottles/enrich', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: bottleName }),
        })
        const d = await r.json()
        if (cancelled) return
        if (!r.ok) {
          setError(d.upgradeRequired ? 'AI auto-fill is a Pro feature.' : (d.error ?? 'Could not generate a draft.'))
          setPhase('error')
          return
        }
        const dr = d.draft ?? {}
        setForm({
          name:        dr.name ?? bottleName,
          distillery:  dr.distillery ?? '',
          category:    dr.category ?? '',
          proof:       dr.proof ?? '',
          age:         dr.age ?? '',
          msrp:        dr.msrp ?? '',
          releaseYear: dr.releaseYear ?? '',
          region:      dr.region ?? '',
          origin:      dr.origin ?? '',
          rarity:      dr.rarity ?? '',
          note:        dr.note ?? '',
          secLow:      dr.secondary?.low ?? '',
          secAvg:      dr.secondary?.avg ?? '',
          secHigh:     dr.secondary?.high ?? '',
        })
        setPhase('review')
      } catch {
        if (!cancelled) { setError('AI lookup failed — try again.'); setPhase('error') }
      }
    })()
    return () => { cancelled = true }
  }, [bottleName])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const num = v => (v === '' || v == null ? null : Number(v))

  async function handleSave() {
    setPhase('saving')
    try {
      const r = await fetch('/api/bottles/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        form.name.trim(),
          distillery:  form.distillery.trim() || null,
          category:    form.category || null,
          proof:       num(form.proof),
          age:         num(form.age),
          msrp:        num(form.msrp),
          releaseYear: num(form.releaseYear),
          region:      form.region.trim() || null,
          origin:      form.origin.trim() || null,
          rarity:      form.rarity || null,
          note:        form.note.trim() || null,
          secondary:   { low: num(form.secLow), avg: num(form.secAvg), high: num(form.secHigh) },
          source:      'user',
        }),
      })
      if (!r.ok) throw new Error('save failed')
      onSaved?.()
    } catch {
      setError('Save failed — try again.')
      setPhase('error')
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 540, maxHeight: '90dvh', overflowY: 'auto',
          background: 'var(--bg-base)', borderTopLeftRadius: 18, borderTopRightRadius: 18,
          border: '1px solid var(--hairline-2)', borderBottom: 'none',
          padding: 'var(--sp-4)', paddingBottom: 'calc(var(--sp-5) + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Sparkles size={18} color="var(--amber)" />
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
            Auto-fill with AI
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: 14 }}>
            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: 10 }}>Researching “{bottleName}”…</div>
          </div>
        )}

        {phase === 'error' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ color: 'var(--amber)', fontSize: 14, marginBottom: 16 }}>{error}</div>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        )}

        {form && (phase === 'review' || phase === 'saving') && (
          <>
            <div style={{
              fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic',
              background: 'rgba(245,184,58,0.06)', border: '1px solid rgba(245,184,58,0.2)',
              borderRadius: 8, padding: '8px 10px', marginBottom: 14,
            }}>
              ✨ AI-generated — please verify each field before saving. Your edits are stored as the source of truth.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Name">
                <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} />
              </Field>
              <Field label="Distillery">
                <input style={inputStyle} value={form.distillery} onChange={e => set('distillery', e.target.value)} />
              </Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <Field label="Category">
                  <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
                    <option value="">—</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Rarity">
                  <select style={inputStyle} value={form.rarity} onChange={e => set('rarity', e.target.value)}>
                    <option value="">—</option>
                    {RARITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Field label="Proof"><input type="number" style={inputStyle} value={form.proof} onChange={e => set('proof', e.target.value)} /></Field>
                <Field label="Age (yrs)"><input type="number" style={inputStyle} value={form.age} onChange={e => set('age', e.target.value)} /></Field>
                <Field label="MSRP ($)"><input type="number" style={inputStyle} value={form.msrp} onChange={e => set('msrp', e.target.value)} /></Field>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Field label="Region"><input style={inputStyle} value={form.region} onChange={e => set('region', e.target.value)} /></Field>
                <Field label="Origin"><input style={inputStyle} value={form.origin} onChange={e => set('origin', e.target.value)} /></Field>
                <Field label="Released"><input type="number" style={inputStyle} value={form.releaseYear} onChange={e => set('releaseYear', e.target.value)} /></Field>
              </div>
              <div>
                <span style={labelStyle}>Secondary market ($)</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Field label="Low"><input type="number" style={inputStyle} value={form.secLow} onChange={e => set('secLow', e.target.value)} /></Field>
                  <Field label="Avg"><input type="number" style={inputStyle} value={form.secAvg} onChange={e => set('secAvg', e.target.value)} /></Field>
                  <Field label="High"><input type="number" style={inputStyle} value={form.secHigh} onChange={e => set('secHigh', e.target.value)} /></Field>
                </div>
              </div>
              <Field label="Note">
                <textarea style={{ ...inputStyle, minHeight: 54, resize: 'vertical' }} value={form.note} onChange={e => set('note', e.target.value)} />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <Button variant="ghost" fullWidth onClick={onClose} disabled={phase === 'saving'}>Cancel</Button>
              <Button variant="primary" fullWidth onClick={handleSave} disabled={phase === 'saving' || !form.name.trim()}>
                {phase === 'saving' ? 'Saving…' : 'Save details'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
