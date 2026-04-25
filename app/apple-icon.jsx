import { ImageResponse } from 'next/og'

export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width:           180,
        height:          180,
        background:      'linear-gradient(145deg, #6b2d0a, #8B4513)',
        borderRadius:    40,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontSize:        110,
        lineHeight:      1,
      }}
    >
      🥃
    </div>,
    { width: 180, height: 180 }
  )
}
