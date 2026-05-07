/**
 * CLI wrapper around lib/iowa-import.js — run the Iowa Liquor Products → Redis
 * import from a local shell.
 *
 *   node scripts/import-iowa-upcs.mjs            # live import
 *   node scripts/import-iowa-upcs.mjs --dry-run  # preview only, no writes
 *
 * Requires UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in env (live mode).
 * See lib/iowa-import.js for the full source/filter/refresh contract.
 */

import { runIowaImport } from '../lib/iowa-import.js'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const result = await runIowaImport({ dryRun, log: console.log })

  console.log('\n──────────────────────────────────────────────────')
  console.log('Allocated-bottle preview:')
  for (const [term, hits] of Object.entries(result.watchlist)) {
    if (hits.length === 0) continue
    console.log(`\n  [${term}]`)
    for (const h of hits.slice(0, 6)) {
      console.log(`    ${h.upc}  ${h.name}  (${h.sizeMl}ml)`)
    }
    if (hits.length > 6) console.log(`    … and ${hits.length - 6} more`)
  }

  console.log('\n──────────────────────────────────────────────────')
  if (dryRun) {
    console.log(`Dry run complete — ${result.stats.kept.toLocaleString()} UPCs would be written.`)
  } else {
    console.log(`Done — ${result.written.toLocaleString()} UPCs cached · ${result.protected} user-confirmed preserved.`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
