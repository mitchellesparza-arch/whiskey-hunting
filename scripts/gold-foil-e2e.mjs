#!/usr/bin/env node
/**
 * scripts/gold-foil-e2e.mjs
 *
 * End-to-end test for the Gold Foil monitor's notification pipeline.
 * Hits the live /api/reservebar-monitor?test_notify=1 endpoint and confirms
 * a push notification is delivered to your actual device(s).
 *
 * Usage:
 *   npm run test:gold-foil-e2e
 *
 * Required env vars (can be set in .env.local):
 *   NEXT_PUBLIC_BASE_URL   — your deployment URL, e.g. https://whiskey-hunter.vercel.app
 *   CRON_SECRET            — the CRON_SECRET configured in Vercel
 *
 * The script exits 0 on HTTP 200, non-zero on any error. It does NOT verify
 * that the push actually vibrated your phone (that requires you to look), but
 * it confirms the push pipeline completed without error on the server.
 */

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '')
const secret  = process.env.CRON_SECRET

if (!baseUrl) {
  console.error('Error: NEXT_PUBLIC_BASE_URL is not set.')
  console.error('  export NEXT_PUBLIC_BASE_URL=https://whiskey-hunter.vercel.app')
  process.exit(1)
}

if (!secret) {
  console.error('Error: CRON_SECRET is not set.')
  process.exit(1)
}

const url = `${baseUrl}/api/reservebar-monitor?test_notify=1`

console.log(`Sending test notification via ${url} …`)

let res
try {
  res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${secret}` },
  })
} catch (err) {
  console.error('Fetch failed:', err.message)
  process.exit(1)
}

const body = await res.json().catch(() => ({}))

if (!res.ok) {
  console.error(`HTTP ${res.status}:`, JSON.stringify(body, null, 2))
  process.exit(1)
}

if (!body.testNotificationSent) {
  console.error('Server responded 200 but testNotificationSent was not true:')
  console.error(JSON.stringify(body, null, 2))
  process.exit(1)
}

console.log('✓ Server confirmed test notification was sent.')
console.log('  Check your device — you should see:')
console.log('    Title: 🥃 [TEST] Gold Foil Monitor')
console.log('    Body:  This is a test notification — push delivery confirmed.')
console.log()
console.log('If no notification arrives within ~30 seconds:')
console.log('  • Confirm your browser has push permission enabled for this site')
console.log('  • Visit /profile and re-enable push notifications')
console.log('  • Check Vercel function logs for VAPID errors')
