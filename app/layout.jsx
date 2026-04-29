import './globals.css'
import Providers     from './providers.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import BottomNav     from './components/BottomNav.jsx'

export const metadata = {
  title:       'Tater Tracker',
  description: "Track allocated bourbon truck deliveries and community finds across Chicagoland Binny's",
  manifest:    '/manifest.webmanifest',
  icons: {
    icon:  '/tater-icon.png',
    apple: '/tater-icon.png',
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
        <InstallPrompt />
        <BottomNav />
      </body>
    </html>
  )
}
