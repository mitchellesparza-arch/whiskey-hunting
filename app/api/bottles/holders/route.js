import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import { getFriends, getUserProfile } from '../../../../lib/friends.js'
import { getCollection }  from '../../../../lib/collection.js'

/**
 * GET /api/bottles/holders?name=<bottleName>
 *
 * Returns the current user's friends who have this bottle in their collection.
 * Aggregates by reading each friend's collection — N+1 reads, but N is small
 * (typical user has < 30 friends) and Upstash hash reads are cheap.  Cached
 * lightly client-side via the BottleDetailPage's load.
 *
 * Response: { holders: [{ email, name, qty, addedAt }] }
 */

function normName(s) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function nameMatches(a, b) {
  const an = normName(a)
  const bn = normName(b)
  if (!an || !bn) return false
  return an === bn || an.includes(bn) || bn.includes(an)
}

export async function GET(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const name = (searchParams.get('name') ?? '').trim()
  if (!name) return NextResponse.json({ holders: [] })

  try {
    const me      = token.email.toLowerCase()
    const friends = await getFriends(me)
    if (!friends.length) return NextResponse.json({ holders: [] })

    const results = await Promise.all(friends.map(async email => {
      try {
        const [collection, profile] = await Promise.all([
          getCollection(email),
          getUserProfile(email),
        ])
        const matches = (collection ?? []).filter(b => nameMatches(b.name, name))
        if (!matches.length) return null
        const totalQty = matches.reduce((sum, b) => sum + (b.qty ?? 1), 0)
        const newest   = matches.reduce((m, b) => Math.max(m, b.addedAt ?? 0), 0)
        return {
          email,
          name:    profile?.name ?? email.split('@')[0],
          qty:     totalQty,
          addedAt: newest,
        }
      } catch { return null }
    }))

    const holders = results.filter(Boolean).sort((a, b) => b.addedAt - a.addedAt)
    return NextResponse.json({ holders })
  } catch (err) {
    console.error('[bottles/holders] error:', err)
    return NextResponse.json({ holders: [] })
  }
}
