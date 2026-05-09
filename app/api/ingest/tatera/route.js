import { NextResponse }     from 'next/server'
import { sendTateraAlert }  from '../../../../lib/email.js'
import { postTateraAlert }  from '../../../../lib/discord.js'
import { sendBroadcast }    from '../../../../lib/push.js'

/**
 * POST /api/ingest/tatera
 *
 * Receives Costco bourbon alerts that a Tampermonkey userscript scrapes from
 * Tatera.io's #illinois Discord channel.  Fans out to email, our own Discord
 * webhook, and web-push subscribers.
 *
 * Auth: Bearer token in Authorization header, must equal TATERA_INGEST_SECRET.
 *
 * Payload:
 *   {
 *     productName: string,
 *     itemNumber:  string,
 *     storeName:   string,
 *     storeNumber: string,
 *     state:       string,             // "IL"
 *     status:      "in_stock" | "out_of_stock",
 *     observedAt:  string,             // ISO timestamp
 *     discordMessageId: string         // for dedup / logging
 *   }
 */

const ALLOWED_ORIGIN = 'https://discord.com'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age':       '86400',
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function POST(request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const secret = process.env.TATERA_INGEST_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'TATERA_INGEST_SECRET not configured' },
      { status: 500, headers: corsHeaders() }
    )
  }
  const auth  = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (token !== secret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders() }
    )
  }

  // ── Parse + validate ───────────────────────────────────────────────────────
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders() })
  }

  const required = ['productName', 'itemNumber', 'storeName', 'storeNumber', 'state', 'status', 'discordMessageId']
  for (const k of required) {
    if (typeof body[k] !== 'string' || !body[k].trim()) {
      return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400, headers: corsHeaders() })
    }
  }
  if (body.status !== 'in_stock' && body.status !== 'out_of_stock') {
    return NextResponse.json({ error: 'status must be in_stock or out_of_stock' }, { status: 400, headers: corsHeaders() })
  }

  const alert = {
    productName: body.productName.trim(),
    itemNumber:  body.itemNumber.trim(),
    storeName:   body.storeName.trim(),
    storeNumber: body.storeNumber.trim(),
    state:       body.state.trim().toUpperCase(),
    status:      body.status,
    observedAt:  body.observedAt || new Date().toISOString(),
    discordMessageId: body.discordMessageId.trim(),
  }

  console.log(
    `[ingest/tatera] ${alert.status} · ${alert.productName} · ${alert.storeName} (${alert.storeNumber}), ${alert.state} · msg ${alert.discordMessageId}`
  )

  // ── Fanout (best-effort, parallel) ─────────────────────────────────────────
  // Only in_stock transitions trigger user-visible alerts.  out_of_stock is
  // logged for context but doesn't fan out.
  if (alert.status === 'in_stock') {
    await Promise.allSettled([
      sendTateraAlert(alert),
      postTateraAlert(alert),
      sendBroadcast({
        title: `🥃 Costco ${alert.state}: ${alert.productName}`,
        body:  `In stock at ${alert.storeName} (${alert.storeNumber})`,
        url:   '/tracker',
        tag:   `tatera-${alert.discordMessageId}`,
      }, 'costco'),
    ])
  }

  return NextResponse.json(
    { ok: true, status: alert.status, fanout: alert.status === 'in_stock' },
    { headers: corsHeaders() }
  )
}
