'use client'
import { useSession } from 'next-auth/react'
import { useRouter }  from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import AppHeader from '../components/AppHeader.jsx'
import { TIERS, tierLabel, tierColor } from '../../lib/tier.js'

function Avatar({ name }) {
  const initials = name
    ? name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase()
    : '?'
  return (
    <div style={{
      width:          40,
      height:         40,
      borderRadius:   '50%',
      background:     'var(--grad-copper)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontWeight:     800,
      fontSize:       'var(--fs-meta)',
      color:          'var(--text-inverse)',
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
  const { data: session, status, update } = useSession()
  const router = useRouter()

  const [pending,    setPending]    = useState([])
  const [approved,   setApproved]   = useState([])
  const [members,    setMembers]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [denied,     setDenied]     = useState(false)
  const [approving,  setApproving]  = useState(null) // email being approved
  const [settingTier, setSettingTier] = useState(null) // email having tier changed
  const [tab,        setTab]        = useState('pending')
  const [cronStatus, setCronStatus] = useState({}) // key → 'running'|'ok'|'error'

  // Redirect non-owners
  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/login'); return }
    if (status === 'authenticated' && session?.user?.approved === false) { router.replace('/pending'); return }
  }, [status, session])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, tierRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/tier'),
      ])
      if (usersRes.status === 401) { setDenied(true); setLoading(false); return }
      const usersData = await usersRes.json()
      const tierData  = tierRes.ok ? await tierRes.json() : { users: [] }

      setPending((usersData.pending ?? []).sort((a, b) =>
        new Date(b.requestedAt ?? 0) - new Date(a.requestedAt ?? 0)
      ))
      setApproved((usersData.approved ?? []).sort())
      setMembers((tierData.users ?? []).sort((a, b) => (a.email > b.email ? 1 : -1)))
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

  async function runCron(key, path, method = 'GET') {
    setCronStatus(s => ({ ...s, [key]: 'running' }))
    try {
      const res  = await fetch('/api/admin/run-cron', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ path, method }),
      })
      const data = await res.json().catch(() => ({}))
      setCronStatus(s => ({ ...s, [key]: res.ok ? { ok: true, data } : { ok: false, data } }))
    } catch (err) {
      setCronStatus(s => ({ ...s, [key]: { ok: false, data: { error: err.message } } }))
    }
  }

  async function setTier(email, tier) {
    setSettingTier(email)
    try {
      await fetch('/api/admin/tier', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, tier }),
      })
      await load()
      // If changing your own tier, refresh the session so it takes effect immediately
      if (email.toLowerCase() === session?.user?.email?.toLowerCase()) {
        await update({ checkTier: true })
      }
    } finally {
      setSettingTier(null)
    }
  }

  if (status === 'loading' || loading) return null

  if (denied) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
        <AppHeader sub="Access Control" />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--sp-10) var(--sp-4)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 'var(--sp-4)' }}>🔒</div>
          <div style={{ fontWeight: 800, fontSize: 'var(--fs-h2)', color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>Access denied</div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 'var(--sp-6)' }}>
            You're signed in as <strong style={{ color: 'var(--text-primary)' }}>{session?.user?.email}</strong>.<br />
            The <code style={{ color: 'var(--copper-400)' }}>ALERT_EMAIL</code> env var on Vercel needs to match this address.
          </div>
          <div style={{ background: 'var(--bg-elev-2)', border: '1px solid var(--hairline-2)', borderRadius: 10,
                        padding: 'var(--sp-4) var(--sp-5)', fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', textAlign: 'left' }}>
            <strong style={{ color: 'var(--text-primary)' }}>To fix:</strong> Go to your Vercel project →
            Settings → Environment Variables → update <code style={{ color: 'var(--copper-400)' }}>ALERT_EMAIL</code> to{' '}
            <code style={{ color: 'var(--copper-400)' }}>{session?.user?.email}</code>, then redeploy.
          </div>
        </div>
      </div>
    )
  }

  const tabStyle = active => ({
    padding:       'var(--sp-2) var(--sp-4)',
    borderRadius:  'var(--sp-2)',
    fontSize:      'var(--fs-meta)',
    fontWeight:    700,
    cursor:        'pointer',
    border:        'none',
    background:    active ? 'var(--copper-400)' : 'transparent',
    color:         active ? 'var(--text-inverse)' : 'var(--text-muted)',
    transition:    'background 0.15s, color 0.15s',
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppHeader sub="Access Control" />

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--sp-5) var(--sp-4)' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 'var(--sp-1)', marginBottom: 'var(--sp-5)', background: 'var(--bg-elev-2)', borderRadius: 10, padding: 'var(--sp-1)' }}>
          <button style={tabStyle(tab === 'pending')}  onClick={() => setTab('pending')}>
            Pending
            {pending.length > 0 && (
              <span style={{ marginLeft: 'var(--sp-1)', background: 'var(--red)', color: 'var(--text-inverse)', borderRadius: 999,
                             fontSize: 'var(--fs-overline)', fontWeight: 800, padding: 'var(--sp-px) var(--sp-1)' }}>
                {pending.length}
              </span>
            )}
          </button>
          <button style={tabStyle(tab === 'approved')} onClick={() => setTab('approved')}>
            Approved ({approved.length})
          </button>
          <button style={tabStyle(tab === 'members')} onClick={() => setTab('members')}>
            Members ({members.length})
          </button>
          <button style={tabStyle(tab === 'tools')} onClick={() => setTab('tools')}>
            Tools
          </button>
        </div>

        {/* Pending tab */}
        {tab === 'pending' && (
          pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0', color: 'var(--text-dim)', fontSize: 'var(--fs-body)' }}>
              🎉 No pending requests
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {pending.map(u => (
                <div key={u.email} style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          'var(--sp-3)',
                  background:   'var(--bg-elev-2)',
                  border:       '1px solid var(--hairline-2)',
                  borderRadius: 12,
                  padding:      'var(--sp-3) var(--sp-4)',
                }}>
                  <Avatar name={u.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name ?? u.email}
                    </div>
                    <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', marginTop: 'var(--sp-px)',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.email}
                    </div>
                    <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-dim)', marginTop: 'var(--sp-px)' }}>
                      Requested {timeAgo(u.requestedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => approve(u.email)}
                    disabled={approving === u.email}
                    style={{
                      padding:      'var(--sp-2) var(--sp-4)',
                      background:   approving === u.email ? 'rgba(74,222,128,0.15)' : 'var(--green)',
                      color:        'var(--text-inverse)',
                      border:       'none',
                      borderRadius: 'var(--sp-2)',
                      fontWeight:   700,
                      fontSize:     'var(--fs-meta)',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {approved.map(email => (
              <div key={email} style={{
                display:      'flex',
                alignItems:   'center',
                gap:          'var(--sp-3)',
                background:   'var(--bg-elev-2)',
                border:       '1px solid var(--hairline)',
                borderRadius: 10,
                padding:      'var(--sp-3) var(--sp-4)',
              }}>
                <div style={{ fontSize: 16 }}>✅</div>
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Members / Tier management tab */}
        {tab === 'members' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {members.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--sp-12) 0', color: 'var(--text-dim)', fontSize: 'var(--fs-body)' }}>
                No members yet
              </div>
            )}
            {members.map(u => {
              const tier = u.tier ?? TIERS.FREE
              return (
                <div key={u.email} style={{
                  background:   'var(--bg-elev-2)',
                  border:       '1px solid var(--hairline-2)',
                  borderRadius: 12,
                  padding:      'var(--sp-3) var(--sp-4)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', marginBottom: 'var(--sp-2)' }}>
                    <Avatar name={u.name ?? u.email} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name ?? u.email}
                      </div>
                      <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.email}
                      </div>
                    </div>
                    {/* Tier badge */}
                    <span style={{
                      fontSize:     'var(--fs-overline)',
                      fontWeight:   700,
                      color:        tierColor(tier),
                      background:   `${tierColor(tier)}22`,
                      borderRadius: 999,
                      padding:      '2px 10px',
                      flexShrink:   0,
                    }}>
                      {tierLabel(tier)}
                    </span>
                  </div>
                  {/* Tier controls */}
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                    {Object.values(TIERS).map(t => (
                      <button
                        key={t}
                        disabled={tier === t || settingTier === u.email}
                        onClick={() => setTier(u.email, t)}
                        style={{
                          padding:      'var(--sp-1) var(--sp-3)',
                          borderRadius: 'var(--r-sm)',
                          fontSize:     'var(--fs-overline)',
                          fontWeight:   700,
                          border:       `1px solid ${tier === t ? tierColor(t) : 'var(--hairline-2)'}`,
                          background:   tier === t ? `${tierColor(t)}22` : 'transparent',
                          color:        tier === t ? tierColor(t) : 'var(--text-muted)',
                          cursor:       tier === t || settingTier === u.email ? 'default' : 'pointer',
                          opacity:      settingTier === u.email && tier !== t ? 0.5 : 1,
                        }}
                      >
                        {settingTier === u.email && tier !== t ? '…' : tierLabel(t)}
                      </button>
                    ))}
                  </div>
                  {u.subscriptionStatus && (
                    <div style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--fs-overline)', color: 'var(--text-dim)' }}>
                      Stripe: {u.subscriptionStatus}{u.subscriptionId ? ` · ${u.subscriptionId.slice(0, 12)}…` : ''}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Tools tab */}
        {tab === 'tools' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {[
              {
                key:    'seed',
                label:  '1. Seed Bottle DB',
                desc:   'Backfills 256 seed + 400 catalog bottles into Redis. Safe to re-run.',
                url:    '/api/admin/bottle-seed',
                method: 'POST',
              },
              {
                key:    'backfillPrices',
                label:  '1b. Backfill Prices',
                desc:   'Writes market prices + MSRP from Redis price cache into canonical bottle records.',
                url:    '/api/admin/backfill-prices',
                method: 'POST',
              },
              {
                key:    'market',
                label:  '2. Market Price Refresh',
                desc:   'Pulls UA hammer prices + images + live Binny\'s MSRP. Run after UA scraper.',
                url:    '/api/market-price/refresh',
                method: 'GET',
              },
              {
                key:    'cron',
                label:  '3. Daily Cron',
                desc:   'Algolia canary checks → truck detection → enriches bottle DB.',
                url:    '/api/cron',
                method: 'GET',
              },
              {
                key:    'importUpcs',
                label:  '4. Import UPCs',
                desc:   'Monthly UPC batch import.',
                url:    '/api/cron/import-upcs',
                method: 'GET',
              },
              {
                key:    'algoliaSweep',
                label:  '5. Algolia Sweep',
                desc:   'Paginates full Binny\'s catalog — discovers new SKUs, fills objectIDs + images.',
                url:    '/api/cron/algolia-sweep',
                method: 'GET',
              },
              {
                key:    'reservebar',
                label:  '6. ReserveBar Monitor',
                desc:   'Checks ReserveBar for deals. Independent of other crons.',
                url:    '/api/reservebar-monitor',
                method: 'GET',
              },
              {
                key:    'audit',
                label:  '7. Catalog Audit',
                desc:   'Audits the bottle catalog and sends a report. Run last.',
                url:    '/api/cron/catalog-audit',
                method: 'GET',
              },
            ].map(({ key, label, desc, url, method }) => {
              const st = cronStatus[key]
              return (
                <div key={key} style={{
                  background:   'var(--bg-elev-2)',
                  border:       `1px solid ${st?.ok === false ? 'var(--red)' : st?.ok === true ? 'var(--green)' : 'var(--hairline-2)'}`,
                  borderRadius: 12,
                  padding:      'var(--sp-3) var(--sp-4)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>{label}</div>
                      <div style={{ fontSize: 'var(--fs-overline)', color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
                    </div>
                    <button
                      onClick={() => runCron(key, url, method)}
                      disabled={st === 'running'}
                      style={{
                        padding:      'var(--sp-2) var(--sp-4)',
                        background:   st === 'running' ? 'var(--bg-elev-3)' : st?.ok === true ? 'rgba(74,222,128,0.15)' : st?.ok === false ? 'rgba(239,68,68,0.15)' : 'var(--copper-400)',
                        color:        st?.ok === true ? 'var(--green)' : st?.ok === false ? 'var(--red)' : st === 'running' ? 'var(--text-muted)' : 'var(--text-inverse)',
                        border:       'none',
                        borderRadius: 'var(--r-sm)',
                        fontWeight:   700,
                        fontSize:     'var(--fs-meta)',
                        cursor:       st === 'running' ? 'default' : 'pointer',
                        flexShrink:   0,
                        minWidth:     72,
                      }}
                    >
                      {st === 'running' ? 'Running…' : st?.ok === true ? 'Done' : st?.ok === false ? 'Error' : 'Run'}
                    </button>
                  </div>
                  {st?.data && (
                    <pre style={{
                      marginTop:   'var(--sp-2)',
                      fontSize:    10,
                      color:       st.ok ? 'var(--text-muted)' : 'var(--red)',
                      background:  'var(--bg-elev-3)',
                      borderRadius: 6,
                      padding:     'var(--sp-2)',
                      overflowX:   'auto',
                      whiteSpace:  'pre-wrap',
                      wordBreak:   'break-all',
                    }}>
                      {JSON.stringify(st.data, null, 2)}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
