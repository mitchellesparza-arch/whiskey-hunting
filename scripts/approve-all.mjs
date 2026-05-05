/**
 * Approve all pending users in one shot.
 * Run from the project root: node scripts/approve-all.mjs
 */
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const APPROVED_KEY = 'wh:auth:approved'
const PENDING_KEY  = 'wh:auth:pending'

const pending = (await redis.hgetall(PENDING_KEY)) ?? {}
const entries = Object.entries(pending)

if (entries.length === 0) {
  console.log('No pending users.')
  process.exit(0)
}

console.log(`Approving ${entries.length} user(s):\n`)
for (const [email, raw] of entries) {
  let name = email
  try { name = JSON.parse(raw)?.name ?? email } catch {}
  await redis.sadd(APPROVED_KEY, email)
  await redis.hdel(PENDING_KEY, email)
  console.log(`  ✓  ${name} <${email}>`)
}
console.log('\nDone. They can reload their pending page to get in.')
