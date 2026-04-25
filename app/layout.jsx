import './globals.css'
import Providers       from './providers.jsx'
import InstallPrompt   from './components/InstallPrompt.jsx'

export const metadata = {
  title:       "Whiskey Hunter — Chicagoland Binny's",
  description: "Track allocated bourbon truck deliveries across all Chicagoland Binny's locations",
  manifest:    '/manifest.webmanifest',
  appleWebApp: {
    capable:           true,
    statusBarStyle:    'black-translucent',
    title:             'Whiskey Hunter',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport = {
  themeColor: '#8B4513',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
        <InstallPrompt />
      </body>
    </html>
  )
}
