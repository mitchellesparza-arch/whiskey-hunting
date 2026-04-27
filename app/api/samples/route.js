import { NextResponse }                    from 'next/server'
import { getToken }                        from 'next-auth/jwt'
import { getSamples, addSample, removeSample } from '../../../lib/samples.js'

/**
 * GET /api/samples
 * Returns the authenticated user's sample list.
 */
export async function GET(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const samples = await getSamples(token.email)
    return NextResponse.json({ samples })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * POST /api/samples
 * Body: { name, from, fromEmail?, type, notes? }
 */
export async function POST(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const body = await request.json()
    const { name, from, fromEmail, type, notes } = body

    if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!from?.trim()) return NextResponse.json({ error: 'from is required' }, { status: 400 })

    const entry = await addSample(token.email, { name, from, fromEmail, type, notes })
    return NextResponse.json({ ok: true, sample: entry })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * DELETE /api/samples?id=xxx
 */
export async function DELETE(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const samples = await removeSample(token.email, id)
    return NextResponse.json({ ok: true, samples })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
