'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, Download, Bluetooth, Search, Wand2, Loader } from 'lucide-react'
import Sheet from '../../components/ui/Sheet.jsx'

// ── Label sizes ───────────────────────────────────────────────────────────────

const SIZES = [
  { id: '40x30', label: '40×30mm', w: 320, h: 240 },
  { id: '50x30', label: '50×30mm', w: 400, h: 240 },
  { id: '38x50', label: '38×50mm', w: 304, h: 400 },
]

// ── Canvas renderer ───────────────────────────────────────────────────────────

async function tryLoadImage(src) {
  if (!src) return null
  return new Promise(resolve => {
    const img    = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
    setTimeout(() => resolve(null), 5000)
  })
}

function doubleRule(ctx, W, y, padFrac = 0.08, color = '#c4893a') {
  const gap = 3
  const px  = Math.round(W * padFrac)
  ctx.strokeStyle = color
  ctx.lineWidth   = 0.75
  ;[-gap / 2, gap / 2].forEach(offset => {
    ctx.beginPath()
    ctx.moveTo(px, y + offset)
    ctx.lineTo(W - px, y + offset)
    ctx.stroke()
  })
}

async function renderLabel(ctx, W, H, { name, proof, giver, imageUrl }) {
  const PAD = Math.round(W * 0.05)

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  const img    = await tryLoadImage(imageUrl)
  const hasImg = !!img

  if (hasImg) {
    // ── Photo layout: image top, structured info bar bottom ────────────
    const infoH  = Math.round(H * 0.30)
    const photoH = H - infoH

    const scale = Math.max(W / img.naturalWidth, photoH / img.naturalHeight)
    const sw    = W / scale
    const sh    = photoH / scale
    const sx    = (img.naturalWidth  - sw) / 2
    const sy    = (img.naturalHeight - sh) * 0.35
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, photoH)

    // Subtle gradient at photo bottom
    const grad = ctx.createLinearGradient(0, photoH - Math.round(photoH * 0.25), 0, photoH)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(1, 'rgba(0,0,0,0.25)')
    ctx.fillStyle = grad
    ctx.fillRect(0, photoH - Math.round(photoH * 0.25), W, Math.round(photoH * 0.25))

    // Info bar
    ctx.fillStyle = '#F8F6F2'
    ctx.fillRect(0, photoH, W, infoH)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth   = 1.5
    ctx.beginPath(); ctx.moveTo(0, photoH); ctx.lineTo(W, photoH); ctx.stroke()

    // Two columns: PROOF | SAMPLE FROM
    const labelFs = Math.max(8,  Math.round(H * 0.038))
    const valueFs = Math.max(11, Math.round(H * 0.065))
    const colW    = W / 2
    const rowY    = photoH + Math.round(infoH * 0.16)

    ctx.strokeStyle = '#CCCCCC'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.moveTo(W / 2, photoH + Math.round(infoH * 0.1))
    ctx.lineTo(W / 2, H - Math.round(infoH * 0.1))
    ctx.stroke()

    ctx.textAlign    = 'center'
    ctx.textBaseline = 'top'

    ctx.font      = `700 ${labelFs}px Arial, sans-serif`
    ctx.fillStyle = '#888888'
    ctx.fillText('PROOF', colW / 2, rowY)
    ctx.font      = `bold ${valueFs}px Georgia, serif`
    ctx.fillStyle = '#111111'
    ctx.fillText(proof ? `${proof}°` : '—', colW / 2, rowY + labelFs + 3)

    ctx.font      = `700 ${labelFs}px Arial, sans-serif`
    ctx.fillStyle = '#888888'
    ctx.fillText('SAMPLE FROM', W / 2 + colW / 2, rowY)
    ctx.font      = `italic ${valueFs}px Georgia, serif`
    ctx.fillStyle = '#111111'
    ctx.fillText(giver || '—', W / 2 + colW / 2, rowY + labelFs + 3)

  } else {
    // ── Typographic label (no photo) ────────────────────────────────────

    // Split name: brand (italic large) + type (dark band caps)
    const words = (name || '').trim().split(/\s+/)
    let brand, type
    if (words.length <= 1) {
      brand = name || '?'; type = ''
    } else if (words.length === 2) {
      brand = words[0]; type = words[1]
    } else {
      const splitAt = words.length <= 4 ? 2 : Math.ceil(words.length * 0.38)
      brand = words.slice(0, splitAt).join(' ')
      type  = words.slice(splitAt).join(' ')
    }

    // Thin outer border
    ctx.strokeStyle = '#111111'
    ctx.lineWidth   = 1.5
    ctx.strokeRect(1.5, 1.5, W - 3, H - 3)

    // Zone layout
    const topPad   = Math.round(H * 0.055)
    const brandH   = Math.round(H * 0.30)
    const gapA     = Math.round(H * 0.025)
    const typeH    = Math.round(H * 0.22)
    const gapB     = Math.round(H * 0.025)
    const dataT    = topPad + brandH + gapA + typeH + gapB
    const dataH    = H - dataT - Math.round(H * 0.04)

    // ── Brand name ───────────────────────────────────────────────────
    let brandFs = Math.round(H * 0.17)
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `italic bold ${brandFs}px Georgia, serif`
    while (brandFs > 10 && ctx.measureText(brand).width > W - PAD * 3) {
      brandFs--
      ctx.font = `italic bold ${brandFs}px Georgia, serif`
    }
    ctx.fillStyle = '#111111'
    ctx.fillText(brand, W / 2, topPad + brandH / 2)

    // Copper double rule above type band
    doubleRule(ctx, W, topPad + brandH + gapA / 2)

    // ── Type band (dark block, white caps) ───────────────────────────
    if (type) {
      const typeT = topPad + brandH + gapA
      ctx.fillStyle = '#111111'
      ctx.fillRect(PAD * 0.4, typeT, W - PAD * 0.8, typeH)

      const typeStr   = type.toUpperCase()
      const typeWords = typeStr.split(/\s+/)
      let typeLines   = [typeStr]
      let typeFs      = Math.round(H * 0.11)
      ctx.font = `bold ${typeFs}px Arial, sans-serif`

      if (ctx.measureText(typeStr).width > W - PAD * 3) {
        const mid  = Math.ceil(typeWords.length / 2)
        typeLines  = [typeWords.slice(0, mid).join(' '), typeWords.slice(mid).join(' ')]
        typeFs     = Math.round(H * 0.088)
        ctx.font   = `bold ${typeFs}px Arial, sans-serif`
        while (typeLines.some(l => ctx.measureText(l).width > W - PAD * 3) && typeFs > 7) {
          typeFs--
          ctx.font = `bold ${typeFs}px Arial, sans-serif`
        }
      }

      ctx.fillStyle    = '#FFFFFF'
      ctx.textBaseline = 'middle'
      const lineH  = typeFs * 1.25
      const blockH = typeLines.length * lineH
      typeLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, typeT + typeH / 2 - blockH / 2 + lineH * 0.5 + i * lineH)
      })

      // Copper double rule below type band
      doubleRule(ctx, W, typeT + typeH + gapB / 2)
    }

    // ── Data zone: PROOF | SAMPLE FROM ──────────────────────────────
    const labelFs = Math.max(8,  Math.round(H * 0.038))
    const valueFs = Math.max(10, Math.round(H * 0.062))
    const rowTop  = dataT + Math.round((dataH - labelFs - 4 - valueFs) / 2)

    ctx.textAlign    = 'center'
    ctx.textBaseline = 'top'

    if (proof && giver) {
      const colW = W / 2
      ctx.strokeStyle = '#CCCCCC'
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.moveTo(W / 2, dataT + Math.round(dataH * 0.08))
      ctx.lineTo(W / 2, dataT + dataH - Math.round(dataH * 0.08))
      ctx.stroke()

      ctx.font = `700 ${labelFs}px Arial, sans-serif`; ctx.fillStyle = '#888888'
      ctx.fillText('PROOF', colW / 2, rowTop)
      ctx.font = `bold ${valueFs}px Georgia, serif`; ctx.fillStyle = '#111111'
      ctx.fillText(`${proof}°`, colW / 2, rowTop + labelFs + 4)

      ctx.font = `700 ${labelFs}px Arial, sans-serif`; ctx.fillStyle = '#888888'
      ctx.fillText('SAMPLE FROM', W / 2 + colW / 2, rowTop)
      ctx.font = `italic ${valueFs}px Georgia, serif`; ctx.fillStyle = '#111111'
      ctx.fillText(giver, W / 2 + colW / 2, rowTop + labelFs + 4)
    } else if (proof) {
      ctx.font = `700 ${labelFs}px Arial, sans-serif`; ctx.fillStyle = '#888888'
      ctx.fillText('PROOF', W / 2, rowTop)
      ctx.font = `bold ${valueFs}px Georgia, serif`; ctx.fillStyle = '#111111'
      ctx.fillText(`${proof}°`, W / 2, rowTop + labelFs + 4)
    } else if (giver) {
      ctx.font = `700 ${labelFs}px Arial, sans-serif`; ctx.fillStyle = '#888888'
      ctx.fillText('SAMPLE FROM', W / 2, rowTop)
      ctx.font = `italic ${valueFs}px Georgia, serif`; ctx.fillStyle = '#111111'
      ctx.fillText(giver, W / 2, rowTop + labelFs + 4)
    }
  }
}

