import { NextResponse } from 'next/server'
import { readFileSync }  from 'fs'
import { Resend }        from 'resend'
import path              from 'path'

const DATA_PATH = path.join(process.cwd(), 'lib', 'market-prices-data.json')

function norm(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/['''''']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86400_000).toISOString()
}

function pct(num, den) {
  if (!den) return '0%'
  return `${Math.round((num / den) * 100)}%`
}

// ─── Email report ─────────────────────────────────────────────────────────────

function warn(n, threshold = 0) {
  return n > threshold ? ' ⚠️' : ''
}

function statRow(label, value, flag = false) {
  const color = flag ? '#e8943a' : '#c9a87a'
  return `
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#9a7c55;">${label}</td>
      <td style="padding:5px 0;font-size:13px;color:${color};font-weight:${flag ? '700' : '400'};text-align:right;">${value}${flag ? ' ⚠️' : ''}</td>
    </tr>`
}

function section(title, rows) {
  return `
    <div style="margin-bottom:24px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b5030;margin-bottom:10px;border-bottom:1px solid #2a2118;padding-bottom:6px;">${title}</div>
      <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </div>`
}

async function sendAuditEmail(stats) {
  const to = process.env.ALERT_EMAIL
  if (!to) { console.warn('[catalog-audit] ALERT_EMAIL not set — skipping email'); return }

  const { catalog, prices, history, lastScrape, runAt } = stats
  const runDate = new Date(runAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })

  const catalogRows = [
    statRow('Total bottles in catalog', catalog.total.toLocaleString()),
    statRow('New this week', catalog.newThisWeek.toLocaleString()),
    statRow('Existing, re-seen this week', catalog.updatedThisWeek.toLocaleString()),
    statRow('Not seen this week', catalog.staleSinceWeek.toLocaleString(), catalog.staleSinceWeek > 50),
    statRow('Missing image', `${catalog.missingImage.toLocaleString()} / ${catalog.total} (${pct(catalog.missingImage, catalog.total)})`, catalog.missingImage > 200),
    statRow('Missing lot URL', `${catalog.missingLotUrl.toLocaleString()} / ${catalog.total}`, catalog.missingLotUrl > 100),
  ].join('')

  const topCats = Object.entries(catalog.categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, n]) => `<span style="display:inline-block;margin:3px 6px 3px 0;background:#2a1500;border:1px solid #4a2e10;border-radius:4px;padding:3px 8px;font-size:12px;color:#c9a87a;">${cat}: ${n}</span>`)
    .join('')

  const priceRows = [
    statRow('Static catalog size', prices.total.toLocaleString()),
    statRow('Live Redis prices', `${prices.hasLive} / ${prices.total} (${pct(prices.hasLive, prices.total)})`),
    statRow('Source — UA hammer prices', prices.srcUA.toLocaleString()),
    statRow('Source — static fallback', prices.srcStatic.toLocaleString(), prices.srcStatic > 50),
    statRow('MSRP populated', `${prices.hasMsrp} / ${prices.total}`, prices.total - prices.hasMsrp > 10),
    statRow('Missing MSRP', (prices.total - prices.hasMsrp).toLocaleString(), prices.total - prices.hasMsrp > 10),
  ].join('')

  const historyRows = [
    statRow('Has price history', `${history.hasHistory} / ${prices.total} (${pct(history.hasHistory, prices.total)})`),
    statRow('No history yet', (prices.total - history.hasHistory).toLocaleString(), prices.total - history.hasHistory > 100),
    statRow('Updated this month', history.updatedThisMonth.toLocaleString()),
  ].join('')

  const enrichRows = [
    statRow('No MSRP + no image (highest need)', catalog.needsBoth.toLocaleString(), catalog.needsBoth > 20),
    statRow('No MSRP only', (prices.total - prices.hasMsrp).toLocaleString()),
    statRow('No image only', catalog.missingImage.toLocaleString()),
    statRow('No price history', (prices.total - history.hasHistory).toLocaleString()),
  ].join('')

  let scraperSection = ''
  if (lastScrape) {
    const ranAgo = lastScrape.scraped_at
      ? `${Math.round((Date.now() - Date.parse(lastScrape.scraped_at)) / 60000)}m ago`
      : 'unknown'
    const scraperRows = [
      statRow('Last ran', `${ranAgo} (${lastScrape.scraped_at ? new Date(lastScrape.scraped_at).toUTCString() : '?'})`),
      statRow('Total lots in output', (lastScrape.dealsCount ?? '?').toLocaleString()),
      ...(lastScrape.category_counts
        ? Object.entries(lastScrape.category_counts).map(([k, v]) => statRow(k, v))
        : []),
    ].join('')
    scraperSection = section('Unicorn Auctions Scraper', scraperRows)
  }

  const hasWarnings = catalog.staleSinceWeek > 50 || catalog.missingImage > 200 ||
    catalog.missingLotUrl > 100 || prices.srcStatic > 50 ||
    prices.total - prices.hasMsrp > 10 || prices.total - history.hasHistory > 100 ||
    catalog.needsBoth > 20

  const subject = hasWarnings
    ? `⚠️ Weekly DB Audit — ${runDate} (action needed)`
    : `✅ Weekly DB Audit — ${runDate} (all clear)`

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0f0a05;color:#f5e6cc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a05;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1008;border-radius:12px;overflow:hidden;border:1px solid #3d2b10;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3a0a,#c46c1a);padding:32px 32px 28px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">📊</div>
              <h1 style="margin:0;font-size:24px;color:#fff;font-weight:800;letter-spacing:-0.5px;">
                Weekly DB Audit
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:#fde8c0;opacity:0.9;">
                ${runDate}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 8px;">

              ${section('UA Catalog (wh:ua:catalog)', catalogRows)}

              <!-- Category chips -->
              <div style="margin-bottom:24px;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b5030;margin-bottom:10px;border-bottom:1px solid #2a2118;padding-bottom:6px;">Category Breakdown</div>
                <div>${topCats || '<span style="color:#4a3020;font-size:13px;">No data</span>'}</div>
              </div>

              ${section('Market Price Coverage', priceRows)}
              ${section('Price History (wh:price-history:*)', historyRows)}
              ${section('Needs Enrichment', enrichRows)}
              ${scraperSection}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #2a2118;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b5030;">
                ${new Date(runAt).toUTCString()}<br/>
                Tater Tracker · /api/cron/catalog-audit
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from:    'Tater Tracker <onboarding@resend.dev>',
      to,
      subject,
      html,
    })
    if (error) console.warn('[catalog-audit] Resend error:', error)
    else        console.log('[catalog-audit] Audit email sent:', data?.id)
  } catch (err) {
    console.warn('[catalog-audit] Email send error:', err.message)
  }
}

