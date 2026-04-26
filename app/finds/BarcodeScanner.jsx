'use client'
/**
 * BarcodeScanner
 *
 * Two modes:
 *  1. IMAGE  — user picks an image file; ZXing decodes the barcode from it.
 *  2. CAMERA — live viewfinder using the rear camera; ZXing streams frames.
 *
 * Props:
 *   onResult(upc: string) — called when a barcode is decoded
 *   onClose()             — called when the panel should be dismissed
 */

import { useEffect, useRef, useState } from 'react'

export default function BarcodeScanner({ onResult, onClose, autoCamera = false }) {
  const videoRef   = useRef(null)
  const readerRef  = useRef(null)
  const [mode,     setMode]     = useState(autoCamera ? 'camera' : 'image')
  const [scanning, setScanning] = useState(false)
  const [error,    setError]    = useState(null)

  // Stop camera on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [])

  // Auto-start camera if opened via the scan button
  useEffect(() => {
    if (autoCamera) startCamera()
  }, [])

  async function stopCamera() {
    try {
      readerRef.current?.reset()
      readerRef.current = null
    } catch {}
  }

  async function handleImageFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setScanning(true)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      const url    = URL.createObjectURL(file)
      const result = await reader.decodeFromImageUrl(url)
      URL.revokeObjectURL(url)
      onResult(result.getText())
    } catch (err) {
      setError('No barcode found — try a clearer image or type the UPC manually.')
    } finally {
      setScanning(false)
    }
  }

  async function startCamera() {
    setError(null)
    setScanning(true)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader    = new BrowserMultiFormatReader()
      readerRef.current = reader

      const devices   = await BrowserMultiFormatReader.listVideoInputDevices()
      // Prefer rear camera
      const rearCam   = devices.find(d =>
        /back|rear|environment/i.test(d.label)
      ) ?? devices[0]

      if (!rearCam) throw new Error('No camera found')

      let fired = false   // guard against multiple callbacks before reset settles
      await reader.decodeFromVideoDevice(
        rearCam.deviceId,
        videoRef.current,
        (result, err) => {
          if (result && !fired) {
            fired = true
            stopCamera()
            setScanning(false)
            onResult(result.getText())
          }
          // Ignore per-frame decode errors — normal when no barcode in frame
        }
      )
    } catch (err) {
      setError(err.message || 'Camera error')
      setScanning(false)
    }
  }

  function switchMode(m) {
    stopCamera()
    setMode(m)
    setError(null)
    setScanning(false)
  }

  return (
    <div style={{
      background: '#1a1a2e',
      border:     '1px solid #4a3728',
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: '#d4a054', fontWeight: 600 }}>📷 Scan Barcode</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18,
        }}>✕</button>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['image', 'camera'].map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: mode === m ? '#8B4513' : '#2d2d2d',
              color: mode === m ? '#fff' : '#aaa',
              fontSize: 13,
            }}
          >
            {m === 'image' ? '🖼 Image' : '📸 Camera'}
          </button>
        ))}
      </div>

      {/* Image mode */}
      {mode === 'image' && (
        <div>
          <label style={{
            display: 'block',
            background: '#2d2d2d',
            border: '1px dashed #4a3728',
            borderRadius: 6,
            padding: '20px',
            textAlign: 'center',
            cursor: 'pointer',
            color: '#aaa',
            fontSize: 13,
          }}>
            {scanning ? '⏳ Scanning…' : 'Tap to choose a photo of the barcode'}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageFile}
              style={{ display: 'none' }}
              disabled={scanning}
            />
          </label>
        </div>
      )}

      {/* Camera mode */}
      {mode === 'camera' && (
        <div>
          <video
            ref={videoRef}
            style={{
              width: '100%',
              maxHeight: 220,
              borderRadius: 6,
              background: '#000',
              display: 'block',
            }}
            playsInline
            muted
          />
          {!scanning && (
            <button
              onClick={startCamera}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '8px 0',
                background: '#8B4513',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Start Camera
            </button>
          )}
          {scanning && (
            <p style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginTop: 6 }}>
              Point camera at barcode…
            </p>
          )}
        </div>
      )}

      {error && (
        <p style={{ color: '#e87', fontSize: 12, marginTop: 8 }}>{error}</p>
      )}
    </div>
  )
}
