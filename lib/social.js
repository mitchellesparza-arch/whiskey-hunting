/**
 * Social media scanning for allocated bourbon sightings
 * within ~30 minutes of 9312 Dunmore Dr, Orland Park IL.
 *
 * Sources:
 *   Reddit posts      — /new pagination across bourbon/local subs
 *   Reddit comments   — bottle drop thread comment trees (r/ChicagolandWhiskey)
 *   RSS feeds         — ModernThirst, BourbonBlog release announcements
 *   Twitter/X         — guest token (best effort) or TWITTER_BEARER_TOKEN env var
 */

// ── Match terms ───────────────────────────────────────────────────────────────

const BOTTLE_TERMS = [
  // ── Buffalo Trace / Sazerac ─────────────────────────────────────────────
  "blanton",           // Blanton's Original, Straight from the Barrel
  "eagle rare",        // Eagle Rare 10yr, 17yr
  "weller",            // Weller SR / 12 / Antique 107 / CYPB / Full Proof
  "william larue",     // William Larue Weller (BTAC)
  "pappy", "van winkle", // All Pappy expressions
  "e.h. taylor", "eh taylor", // All E.H. Taylor expressions
  "george t. stagg",   // BTAC
  "thomas h. handy",   // BTAC rye
  "sazerac 18",        // BTAC rye
  "old fitzgerald",    // Old Fitzgerald Decanter Series
  "rock hill farms",
  // ── Heaven Hill ─────────────────────────────────────────────────────────
  "elijah craig barrel proof",
  "elijah craig bp",   // common abbreviation
  "ecbp",              // common abbreviation
  "larceny barrel proof",
  "parker's heritage", "parkers heritage",
  "heaven hill heritage",
  // ── Wild Turkey / Campari ────────────────────────────────────────────────
  "russell's reserve 13", "russells reserve 13",
  "russell's reserve 15", "russells reserve 15",
  "master's keep", "masters keep",
  // ── Jack Daniel's / Brown-Forman ─────────────────────────────────────────
  "coy hill",          // Jack Daniel's Coy Hill High Proof
  "jack daniel's 14", "jack daniels 14",
  "jack daniel's 12yr", "jack daniels 12yr",
  "old forester birthday", "birthday bourbon",
  "king of kentucky",
  "woodford double double",
  // ── Four Roses ──────────────────────────────────────────────────────────
  "four roses limited",   // Limited Edition Small Batch
  "four roses single barrel limited",
  "frlesmb",              // common abbreviation
  // ── Beam Suntory ────────────────────────────────────────────────────────
  "booker's",          // each batch is allocated
  "knob creek 18",
  "baker's 13",
  // ── Barrell Craft Spirits ────────────────────────────────────────────────
  "barrell craft", "barrell bourbon",
  // ── Michter's ───────────────────────────────────────────────────────────
  "michter's 10", "michters 10",
  "michter's 20", "michters 20",
  // ── High West ───────────────────────────────────────────────────────────
  "midwinter night", "midwinter's night", // A Midwinter Night's Dram
  // ── Willett / KBD ───────────────────────────────────────────────────────
  "willett family estate",
  // ── Bardstown Bourbon ────────────────────────────────────────────────────
  "bardstown discovery",
  // ── Old Carter ──────────────────────────────────────────────────────────
  "old carter",
  // ── Stagg Jr (still tracked) ─────────────────────────────────────────────
  "stagg jr",
]

const STORE_TERMS = ["binnys", "binny's", "total wine", "totalwine", "jewel", "jewel-osco", "jewel osco", "joe's discount", "joes discount", "nmbb", "binny"]

// Chicago south/southwest suburbs within ~30 min of Orland Park
const AREA_TERMS = [
  "orland park", "tinley park", "mokena", "frankfort", "new lenox",
  "homer glen", "lockport", "romeoville", "bolingbrook", "lisle",
  "downers grove", "westmont", "oak brook", "woodridge", "naperville",
  "burr ridge", "willowbrook", "darien", "oak lawn", "chicago ridge",
  "bridgeview", "justice", "worth", "alsip", "blue island",
  "palos heights", "palos park", "palos hills", "lemont",
]