// ─── main handler ─────────────────────────────────────────────────────────────

export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth  = request.headers.get('authorization') ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (token !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runAt  = new Date().toISOString()
  const cutoff = daysAgo(7)
  const month  = runAt.slice(0, 7) // YYYY-MM

  try {
    const { Redis } = await import('@upstash/redis')
    const redis = Redis.fromEnv()

    // ── 1. Fetch raw data in parallel ────────────────────────────────────────
    const [rawCatalog, rawDeals] = await Promise.all([
      redis.hgetall('wh:ua:catalog'),
      redis.get('wh:unicorn:deals'),
    ])

    // ── 2. Analyze UA catalog ────────────────────────────────────────────────
    const catalogEntries = Object.entries(rawCatalog ?? {})
    const categories  = {}
    let newThisWeek = 0, updatedThisWeek = 0, staleSinceWeek = 0
    let missingImage = 0, missingLotUrl = 0, needsBoth = 0

    for (const [, raw] of catalogEntries) {
      const e = typeof raw === 'string' ? JSON.parse(raw) : raw

      const cat = (e.category || 'Unknown').trim()
      categories[cat] = (categories[cat] || 0) + 1

      const isNew      = e.firstSeen && e.firstSeen >= cutoff
      const seenRecent = e.lastSeen  && e.lastSeen  >= cutoff
      if (isNew)                     newThisWeek++
      else if (seenRecent)           updatedThisWeek++
      else                           staleSinceWeek++

      const noImg = !e.imageUrl
      const noUrl = !e.lotUrl
      if (noImg) missingImage++
      if (noUrl) missingLotUrl++
    }

    // ── 3. Market price + history coverage for static catalog ────────────────
    const staticCatalog = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
    const normKeys = staticCatalog.map(e => norm(e.name))

    const pipeline = redis.pipeline()
    for (const nk of normKeys) pipeline.get(`wh:market-prices:live:${nk}`)
    for (const nk of normKeys) pipeline.hget(`wh:price-history:${nk}`, month)
    const pipelineResults = await pipeline.exec()

    const priceResults = pipelineResults.slice(0, normKeys.length)
    const histResults  = pipelineResults.slice(normKeys.length)

    let hasLive = 0, srcUA = 0, srcStatic = 0, hasMsrp = 0
    let hasHistory = 0, updatedThisMonth = 0

    for (let i = 0; i < normKeys.length; i++) {
      const priceVal = priceResults[i]
      if (priceVal) {
        hasLive++
        const p = typeof priceVal === 'string' ? JSON.parse(priceVal) : priceVal
        if ((p.source ?? '').toLowerCase().includes('unicorn')) srcUA++
        else srcStatic++
        if (p.msrp) hasMsrp++
      }
      if (histResults[i]) {
        hasHistory++
        updatedThisMonth++
      }
    }

    // Bottles missing both image AND msrp (most in need of enrichment)
    const noMsrpNames = new Set(
      staticCatalog.filter(e => !e.msrp).map(e => norm(e.name))
    )
    for (const [, raw] of catalogEntries) {
      const e  = typeof raw === 'string' ? JSON.parse(raw) : raw
      const nk = norm(e.name || '')
      if (!e.imageUrl && noMsrpNames.has(nk)) needsBoth++
    }

    // ── 4. Parse last scraper run info ───────────────────────────────────────
    let lastScrape = null
    try {
      const deals = typeof rawDeals === 'string' ? JSON.parse(rawDeals) : rawDeals
      if (deals) {
        lastScrape = {
          scraped_at:      deals.scraped_at ?? null,
          dealsCount:      deals.deals?.length ?? null,
          category_counts: deals.category_counts ?? null,
        }
      }
    } catch {}

    // ── 5. Assemble and ship ─────────────────────────────────────────────────
    const stats = {
      catalog: {
        total: catalogEntries.length,
        newThisWeek,
        updatedThisWeek,
        staleSinceWeek,
        missingImage,
        missingLotUrl,
        needsBoth,
        categories,
      },
      prices: {
        total: normKeys.length,
        hasLive,
        srcUA,
        srcStatic,
        hasMsrp,
      },
      history: {
        hasHistory,
        updatedThisMonth,
      },
      lastScrape,
      runAt,
    }

    await sendAuditEmail(stats)

    return NextResponse.json({ ok: true, ...stats })

  } catch (err) {
    console.error('[catalog-audit]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
