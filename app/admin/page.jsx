'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import AppHeader from '../components/AppHeader.jsx'

function Avatar({ name }) {
  const initials = name
    ? name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
    : '?'
  return (
    <div style={{
      width:          40,
      height:         40,
      borderRadius:   '50%',
      background:     'linear-gradient(135deg, #3d1f6b, #6b35b8)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontWeight:     800,
      fontSize:       14,
      color:          '#fff',
      flexShrink:     0,
    }}>
      {initials}
    </div>
  )
}

function timeAgo(iso) {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (mins < 60)   return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [pending,   setPending]   = useState([])
  const [approved,  setApproved]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [approving, setApproving] = useState(null) // email being approved
  const [tab,       setTab]       = useState('pending')

  // Redirect non-owners
  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status === 'authenticated' && session?.user?.approved === false) { router.replace('/pending'); return }
  }, [status, session])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (res.status === 401) { router.replace('/profile'); return }
      const data = await res.json()
      setPending((data.pending ?? []).sort((a, b) =>
        new Date(b.requestedAt ?? 0) - new Date(a.requestedAt ?? 0)
      ))
      setApproved((data.approved ?? []).sort())
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (status === 'authenticated') load()
  }, [status, load])

  async function approve(email) {
    setApproving(email)
    try {
      await fetch('/api/admin/approve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      await load()
    } finally {
      setApproving(null)
    }
  }

  if (status === 'loading' || loading) return null

  const tabStyle = active => ({
    padding:       '8px 18px',
    borderRadius:  8,
    fontSize:      13,
    fontWeight:    700,
    cursor:        'pointer',
    border:        'none',
    background:    active ? '#e8943a' : 'transparent',
    color:         active ? '#fff'    : '#9a7c55',
    transition:    'background 0.15s, color 0.15s',
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader sub="Access Control" />

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#1a1008', borderRadius: 10, padding: 4 }}>
          <button style={tabStyle(tab === 'pending')}  onClick={() => setTab('pending')}>
            Pending
            {pending.length > 0 && (
              <span style={{ marginLeft: 6, background: '#f87171', color: '#fff', borderRadius: 999,
                             fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
                {pending.length}
              </span>
            )}
          </button>
          <button style={tabStyle(tab === 'approved')} onClick={() => setTab('approved')}>
            Approved ({approved.length})
          </button>
        </div>

        {/* Pending tab */}
        {tab === 'pending' && (
          pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b5030', fontSize: 14 }}>
              🎉 No pending requests
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map(u => (
                <div key={u.email} style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          14,
                  background:   '#1a1008',
                  border:       '1px solid #3d2b10',
                  borderRadius: 12,
                  padding:      '14px 16px',
                }}>
                  <Avatar name={u.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#f5e6cc',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name ?? u.email}
                    </div>
                    <div style={{ fontSize: 12, color: '#9a7c55', marginTop: 2,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.email}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b5030', marginTop: 2 }}>
                      Requested {timeAgo(u.requestedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => approve(u.email)}
                    disabled={approving === u.email}
                    style={{
                      padding:      '9px 18px',
                      background:   approving === u.email ? '#1f3a25' : 'linear-gradient(135deg,#166534,#15803d)',
                      color:        '#fff',
                      border:       'none',
                      borderRadius: 8,
                      fontWeight:   700,
                      fontSize:     13,
                      cursor:       approving === u.email ? 'default' : 'pointer',
                      flexShrink:   0,
                    }}
                  >
                    {approving === u.email ? '…' : 'Approve'}
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* Approved tab */}
        {tab === 'approved' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {approved.map(email => (
              <div key={email} style={{
                display:      'flex',
                alignItems:   'center',
                gap:          12,
                background:   '#1a1008',
                border:       '1px solid #2a1c08',
                borderRadius: 10,
                padding:      '12px 16px',
              }}>
                <div style={{ fontSize: 16 }}>✅</div>
                <div style={{ fontSize: 13, color: '#9a7c55',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
