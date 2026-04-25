export default function manifest() {
  return {
    name:             'Whiskey Hunter',
    short_name:       'Whiskey Hunter',
    description:      "Track allocated bourbon truck deliveries across Chicagoland Binny's",
    start_url:        '/',
    display:          'standalone',
    orientation:      'portrait',
    background_color: '#0d0d1a',
    theme_color:      '#8B4513',
    icons: [
      { src: '/icon.png',  sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon.png',  sizes: '192x192', type: 'image/png' },
    ],
  }
}