// ── Emoji vocabulary (r/ChicagolandWhiskey drop thread conventions) ───────────
//
// STORE SHORTHANDS
//   💎  = Jewel-Osco (gem = jewel)
//   🌮  = Joe's Discount Liquors, Tinley Park
//   🔑  = Key Spirits / Key Liquors (occasionally used)
//
// BOTTLE / BRAND COLORS (Buffalo Trace portfolio label colors)
//   🟠  = Blanton's Original Single Barrel       (orange label)
//   🔵  = Blanton's Straight from the Barrel     (blue label)
//   🔴  = Weller Special Reserve / Weller Full Proof (red label)
//   ⚪  = Weller 12yr                             (white/cream label)
//   🟡  = Weller Antique 107                      (yellow label) — less common
//   🟢  = Eagle Rare 10yr                         (green label)
//   ⚫  = E.H. Taylor Small Batch / Taylor line   (black label)
//   🟣  = Willett Family Estate (purple wax top)
//
// AMBIGUOUS (contextual — may be bottle or price marker)
//   🦌  = George T. Stagg (stag/deer) OR dollar-sign substitute ("65🦌" = $65)
//   🌮  = Joe's Discount Liquors OR dollar-sign substitute ("65🌮" = $65)
//
// SENTIMENT / NOISE (no bottle meaning)
//   ☕  = morning/good luck opener
//   🥃  = whiskey glass, generic excitement
//   🤞  = hoping for a find
//   🙏  = grateful/hoping
//   🤣🤷 = reactions, no bottle meaning

export const EMOJI_BOTTLE_MAP = {
  // Store shorthands — expand to store name for location matching
  '💎': { type: 'store',  value: 'jewel osco' },
  // 🌮 = Joe's Discount Liquors, BUT also used as a dollar-sign substitute
  // (e.g. "65🌮" = $65). contextual: true means we only expand when NOT
  // preceded immediately by digits.
  '🌮': { type: 'store',  value: "joe's discount liquors tinley park", contextual: true },

  // Bottle colors — Buffalo Trace portfolio
  '🟠': { type: 'bottle', value: "blanton's original single barrel" },
  '🔵': { type: 'bottle', value: "blanton's straight from the barrel" },
  '🔴': { type: 'bottle', value: 'weller' },
  '⚪': { type: 'bottle', value: 'weller 12' },
  '🟡': { type: 'bottle', value: 'weller antique 107' },
  '🟢': { type: 'bottle', value: 'eagle rare' },
  '⚫': { type: 'bottle', value: 'e.h. taylor' },

  // Bottle wax colors
  '🟣': { type: 'bottle', value: 'willett family estate' },

  // 🦌 = deer/stag — often represents George T. Stagg, BUT also used as a
  // dollar sign ("65🦌" = $65). contextual: true, same numeric-prefix check.
  '🦌': { type: 'bottle', value: 'george t. stagg', contextual: true },
}

// Noise emojis — present in comments but carry no bottle/store signal
const EMOJI_NOISE = new Set(['☕', '🥃', '🤞', '🙏', '✝', '🤘', '🤣', '🤷', '🔥'])

// Matches a number (optionally with spaces) immediately before an emoji —
// indicates the emoji is being used as a price/dollar marker, not a bottle name.
const PRICE_PREFIX_RE = /\d+\s*$/

/**
 * Expand emoji in a comment body into readable equivalents, then return
 * the augmented string for bottle/location matching.
 *
 * Contextual emojis (🌮, 🦌) are only expanded when NOT preceded by digits,
 * since they double as dollar-sign substitutes in price notations like "65🌮".
 *
 * Also returns a human-readable list of what was decoded, for display.
 */
export function expandEmoji(text) {
  let expanded = text
  const decoded = []

  for (const [emoji, mapping] of Object.entries(EMOJI_BOTTLE_MAP)) {
    if (!expanded.includes(emoji)) continue

    if (mapping.contextual) {
      // Walk through occurrences; only expand those not preceded by a number.
      let result = ''
      let remaining = expanded
      let found = false
      while (remaining.length) {
        const idx = remaining.indexOf(emoji)
        if (idx === -1) { result += remaining; break }
        const before = result + remaining.slice(0, idx)
        if (PRICE_PREFIX_RE.test(before)) {
          // Looks like a price marker — leave the emoji in place
          result += remaining.slice(0, idx + emoji.length)
        } else {
          // Meaningful usage — replace with the bottle/store name
          result += remaining.slice(0, idx) + ` ${mapping.value} `
          if (!found) { decoded.push({ emoji, ...mapping }); found = true }
        }
        remaining = remaining.slice(idx + emoji.length)
      }
      expanded = result
    } else {
      expanded = expanded.replaceAll(emoji, ` ${mapping.value} `)
      decoded.push({ emoji, ...mapping })
    }
  }

  return { expanded, decoded }
}

