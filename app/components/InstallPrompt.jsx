'use client'
/**
 * InstallPrompt
 *
 * Shows a "Add to Home Screen" banner on mobile browsers.
 *
 * Android/Chrome: captures the native `beforeinstallprompt` event via a
 *   global set in layout.jsx <head> before React hydrates (avoids the
 *   timing race where the event fires before useEffect runs).
 *   Falls back to manual instructions if the event never fires.
 *
 * iOS Safari: detects the platform and shows step-by-step instructions.
 *
 * Dismissed state is stored in localStorage.
 */

import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'tt-install-dismissed'   // tt- prefix since we renamed the app

function isIosSafari() {
  if (typeof window === 'undefined') return false
  const ua           = window.navigator.userAgent
  const isIos        = /iphone|ipad|ipod/i.test(ua)
  const isSafari     = isIos && !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua)
  const isStandalone = window.navigator.standalone === true
  return isSafari && !isStandalone
}

function isAndroidBrowser() {
  if (typeof window === 'undefined') return false
  return /android/i.test(navigator.userAgent) && !window.navigator.standalone
}

export default function InstallPrompt() {
  const [show,       setShow]       = useState(false)
  const [platform,   setPlatform]   = useState(null)   // 'ios' | 'android' | 'android-manual'
  const [deferredEvt,setDeferredEvt]= useState(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return

    // ── iOS Safari ──────────────────────────────────────────────────────────
    if (isIosSafari()) {
      setPlatform('ios')
      setShow(true)
      return
    }

    // ── Android / Chrome ────────────────────────────────────────────────────
    if (!isAndroidBrowser()) return   // desktop — skip

    // Check if event was already captured by the inline <head> script
    if (window.__installPrompt) {
      setDeferredEvt(window.__installPrompt)
      window.__installPrompt = null
      setPlatform('android')
      setShow(true)
      return
    }

    // Otherwise listen for it (fires after a user interaction on some Chrome versions)
    function onPrompt(e) {
      e.preventDefault()
      setDeferredEvt(e)
      window.__installPrompt = null
      if (!localStorage.getItem(DISMISSED_KEY)) {
        setPlatform('android')
        setShow(true)
      }
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setShow(false))

    // Fallback: if the event never fires (e.g. service worker not registered),
    // show manual instructions after 3 s so Android users still get guidance.
    const fallback = setTimeout(() => {
      if (!localStorage.getItem(DISMISSED_KEY) && !show) {
        setPlatform('android-manual')
        setShow(true)
      }
    }, 3000)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      clearTimeout(fallback)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  async function handleInstall() {
    if (!deferredEvt) return
    setInstalling(true)
    deferredEvt.prompt()
    const { outcome } = await deferredEvt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      localStorage.setItem(DISMISSED_KEY, '1')
    }
    setInstalling(false)
    setDeferredEvt(null)
  }

  if (!show) return null

  return (
    <div style={{
      position:   'fixed',
      bottom:     0,
      left:       0,
      right:      0,
      zIndex:     9999,
      background: 'rgba(20,12,4,0.97)',
      borderTop:  '1px solid #4a3728',
      padding:    '14px 16px calc(14px + env(safe-area-inset-bottom))',
      display:    'flex',
      alignItems: 'flex-start',
      gap:        12,
      boxShadow:  '0 -4px 24px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontSize: 30, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>🥃</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#f5e6cc' }}>
          Add Tater Tracker to your home screen
        </p>

        {platform === 'ios' && (
          <p style={{ margin: 0, fontSize: 13, color: '#9a7c55', lineHeight: 1.5 }}>
            Tap the <span style={{ color: '#d4a054' }}>Share</span> button{' '}
            <span style={{ fontSize: 15 }}>⎋</span> at the bottom of Safari, then{' '}
            <span style={{ color: '#d4a054' }}>"Add to Home Screen"</span>.
          </p>
        )}

        {platform === 'android' && (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#9a7c55' }}>
              Install for quick access — works great as an app.
            </p>
            <button
              onClick={handleInstall}
              disabled={installing}
              style={{
                padding:      '7px 18px',
                background:   '#e8943a',
                color:        '#fff',
                border:       'none',
                borderRadius: 6,
                fontSize:     13,
                fontWeight:   700,
                cursor:       installing ? 'not-allowed' : 'pointer',
              }}
            >
              {installing ? 'Installing…' : 'Add to Home Screen'}
            </button>
          </>
        )}

        {platform === 'android-manual' && (
          <p style={{ margin: 0, fontSize: 13, color: '#9a7c55', lineHeight: 1.5 }}>
            Tap the <span style={{ color: '#d4a054' }}>⋮ menu</span> in Chrome, then{' '}
            <span style={{ color: '#d4a054' }}>"Add to Home screen"</span>.
          </p>
        )}
      </div>

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border:     'none',
          color:      '#6b5030',
          fontSize:   20,
          cursor:     'pointer',
          padding:    '0 0 0 4px',
          flexShrink: 0,
          lineHeight: 1,
        }}
      >✕</button>
    </div>
  )
}
