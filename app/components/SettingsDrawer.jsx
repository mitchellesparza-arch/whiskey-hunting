'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export default function SettingsDrawer({ open, onClose }) {
  const { data: session } = useSession()
  const [displayName,    setDisplayName]    = useState('')
  const [discordHandle,  setDiscordHandle]  = useState('')
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(false)
  const [saveError,      setSaveError]      = useState(null)

  // Load stored profile when drawer opens
  useEffect(() => {
    if (!open) return
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        setDisplayName(d.profile?.name || session?.user?.name || '')
        setDiscordHandle(d.profile?.discordHandle || '')
      })
      .catch(() => {
        setDisplayName(session?.user?.name || '')
      })
  }, [open])

  if (!open) return null

  const section = {
    fontWeight:     700,
    fontSize:       11,
    color:          '#9a7c55',
    textTransform:  'uppercase',
    letterSpacing:  '0.07em',
    padding:        '16px 16px 8px',
    borderBottom:   '1px solid #2a1c08',
  }

  const inputStyle = {
    width:        '100%',
    padding:      '8px 12px',
    background:   '#0f0a05',
    border:       '1px solid #3d2b10',
    borderRadius: 8,
    color:        '#f5e6cc',
    fontSize:     13,
    fontFamily:   'inherit',
    outline:      'none',
    boxSizing:    'border-box',
  }

  const labelStyle = {
    display:       'block',
    fontSize:      10,
    fontWeight:    700,
    color:         '#9a7c55',
    marginBottom:  4,
    marginTop:     12,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }

  const prefRow = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '9px 16px',
    borderBottom:   '1px solid #1f1308',
  }

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

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 149 }}
      />

      {/* Panel */}
      <div style={{
        position:     'fixed',
        top:          0,
        right:        0,
        bottom:       0,
        width:        'min(360px, 100vw)',
        background:   '#1a1008',
        borderLeft:   '1px solid #3d2b10',
        zIndex:       150,
        display:      'flex',
        flexDirection:'column',
        animation:    'slideLeft 0.25s ease',
        overflowY:    'auto',
      }}>

        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '14px 16px',
          borderBottom:   '1px solid #3d2b10',
          background:     '#1a1008',
          position:       'sticky',
          top:            0,
          zIndex:         1,
        }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#f5e6cc' }}>⚙️ Settings</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a7c55', fontSize: 20, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Section: Profile */}
        <div style={section}>Profile</div>

        <div style={{ padding: '16px' }}>
          {/* Avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width:        52,
              height:       52,
              borderRadius: '50%',
              background:   'linear-gradient(135deg, #e8943a, #b05a10)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              fontWeight:   800,
              fontSize:     18,
              color:        '#fff',
              flexShrink:   0,
            }}>
              {initials(displayName || session?.user?.name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f5e6cc' }}>
                {displayName || session?.user?.name || 'Your Name'}
              </div>
              <div style={{ fontSize: 12, color: '#9a7c55', marginTop: 2 }}>
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
          />

          <label style={labelStyle}>Discord Handle</label>
          <input
            style={inputStyle}
            value={discordHandle}
            onChange={e => setDiscordHandle(e.target.value)}
            placeholder="e.g. whiskeydave#1234"
          />

          {saveError && (
            <p style={{ color: '#f87171', fontSize: 12, margin: '8px 0 0' }}>{saveError}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              marginTop:    12,
              width:        '100%',
              padding:      '9px',
              background:   saved ? '#166534' : '#e8943a',
              border:       'none',
              borderRadius: 8,
              color:        '#fff',
              fontWeight:   700,
              fontSize:     13,
              cursor:       saving ? 'not-allowed' : 'pointer',
              opacity:      saving ? 0.7 : 1,
              transition:   'background 0.2s',
            }}
          >
            {saving ? '⏳ Saving…' : saved ? '✓ Saved' : 'Save Profile'}
          </button>
        </div>

        {/* Section: Club */}
        <div style={section}>Club</div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a1c08' }}>
          <div style={{
            background:   '#1f1308',
            border:       '1px solid #3d2b10',
            borderRadius: 10,
            padding:      '12px 14px',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f5e6cc', marginBottom: 4 }}>
              🥃 Jon and the Juice
            </div>
            <div style={{ fontSize: 12, color: '#9a7c55' }}>
              Chicagoland bourbon community
            </div>
          </div>
        </div>

        {/* Section: App Preferences */}
        <div style={section}>App Preferences</div>

        {[
          { label: 'Default tab on open', value: 'Finds'       },
          { label: 'Truck check schedule', value: '6× daily'   },
          { label: 'Find expiry',          value: '24 hours'   },
          { label: 'Fresh badge threshold',value: '< 6h old'   },
        ].map(({ label, value }) => (
          <div key={label} style={prefRow}>
            <span style={{ fontSize: 13, color: '#c9a87a' }}>{label}</span>
            <span style={{ fontSize: 12, color: '#6b5030' }}>{value}</span>
          </div>
        ))}

        {/* Section: Account */}
        <div style={section}>Account</div>

        <div style={{ padding: '16px' }}>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              width:        '100%',
              padding:      '10px',
              background:   'transparent',
              border:       '1px solid #f87171',
              borderRadius: 8,
              color:        '#f87171',
              fontWeight:   700,
              fontSize:     14,
              cursor:       'pointer',
            }}
          >
            Sign Out
          </button>
        </div>

        <div style={{ height: 'env(safe-area-inset-bottom)' }} />
      </div>
    </>
  )
}
