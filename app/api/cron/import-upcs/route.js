import { NextResponse }  from 'next/server'
import { runIowaImport } from '../../../../lib/iowa-import.js'

export const maxDuration = 300   // Iowa catalog has ~10k rows; allow ample margin

/**
 * GET /api/cron/import-upcs
 *
 * Refreshes the Redis UPC cache from Iowa's public liquor products dataset.
 * Scheduled monthly via vercel.json — Iowa's own dataset updates monthly.
 * Protected by CRON_SECRET Bearer token.
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *        https://whiskey-hunter.vercel.app/api/cron/import-upcs
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth  = request.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startedAt = new Date().toISOString()
  const lines     = []
  const log       = (msg) => { lines.push(msg); console.log('[import-upcs]', msg) }

  try {
    const result = await runIowaImport({ log })
    return NextResponse.json({
      ok:         true,
      startedAt,
      finishedAt: new Date().toISOString(),
      kept:       result.stats.kept,
      written:    result.written,
      protected:  result.protected,
      log:        lines,
    })
  } catch (err) {
    console.error('[import-upcs] Fatal:', err)
    return NextResponse.json({ error: err.message, log: lines }, { status: 500 })
  }
}
