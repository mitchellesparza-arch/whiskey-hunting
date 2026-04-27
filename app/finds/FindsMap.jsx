'use client'
/**
 * FindsMap — Leaflet map showing all whiskey finds.
 *
 * Dynamically imported (ssr: false) from page.jsx.
 * Uses raw Leaflet (not react-leaflet) to avoid SSR issues.
 *
 * Features:
 *   - Groups multiple finds at the same store under one marker
 *   - Marker shows a count badge when 2+ finds exist at a location
 *   - Multi-find popup has ‹ Prev / Next › navigation
 *
 * Props:
 *   finds: Find[]  — array of find objects with store.lat / store.lng
 */

import { useEffect, useRef } from 'react'

export default function FindsMap({ finds }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const markersRef   = useRef([])

  useEffect(() => {
    if (!containerRef.current) return
    let L
    let mounted = true

    async function init() {
      L = (await import('leaflet')).default

      // Fix default icon URLs (broken by webpack)
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!mounted) return

      // Init map centered on Chicagoland
      const map = L.map(containerRef.current, {
        center:      [41.85, -87.9],
        zoom:        10,
        zoomControl: true,
      })
      mapRef.current = map

      // Dark CartoDB tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains:  'abcd',
        maxZoom:     19,
      }).addTo(map)

      addMarkers(L, map)
    }

    init()
    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update markers when finds change (after map init)
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(mod => {
      const L = mod.default
      addMarkers(L, mapRef.current)
    })
  }, [finds])

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function fmtTs(ts) {
    if (!ts) return '—'
    const d = new Date(ts)
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }

  function timeAgo(ts) {
    if (!ts) return ''
    const m = Math.floor((Date.now() - ts) / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  // Build HTML for one find's content (used in both single and multi popups)
  function findHtml(find) {
    return `
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;color:#1a0e04">
        🥃 ${escHtml(find.bottleName)}
      </div>
      <div style="font-size:11px;color:#888;margin-bottom:${find.notes || find.photoUrl ? 4 : 0}px">
        ${escHtml(fmtTs(find.timestamp))}${find.timestamp ? ` · ${escHtml(timeAgo(find.timestamp))}` : ''}
        ${find.price ? ` · <span style="color:#c46c1a;font-weight:700">$${Number(find.price).toFixed(2)}</span>` : ''}
        ${find.submitterName ? ` · <span style="color:#9a7c55">${escHtml(find.submitterName)}</span>` : ''}
      </div>
      ${find.notes ? `<div style="font-size:12px;color:#333;font-style:italic;margin-bottom:${find.photoUrl ? 4 : 0}px">"${escHtml(find.notes)}"</div>` : ''}
      ${find.photoUrl ? `<img src="${escHtml(find.photoUrl)}" style="width:100%;max-height:130px;object-fit:cover;border-radius:4px;margin-top:4px" />` : ''}
    `
  }

  // Single-find popup
  function buildSinglePopup(find) {
    return `
      <div style="font-family:system-ui;line-height:1.4;min-width:200px">
        <div style="font-weight:700;font-size:13px;color:#555;margin-bottom:6px">
          📍 ${escHtml(find.store?.name ?? '—')}
          ${find.store?.address ? `<div style="font-size:11px;color:#888;font-weight:400">${escHtml(find.store.address)}</div>` : ''}
        </div>
        ${findHtml(find)}
      </div>
    `
  }

  // Multi-find popup with nav arrows.
  // Buttons use data-nav attributes instead of onclick — Leaflet event listeners
  // are attached via L.DomEvent after the popup opens so touch events work on mobile.
  function buildMultiPopup(groupFinds, idx) {
    const find  = groupFinds[idx]
    const total = groupFinds.length
    const navBtnStyle = [
      'padding:6px 16px',
      'border-radius:4px',
      'border:none',
      'cursor:pointer',
      'background:#8B4513',
      'color:#fff',
      'font-size:16px',
      'font-weight:700',
      'touch-action:manipulation',   // prevents 300ms tap delay on iOS
      '-webkit-tap-highlight-color:transparent',
    ].join(';')
    return `
      <div style="font-family:system-ui;line-height:1.4;min-width:220px">
        <div style="font-weight:700;font-size:13px;color:#555;margin-bottom:6px">
          📍 ${escHtml(find.store?.name ?? '—')}
          ${find.store?.address ? `<div style="font-size:11px;color:#888;font-weight:400">${escHtml(find.store.address)}</div>` : ''}
        </div>
        ${findHtml(find)}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid #eee">
          <button data-nav="-1" style="${navBtnStyle}">‹</button>
          <span style="font-size:12px;color:#888">${idx + 1} of ${total}</span>
          <button data-nav="1" style="${navBtnStyle}">›</button>
        </div>
      </div>
    `
  }

  function addMarkers(L, map) {
    // Clean up old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const validFinds = finds.filter(f => f.store?.lat != null && f.store?.lng != null)

    // Group finds by store (use placeId when available, else lat+lng key)
    const groups = {}
    for (const find of validFinds) {
      const key = find.store.placeId
        || `${find.store.lat.toFixed(5)},${find.store.lng.toFixed(5)}`
      if (!groups[key]) groups[key] = { store: find.store, finds: [] }
      groups[key].finds.push(find)
    }

    let navCounter = 0

    Object.values(groups).forEach(({ store, finds: groupFinds }) => {
      const count = groupFinds.length

      // Marker icon — larger with count badge for multi-find stores
      const size = count > 1 ? 22 : 14
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background:#8B4513;
          border:2px solid #d4a054;
          border-radius:50%;
          width:${size}px;
          height:${size}px;
          box-shadow:0 0 6px rgba(212,160,84,0.6);
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:10px;
          font-weight:700;
          color:#fff;
          line-height:1;
        ">${count > 1 ? count : ''}</div>`,
        iconSize:   [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      if (count === 1) {
        // ── Single-find marker ──────────────────────────────────────────────
        const popup  = L.popup({ maxWidth: 280 }).setContent(buildSinglePopup(groupFinds[0]))
        const marker = L.marker([store.lat, store.lng], { icon }).addTo(map).bindPopup(popup)

        // Prevent tap events inside popup from bubbling to map (closes popup on mobile)
        marker.on('popupopen', () => {
          const el = marker.getPopup()?.getElement()
          if (el) {
            L.DomEvent.disableClickPropagation(el)
            L.DomEvent.disableScrollPropagation(el)
          }
        })

        markersRef.current.push(marker)
      } else {
        // ── Multi-find marker — prev/next navigation ─────────────────────────
        navCounter++  // keep incrementing so IDs stay unique (not actually used in HTML now)
        let idx = 0

        const popup  = L.popup({ maxWidth: 290 }).setContent(buildMultiPopup(groupFinds, 0))
        const marker = L.marker([store.lat, store.lng], { icon }).addTo(map).bindPopup(popup)

        function attachNavHandlers() {
          const popupEl = marker.getPopup()?.getElement()
          if (!popupEl) return

          // Stop ALL touch/click events inside the popup from reaching the map
          L.DomEvent.disableClickPropagation(popupEl)
          L.DomEvent.disableScrollPropagation(popupEl)

          // Bind prev/next buttons using Leaflet's event system (works on mobile)
          popupEl.querySelectorAll('[data-nav]').forEach(btn => {
            // Remove any previously-bound listeners to avoid duplicates after setPopupContent
            L.DomEvent.off(btn)
            L.DomEvent.on(btn, 'click', function(e) {
              L.DomEvent.stopPropagation(e)
              const dir = Number(btn.getAttribute('data-nav'))
              idx = (idx + dir + groupFinds.length) % groupFinds.length
              marker.setPopupContent(buildMultiPopup(groupFinds, idx))
              // Re-bind after DOM replacement (setPopupContent swaps innerHTML)
              setTimeout(attachNavHandlers, 0)
            })
          })
        }

        marker.on('popupopen', attachNavHandlers)

        markersRef.current.push(marker)
      }
    })

    // Fit bounds if we have markers
    if (markersRef.current.length > 0) {
      try {
        const group = L.featureGroup(markersRef.current)
        map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 13 })
      } catch {}
    }
  }

  return (
    <>
      {/* Leaflet CSS — must not be a top-level import */}
      <style>{`@import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');`}</style>
      <div
        ref={containerRef}
        style={{ width: '100%', height: 380, borderRadius: 8, overflow: 'hidden', background: '#111' }}
      />
    </>
  )
}
