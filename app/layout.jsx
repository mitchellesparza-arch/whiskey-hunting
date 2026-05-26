import './globals.css'
import Providers     from './providers.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import BottomNav     from './components/BottomNav.jsx'
import PushInit      from './components/PushInit.jsx'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title:       'Tater Tracker',
  description: "Track allocated bourbon truck deliveries and community finds across Chicagoland Binny's",
  manifest:    '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16',   type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32',   type: 'image/png' },
      { url: '/icon-192.png',      sizes: '192x192',  type: 'image/png' },
      { url: '/icon-512.png',      sizes: '512x512',  type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png',     sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'black-translucent',
    title:          'Tater Tracker',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  themeColor: '#e8943a',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* Capture beforeinstallprompt before React hydrates — event fires early */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.__installPrompt = null;
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__installPrompt = e;
          });
        `}} />
      </head>
      <body className="min-h-screen antialiased" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <Providers>
          {/* safe-area-aware bottom padding so content clears the nav on all devices */}
          <div style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
            {children}
          </div>
        </Providers>
        <PushInit />
        <InstallPrompt />
        <BottomNav />
        <Analytics />
      </body>
    </html>
  )
}