// ── Acronym vocabulary (r/ChicagolandWhiskey + bourbon community shorthands) ──
//
// Source: compiled glossary from r/ChicagolandWhiskey community post.
// Keys are uppercase acronyms matched case-insensitively as whole words.
//
// BOTTLE / BRAND
//   4R   = Four Roses
//   EC   = Elijah Craig
//   EHT  = E.H. Taylor
//   EW   = Evan Williams
//   HH   = Heaven Hill
//   OF   = Old Forester
//   WR   = Woodford Reserve
//   WT   = Wild Turkey
//   BT   = Buffalo Trace
//
// DESCRIPTOR (used in combo: "EC BP", "EHT SiB", "4R LE")
//   BP   = Barrel Proof
//   CS   = Cask Strength
//   BiB  = Bottled-in-Bond
//   BIB  = Bottled-in-Bond
//   LE   = Limited Edition
//   NCF  = Non-Chill Filtered
//   SiB  = Single Barrel
//   SB   = Single Barrel (ambiguous — could be Small Batch; expand both)
//   SmB  = Small Batch
//   SP   = Store Pick
//   PB   = Private Barrel
//
// STORE TYPE
//   NMBB = Non-Membership Big Box (Binny's, Total Wine, etc.)
//   MBB  = Membership Big Box (Costco, Sam's Club, etc.)

export const ACRONYM_MAP = {
  // Brands/bottles — expand so BOTTLE_TERMS can match
  '4R':   'four roses',
  'EC':   'elijah craig',
  'EHT':  'e.h. taylor',
  'EW':   'evan williams',
  'HH':   'heaven hill',
  'OF':   'old forester',
  'WR':   'woodford reserve',
  'WT':   'wild turkey',
  'BT':   'buffalo trace',

  // Descriptors — expand so combos like "EC BP" become "elijah craig barrel proof"
  'BP':   'barrel proof',
  'CS':   'cask strength',
  'BIB':  'bottled in bond',
  'BiB':  'bottled in bond',
  'LE':   'limited edition',
  'NCF':  'non chill filtered',
  'SiB':  'single barrel',
  'SB':   'single barrel',
  'SmB':  'small batch',
  'SP':   'store pick',
  'PB':   'private barrel',

  // Store types — expand so location matching can catch them
  'NMBB': "binny's total wine",
  'MBB':  'costco sam\'s club',
}

// Matches acronyms as whole words (word boundary on both sides), case-sensitive
// per key so "BT" doesn't clobber "bt" in the middle of a word.
const ACRONYM_RE_CACHE = {}
function acronymRegex(key) {
  if (!ACRONYM_RE_CACHE[key]) {
    ACRONYM_RE_CACHE[key] = new RegExp(`(?<![A-Za-z])${key}(?![A-Za-z])`, 'g')
  }
  return ACRONYM_RE_CACHE[key]
}

/**
 * Expand community acronyms in text before bottle/location matching.
 * Runs after expandEmoji so emoji-decoded text also benefits.
 */
export function expandAcronyms(text) {
  let expanded = text
  for (const [acronym, full] of Object.entries(ACRONYM_MAP)) {
    expanded = expanded.replace(acronymRegex(acronym), ` ${full} `)
  }
  return expanded
}

function normalizeText(text) {
  const { expanded: emojiExpanded } = expandEmoji(text)
  return expandAcronyms(emojiExpanded).toLowerCase()
}

function containsBottle(text) {
  const l = normalizeText(text)
  return BOTTLE_TERMS.some(t => l.includes(t))
}

function containsLocation(text) {
  const l = normalizeText(text)
  return STORE_TERMS.some(t => l.includes(t)) || AREA_TERMS.some(t => l.includes(t))
}

// Reject posts that are clearly non-English (>20% non-ASCII characters)
function isEnglish(text) {
  if (!text || text.length < 5) return true
  const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length
  return nonAscii / text.length < 0.2
}

// Reject user profile subs (r/u_username) — not community subs
function isCommunitySub(subreddit) {
  return !subreddit.startsWith('u_')
}

// ── Reddit ────────────────────────────────────────────────────────────────────

// Subreddits to search. r/CHIBourbon may not exist — handled gracefully.
const REDDIT_SUBREDDITS = ['bourbon', 'whiskeyhotline', 'CHIBourbon', 'ChicagolandWhiskey', 'chicago', 'chicagoland']

