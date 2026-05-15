'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Sheet from './ui/Sheet.jsx'
import SectionHeader from './ui/SectionHeader.jsx'
import Button from './ui/Button.jsx'

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export default function SettingsDrawer({ open, onClose }) {
  const { data: session } = useSession()
  const [displayName,   setDisplayName]   = useState('')
  const [discordHandle, setDiscordHandle] = useState('')
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [saveError,     setSaveError]     = useState(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        setDisplayName(d.profile?.name || session?.user?.name || '')
        setDiscordHandle(d.profile?.discordHandle || '')
      })
      .catch(() => { setDisplayName(session?.user?.name || '') })
  }, [open])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/profile', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: displayName, discordHandle }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setSaveError('Could not save — try again')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width:        '100%',
    padding:      'var(--sp-2) var(--sp-3)',
    background:   'var(--bg-base)',
    border:       '1px solid var(--hairline-2)',
    borderRadius: 'var(--r-md)',
    color:        'var(--text-primary)',
    fontSize:     'var(--fs-body)',
    fontFamily:   'inherit',
    outline:      'none',
    boxSizing:    'border-box',
    transition:   'border-color var(--t-fast) var(--ease-out)',
  }

  const labelStyle = {
    display:       'block',
    fontSize:      'var(--fs-overline)',
    fontWeight:    700,
    color:         'var(--text-muted)',
    marginBottom:  'var(--sp-1)',
    marginTop:     'var(--sp-4)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-overline)',
  }

  const prefRow = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        'var(--sp-3) 0',
    borderBottom:   '1px solid var(--hairline)',
  }

  return (
    <Sheet open={open} onClose={onClose} side title="Settings">

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      <SectionHeader overline="Profile" style={{ marginBottom: 'var(--sp-4)' }} />

      {/* Avatar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)' }}>
        <div style={{
          width:          52,
          height:         52,
          borderRadius:   '50%',
          background:     'var(--grad-copper)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontWeight:     800,
          fontSize:       18,
          color:          'var(--text-inverse)',
          flexShrink:     0,
          boxShadow:      'var(--shadow-2)',
        }}>
          {initials(displayName || session?.user?.name)}
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-h3)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {displayName || session?.user?.name || 'Your Name'}
          </div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 2 }}>
            {session?.user?.email}
          </div>
        </div>
      </div>

      <label style={labelStyle}>Display Name</label>
      <input
        style={inputStyle}
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        placeholder="How you appear in the app"
        onFocus={e => e.target.style.borderColor = 'var(--copper-500)'}
        onBlur={e  => e.target.style.borderColor = 'var(--hairline-2)'}
      />

      <label style={labelStyle}>Discord Handle</label>
      <input
        style={inputStyle}
        value={discordHandle}
        onChange={e => setDiscordHandle(e.target.value)}
        placeholder="e.g. whiskeydave#1234"
        onFocus={e => e.target.style.borderColor = 'var(--copper-500)'}
        onBlur={e  => e.target.style.borderColor = 'var(--hairline-2)'}
      />

      {saveError && (
        <p style={{ color: 'var(--red)', fontSize: 'var(--fs-meta)', margin: 'var(--sp-2) 0 0' }}>{saveError}</p>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        variant={saved ? 'secondary' : 'primary'}
        fullWidth
        style={{ marginTop: 'var(--sp-4)', background: saved ? 'rgba(93,211,158,0.15)' : undefined, color: saved ? 'var(--green)' : undefined }}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Profile'}
      </Button>

      <div style={{ borderTop: '1px solid var(--hairline)', margin: 'var(--sp-6) 0' }} />

      {/* ── Club ─────────────────────────────────────────────────────────── */}
      <SectionHeader overline="Club" style={{ marginBottom: 'var(--sp-3)' }} />

      <div style={{
        background:   'var(--bg-elev-3)',
        border:       '1px solid var(--hairline-2)',
        borderRadius: 'var(--r-md)',
        padding:      'var(--sp-3) var(--sp-4)',
      }}>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
          🥃 Tater Tracker
        </div>
        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>
          Chicagoland bourbon community
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--hairline)', margin: 'var(--sp-6) 0' }} />

      {/* ── App Preferences ──────────────────────────────────────────────── */}
      <SectionHeader overline="App Preferences" style={{ marginBottom: 'var(--sp-2)' }} />

      {[
        { label: 'Default tab on open',  value: 'Finds'    },
        { label: 'Truck check schedule', value: '6× daily' },
        { label: 'Find expiry',          value: '24 hours' },
        { label: 'Fresh badge threshold',value: '< 6h old' },
      ].map(({ label, value }) => (
        <div key={label} style={prefRow}>
          <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-2)' }}>{label}</span>
          <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>{value}</span>
        </div>
      ))}

      <div style={{ borderTop: '1px solid var(--hairline)', margin: 'var(--sp-6) 0' }} />

      {/* ── Account ──────────────────────────────────────────────────────── */}
      <SectionHeader overline="Account" style={{ marginBottom: 'var(--sp-4)' }} />

      <Button
        variant="danger"
        fullWidth
        onClick={() => signOut({ callbackUrl: '/login' })}
      >
        Sign Out
      </Button>

    </Sheet>
  )
}
