import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import Anthropic        from '@anthropic-ai/sdk'
import { Redis }        from '@upstash/redis'
import { upsertBottle } from '../../../../lib/bottle-db.js'

/**
 * POST /api/upc/identify
 * Body: { upc?: string, image: "<base64>", mediaType?: string }
 *
 * Open to all authenticated users — this is the "help us identify this bottle"
 * flow triggered when a barcode scan hits no match in the database.
 *
 * Uses Claude Haiku vision to extract full bottle metadata from a label photo,
 * then persists it to wh:upc:{upc} so every future scan of that barcode resolves
 * instantly without hitting the AI again.
 */
export async function POST(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { upc, image, mediaType = 'image/jpeg' } = body
  if (!image) return NextResponse.json({ error: 'image (base64) required' }, { status: 400 })

  const cleanUpc = (upc ?? '').toString().trim().replace(/\D/g, '') || null

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role:    'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: mediaType, data: image },
          },
          {
            type: 'text',
            text: `You are reading a whiskey or spirits bottle label. Extract the following details and return ONLY a valid JSON object — no markdown, no explanation.

Fields to extract:
- name: full product name exactly as shown on label (string)
- distillery: producer or distillery name (string or null)
- category: one of "Bourbon" | "Rye" | "Scotch" | "Irish" | "Japanese" | "Canadian" | "American" | "Tennessee" | "Other"
- proof: numeric proof value as a number (e.g. 90), or null if not visible
- age: age statement in years as a number (e.g. 12), or null if NAS or not shown
- msrp: your best estimate of typical US retail price in dollars as a number, or null

Return only the JSON object.`,
          },
        ],
      }],
    })

    const raw     = response.content[0]?.text?.trim() ?? ''
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const parsed  = JSON.parse(jsonStr)

    const bottle = {
      name:       (parsed.name ?? '').trim() || null,
      distillery: parsed.distillery ?? null,
      category:   parsed.category   ?? 'Other',
      proof:      parsed.proof      ?? null,
      age:        parsed.age        ?? null,
      msrp:       parsed.msrp       ?? null,
    }

    if (!bottle.name) {
      return NextResponse.json({ found: false, error: 'Could not identify bottle from image' })
    }

    // Persist full bottle data so future scans of this UPC resolve instantly
    if (cleanUpc) {
      try {
        const redis = Redis.fromEnv()
        await redis.set(`wh:upc:${cleanUpc}`, JSON.stringify({
          ...bottle,
          source:       'ai-vision',
          identifiedBy: token.email,
          identifiedAt: new Date().toISOString(),
        }))
      } catch (err) {
        console.warn('[upc/identify] Redis persist failed:', err.message)
      }
    }

    // Enrich canonical bottle DB — AI vision is the richest per-scan signal
    upsertBottle({ ...bottle, upc: cleanUpc ?? undefined }, 'ai').catch(() => {})

    return NextResponse.json({ found: true, bottle })
  } catch (err) {
    console.error('[upc/identify] error:', err)
    return NextResponse.json({ error: 'Failed to analyze photo', detail: err.message }, { status: 500 })
  }
}