export async function searchReddit() {
  const posts = []
  const seen  = new Set()
  const since = Date.now() - 24 * 60 * 60 * 1000  // hard 24h cutoff

  // Crawl /new directly — Reddit's /search API is unreliable for restrict_sr queries.
  // We paginate until we hit a post older than `since` or run out of pages.
  async function crawlSub(sub, after = null, depth = 0) {
    if (depth > 4) return   // max 5 pages = 125 posts per sub
    const params = new URLSearchParams({ limit: 25, sort: 'new' })
    if (after) params.set('after', after)
    const url = `https://www.reddit.com/r/${sub}/new.json?${params}`
    try {
      const res  = await fetch(url, { headers: { 'User-Agent': 'WhiskeyHunterBot/1.0 (bourbon inventory tracker)' } })
      if (!res.ok) return
      const data  = await res.json()
      const items = data?.data?.children ?? []
      if (!items.length) return

      let hitCutoff = false
      for (const { data: p } of items) {
        if (p.created_utc * 1000 < since) { hitCutoff = true; break }
        if (seen.has(p.id)) continue
        seen.add(p.id)
        if (!isCommunitySub(p.subreddit)) continue

        const full = `${p.title} ${p.selftext || ''}`
        if (!isEnglish(full) || !containsBottle(full)) continue

        // Local whiskey subs: no location filter needed
        // National bourbon subs (bourbon, whiskeyhotline): require Binny's/IL store mention
        // Generic local subs (chicago, chicagoland): require location match
        const isLocal   = ['CHIBourbon', 'ChicagolandWhiskey'].includes(sub)
        const isNatBour = ['bourbon', 'whiskeyhotline'].includes(sub)
        if (isNatBour  && !containsLocation(full)) continue
        if (!isLocal && !isNatBour && !containsLocation(full)) continue

        posts.push(normalizeRedditPost(p))
      }

      if (!hitCutoff && data?.data?.after) {
        await new Promise(r => setTimeout(r, 250))  // polite pacing
        await crawlSub(sub, data.data.after, depth + 1)
      }
    } catch (e) {
      console.warn(`Reddit r/${sub} crawl failed:`, e.message)
    }
  }

  // Crawl all subreddits concurrently
  await Promise.all(REDDIT_SUBREDDITS.map(sub => crawlSub(sub)))

  return posts
}

function normalizeRedditPost(p) {
  return {
    id:        `reddit_${p.id}`,
    source:    'Reddit',
    label:     `r/${p.subreddit}`,
    title:     p.title,
    snippet:   (p.selftext || '').trim().slice(0, 300),
    url:       `https://reddit.com${p.permalink}`,
    author:    `u/${p.author}`,
    score:     p.score,
    createdAt: new Date(p.created_utc * 1000).toISOString(),
  }
}

// ── Reddit drop-thread comments ───────────────────────────────────────────────
// r/ChicagolandWhiskey posts a "Bottle Drop Thread" every Mon/Wed/Fri.
// The real signal lives in the comments, not the post titles.
// We find the most recent drop thread (up to 48h old so we don't miss a
// Fri→Mon gap) and scan every top-level comment for bottle mentions.

export async function searchRedditDropThreads() {
  const posts  = []
  const seen   = new Set()
  const since  = Date.now() - 24 * 60 * 60 * 1000   // comments must be < 24h old
  const thread48h = Date.now() - 48 * 60 * 60 * 1000 // threads can be up to 48h old

  try {
    // 1. Find recent drop threads
    const listRes = await fetch('https://www.reddit.com/r/ChicagolandWhiskey/new.json?limit=10', {
      headers: { 'User-Agent': 'WhiskeyHunterBot/1.0 (bourbon inventory tracker)' },
    })
    if (!listRes.ok) return []
    const listData = await listRes.json()

    const dropThreads = (listData?.data?.children ?? [])
      .map(({ data: p }) => p)
      .filter(p =>
        p.created_utc * 1000 >= thread48h &&
        (p.title.toLowerCase().includes('bottle drop') || p.title.toLowerCase().includes('drop thread'))
      )

    // 2. Fetch and scan comments for each thread
    for (const thread of dropThreads) {
      const commRes = await fetch(
        `https://www.reddit.com${thread.permalink}.json?limit=500&depth=1`,
        { headers: { 'User-Agent': 'WhiskeyHunterBot/1.0 (bourbon inventory tracker)' } }
      )
      if (!commRes.ok) continue
      const [, commData] = await commRes.json()

      for (const { data: c } of commData?.data?.children ?? []) {
        if (!c.body || c.body === '[deleted]' || c.body === '[removed]') continue
        if (seen.has(c.id)) continue
        seen.add(c.id)
        if (c.created_utc * 1000 < since) continue      // comment must be < 24h old
        if (!isEnglish(c.body)) continue
        if (!containsBottle(c.body)) continue

        const { decoded } = expandEmoji(c.body)
        // Append a decoder note if emojis were translated
        const decoderNote = decoded.length
          ? `  [${decoded.map(d => `${d.emoji}=${d.value}`).join(', ')}]`
          : ''

        const firstLine = c.body.split('\n').map(l => l.trim()).find(l => l.length > 2) ?? c.body
        posts.push({
          id:        `reddit_comment_${c.id}`,
          source:    'Reddit',
          label:     `r/ChicagolandWhiskey · Drop Thread`,
          title:     firstLine.slice(0, 200),
          snippet:   c.body.trim().slice(0, 300) + decoderNote,
          url:       `https://reddit.com${c.permalink}`,
          author:    `u/${c.author}`,
          score:     c.score,
          createdAt: new Date(c.created_utc * 1000).toISOString(),
        })
      }
    }
  } catch (e) {
    console.warn('Reddit drop thread scan failed:', e.message)
  }

  return posts
}

