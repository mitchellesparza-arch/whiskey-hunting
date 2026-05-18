import { NextResponse }          from 'next/server'
import { getToken }              from 'next-auth/jwt'
import { getFinds, addFind, removeFind, voteFind, getMonthLeaderboard } from '../../../lib/finds.js'
import { getUserProfile }        from '../../../lib/friends.js'
import { sendBroadcast }         from '../../../lib/push.js'
import { postNewFind }           from '../../../lib/discord.js'
import { isPro }                 from '../../../lib/tier.js'

/**
 * GET /api/finds
 * Returns:
 *   finds    — active finds (< 24 h), newest first
 *   archived — archived finds (24–72 h), newest first
 *   leaderboard — top 5 submitters this calendar month
 */
export async function GET(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    // Always fetch live tier from Redis — getToken() reads the raw JWT which
    // only updates on sign-in, so stale tokens would silently downgrade
    // grandfathered/pro viewers to the 1-hour delayed free feed.
    let viewerTier = token?.tier ?? 'free'
    if (token?.email) {
      try {
        const profile = await getUserProfile(token.email.toLowerCase())
        viewerTier = profile?.tier ?? viewerTier
      } catch {}
    }
    const all = await getFinds(viewerTier)

    const finds    = all.filter(f => f.status === 'active')
    const archived = all.filter(f => f.status === 'archived')

    // Leaderboard: read from the durable monthly hash (not the expiring finds set)
    const leaderboard = await getMonthLeaderboard()

    return NextResponse.json({ finds, archived, leaderboard })
  } catch (err) {
    console.error('[finds] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/finds
 * Requires auth + approval.
 * Body: { bottleName, upc?, store, photoUrl?, notes? }
 */
export async function POST(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const body = await request.json()
    const { bottleName, upc, store, photoUrl, notes, price } = body

    if (!bottleName?.trim()) {
      return NextResponse.json({ error: 'bottleName is required' }, { status: 400 })
    }
    if (!store?.name || store?.lat == null || store?.lng == null) {
      return NextResponse.json({ error: 'store with name, lat, lng is required' }, { status: 400 })
    }

    // Use stored display name so settings changes are reflected immediately
    const profile       = await getUserProfile(token.email)
    const submitterName = profile?.name ?? token.name ?? token.email

    const tier  = token.tier ?? 'free'
    const entry = await addFind({
      bottleName,
      upc:      upc      || null,
      store,
      photoUrl: photoUrl || null,
      notes:    notes    || null,
      price:    price    || null,
      submittedBy:   token.email,
      submitterName,
      tier,
    })

    // All finds post immediately to the map for Pro users.
    // Fire Discord + broadcast right away for every submission.
    await postNewFind(entry).catch(() => {})
    sendBroadcast({
      title: '📍 New Find',
      body:  `${submitterName} spotted ${bottleName} at ${store.name}`,
      url:   '/',
      tag:   'find',
    }, 'finds').catch(() => {})

    // Free users see a banner telling them they won't see others' new finds for 1 hour
    const delayed = !isPro(tier)

    return NextResponse.json({
      ok:       true,
      find:     entry,
      delayed,
      visibleAt: delayed ? entry.timestamp + (60 * 60 * 1000) : null,
    })
  } catch (err) {
    console.error('[finds] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/finds
 * Body: { id, type: 'up'|'down' }
 * Toggles a vote ("Still There" / "Gone") on a find.
 */
export async function PATCH(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const { id, type } = await request.json()
    if (!id || !['up', 'down'].includes(type)) {
      return NextResponse.json({ error: 'id and type (up|down) required' }, { status: 400 })
    }

    const updated = await voteFind(id, type, token.email)
    if (!updated) return NextResponse.json({ error: 'Find not found' }, { status: 404 })

    return NextResponse.json({ ok: true, find: updated })
  } catch (err) {
    console.error('[finds] PATCH error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/finds?id=xxx
 * Requires auth + approval.
 */
export async function DELETE(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Verify ownership — only the submitter (or owner) can delete a find
    const all  = await getFinds('pro')  // read as pro to see all finds
    const find = all.find(f => f.id === id)
    if (!find) return NextResponse.json({ error: 'Find not found' }, { status: 404 })
    const ownerEmail = process.env.ALERT_EMAIL?.toLowerCase()
    if (find.submittedBy !== token.email?.toLowerCase() && token.email?.toLowerCase() !== ownerEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const finds = await removeFind(id)
    return NextResponse.json({ ok: true, finds })
  } catch (err) {
    console.error('[finds] DELETE error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
