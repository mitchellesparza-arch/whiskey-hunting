/**
 * One-off cleanup for Blob objects that were uploaded but never deleted —
 * from before lib/blob-cleanup.js was wired into finds/collection/marketplace
 * removal and expiry. Those old orphans are still sitting in Blob storage
 * counting against the plan's usage cap; this script finds and removes them.
 *
 * Cross-references every blob actually in the store against every photoUrl
 * still referenced by:
 *   - active finds            (lib/finds.js        getFinds())
 *   - every user's collection (collection:* keys, scanned directly)
 *   - not-yet-expired listings (lib/marketplace.js  getListings({ activeOnly: false }))
 * Anything in the store but not referenced anywhere is an orphan.
 *
 * Defaults to a DRY RUN — prints what it would delete, deletes nothing.
 * Pass --delete to actually delete the orphans.
 *
 * Run:
 *   node scripts/cleanup-orphaned-blobs.mjs           (dry run)
 *   node scripts/cleanup-orphaned-blobs.mjs --delete  (actually deletes)
 *
 * Requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN and
 * BLOB_READ_WRITE_TOKEN in the environment (e.g. via `vercel env pull`).
 * The Blob store must not be suspended for `list`/`del` to work.
 */

import { Redis }        from '@upstash/redis'
import { getFinds }     from '../lib/finds.js'
import { getListings }  from '../lib/marketplace.js'

const DELETE = process.argv.includes('--delete')

async function collectCollectionPhotoUrls(redis) {
  const urls = new Set()
  let cursor = 0
  do {
    const [next, keys] = await redis.scan(cursor, { match: 'collection:*', count: 100 })
    cursor = Number(next)
    for (const k of keys) {
      try {
        const raw     = await redis.get(k)
        const bottles = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : [])
        for (const b of bottles) {
          if (b?.photoUrl) urls.add(b.photoUrl)
        }
      } catch (err) {
        console.warn(`  ! failed to read ${k}:`, err?.message ?? err)
      }
    }
  } while (cursor !== 0)
  return urls
}

async function main() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in environment')
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN in environment')
  }

  const { list, del } = await import('@vercel/blob')
  const redis = Redis.fromEnv()

  console.log(`Mode: ${DELETE ? 'DELETE (irreversible)' : 'DRY RUN — nothing will be deleted'}\n`)

  // ── 1. Gather every URL still referenced by a live record ─────────────────
  console.log('Collecting referenced photo URLs…')

  const finds = await getFinds()
  const findUrls = new Set(finds.map(f => f.photoUrl).filter(Boolean))
  console.log(`  finds:       ${findUrls.size} photo(s) across ${finds.length} active/archived finds`)

  const collectionUrls = await collectCollectionPhotoUrls(redis)
  console.log(`  collection:  ${collectionUrls.size} photo(s)`)

  const listings = await getListings({ activeOnly: false })
  const listingUrls = new Set(listings.flatMap(l => l.photos ?? []))
  console.log(`  marketplace: ${listingUrls.size} photo(s) across ${listings.length} listings`)

  const referenced = new Set([...findUrls, ...collectionUrls, ...listingUrls])
  console.log(`  total referenced: ${referenced.size}\n`)

  // ── 2. List every blob actually in the store ───────────────────────────────
  console.log('Listing all blobs in the store…')
  const allBlobs = []
  let cursor
  do {
    const page = await list({ cursor, limit: 1000 })
    allBlobs.push(...page.blobs)
    cursor = page.cursor
  } while (cursor)
  console.log(`  total blobs in store: ${allBlobs.length}\n`)

  // ── 3. Diff ──────────────────────────────────────────────────────────────
  const orphans   = allBlobs.filter(b => !referenced.has(b.url))
  const totalSize = orphans.reduce((sum, b) => sum + (b.size ?? 0), 0)

  console.log(`Orphaned blobs: ${orphans.length} (${(totalSize / 1024 / 1024).toFixed(1)} MB)`)
  if (orphans.length) {
    console.log('\nSample (up to 20):')
    for (const b of orphans.slice(0, 20)) {
      console.log(`  ${b.pathname}  (${((b.size ?? 0) / 1024).toFixed(0)} KB)  uploaded ${b.uploadedAt}`)
    }
  }

  if (!orphans.length) {
    console.log('\nNothing to clean up.')
    return
  }

  if (!DELETE) {
    console.log(`\nDry run only — rerun with --delete to remove these ${orphans.length} blob(s).`)
    return
  }

  console.log(`\nDeleting ${orphans.length} orphaned blob(s)…`)
  const BATCH = 100
  let deleted = 0
  for (let i = 0; i < orphans.length; i += BATCH) {
    const batch = orphans.slice(i, i + BATCH).map(b => b.url)
    await del(batch)
    deleted += batch.length
    console.log(`  deleted ${deleted}/${orphans.length}`)
  }

  console.log(`\nDone — freed ${(totalSize / 1024 / 1024).toFixed(1)} MB.`)
}

main().catch(err => { console.error(err); process.exit(1) })
