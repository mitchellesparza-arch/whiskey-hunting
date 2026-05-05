// generate-vapid.js — run once with `node generate-vapid.js`, then delete.
// Uses only built-in Node.js crypto (no extra packages needed).
// Appends VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT to .env.local.

const { webcrypto } = require('crypto')
const fs = require('fs')
const path = require('path')

const { subtle } = webcrypto

;(async () => {
  // Generate P-256 key pair (VAPID spec)
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  )

  const publicJwk  = await subtle.exportKey('jwk', keyPair.publicKey)
  const privateJwk = await subtle.exportKey('jwk', keyPair.privateKey)

  // Build uncompressed point (0x04 || x || y) for the public key
  const x = Buffer.from(publicJwk.x, 'base64')
  const y = Buffer.from(publicJwk.y, 'base64')
  const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y])
  const vapidPublicKey  = uncompressed.toString('base64url')
  const vapidPrivateKey = privateJwk.d  // already base64url in JWK

  const envLines = [
    '',
    '# Push notifications — VAPID keys (keep private, add to Vercel env vars too)',
    `VAPID_PUBLIC_KEY=${vapidPublicKey}`,
    `VAPID_PRIVATE_KEY=${vapidPrivateKey}`,
    'VAPID_SUBJECT=mailto:mitchell.esparza@gmail.com',
  ].join('\n')

  const envPath = path.join(__dirname, '.env.local')
  fs.appendFileSync(envPath, envLines + '\n', 'utf8')

  console.log('✓ VAPID keys written to .env.local')
  console.log('  Remember to add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and')
  console.log('  VAPID_SUBJECT to your Vercel Environment Variables dashboard.')
  console.log('\nDelete this file when done:  del generate-vapid.js')
})()
