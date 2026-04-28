import { ImageResponse } from 'next/og'

export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

/**
 * iOS home-screen icon — served as <link rel="apple-touch-icon">.
 * Pure SVG paths, no emoji, no fonts — renders on Vercel edge runtime.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          180,
          height:         180,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     '#1a0e04',
          borderRadius:   40,
        }}
      >
        <svg width="120" height="140" viewBox="0 0 340 400" fill="none">
          {/* Amber liquid — lower 55% of glass */}
          <path d="M66 158 L274 158 L238 312 L102 312 Z" fill="#c46c1a" />
          {/* Liquid highlight at the surface */}
          <path d="M66 158 L274 158 L266 192 L74 192 Z" fill="#e8943a" />
          {/* Glass body outline (trapezoid, wider at top) */}
          <path
            d="M30 22 L310 22 L238 312 L102 312 Z"
            fill="rgba(212,160,84,0.07)"
            stroke="#d4a054"
            strokeWidth="13"
            strokeLinejoin="round"
          />
          {/* Ice cube */}
          <rect x="114" y="196" width="76" height="76" rx="11"
            fill="rgba(255,255,255,0.25)"
            stroke="rgba(255,255,255,0.52)"
            strokeWidth="4"
          />
          {/* Base */}
          <rect x="88" y="314" width="164" height="26" rx="13" fill="#d4a054" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
