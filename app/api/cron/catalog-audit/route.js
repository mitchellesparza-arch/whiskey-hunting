import { NextResponse } from 'next/server'
import { readFileSync }  from 'fs'
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

// ─── Discord report ───────────────────────────────────────────────────────────

async function postAuditReport(stats, webhookUrl) {
  if (!webhookUrl) return

  const { catalog, prices, history, lastScrape, runAt } = stats
  const warn = (n, threshold = 0) => n > threshold ? ' ⚠️' : ''

  const fields = [
    // ── UA Catalog ──────────────────────────────────────────────────────────
    {
      name:   '📦 UA Catalog  (`wh:ua:catalog`)',
      value:  [
        `**Total bottles:** ${catalog.total.toLocaleString()}`,
        `**New this week:** ${catalog.newThisWeek.toLocaleString()} 🆕`,
        `**Existing, re-seen this week:** ${catalog.updatedThisWeek.toLocaleString()}`,
        `**Not seen this week:** ${catalog.staleSinceWeek.toLocaleString()}${warn(catalog.staleSinceWeek, 50)}`,
        `**Missing image:** ${catalog.missingImage.toLocaleString()} / ${catalog.total}  (${pct(catalog.missingImage, catalog.total)})${warn(catalog.missingImage, 200)}`,
        `**Missing lot URL:** ${catalog.missingLotUrl.toLocaleString()} / ${catalog.total}${warn(catalog.missingLotUrl, 100)}`,
      ].join('\n'),
      inline: false,
    },
    // ── Category breakdown ───────────────────────────────────────────────────
    {
      name:   '🏷️ Category Breakdown',
      value:  Object.entries(catalog.categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([cat, n]) => `**${cat}:** ${n}`)
        .join('  ·  ') || 'No data',
      inline: false,
    },
    // ── Market price coverage ────────────────────────────────────────────────
    {
      name:   `💰 Market Price Coverage  (${prices.total}-bottle static catalog)`,
      value:  [
        `**Live Redis prices:** ${prices.hasLive} / ${prices.total}  (${pct(prices.hasLive, prices.total)})`,
        `**Source → UA hammer:** ${prices.srcUA} · **Static fallback:** ${prices.srcStatic}${warn(prices.srcStatic, 50)}`,
        `**MSRP populated:** ${prices.hasMsrp} / ${prices.total}${warn(prices.total - prices.hasMsrp, 10)}`,
        `**Missing MSRP:** ${prices.total - prices.hasMsrp}${warn(prices.total - prices.hasMsrp, 10)}`,
      ].join('\n'),
      inline: false,
    },
    // ── Price history ────────────────────────────────────────────────────────
    {
      name:   '📈 Price History  (`wh:price-history:*`)',
      value:  [
        `**Has history data:** ${history.hasHistory} / ${prices.total}  (${pct(history.hasHistory, prices.total)})`,
        `**No history yet:** ${prices.total - history.hasHistory}${warn(prices.total - history.hasHistory, 100)}`,
        `**Updated this month:** ${history.updatedThisMonth}`,
      ].join('\n'),
      inline: false,
    },
    // ── Needs additional info ────────────────────────────────────────────────
    {
      name:   '🔍 Needs Additional Info',
      value:  [
        `**No MSRP + no image:** ${catalog.needsBoth}${warn(catalog.needsBoth, 20)}`,
        `**No MSRP only:** ${prices.total - prices.hasMsrp}`,
        `**No image only:** ${catalog.missingImage}`,
        `**No price history:** ${prices.total - history.hasHistory}`,
      ].join('\n'),
      inline: false,
    },
  ]

  // ── Last scraper run ───────────────────────────────────────────────────────
  if (lastScrape) {
    const ranAgo = lastScrape.scraped_at
      ? `${Math.round((Date.now() - Date.parse(lastScrape.scraped_at)) / 60000)}m ago`
      : 'unknown'

    const catLine = lastScrape.category_counts
      ? Object.entries(lastScrape.category_counts).map(([k, v]) => `${k}: ${v}`).join(' · ')
      : null

    fields.push({
      name:   '🤖 Last Unicorn Scraper Run',
      value:  [
        `**Ran:** ${ranAgo}  (${lastScrape.scraped_at ? new Date(lastScrape.scraped_at).toUTCString() : '?'})`,
        `**Total lots in output:** ${(lastScrape.dealsCount ?? '?').toLocaleString()}`,
        catLine ? `**Categories:** ${catLine}` : null,
      ].filter(Boolean).join('\n'),
      inline: false,
    })
  }

  const payload = {
    username:   'Tater Tracker',
    avatar_url: 'https://whiskey-hunter.vercel.app/icon.png',
    embeds: [{
      title:     `📊 Weekly DB Audit — ${new Date(runAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}`,
      color:     0xe8943a,
      fields,
      footer:    { text: 'Tater Tracker · /api/cron/catalog-audit' },
      timestamp: runAt,
    }],
  }

  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    if (!res.ok) console.warn('[catalog-audit] Discord webhook failed:', res.status)
  } catch (err) {
    console.warn('[catalog-audit] Discord post error:', err.message)
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

    // One key per entry name (not aliases) to avoid double-counting
    const normKeys = staticCatalog.map(e => norm(e.name))

    // Pipeline: [live price × N] then [history exists × N]
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

    // Bottles in catalog missing both image AND msrp (most in need of enrichment)
    // Approximate: catalog entries with no image where static catalog has no msrp
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

    await postAuditReport(stats, process.env.DISCORD_WEBHOOK_URL)

    return NextResponse.json({ ok: true, ...stats })

  } catch (err) {
    console.error('[catalog-audit]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
