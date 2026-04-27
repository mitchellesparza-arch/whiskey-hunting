import './globals.css'
import Providers     from './providers.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import BottomNav     from './components/BottomNav.jsx'

export const metadata = {
  title:       'Tater Tracker',
  description: "Track allocated bourbon truck deliveries and community finds across Chicagoland Binny's",
  manifest:    '/manifest.webmanifest',
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