// ── NIIMBOT BLE protocol ──────────────────────────────────────────────────────

const BLE_SERVICE = '0000ae30-0000-1000-8000-00805f9b34fb'
const BLE_TX      = '0000ae01-0000-1000-8000-00805f9b34fb'

function makePacket(cmd, payload = []) {
  const body = [cmd, payload.length, ...payload]
  const crc  = body.reduce((a, b) => a ^ b, 0)
  return new Uint8Array([0x55, 0x55, ...body, crc, 0xAA, 0xAA])
}

async function niimbotPrint(srcCanvas, dotW, dotH, onStatus) {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth not supported. Use Chrome or Edge.')

  onStatus('Searching for printer…')
  let device
  try {
    device = await navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_SERVICE] }] })
  } catch {
    throw new Error('Printer selection cancelled.')
  }

  onStatus('Connecting…')
  const server  = await device.gatt.connect()
  const service = await server.getPrimaryService(BLE_SERVICE)
  const tx      = await service.getCharacteristic(BLE_TX)
  const send    = (cmd, data = []) => tx.writeValueWithoutResponse(makePacket(cmd, data))
  const delay   = ms => new Promise(r => setTimeout(r, ms))

  const off  = document.createElement('canvas')
  off.width  = dotW
  off.height = dotH
  const octx = off.getContext('2d')
  octx.drawImage(srcCanvas, 0, 0, dotW, dotH)
  const id   = octx.getImageData(0, 0, dotW, dotH)

  const rows = []
  for (let y = 0; y < dotH; y++) {
    const bytes = []
    for (let xb = 0; xb < dotW; xb += 8) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const x   = xb + bit
        const idx = (y * dotW + x) * 4
        const lum = 0.299 * (id.data[idx] ?? 255) + 0.587 * (id.data[idx + 1] ?? 255) + 0.114 * (id.data[idx + 2] ?? 255)
        if (lum < 128) byte |= (0x80 >> bit)
      }
      bytes.push(byte)
    }
    rows.push(bytes)
  }

  onStatus('Sending…')
  await send(0x23, [1]); await send(0x21, [3]); await send(0x01, []); await delay(120)
  await send(0x13, [dotH >> 8, dotH & 0xFF, dotW >> 8, dotW & 0xFF])
  await send(0x15, [0x00, 0x01]); await send(0x03, []); await delay(60)

  for (let i = 0; i < rows.length; i++) {
    if (i % 20 === 0) onStatus(`Printing… ${Math.round((i / rows.length) * 100)}%`)
    await send(0x85, [i >> 8, i & 0xFF, ...rows[i]])
    await delay(3)
  }

  await send(0xE3, []); await delay(120); await send(0xF3, [])
  onStatus('Done!'); await delay(1200); device.gatt.disconnect(); onStatus(null)
}

