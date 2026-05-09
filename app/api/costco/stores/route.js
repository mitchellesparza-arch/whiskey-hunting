import { NextResponse }     from 'next/server'
import { getToken }         from 'next-auth/jwt'
import { getMergedStores }  from '../../../../lib/costco-history.js'

/**
 * GET /api/costco/stores
 *
 * Returns the merged Illinois warehouse list — the static seed plus any
 * Redis-backed corrections/additions discovered from incoming Discord
 * alerts.  Used by the Tracker → Costco favorites picker.
 */
export async function GET(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stores = await getMergedStores()
  return NextResponse.json({ stores, count: stores.length })
}
