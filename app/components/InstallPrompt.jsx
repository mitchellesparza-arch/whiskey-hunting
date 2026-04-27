'use client'
/**
 * InstallPrompt
 *
 * Shows a "Add to Home Screen" banner on mobile browsers.
 *
 * Android/Chrome: intercepts the native `beforeinstallprompt` event and
 *   shows a one-tap install button.
 *
 * iOS Safari: detects the platform and shows step-by-step instructions
 *   (no programmatic API available on iOS).
 *
 * Dismissed state is stored in localStorage so the banner doesn't reappear
 * after the user explicitly dismisses it.
 */

import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'wh-install-dismissed'

function isIosSafari() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  // Exclude Chrome for iOS (CriOS) and Firefox for iOS (FxiOS)
  const isSafari = isIos && !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua)
  const isStandalone = window.navigator.standalone === true
  return isSafari && !isStandalone
}

function isAndroidChrome() {
  if (typeof window === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

export default function InstallPrompt() {
  const [show,        setShow]        = useState(false)
  const [platform,    setPlatform]    = useState(null)   // 'ios' | 'android'
  const [deferredEvt, setDeferredEvt] = useState(null)
  const [installing,  setInstalling]  = useState(false)

  useEffect(() => {
    // Don't show if already dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return

    // iOS Safari
    if (isIosSafari()) {
      setPlatform('ios')
      setShow(true)
      return
    }

    // Android / Chrome — listen for the browser's install prompt
    function onBeforeInstallPrompt(e) {
      e.preventDefault()           // suppress the mini-infobar
      setDeferredEvt(e)
      if (!localStorage.getItem(DISMISSED_KEY)) {
        setPlatform('android')
        setShow(true)
      }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    // Hide banner once already installed
    window.addEventListener('appinstalled', () => setShow(false))

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
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
      position:        'fixed',
      bottom:          0,
      left:            0,
      right:           0,
      zIndex:          9999,
      background:      'rgba(20, 12, 4, 0.97)',
      borderTop:       '1px solid #4a3728',
      padding:         '14px 16px',
      display:         'flex',
      alignItems:      'flex-start',
      gap:             12,
      boxShadow:       '0 -4px 24px rgba(0,0,0,0.6)',
    }}>
      {/* Icon */}
      <div style={{
        fontSize:    32,
        lineHeight:  1,
        flexShrink:  0,
        marginTop:   2,
      }}>
        🥃
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#f5e6cc' }}>
          Add Tater Tracker to your home screen
        </p>

        {platform === 'ios' && (
          <p style={{ margin: 0, fontSize: 13, color: '#9a7c55', lineHeight: 1.4 }}>
            Tap the{' '}
            <span style={{ color: '#d4a054' }}>Share</span>{' '}
            button{' '}
            <span style={{ fontSize: 15 }}>⎋</span>
            {' '}below, then{' '}
            <span style={{ color: '#d4a054' }}>"Add to Home Screen"</span>.
          </p>
        )}

        {platform === 'android' && (
          <p style={{ margin: '0 0 10px', fontSize: 13, color: '#9a7c55' }}>
            Get quick access — works offline too.
          </p>
        )}

        {platform === 'android' && (
          <button
            onClick={handleInstall}
            disabled={installing}
            style={{
              padding:         '7px 18px',
              background:      '#8B4513',
              color:           '#fff',
              border:          'none',
              borderRadius:    6,
              fontSize:        13,
              fontWeight:      600,
              cursor:          installing ? 'not-allowed' : 'pointer',
            }}
          >
            {installing ? 'Installing…' : 'Add to Home Screen'}
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background:  'none',
          border:      'none',
          color:       '#6b5030',
          fontSize:    20,
          cursor:      'pointer',
          padding:     '0 0 0 4px',
          flexShrink:  0,
          lineHeight:  1,
        }}
      >
        ✕
      </button>
    </div>
  )
}
