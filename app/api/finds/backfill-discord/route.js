import { NextResponse } from 'next/server'
import { getFinds }     from '../../../../lib/finds.js'
import { postNewFind }  from '../../../../lib/discord.js'

/**
 * POST /api/finds/backfill-discord
 * Protected by CRON_SECRET.
 *
 * Fetches all finds still in the 7-day window and posts each one to Discord
 * in chronological order (oldest first), with a 1-second delay between posts
 * to avoid hitting Discord's rate limit (5 requests / 2 seconds per webhook).
 */
export async function POST(request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth  = request.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const all   = await getFinds()
  const finds = [...all].sort((a, b) => a.timestamp - b.timestamp)  // oldest first

  let posted = 0
  let failed = 0

  for (const find of finds) {
    try {
      await postNewFind(find)
      posted++
    } catch {
      failed++
    }
    // 1-second gap to stay within Discord webhook rate limits
    if (posted + failed < finds.length) {
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  return NextResponse.json({ ok: true, total: finds.length, posted, failed })
}
