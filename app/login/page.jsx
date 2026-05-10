'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const params = useSearchParams()
  const error  = params.get('error')

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

        {/* Logo */}
        <div style={{
          width:        80,
          height:       80,
          borderRadius: 'var(--r-xl)',
          overflow:     'hidden',
          background:   '#1e1209',
          margin:       '0 auto var(--sp-5)',
          boxShadow:    'var(--shadow-glow)',
        }}>
        <img
          src="/icon-512.png"
          alt="Tater Tracker"
          style={{
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
            display:    'block',
          }}
        />
        </div>

        <h1 style={{
          margin:        0,
          fontSize:      'var(--fs-h1)',
          fontWeight:    800,
          color:         'var(--text-primary)',
          letterSpacing: 'var(--tracking-head)',
          marginBottom:  'var(--sp-1)',
        }}>
          Tater Tracker
        </h1>
        <p style={{
          fontSize:      'var(--fs-overline)',
          fontWeight:    700,
          color:         'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-overline)',
          marginBottom:  'var(--sp-6)',
        }}>
          Jon and the Juice · Chicagoland
        </p>

        {error && (
          <div style={{
            marginBottom:  'var(--sp-4)',
            padding:       'var(--sp-2) var(--sp-3)',
            borderRadius:  'var(--r-md)',
            background:    'rgba(248,113,113,0.08)',
            border:        '1px solid rgba(248,113,113,0.25)',
            fontSize:      'var(--fs-meta)',
            color:         'var(--red)',
          }}>
            Sign-in failed — please try again.
          </div>
        )}

        <p style={{
          fontSize:     'var(--fs-meta)',
          color:        'var(--text-dim)',
          marginBottom: 'var(--sp-6)',
          lineHeight:   1.6,
        }}>
          Sign in with Google to request access. Your account will be
          reviewed before you can view the tracker.
        </p>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          style={{
            width:          '100%',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            'var(--sp-2)',
            padding:        'var(--sp-3) var(--sp-4)',
            background:     'var(--copper-500)',
            color:          'var(--text-inverse)',
            border:         'none',
            borderRadius:   'var(--r-md)',
            fontSize:       'var(--fs-body)',
            fontWeight:     700,
            fontFamily:     'inherit',
            cursor:         'pointer',
            transition:     'background var(--t-base) var(--ease-out), transform var(--t-fast) var(--ease-out)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--copper-400)'}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
