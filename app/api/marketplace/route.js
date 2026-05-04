import { NextResponse }    from 'next/server'
import { getToken }        from 'next-auth/jwt'
import { getListings, addListing, claimBin, deactivateListing, deleteListing } from '../../../lib/marketplace.js'
import { getUserProfile }  from '../../../lib/friends.js'
import { sendToUser }      from '../../../lib/push.js'

/**
 * GET /api/marketplace?type=selling|trading|iso&activeOnly=1
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const type       = searchParams.get('type') || undefined
    const activeOnly = searchParams.get('activeOnly') === '1'
    const listings   = await getListings({ type, activeOnly })
    return NextResponse.json({ listings })
  } catch (err) {
    console.error('[marketplace] GET error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/marketplace
 * Body: { type, bottles, askingPrice?, binPrice?, zip, notes?, discordHandle?, photos? }
 */
export async function POST(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const body = await request.json()
    const { type, bottles, askingPrice, binPrice, zip, notes, discordHandle, photos } = body

    if (!['selling', 'trading', 'iso'].includes(type)) {
      return NextResponse.json({ error: 'type must be selling, trading, or iso' }, { status: 400 })
    }
    if (!Array.isArray(bottles) || !bottles.length) {
      return NextResponse.json({ error: 'At least one bottle is required' }, { status: 400 })
    }
    if (!zip?.trim()) {
      return NextResponse.json({ error: 'zip is required' }, { status: 400 })
    }

    const profile       = await getUserProfile(token.email)
    const submitterName = profile?.name ?? token.name ?? token.email

    const listing = await addListing({
      type, bottles, askingPrice, binPrice, zip, notes, discordHandle,
      photos: photos ?? [],
      submittedBy:   token.email,
      submitterName,
    })

    return NextResponse.json({ ok: true, listing })
  } catch (err) {
    console.error('[marketplace] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * PATCH /api/marketplace
 * Body: { id, action: 'bin' | 'deactivate' | 'delete' }
 */
export async function PATCH(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const { id, action } = await request.json()
    if (!id || !action)  return NextResponse.json({ error: 'id and action required' }, { status: 400 })

    if (action === 'bin') {
      const profile     = await getUserProfile(token.email)
      const claimerName = profile?.name ?? token.name ?? token.email
      const updated     = await claimBin(id, token.email, claimerName)
      if (!updated) return NextResponse.json({ error: 'Listing not found or already claimed' }, { status: 404 })

      // Notify the poster
      sendToUser(updated.submittedBy, {
        title: '🔒 BIN Claimed',
        body:  `${claimerName} claimed BIN on your listing: ${updated.bottles?.[0]?.name ?? 'your bottle'}`,
        url:   '/marketplace',
        tag:   'marketplace-bin',
      }).catch(() => {})

      return NextResponse.json({ ok: true, listing: updated })
    }

    if (action === 'deactivate') {
      const updated = await deactivateListing(id)
      if (!updated) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      return NextResponse.json({ ok: true, listing: updated })
    }

    if (action === 'delete') {
      await deleteListing(id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[marketplace] PATCH error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