// ── RSS feeds ─────────────────────────────────────────────────────────────────
// Upstream release signals — when a batch is announced nationally, local
// allocations typically follow within days to weeks.

const RSS_FEEDS = [
  { name: 'ModernThirst',  url: 'https://modernthirst.com/feed/',         label: 'ModernThirst' },
  { name: 'BourbonBlog',   url: 'https://www.bourbonblog.com/feed/',      label: 'BourbonBlog'  },
]

// Minimal RSS/Atom parser — no dependencies
function parseRSS(xml) {
  const items = []
  // Match <item> (RSS) or <entry> (Atom)
  const itemRE = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi
  let m
  while ((m = itemRE.exec(xml)) !== null) {
    const block = m[1]
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i')
      return (r.exec(block)?.[1] ?? '').trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '').replace(/&quot;/g, '"')
    }
    const getLink = () => {
      // Atom uses <link href="..."/>, RSS uses <link>url</link>
      const atom = /<link[^>]+href="([^"]+)"/i.exec(block)
      if (atom) return atom[1]
      return get('link')
    }
    const pubDate = get('pubDate') || get('published') || get('updated')
    items.push({
      title:   get('title'),
      link:    getLink(),
      pubDate: pubDate ? new Date(pubDate) : new Date(0),
      summary: (get('description') || get('summary') || get('content')).replace(/<[^>]+>/g, '').trim().slice(0, 300),
    })
  }
  return items
}

export async function searchRSS() {
  const posts = []
  const since = Date.now() - 24 * 60 * 60 * 1000

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'WhiskeyHunterBot/1.0 (bourbon inventory tracker)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const xml   = await res.text()
      const items = parseRSS(xml)

      for (const item of items) {
        if (!item.title || item.pubDate.getTime() < since) continue
        const full = `${item.title} ${item.summary}`
        if (!containsBottle(full)) continue

        const id = `rss_${feed.name}_${Buffer.from(item.link).toString('base64').slice(0, 20)}`
        posts.push({
          id,
          source:    'RSS',
          label:     feed.label,
          title:     item.title,
          snippet:   item.summary,
          url:       item.link,
          author:    feed.name,
          score:     0,
          createdAt: item.pubDate.toISOString(),
        })
      }
    } catch (e) {
      console.warn(`RSS ${feed.name} failed:`, e.message)
    }
  }

  return posts
}

// ── Twitter/X ─────────────────────────────────────────────────────────────────

// Twitter's web-app bearer token (public, embedded in their JS bundle — read-only)
const WEB_BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I6xUoMOuoTY%3DtwY2pTwwMIaAS8AfJztjYBPZYIm'

const TWITTER_QUERIES = [
  `(binnys OR "binny's") (blanton OR "eagle rare" OR weller OR pappy OR stagg OR "e.h. taylor" OR "rock hill farms" OR "old fitzgerald" OR "larceny barrel" OR "parker's heritage" OR "booker's" OR "old carter" OR "birthday bourbon" OR "king of kentucky" OR "master's keep" OR "midwinter night" OR "michter's 10" OR "michter's 20") lang:en`,
  `("orland park" OR "tinley park" OR "downers grove" OR naperville OR "burr ridge" OR bolingbrook) (blanton OR "eagle rare" OR weller OR pappy OR stagg OR "e.h. taylor" OR "old fitzgerald" OR "birthday bourbon" OR "king of kentucky" OR "coy hill" OR willett OR "barrell craft") lang:en`,
]

