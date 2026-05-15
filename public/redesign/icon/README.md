# Tater Tracker — App Icon Drop-In

Drop the **PNG files in this folder** straight into your Next.js app at `public/`. Then add (or update) `public/manifest.json` with the snippet below, and the `<head>` tags in `app/layout.tsx`.

## 1. Files to copy into `public/`

```
public/
├── favicon-16x16.png
├── favicon-32x32.png
├── apple-touch-icon.png         ← 180×180, iOS home screen
├── apple-touch-icon-152.png     ← 152×152, older iPad
├── icon-48.png
├── icon-64.png
├── icon-72.png
├── icon-96.png
├── icon-128.png
├── icon-144.png
├── icon-192.png                 ← Android / PWA
├── icon-256.png
├── icon-384.png
├── icon-512.png                 ← PWA splash + Android
├── icon-1024.png                ← App Store / source master
└── icon-1024-rounded.png        ← preview only (already rounded)
```

The platform applies its own rounded-square mask, so the **square** versions are what you ship. `icon-1024-rounded.png` is just a preview of how it'll look on a phone.

## 2. `public/manifest.json`

```json
{
  "name": "Tater Tracker",
  "short_name": "Tater",
  "description": "Chicagoland bourbon hunting app — Tater Tracker — finds, tracker, marketplace, blind tastings.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0c0805",
  "theme_color": "#d97e2c",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

## 3. `app/layout.tsx` — `<head>` tags

```tsx
export const metadata = {
  title: "Tater Tracker",
  description: "Chicagoland bourbon hunting app — Tater Tracker.",
  manifest: "/manifest.json",
  themeColor: "#d97e2c",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};
```

## 4. Bust the cache

After deploying, members will need to **remove and reinstall the PWA** to see the new home-screen icon — iOS and Android both cache the install icon aggressively. Standard browser-tab favicon updates on next reload.
