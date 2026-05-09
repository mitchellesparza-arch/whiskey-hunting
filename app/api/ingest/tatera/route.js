import { NextResponse }         from 'next/server'
import { postTateraAlert }      from '../../../../lib/discord.js'
import { sendCostcoBroadcast }  from '../../../../lib/push.js'
import { recordAlert, recordStoreFromAlert } from '../../../../lib/costco-history.js'

/**
 * POST /api/ingest/tatera
 *
 * Receives Costco bourbon alerts that a Tampermonkey userscript scrapes from
 * Tatera.io's #illinois Discord channel.  Persists to Redis, fans out to our
 * own Discord webhook (when configured) and to web-push subscribers (filtered
 * by each user's costcoMode + costcoFavorites).
 *
 * Auth: Bearer token in Authorization header, must equal TATERA_INGEST_SECRET.
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

  // ── Self-correct store list (idempotent, runs even on duplicates) ─────────
  try {
    const action = await recordStoreFromAlert({
      number: alert.storeNumber,
      name:   alert.storeName,
      state:  alert.state,
    })
    if (action !== 'noop' && action !== 'touched') {
      console.log(`[ingest/tatera] store ${action}: ${alert.storeNumber} → ${alert.storeName}, ${alert.state}`)
    }
  } catch (err) {
    console.error('[ingest/tatera] recordStoreFromAlert failed:', err.message)
  }

  // ── Persist (atomic dedup + per-store + global lists) ──────────────────────
  let recorded = false
  try {
    recorded = await recordAlert(alert)
  } catch (err) {
    console.error('[ingest/tatera] recordAlert failed:', err.message)
  }

  // Duplicate Discord message — already processed.  Return 200 so the
  // userscript marks it seen and stops retrying.
  if (!recorded) {
    return NextResponse.json(
      { ok: true, duplicate: true, status: alert.status },
      { headers: corsHeaders() }
    )
  }

  // ── Fanout (best-effort, parallel) ─────────────────────────────────────────
  // Only in_stock transitions trigger Discord/push.  Out-of-stock is persisted
  // so it can show up in the live ticker but doesn't notify anyone.
  if (alert.status === 'in_stock') {
    await Promise.allSettled([
      postTateraAlert(alert),
      sendCostcoBroadcast({
        title: `🥃 Costco ${alert.state}: ${alert.productName}`,
        body:  `In stock at ${alert.storeName} (${alert.storeNumber})`,
        url:   '/tracker?tab=costco',
        tag:   `tatera-${alert.discordMessageId}`,
      }, alert.storeNumber),
    ])
  }

  return NextResponse.json(
    { ok: true, status: alert.status, fanout: alert.status === 'in_stock' },
    { headers: corsHeaders() }
  )
}
