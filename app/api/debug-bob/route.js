import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'

export async function GET(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const ownerEmail = process.env.ALERT_EMAIL?.toLowerCase()
  if (!token || token.email?.toLowerCase() !== ownerEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const testMode = process.env.BOB_TEST_MODE === 'true'
  const suburbsUrl = process.env.BOB_SUBURBS_WEBHOOK
  const chicagoUrl = process.env.BOB_CHICAGO_WEBHOOK
  const testUrl    = process.env.BOB_TEST_WEBHOOK

  const address = '8015 W 159th St, Orland Park, IL 60462, USA'
  const isCity  = /\bChicago,\s*IL\b/i.test(address)
  const resolvedUrl = testMode ? testUrl : (isCity ? chicagoUrl : suburbsUrl)

  const payload = {
    thread_name: '🥃 [DEBUG] Orland Park test',
    username:    'Tater Tracker',
    avatar_url:  'https://whiskey-hunter.vercel.app/CURRENT.png',
    embeds: [{
      description: 'Debug test post — suburbs routing check',
      color:       0xe8943a,
      fields: [{ name: '🗺️ Address', value: address, inline: false }],
      footer:      { text: 'Tater Tracker debug' },
      timestamp:   new Date().toISOString(),
    }],
  }

  let discordStatus = null
  let discordBody   = null

  try {
    const res = await fetch(resolvedUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    discordStatus = res.status
    discordBody   = await res.text()
  } catch (err) {
    discordBody = err.message
  }

  return NextResponse.json({
    testMode,
    isCity,
    resolvedUrl: resolvedUrl ? resolvedUrl.slice(0, 60) + '…' : null,
    suburbsUrlSet: !!suburbsUrl,
    chicagoUrlSet: !!chicagoUrl,
    discordStatus,
    discordBody,
  })
}
