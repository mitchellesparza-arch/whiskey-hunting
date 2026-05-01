import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'

/**
 * POST /api/collection/upload
 * Accepts multipart/form-data with a `file` field.
 * Requires auth + approval.
 * Returns { ok, url } on success.
 *
 * Stores photos under 'collection/' prefix in Vercel Blob.
 * Uses @vercel/blob when BLOB_READ_WRITE_TOKEN is set.
 */
export async function POST(request) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token)          return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (!token.approved) return NextResponse.json({ error: 'Not approved' },    { status: 403 })

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'Photo upload not configured (BLOB_READ_WRITE_TOKEN missing)' },
        { status: 501 }
      )
    }

    const formData = await request.formData()
    const file     = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Dynamic import so local dev without token doesn't crash at module load
    const { put } = await import('@vercel/blob')

    const ext      = file.name?.split('.').pop() || 'jpg'
    const filename = `collection/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const buffer = await file.arrayBuffer()
    const blob   = await put(filename, buffer, {
      access:      'public',
      contentType: file.type || 'image/jpeg',
    })

    return NextResponse.json({ ok: true, url: blob.url })
  } catch (err) {
    console.error('[collection/upload] POST error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
