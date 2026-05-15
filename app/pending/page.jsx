'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import Button from '../components/ui/Button.jsx'

export default function PendingPage() {
  const { data: session, update } = useSession()
  const router  = useRouter()
  const [checking, setChecking] = useState(false)
  const [checked,  setChecked]  = useState(false)

  useEffect(() => {
    if (session?.user?.approved) router.replace('/')
  }, [session, router])

  async function checkApproval() {
    setChecking(true)
    await update({ checkApproval: true })
    setChecked(true)
    setChecking(false)
    router.replace('/')
  }

  return (
    <div style={{
      minHeight:      '100dvh',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        'var(--sp-4)',
      background:     'var(--bg-base)',
    }}>
      <div style={{
        width:        '100%',
        maxWidth:     360,
        background:   'var(--bg-elev-2)',
        border:       '1px solid var(--hairline-2)',
        borderRadius: 'var(--r-2xl)',
        padding:      'var(--sp-8) var(--sp-6)',
        boxShadow:    'var(--shadow-3)',
        textAlign:    'center',
      }}>

        {/* Icon */}
        <div style={{
          width:          64,
          height:         64,
          borderRadius:   'var(--r-xl)',
          background:     'var(--bg-elev-3)',
          border:         '1px solid var(--hairline-2)',
          display:        'grid',
          placeItems:     'center',
          margin:         '0 auto var(--sp-5)',
        }}>
          <Clock size={28} strokeWidth={1.75} color="var(--text-muted)" />
        </div>

        <h1 style={{
          margin:        0,
          fontSize:      'var(--fs-h1)',
          fontWeight:    800,
          color:         'var(--text-primary)',
          letterSpacing: 'var(--tracking-head)',
          marginBottom:  'var(--sp-2)',
        }}>
          Almost there
        </h1>

        <p style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', margin: 0 }}>
          Signed in as
        </p>
        <p style={{
          fontSize:      'var(--fs-body)',
          fontWeight:    600,
          color:         'var(--copper-400)',
          wordBreak:     'break-all',
          marginBottom:  'var(--sp-5)',
          marginTop:     'var(--sp-1)',
        }}>
          {session?.user?.email ?? '…'}
        </p>

        <p style={{
          fontSize:     'var(--fs-meta)',
          color:        'var(--text-dim)',
          marginBottom: 'var(--sp-6)',
          lineHeight:   1.6,
        }}>
          Your session is being set up. Tap the button below to continue,
          or sign out and sign back in if this persists.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <Button
            variant="primary"
            fullWidth
            onClick={checkApproval}
            disabled={checking}
          >
            {checking ? 'Loading…' : 'Continue to app'}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Sign out
          </Button>
        </div>

      </div>
    </div>
  )
}
