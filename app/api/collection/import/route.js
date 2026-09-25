import { NextResponse }       from 'next/server'
import { getToken }           from 'next-auth/jwt'
import { importToCollection } from '../../../../lib/collection.js'
import { parseCsv, rowsToEntries, MAX_IMPORT_ROWS } from '../../../../lib/collection-csv.js'
import { getUserProfile }     from '../../../../lib/friends.js'
import { isPro }              from '../../../../lib/tier.js'

const MAX_BYTES = 2 * 1024 * 1024

/**
 * POST /api/collection/import  { csv: string, dryRun?: boolean }
 *
 * Pro only. Parses a CSV (our export format or another tracker's, matched by
 * header aliases) and appends the bottles to the caller's collection.
 * dryRun returns the same summary without writing, for the confirm step.
 *
 * Returns { added, duplicates, skipped, unmatchedHeaders, preview, bottles? }
 */
export async function POST(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = token.email.toLowerCase()

  // token.tier is only set at sign-in; check live tier so upgrades apply immediately
  const profile = await getUserProfile(userId).catch(() => null)
  if (!isPro(profile?.tier ?? token.tier)) {
    return NextResponse.json({ error: 'Pro required', upgradeRequired: true }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const csv = typeof body?.csv === 'string' ? body.csv : ''
  if (!csv.trim())            return NextResponse.json({ error: 'The file is empty.' }, { status: 400 })
  if (csv.length > MAX_BYTES) return NextResponse.json({ error: 'File is too large (2 MB max).' }, { status: 413 })

  let parsed
  try {
    const rows = parseCsv(csv)
    if (rows.length - 1 > MAX_IMPORT_ROWS) {
      return NextResponse.json({ error: `Too many rows (${MAX_IMPORT_ROWS} max).` }, { status: 413 })
    }
    parsed = rowsToEntries(rows)
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  try {
    const { added, duplicates, bottles } = await importToCollection(userId, parsed.entries, { dryRun: !!body.dryRun })
    return NextResponse.json({
      added:            added.length,
      duplicates:       duplicates.length,
      skipped:          parsed.skipped,
      unmatchedHeaders: parsed.unmatchedHeaders,
      preview:          added.slice(0, 5).map(b => ({ name: b.name, category: b.category, proof: b.proof, qty: b.qty })),
      ...(body.dryRun ? {} : { bottles }),
    })
  } catch (err) {
    console.error('[collection/import] error:', err)
    return NextResponse.json({ error: 'Import failed — nothing was saved.' }, { status: 500 })
  }
}
