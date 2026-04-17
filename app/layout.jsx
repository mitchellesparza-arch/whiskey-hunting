import './globals.css'

export const metadata = {
  title: "Whiskey Hunter — Binny's Orland Park",
  description: "Track allocated bourbon availability at Binny's Orland Park",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
