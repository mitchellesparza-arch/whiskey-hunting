'use client'
/**
 * FindsMap — Leaflet map showing all whiskey finds.
 *
 * Dynamically imported (ssr: false) from page.jsx.
 * Uses raw Leaflet (not react-leaflet) to avoid SSR issues.
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
        center:    [41.85, -87.9],
        zoom:      10,
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

  function addMarkers(L, map) {
    // Remove old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const validFinds = finds.filter(f => f.store?.lat != null && f.store?.lng != null)

    validFinds.forEach(find => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background:#8B4513;
          border:2px solid #d4a054;
          border-radius:50%;
          width:14px;
          height:14px;
          box-shadow:0 0 6px rgba(212,160,84,0.6);
        "></div>`,
        iconSize:   [14, 14],
        iconAnchor: [7, 7],
      })

      const date = find.timestamp
        ? new Date(find.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—'

      const popup = L.popup({ maxWidth: 260 }).setContent(`
        <div style="font-family:system-ui;color:#111;line-height:1.4">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">
            🥃 ${escHtml(find.bottleName)}
          </div>
          <div style="font-size:12px;color:#555;margin-bottom:2px">
            📍 ${escHtml(find.store?.name ?? '—')}
          </div>
          ${find.store?.address ? `<div style="font-size:11px;color:#777;margin-bottom:4px">${escHtml(find.store.address)}</div>` : ''}
          <div style="font-size:11px;color:#888;margin-bottom:4px">
            Reported ${date} by ${escHtml(find.submitterName ?? '—')}
          </div>
          ${find.notes ? `<div style="font-size:12px;color:#333;font-style:italic">"${escHtml(find.notes)}"</div>` : ''}
          ${find.photoUrl ? `<img src="${escHtml(find.photoUrl)}" style="width:100%;border-radius:4px;margin-top:6px" />` : ''}
        </div>
      `)

      const marker = L.marker([find.store.lat, find.store.lng], { icon })
        .addTo(map)
        .bindPopup(popup)

      markersRef.current.push(marker)
    })

    // Fit bounds if we have markers
    if (markersRef.current.length > 0) {
      try {
        const group = L.featureGroup(markersRef.current)
        map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 13 })
      } catch {}
    }
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
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
