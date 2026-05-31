'use client'
import { useEffect, useRef } from 'react'

/**
 * IndependentsMap — Leaflet map showing independent retailer locations.
 * Green pulsing pin = has allocated stock right now.
 * Grey pin = checked, nothing in stock.
 *
 * This file is dynamically imported (SSR disabled) from IndependentsTab.
 */
export default function IndependentsMap({ retailers, allFinds, selected, onSelect }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const markersRef   = useRef([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Dynamically import Leaflet (browser-only)
    import('leaflet').then(L => {
      // Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link  = document.createElement('link')
        link.id     = 'leaflet-css'
        link.rel    = 'stylesheet'
        link.href   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      // Chicagoland center
      const map = L.map(containerRef.current, {
        center:  [41.88, -87.85],
        zoom:    9,
        zoomControl: true,
        attributionControl: false,
      })

      mapRef.current = map

      // Dark tile layer matching app theme
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 18 }
      ).addTo(map)

      // Build markers
      function buildMarkers() {
        // Remove old markers
        markersRef.current.forEach(m => m.remove())
        markersRef.current = []

        retailers.forEach(retailer => {
          const hasStock = allFinds.some(f => f.retailer === retailer.name)
          const isSelected = selected === retailer.name
          const finds = allFinds.filter(f => f.retailer === retailer.name)

          // Custom SVG pin
          const color  = hasStock ? '#5dd39e' : '#6b7280'
          const glow   = hasStock ? 'drop-shadow(0 0 6px rgba(93,211,158,0.7))' : 'none'
          const size   = isSelected ? 36 : 28

          const icon = L.divIcon({
            className: '',
            iconSize:  [size, size],
            iconAnchor: [size/2, size],
            html: `
              <div style="position:relative;width:${size}px;height:${size}px;">
                ${hasStock ? `
                  <div style="
                    position:absolute;inset:0;
                    border-radius:50%;
                    border:2px solid rgba(93,211,158,0.4);
                    animation:map-pulse 2s ease-out infinite;
                    box-sizing:border-box;
                  "></div>` : ''}
                <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg"
                  style="filter:${glow};width:${size}px;height:${size}px;">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <style>
                @keyframes map-pulse {
                  0%   { transform:scale(1);   opacity:0.8; }
                  100% { transform:scale(2.2); opacity:0;   }
                }
              </style>
            `,
          })

          // Popup content
          const bottleLines = finds.length > 0
            ? finds.map(f =>
                `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                   <span style="width:7px;height:7px;border-radius:50%;background:#5dd39e;flex-shrink:0"></span>
                   <a href="${f.url}" target="_blank" rel="noopener"
                      style="color:#c9a87a;font-weight:700;text-decoration:none;font-size:12px;">${f.bottle}</a>
                   ${f.price ? `<span style="color:#e8943a;font-size:11px;font-weight:700;">$${f.price.toFixed(2)}</span>` : ''}
                 </div>`
              ).join('')
            : `<div style="color:#6b7280;font-size:12px;">Nothing in stock right now</div>`

          const popup = L.popup({
            className:   'indie-popup',
            maxWidth:    260,
            closeButton: true,
          }).setContent(`
            <div style="font-family:var(--font-body,sans-serif);">
              <div style="font-weight:800;font-size:14px;color:#f4e8d8;margin-bottom:2px;">${retailer.name}</div>
              <div style="font-size:11px;color:#9a7c55;margin-bottom:8px;">${retailer.location}</div>
              ${bottleLines}
              <a href="${retailer.url}" target="_blank" rel="noopener"
                 style="display:inline-block;margin-top:8px;font-size:11px;color:#e8943a;text-decoration:none;font-weight:600;">
                Visit store →
              </a>
            </div>
          `)

          const marker = L.marker([retailer.lat, retailer.lng], { icon })
            .addTo(map)
            .bindPopup(popup)

          marker.on('click', () => onSelect(retailer.name))

          if (isSelected) {
            marker.openPopup()
          }

          markersRef.current.push(marker)
        })
      }

      buildMarkers()

      // Inject popup styles
      if (!document.getElementById('indie-map-styles')) {
        const style = document.createElement('style')
        style.id    = 'indie-map-styles'
        style.textContent = `
          .indie-popup .leaflet-popup-content-wrapper {
            background: #1a1008;
            border: 1px solid #4a2e10;
            border-radius: 10px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            padding: 0;
          }
          .indie-popup .leaflet-popup-content {
            margin: 14px 16px;
            line-height: 1.4;
          }
          .indie-popup .leaflet-popup-tip {
            background: #1a1008;
          }
          .indie-popup .leaflet-popup-close-button {
            color: #9a7c55 !important;
            font-size: 16px !important;
          }
        `
        document.head.appendChild(style)
      }
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // mount once

  // Re-render markers when data changes
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(L => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      retailers.forEach(retailer => {
        const hasStock   = allFinds.some(f => f.retailer === retailer.name)
        const isSelected = selected === retailer.name
        const finds      = allFinds.filter(f => f.retailer === retailer.name)
        const color  = hasStock ? '#5dd39e' : '#6b7280'
        const glow   = hasStock ? 'drop-shadow(0 0 6px rgba(93,211,158,0.7))' : 'none'
        const size   = isSelected ? 36 : 28

        const icon = L.divIcon({
          className: '',
          iconSize:  [size, size],
          iconAnchor: [size/2, size],
          html: `
            <div style="position:relative;width:${size}px;height:${size}px;">
              ${hasStock ? `
                <div style="
                  position:absolute;inset:0;
                  border-radius:50%;
                  border:2px solid rgba(93,211,158,0.4);
                  animation:map-pulse 2s ease-out infinite;
                  box-sizing:border-box;
                "></div>` : ''}
              <svg viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg"
                style="filter:${glow};width:${size}px;height:${size}px;">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          `,
        })

        const bottleLines = finds.length > 0
          ? finds.map(f =>
              `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                 <span style="width:7px;height:7px;border-radius:50%;background:#5dd39e;flex-shrink:0"></span>
                 <a href="${f.url}" target="_blank" rel="noopener"
                    style="color:#c9a87a;font-weight:700;text-decoration:none;font-size:12px;">${f.bottle}</a>
                 ${f.price ? `<span style="color:#e8943a;font-size:11px;font-weight:700;">$${f.price.toFixed(2)}</span>` : ''}
               </div>`
            ).join('')
          : `<div style="color:#6b7280;font-size:12px;">Nothing in stock right now</div>`

        const popup = L.popup({
          className:   'indie-popup',
          maxWidth:    260,
          closeButton: true,
        }).setContent(`
          <div style="font-family:var(--font-body,sans-serif);">
            <div style="font-weight:800;font-size:14px;color:#f4e8d8;margin-bottom:2px;">${retailer.name}</div>
            <div style="font-size:11px;color:#9a7c55;margin-bottom:8px;">${retailer.location}</div>
            ${bottleLines}
            <a href="${retailer.url}" target="_blank" rel="noopener"
               style="display:inline-block;margin-top:8px;font-size:11px;color:#e8943a;text-decoration:none;font-weight:600;">
              Visit store →
            </a>
          </div>
        `)

        const marker = L.marker([retailer.lat, retailer.lng], { icon })
          .addTo(mapRef.current)
          .bindPopup(popup)

        marker.on('click', () => onSelect(retailer.name))

        if (isSelected) {
          setTimeout(() => marker.openPopup(), 100)
        }

        markersRef.current.push(marker)
      })
    })
  }, [retailers, allFinds, selected])

  return (
    <div
      ref={containerRef}
      style={{
        height:       320,
        borderRadius: 'var(--r-md)',
        overflow:     'hidden',
        border:       '1px solid var(--hairline)',
      }}
    />
  )
}
