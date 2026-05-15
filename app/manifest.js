export default function manifest() {
  return {
    name:             'Tater Tracker',
    short_name:       'Tater Tracker',
    description:      "Community bourbon finds and truck tracker for Chicagoland Binny's — Tater Tracker",
    start_url:        '/',
    display:          'standalone',
    orientation:      'portrait',
    background_color: '#0f0a05',
    theme_color:      '#e8943a',
    icons: [
      { src: '/icon-48.png',           sizes: '48x48',   type: 'image/png' },
      { src: '/icon-72.png',           sizes: '72x72',   type: 'image/png' },
      { src: '/icon-96.png',           sizes: '96x96',   type: 'image/png' },
      { src: '/icon-128.png',          sizes: '128x128', type: 'image/png' },
      { src: '/icon-144.png',          sizes: '144x144', type: 'image/png' },
      { src: '/icon-192.png',          sizes: '192x192', type: 'image/png' },
      { src: '/icon-256.png',          sizes: '256x256', type: 'image/png' },
      { src: '/icon-384.png',          sizes: '384x384', type: 'image/png' },
      { src: '/icon-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-1024-rounded.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
