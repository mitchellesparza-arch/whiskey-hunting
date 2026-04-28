export default function manifest() {
  return {
    name:             'Tater Tracker',
    short_name:       'Tater Tracker',
    description:      "Community bourbon finds and truck tracker for Chicagoland Binny's — Jon and the Juice",
    start_url:        '/',
    display:          'standalone',
    orientation:      'portrait',
    background_color: '#0f0a05',
    theme_color:      '#e8943a',
    icons: [
      { src: '/icon',  sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon',  sizes: '192x192', type: 'image/png' },
    ],
  }
}