// ── Styles ────────────────────────────────────────────────────────────────────

const fldLabel = {
  display:       'block',
  fontSize:      'var(--fs-overline)',
  fontWeight:    700,
  color:         'var(--text-muted)',
  marginTop:     'var(--sp-3)',
  marginBottom:  'var(--sp-1)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const fldInput = {
  width:        '100%',
  padding:      'var(--sp-2) var(--sp-3)',
  background:   'var(--bg-base)',
  border:       '1px solid var(--hairline-3)',
  borderRadius: 'var(--r-md)',
  color:        'var(--text-primary)',
  fontSize:     'var(--fs-body)',
  fontFamily:   'inherit',
  outline:      'none',
  boxSizing:    'border-box',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LabelMakerSheet({ open, onClose, bottle, bottles = [], session }) {
  const canvasRef    = useRef(null)
  const scanInputRef = useRef(null)

  const [sourceTab, setSourceTab]   = useState('collection')
  const [query,     setQuery]       = useState('')

  // Label data
  const [name,     setName]     = useState('')
  const [proof,    setProof]    = useState('')
  const [giver,    setGiver]    = useState('')
  const [imageUrl, setImageUrl] = useState(null)

  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanMsg,  setScanMsg]  = useState(null)

  // AI generation state
  const [generatedImg, setGeneratedImg] = useState(null)
  const [generating,   setGenerating]   = useState(false)
  const [genError,     setGenError]     = useState(null)

  // Print state
  const [size,     setSize]     = useState(SIZES[0])
  const [btStatus, setBtStatus] = useState(null)
  const [btError,  setBtError]  = useState(null)

  const hasBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator

  // Fetch display name from profile on open
  useEffect(() => {
    if (!open) return
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => { if (d.profile?.name) setGiver(d.profile.name) })
      .catch(() => { if (session?.user?.name) setGiver(session.user.name) })
  }, [open])

  // Pre-fill from BottleCard selection — clear any previous generation
  useEffect(() => {
    if (!bottle) return
    setName(bottle.name ?? '')
    setProof(bottle.proof ? String(bottle.proof) : '')
    setImageUrl(bottle.photoUrl ?? null)
    setQuery('')
    setScanMsg(null)
    setBtStatus(null)
    setBtError(null)
    setGeneratedImg(null)
    setGenError(null)
  }, [bottle?.id])

  // Draw to canvas: AI image if available, otherwise canvas renderer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !open) return

    function setupCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width        = size.w * dpr
      canvas.height       = size.h * dpr
      canvas.style.width  = `${size.w}px`
      canvas.style.height = `${size.h}px`
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      return ctx
    }

    if (generatedImg) {
      const img = new Image()
      img.onload = () => {
        const ctx = setupCanvas()
        ctx.drawImage(img, 0, 0, size.w, size.h)
      }
      img.src = generatedImg
    } else {
      const ctx = setupCanvas()
      ;(async () => renderLabel(ctx, size.w, size.h, { name, proof, giver, imageUrl }))()
    }
  }, [open, size, name, proof, giver, imageUrl, generatedImg])

  // Filtered bottles for picker
  const filtered = query.trim()
    ? bottles.filter(b => b.name?.toLowerCase().includes(query.toLowerCase()))
    : bottles

  function pickBottle(b) {
    setName(b.name ?? '')
    setProof(b.proof ? String(b.proof) : '')
    setImageUrl(b.photoUrl ?? null)
    setQuery('')
    setScanMsg(null)
  }

  async function handleScan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setScanMsg('Reading label with AI…')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const mediaType = file.type || 'image/jpeg'

      // Use the photo itself as the label image
      setImageUrl(`data:${mediaType};base64,${base64}`)

      const r = await fetch('/api/lookup/photo', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: base64, mediaType }),
      })
      const d = await r.json()
      if (d.found && d.bottle) {
        if (d.bottle.name)  setName(d.bottle.name)
        if (d.bottle.proof) setProof(String(d.bottle.proof))
        setScanMsg(`Found: ${d.bottle.name}`)
      } else {
        setScanMsg('Could not identify — fill in manually below')
      }
    } catch {
      setScanMsg('Scan failed — fill in manually below')
    } finally {
      setScanning(false)
      e.target.value = ''
    }
  }

  async function handleGenerate() {
    if (!name.trim()) return
    setGenerating(true)
    setGenError(null)
    setGeneratedImg(null)
    try {
      const matched    = bottles.find(b => b.name === name)
      const distillery = matched?.distillery ?? ''

      const res  = await fetch('/api/label/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, proof, distillery, giver }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setGeneratedImg(data.imageData)
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link    = document.createElement('a')
    link.download = `${(name || 'sample').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_label.png`
    link.href     = canvas.toDataURL('image/png')
    link.click()
  }

  async function handleBluetooth() {
    const canvas = canvasRef.current
    if (!canvas) return
    setBtError(null)
    try {
      await niimbotPrint(canvas, size.w, size.h, s => setBtStatus(s))
    } catch (err) {
      setBtError(err.message)
      setBtStatus(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Sample Label">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', paddingBottom: 'var(--sp-5)' }}>

        {/* Source tabs */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {[
            { id: 'collection', label: '📦  My Bottles' },
            { id: 'scan',       label: '📷  Scan Label'  },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSourceTab(t.id)}
              style={{
                flex:         1,
                padding:      'var(--sp-2) 0',
                borderRadius: 'var(--r-md)',
                border:       'none',
                cursor:       'pointer',
                fontWeight:   700,
                fontSize:     'var(--fs-body)',
                background:   sourceTab === t.id ? 'var(--copper-500)' : 'var(--bg-elev-2)',
                color:        sourceTab === t.id ? 'var(--text-inverse)' : 'var(--text-dim)',
                fontFamily:   'inherit',
                transition:   'background var(--t-base) var(--ease-out)',
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* ── My Bottles picker ── */}
        {sourceTab === 'collection' && (
          <div>
            {name ? (
              /* Selected state — show just the picked bottle */
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          'var(--sp-3)',
                padding:      'var(--sp-3)',
                background:   'rgba(217,126,44,0.10)',
                border:       '1px solid rgba(217,126,44,0.35)',
                borderRadius: 'var(--r-lg)',
              }}>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt=""
                    style={{ width: 36, height: 46, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  {proof && (
                    <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 2 }}>
                      {proof}° Proof
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setName(''); setProof(''); setImageUrl(null); setGeneratedImg(null); setGenError(null) }}
                  style={{
                    flexShrink:   0,
                    background:   'none',
                    border:       '1px solid var(--hairline-3)',
                    borderRadius: 'var(--r-md)',
                    color:        'var(--text-muted)',
                    fontSize:     'var(--fs-meta)',
                    fontWeight:   600,
                    cursor:       'pointer',
                    padding:      'var(--sp-1) var(--sp-2)',
                    fontFamily:   'inherit',
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              /* Picker state — search + list */
              <>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    strokeWidth={1.75}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }}
                  />
                  <input
                    style={{ ...fldInput, paddingLeft: 32 }}
                    placeholder="Search your bottles…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 'var(--sp-2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {filtered.slice(0, 30).map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => pickBottle(b)}
                      style={{
                        display:      'flex',
                        alignItems:   'center',
                        gap:          'var(--sp-2)',
                        padding:      'var(--sp-2) var(--sp-3)',
                        background:   'var(--bg-elev-2)',
                        border:       '1px solid transparent',
                        borderRadius: 'var(--r-md)',
                        cursor:       'pointer',
                        textAlign:    'left',
                        fontFamily:   'inherit',
                        width:        '100%',
                      }}
                    >
                      {b.photoUrl && (
                        <img src={b.photoUrl} alt="" style={{ width: 28, height: 36, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.name}
                        </div>
                        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>
                          {[b.distillery, b.proof ? `${b.proof}°` : null].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--fs-meta)', padding: 'var(--sp-4) 0', margin: 0 }}>
                      No bottles found
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Scan tab ── */}
        {sourceTab === 'scan' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleScan}
            />
            <button
              type="button"
              onClick={() => scanInputRef.current?.click()}
              disabled={scanning}
              style={{
                width:           '100%',
                padding:         'var(--sp-5)',
                background:      'var(--bg-elev-2)',
                border:          '2px dashed var(--hairline-3)',
                borderRadius:    'var(--r-lg)',
                cursor:          scanning ? 'wait' : 'pointer',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                gap:             'var(--sp-2)',
                color:           scanning ? 'var(--text-dim)' : 'var(--text-muted)',
                fontWeight:      700,
                fontSize:        'var(--fs-body)',
                fontFamily:      'inherit',
              }}
            >
              <Camera size={20} strokeWidth={1.75} />
              {scanning ? 'Scanning…' : 'Take photo of bottle label'}
            </button>
            {scanMsg && (
              <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', textAlign: 'center' }}>
                {scanMsg}
              </p>
            )}
          </div>
        )}

        {/* ── Label preview ── */}
        <div style={{
          display:        'flex',
          justifyContent: 'center',
          alignItems:     'center',
          background:     'var(--bg-elev-1)',
          borderRadius:   'var(--r-lg)',
          padding:        'var(--sp-5)',
          minHeight:      180,
        }}>
          {/* Canvas is always rendered (needed for download/print) but only visible when AI image is ready */}
          <canvas
            ref={canvasRef}
            style={{
              borderRadius: 3,
              boxShadow:    '0 4px 18px rgba(0,0,0,0.45)',
              maxWidth:     '100%',
              display:      generatedImg ? 'block' : 'none',
            }}
          />

          {/* Placeholder shown before generation */}
          {!generatedImg && (
            <div style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            'var(--sp-3)',
              textAlign:      'center',
              padding:        'var(--sp-4)',
            }}>
              <Wand2 size={32} strokeWidth={1.25} color="var(--text-dim)" style={{ opacity: 0.5 }} />
              {name ? (
                <>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>{name}</div>
                    {proof && <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)', marginTop: 2 }}>{proof}° Proof</div>}
                    {giver && <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-muted)' }}>From {giver}</div>}
                  </div>
                  <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>
                    Tap "Generate Label with AI" to create your label
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-dim)' }}>
                  Select a bottle above, then tap Generate
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Size ── */}
        <div>
          <label style={fldLabel}>Label Size</label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {SIZES.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSize(s)}
                style={{
                  flex:         1,
                  padding:      'var(--sp-2) 0',
                  borderRadius: 'var(--r-md)',
                  border:       'none',
                  cursor:       'pointer',
                  fontWeight:   700,
                  fontSize:     'var(--fs-meta)',
                  background:   size.id === s.id ? 'var(--copper-500)' : 'var(--bg-elev-2)',
                  color:        size.id === s.id ? 'var(--text-inverse)' : 'var(--text-dim)',
                  fontFamily:   'inherit',
                }}
              >{s.label}</button>
            ))}
          </div>
        </div>

        {/* ── Editable fields ── */}
        <div>
          <label style={fldLabel}>Proof</label>
          <input
            style={fldInput}
            type="number"
            value={proof}
            onChange={e => setProof(e.target.value)}
            placeholder="e.g. 107"
          />
          <label style={fldLabel}>From (your name on label)</label>
          <input
            style={fldInput}
            value={giver}
            onChange={e => setGiver(e.target.value)}
            placeholder="e.g. RyeGuy"
          />
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>

          {/* Generate */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !name.trim()}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            'var(--sp-2)',
              padding:        'var(--sp-3) var(--sp-4)',
              background:     generating || !name.trim() ? 'var(--bg-elev-2)' : 'var(--copper-500)',
              color:          generating || !name.trim() ? 'var(--text-dim)' : 'var(--text-inverse)',
              border:         'none',
              borderRadius:   'var(--r-lg)',
              fontWeight:     800,
              fontSize:       'var(--fs-body)',
              cursor:         generating || !name.trim() ? 'not-allowed' : 'pointer',
              fontFamily:     'inherit',
              transition:     'background var(--t-base) var(--ease-out)',
            }}
          >
            {generating
              ? <><Loader size={16} strokeWidth={1.75} /> Generating… (~20–30s)</>
              : <><Wand2  size={16} strokeWidth={1.75} /> {generatedImg ? 'Regenerate Label' : 'Generate Label with AI'}</>
            }
          </button>

          {genError && (
            <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--red)', textAlign: 'center' }}>
              {genError}
            </p>
          )}

          <button
            type="button"
            onClick={handleDownload}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            'var(--sp-2)',
              padding:        'var(--sp-3) var(--sp-4)',
              background:     'var(--copper-500)',
              color:          'var(--text-inverse)',
              border:         'none',
              borderRadius:   'var(--r-lg)',
              fontWeight:     800,
              fontSize:       'var(--fs-body)',
              cursor:         'pointer',
              fontFamily:     'inherit',
            }}
          >
            <Download size={16} strokeWidth={2} />
            Download PNG
          </button>

          <button
            type="button"
            onClick={hasBluetooth && !btStatus ? handleBluetooth : undefined}
            disabled={!!btStatus || !hasBluetooth}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            'var(--sp-2)',
              padding:        'var(--sp-3) var(--sp-4)',
              background:     'var(--bg-elev-2)',
              color:          hasBluetooth ? 'var(--text-primary)' : 'var(--text-dim)',
              border:         '1px solid var(--hairline-2)',
              borderRadius:   'var(--r-lg)',
              fontWeight:     700,
              fontSize:       'var(--fs-body)',
              cursor:         hasBluetooth && !btStatus ? 'pointer' : 'not-allowed',
              opacity:        hasBluetooth ? 1 : 0.5,
              fontFamily:     'inherit',
            }}
          >
            <Bluetooth size={16} strokeWidth={1.75} />
            {btStatus ?? (hasBluetooth ? 'Print via Bluetooth' : 'Bluetooth — Chrome/Edge only')}
          </button>

          {btError && (
            <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--red)', textAlign: 'center' }}>
              {btError}
            </p>
          )}

          <p style={{ margin: 0, fontSize: 'var(--fs-meta)', color: 'var(--text-dim)', textAlign: 'center', lineHeight: 1.5 }}>
            Download the PNG and import into the NIIMBOT app, or print directly via Bluetooth in Chrome/Edge.
          </p>
        </div>

      </div>
    </Sheet>
  )
}