export async function searchTwitter() {
  // Prefer official bearer token if provided
  if (process.env.TWITTER_BEARER_TOKEN) {
    return searchTwitterV2(process.env.TWITTER_BEARER_TOKEN)
  }

  // Fall back to guest token (best effort — may be blocked by Twitter)
  try {
    const guestRes = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${WEB_BEARER}` },
    })
    if (!guestRes.ok) return []
    const { guest_token } = await guestRes.json()
    if (!guest_token) return []
    return searchTwitterV1Guest(guest_token)
  } catch (e) {
    console.warn('Twitter guest auth unavailable:', e.message)
    return []
  }
}

async function searchTwitterV2(bearer) {
  const posts = []
  const seen  = new Set()

  for (const q of TWITTER_QUERIES) {
    try {
      const params = new URLSearchParams({
        query:           q,
        max_results:     '20',
        'tweet.fields':  'created_at,author_id,public_metrics',
        expansions:      'author_id',
        'user.fields':   'username',
      })
      const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
        headers: { 'Authorization': `Bearer ${bearer}` },
      })
      if (!res.ok) continue
      const data = await res.json()

      const users = Object.fromEntries((data.includes?.users ?? []).map(u => [u.id, u.username]))
      for (const tweet of (data.data ?? [])) {
        if (seen.has(tweet.id)) continue
        seen.add(tweet.id)
        const text = tweet.text
        if (!containsBottle(text) || !containsLocation(text)) continue
        posts.push(normalizeTwitterPost(
          `twitter_${tweet.id}`,
          text,
          `https://twitter.com/i/web/status/${tweet.id}`,
          `@${users[tweet.author_id] ?? tweet.author_id}`,
          (tweet.public_metrics?.like_count ?? 0) + (tweet.public_metrics?.retweet_count ?? 0),
          tweet.created_at,
        ))
      }
    } catch (e) {
      console.warn('Twitter v2 query failed:', e.message)
    }
  }
  return posts
}

async function searchTwitterV1Guest(guestToken) {
  const posts = []
  const seen  = new Set()

  // v1 queries omit lang: filter (not supported in v1 the same way)
  const v1Queries = [
    `(binnys OR "binny's") (blanton OR "eagle rare" OR weller OR pappy OR stagg OR "e.h. taylor" OR "rock hill farms" OR "old fitzgerald" OR "birthday bourbon" OR "king of kentucky" OR "master's keep" OR "midwinter night" OR "michter's 10" OR "michter's 20" OR "old carter")`,
    `("orland park" OR "downers grove" OR naperville OR "tinley park" OR "burr ridge") (blanton OR "eagle rare" OR weller OR pappy OR stagg OR "e.h. taylor" OR "old fitzgerald" OR "birthday bourbon" OR "king of kentucky" OR "coy hill" OR willett OR "barrell craft")`,
  ]

  for (const q of v1Queries) {
    try {
      const params = new URLSearchParams({ q, result_type: 'recent', count: '20', tweet_mode: 'extended' })
      const res = await fetch(`https://api.twitter.com/1.1/search/tweets.json?${params}`, {
        headers: {
          'Authorization':  `Bearer ${WEB_BEARER}`,
          'x-guest-token':  guestToken,
        },
      })
      if (!res.ok) continue
      const data = await res.json()

      for (const tweet of (data?.statuses ?? [])) {
        if (seen.has(tweet.id_str)) continue
        seen.add(tweet.id_str)
        const text = tweet.full_text || tweet.text || ''
        if (!containsBottle(text) || !containsLocation(text)) continue
        posts.push(normalizeTwitterPost(
          `twitter_${tweet.id_str}`,
          text,
          `https://twitter.com/${tweet.user?.screen_name}/status/${tweet.id_str}`,
          `@${tweet.user?.screen_name ?? 'unknown'}`,
          (tweet.favorite_count ?? 0) + (tweet.retweet_count ?? 0),
          new Date(tweet.created_at).toISOString(),
        ))
      }
    } catch (e) {
      console.warn('Twitter v1 guest query failed:', e.message)
    }
  }
  return posts
}

function normalizeTwitterPost(id, text, url, author, score, createdAt) {
  return { id, source: 'Twitter/X', label: 'Twitter/X', title: text, snippet: '', url, author, score, createdAt }
}
