import './globals.css'
import Providers from './providers.jsx'

export const metadata = {
  title: "Whiskey Hunter — Chicagoland Binny's",
  description: "Track allocated bourbon truck deliveries across all Chicagoland Binny's locations",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
