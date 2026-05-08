import { NextResponse } from 'next/server'
import { getToken }     from 'next-auth/jwt'
import { Redis }        from '@upstash/redis'

/**
 * GET /api/reviews/breaking-bourbon?name=<bottleName>
 *
 * Two-step scrape: (1) hit Breaking Bourbon's search page to find the canonical
 * review slug for the bottle (their slugs include suffixes like "-bourbon-2021"
 * that aren't predictable from the name alone), then (2) fetch that review
 * page and extract the structured fields.
 *
 * BB's numeric ratings are baked into a JPEG so we can't pull them as text.
 * We surface the "sumitup" verdict instead — a single-sentence overall judgment
 * the reviewer writes for every review — plus distillery/proof/MSRP from the
 * structured bottle-info block, the author byline, and a link back to the
 * full review.  Snippet-only + always-linkback respects fair use.
 *
 * Cached in Redis (`wh:reviews:breaking-bourbon:{normName}`) for 90 days,
 * positive AND negative.  Reviews don't change once published, so a 90-day
 * TTL effectively never re-scrapes a bottle once we've found it.
 *
 * Response: { found, url, title, verdict, distillery, proof, msrp, author, date } | { found: false }
 */

const TTL_SEC      = 90 * 24 * 60 * 60
const SEARCH_URL   = 'https://www.breakingbourbon.com/search?query='
const REVIEW_BASE  = 'https://www.breakingbourbon.com'
const FETCH_OPTS   = {
  headers: {
    // Identify ourselves honestly so BB can rate-limit / block if they need to;
    // keeps us in good standing as a low-volume scraper.
    'User-Agent': 'TaterTracker/1.0 (+bourbon hunting community app)',
    'Accept':     'text/html',
  },
  cache:  'no-store',
  signal: AbortSignal.timeout(8000),
}

let _redis = null
function getRedis() {
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

function normName(s) {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// HTML helpers — keep regexes simple, BB's markup hasn't moved much in years.
function pickFirst(html, regex) {
  const m = html.match(regex)
  return m ? m[1].trim() : null
}

function decodeHtml(s) {
  if (!s) return s
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;|&#x27;/g, "'")
    .replace(/&#x2019;|&rsquo;/g, '’')
    .replace(/&nbsp;/g, ' ')
}

function stripTags(s) {
  return decodeHtml((s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

// Score a candidate slug against the user's bottle name.  Returns 0 to 1 based
// on how many distinctive query tokens appear in the slug.  Common modifiers
// (year, bourbon, batch, etc.) are excluded so they don't inflate scores for
// obvious mismatches.
//
// Numeric tokens are treated as load-bearing: when the query names a specific
// age or year ("Pappy Van Winkle 15 Year"), the slug MUST include that number
// — otherwise it's a different product (e.g. Van Winkle Family Reserve Rye
// would otherwise score 0.5 against "Pappy Van Winkle 15 Year" via the
// shared van/winkle tokens).
function scoreSlug(name, slug) {
  const stopwords = new Set([
    'year', 'years', 'bourbon', 'whiskey', 'whisky', 'rye',
    'barrel', 'single', 'small', 'batch', 'straight', 'kentucky',
  ])
  const tokenize = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  const queryTokens = tokenize(name)
  const slugTokens  = tokenize(slug)
  const distinctive = queryTokens.filter(t => !stopwords.has(t) && t.length > 1)
  if (!distinctive.length) return 0

  // Hard reject when the query specifies a number that doesn't appear in the slug
  const queryNumbers = distinctive.filter(t => /^\d+$/.test(t))
  if (queryNumbers.length && !queryNumbers.every(n => slugTokens.includes(n))) return 0

  const matched = distinctive.filter(t => slugTokens.includes(t))
  return matched.length / distinctive.length
}

// Breaking Bourbon's site search ranks by full-text relevance, not title match,
// so a review that just MENTIONS the search term in its body can show up first
// (e.g. searching "Pappy" returned a Seelbach's wheated review because it
// referenced Pappy in the comparison text).  Score every candidate slug and
// only return one when the match is strong enough to be the right bottle.
async function findReviewSlug(name) {
  try {
    const url = SEARCH_URL + encodeURIComponent(name)
    const res = await fetch(url, FETCH_OPTS)
    if (!res.ok) return null
    const html = await res.text()
    const slugs = [...new Set(
      [...html.matchAll(/href="\/review\/([a-z0-9-]+)"/gi)].map(m => m[1])
    )]
    if (!slugs.length) return null
    const scored = slugs
      .map(s => ({ slug: s, score: scoreSlug(name, s) }))
      .sort((a, b) => b.score - a.score)
    return scored[0].score >= 0.5 ? scored[0].slug : null
  } catch { return null }
}

async function fetchReview(slug) {
  try {
    const url = `${REVIEW_BASE}/review/${slug}`
    const res = await fetch(url, FETCH_OPTS)
    if (!res.ok) return null
    const html = await res.text()

    const title    = stripTags(pickFirst(html, /<h1[^>]*class="bold-page-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i))
    const verdict  = stripTags(pickFirst(html, /<div class="sumitup[^"]*"[^>]*>([\s\S]*?)<\/div>/i))
    const author   = stripTags(pickFirst(html, /<h1 class="text-block-2">([\s\S]*?)<\/h1>/i))?.replace(/^Written By:\s*/i, '') ?? null
    const date     = stripTags(pickFirst(html, /<div class="text-block-5">([\s\S]*?)<\/div>/i))

    // Main hero photo — sits inside <div class="main-photo-section"> as a CSS
    // background-image with HTML-encoded quotes.  Used as the bottle-page hero
    // fallback when Binny's Algolia catalog has no image for this bottle.
    const image = pickFirst(html, /main-photo-section[\s\S]*?background-image:url\(&quot;([^&]+)&quot;\)/i)

    // Bottle-info block uses <strong>Field:</strong> Value patterns — pull the few
    // fields that are useful to display alongside the verdict.
    function infoField(label) {
      const re = new RegExp(`<strong>${label}[^<]*<\\/strong>([\\s\\S]*?)<\\/p>`, 'i')
      const v  = stripTags(pickFirst(html, re))
      return v ? v.replace(/^[:\s]+/, '').trim() || null : null
    }
    const distillery = infoField('Distillery')
    const proof      = infoField('Proof')
    const msrp       = infoField('MSRP')

    if (!title && !verdict) return null
    return { url, title, verdict, distillery, proof, msrp, author, date, image }
  } catch { return null }
}

export async function GET(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const name = (searchParams.get('name') ?? '').trim()
  if (name.length < 2) return NextResponse.json({ found: false })

  // v4 = numeric tokens (age statements) are now required to match in the slug
  const cacheKey = `wh:reviews:breaking-bourbon:v4:${normName(name)}`

  try {
    const cached = await getRedis().get(cacheKey)
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached
      return NextResponse.json({ ...data, cached: true })
    }
  } catch { /* fall through */ }

  const slug = await findReviewSlug(name)
  if (!slug) {
    const empty = { found: false }
    try { await getRedis().set(cacheKey, JSON.stringify(empty), { ex: TTL_SEC }) } catch {}
    return NextResponse.json(empty)
  }

  const review = await fetchReview(slug)
  if (!review) {
    const empty = { found: false }
    try { await getRedis().set(cacheKey, JSON.stringify(empty), { ex: TTL_SEC }) } catch {}
    return NextResponse.json(empty)
  }

  const result = { found: true, ...review }
  try { await getRedis().set(cacheKey, JSON.stringify(result), { ex: TTL_SEC }) } catch {}
  return NextResponse.json(result)
}
