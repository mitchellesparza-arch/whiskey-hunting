import { ImageResponse } from 'next/og'

export const size        = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width:           512,
        height:          512,
        background:      'linear-gradient(145deg, #6b2d0a, #8B4513)',
        borderRadius:    96,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontSize:        320,
        lineHeight:      1,
      }}
    >
      🥃
    </div>,
    { width: 512, height: 512 }
  )
}
