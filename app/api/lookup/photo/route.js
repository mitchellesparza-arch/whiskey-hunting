import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import Anthropic        from '@anthropic-ai/sdk'
import { findByName }   from '../../../../lib/whiskey-db.js'

/**
 * POST /api/lookup/photo
 * Body: { image: "<base64>", mediaType?: "image/jpeg" | "image/png" | "image/webp" }
 *
 * Sends the label photo to Claude Vision and returns structured bottle data,
 * enriched with MSRP + category from the seed database where available.
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

  const { image, mediaType = 'image/jpeg' } = body
  if (!image) return NextResponse.json({ error: 'image (base64) required' }, { status: 400 })

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model:      'claude-opus-4-5',
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
            text: `You are reading a whiskey or bourbon bottle label. Extract the following details and return ONLY a valid JSON object — no markdown, no explanation.

Fields to extract:
- name: full product name exactly as shown on label (string)
- distillery: producer or distillery name (string or null)
- category: one of "Bourbon" | "Rye" | "Scotch" | "Irish" | "Japanese" | "Canadian" | "American" | "Other"
- proof: numeric proof value as a number (e.g. 90), or null if not visible
- age: age statement in years as a number (e.g. 12), or null if NAS or not shown
- msrp: your best estimate of typical US retail price in dollars as a number, or null

Return only the JSON object.`,
          },
        ],
      }],
    })

    const raw = response.content[0]?.text?.trim() ?? ''

    // Strip markdown code fences if Claude adds them despite instructions
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const parsed  = JSON.parse(jsonStr)

    // Enrich with seed data if we can match the name
    const seed = parsed.name ? findByName(parsed.name) : null
    const result = {
      name:       parsed.name       ?? null,
      distillery: parsed.distillery ?? seed?.distillery ?? null,
      category:   parsed.category   ?? seed?.category   ?? 'Bourbon',
      proof:      parsed.proof      ?? seed?.proof       ?? null,
      age:        parsed.age        ?? null,
      msrp:       parsed.msrp      ?? seed?.msrp        ?? null,
      source:     'photo',
    }

    return NextResponse.json({ found: true, bottle: result })
  } catch (err) {
    console.error('[lookup/photo] error:', err)
    return NextResponse.json({ error: 'Failed to analyze photo', detail: err.message }, { status: 500 })
  }
}
