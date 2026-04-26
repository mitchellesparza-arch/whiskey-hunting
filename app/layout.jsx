import './globals.css'
import Providers     from './providers.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import BottomNav     from './components/BottomNav.jsx'

export const metadata = {
  title:       "Whiskey Hunter — Chicagoland Binny's",
  description: "Track allocated bourbon truck deliveries across all Chicagoland Binny's locations",
  manifest:    '/manifest.webmanifest',
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'black-translucent',
    title:          'Whiskey Hunter',
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
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <Providers>
          {/* pb-20 = 80px bottom padding so content doesn't hide behind the nav */}
          <div className="pb-20">
            {children}
          </div>
        </Providers>
        <InstallPrompt />
        <BottomNav />
      </body>
    </html>
  )
}
