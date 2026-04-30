import { NextResponse } from 'next/server'

/**
 * GET /api/trigger-unicorn
 * Called by Vercel cron — triggers the GitHub Actions unicorn-scraper workflow
 * via workflow_dispatch so we aren't subject to GitHub's scheduled-cron throttling.
 *
 * Required env vars:
 *   CRON_SECRET     — same secret used by /api/cron (protects this endpoint)
 *   GITHUB_PAT      — Personal Access Token with Actions: Read & Write scope
 *   GITHUB_REPO     — e.g. "mitchellesparza-arch/whiskey-hunting"
 */
export async function GET(request) {
  // Auth — Vercel passes CRON_SECRET automatically for cron-triggered requests
  const auth = request.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pat  = process.env.GITHUB_PAT
  const repo = process.env.GITHUB_REPO ?? 'mitchellesparza-arch/whiskey-hunting'

  if (!pat) {
    return NextResponse.json({ error: 'GITHUB_PAT not set' }, { status: 500 })
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/unicorn-scraper.yml/dispatches`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: 'master' }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    console.error('[trigger-unicorn] GitHub API error:', res.status, text)
    return NextResponse.json({ error: text, status: res.status }, { status: 502 })
  }

  console.log('[trigger-unicorn] workflow_dispatch triggered at', new Date().toISOString())
  return NextResponse.json({ ok: true, triggered: new Date().toISOString() })
}
