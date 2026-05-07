'use client'
import { useEffect, useRef, useState } from 'react'

export default function BarcodeScanner({ onResult, onClose }) {
  const videoRef  = useRef(null)
  const readerRef = useRef(null)
  const firedRef  = useRef(false)
  const [status, setStatus] = useState('starting') // 'starting' | 'scanning' | 'error'
  const [error,  setError]  = useState(null)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  async function stopCamera() {
    try {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
        videoRef.current.srcObject = null
      }
      readerRef.current?.reset()
      readerRef.current = null
    } catch {}
  }

  async function startCamera() {
    firedRef.current = false
    setError(null)
    setStatus('starting')
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      const cam = devices.find(d => /back|rear|environment/i.test(d.label)) ?? devices[0]
      if (!cam) throw new Error('No camera found')

      setStatus('scanning')
      await reader.decodeFromVideoDevice(cam.deviceId, videoRef.current, (result) => {
        if (result && !firedRef.current) {
          firedRef.current = true
          stopCamera()
          onResult(result.getText())
        }
      })
    } catch (err) {
      setError(err.message || 'Camera unavailable')
      setStatus('error')
    }
  }

  return (
    <>
      <style>{`
        @keyframes wh-scan {
          0%   { transform: translateY(-56px); }
          100% { transform: translateY(56px);  }
        }
      `}</style>

      <div style={{
        position:      'fixed',
        inset:         0,
        background:    '#000',
        zIndex:        500,
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        justifyContent:'center',
      }}>

        {/* Live camera feed — fills entire background */}
        <video
          ref={videoRef}
          style={{
            position:   'absolute',
            inset:      0,
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
          }}
          playsInline
          muted
        />

        {/* Top bar */}
        <div style={{
          position:   'absolute',
          top:        0,
          left:       0,
          right:      0,
          paddingTop: 'calc(14px + env(safe-area-inset-top))',
          padding:    '14px 16px 14px',
          zIndex:     2,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)',
        }}>
          <span style={{ color: '#fff', fontSize: 17, fontWeight: 600, letterSpacing: 0.2 }}>
            Scan Barcode
          </span>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            style={{
              background:   'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(4px)',
              border:       '1px solid rgba(255,255,255,0.25)',
              borderRadius: '50%',
              width:        36,
              height:       36,
              color:        '#fff',
              fontSize:     17,
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              lineHeight:   1,
            }}
          >✕</button>
        </div>

        {/* Scan frame + dark vignette */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* The frame box — its box-shadow creates the dark surround */}
          <div style={{
            width:      '72vw',
            maxWidth:   300,
            height:     160,
            borderRadius: 12,
            boxShadow:  '0 0 0 9999px rgba(0,0,0,0.52)',
            position:   'relative',
            overflow:   'hidden',
          }}>
            {/* Animated scan line */}
            {status === 'scanning' && (
              <div style={{
                position:   'absolute',
                left:       0,
                right:      0,
                top:        '50%',
                height:     2,
                background: 'linear-gradient(90deg, transparent 0%, #e8943a 30%, #f4b96a 50%, #e8943a 70%, transparent 100%)',
                boxShadow:  '0 0 10px 2px rgba(232,148,58,0.6)',
                animation:  'wh-scan 1.5s ease-in-out infinite alternate',
              }} />
            )}
          </div>

          {/* Corner brackets — drawn outside the frame box so they're always visible */}
          {[
            { top: -2, left: -2,   borderTop: '3px solid #e8943a', borderLeft:  '3px solid #e8943a', borderRadius: '10px 0 0 0' },
            { top: -2, right: -2,  borderTop: '3px solid #e8943a', borderRight: '3px solid #e8943a', borderRadius: '0 10px 0 0' },
            { bottom: -2, left: -2,  borderBottom: '3px solid #e8943a', borderLeft:  '3px solid #e8943a', borderRadius: '0 0 0 10px' },
            { bottom: -2, right: -2, borderBottom: '3px solid #e8943a', borderRight: '3px solid #e8943a', borderRadius: '0 0 10px 0' },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 22, height: 22, ...s }} />
          ))}
        </div>

        {/* Status label below frame */}
        <p style={{
          position:    'relative',
          zIndex:      2,
          marginTop:   20,
          color:       status === 'error' ? '#f87' : 'rgba(255,255,255,0.75)',
          fontSize:    13,
          textAlign:   'center',
          letterSpacing: 0.2,
          padding:     '0 32px',
        }}>
          {status === 'starting' && 'Starting camera…'}
          {status === 'scanning' && 'Align the barcode inside the frame'}
          {status === 'error'    && (error || 'Camera unavailable')}
        </p>

        {/* Bottom actions */}
        <div style={{
          position:      'absolute',
          bottom:        0,
          left:          0,
          right:         0,
          paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
          zIndex:        2,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           10,
          background:    'linear-gradient(to top, rgba(0,0,0,0.65), transparent)',
          padding:       '32px 24px calc(28px + env(safe-area-inset-bottom))',
        }}>
          {status === 'error' && (
            <button
              onClick={startCamera}
              style={{
                background:   '#e8943a',
                color:        '#fff',
                border:       'none',
                borderRadius: 10,
                padding:      '12px 36px',
                fontSize:     15,
                fontWeight:   600,
                cursor:       'pointer',
                fontFamily:   'inherit',
              }}
            >
              Try Again
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background:   'none',
              border:       'none',
              color:        'rgba(255,255,255,0.55)',
              fontSize:     13,
              cursor:       'pointer',
              fontFamily:   'inherit',
              padding:      '4px 0',
            }}
          >
            Enter UPC manually
          </button>
        </div>
      </div>
    </>
  )
}
