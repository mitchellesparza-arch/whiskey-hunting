/**
 * lib/discord.js — Discord webhook helper
 *
 * Posts a rich embed to the configured DISCORD_WEBHOOK_URL when a
 * truck delivery is detected.  Silently no-ops if the env var is absent.
 */

const DIST_EMOJI = {
  'Breakthru Beverage': '🟠',
  "Southern Glazer's":  '🟢',
  'RNDC':               '🔵',
  'BC Merchants':       '🟣',
}

/**
 * Shared fetch helper with a single 429-retry.  Returns true on success.
 * Discord webhooks return 204 No Content on success, so we treat any 2xx as ok.
 */
async function postWebhook(url, payload, label) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after') ?? 2) * 1000
        console.warn(`[discord] ${label} rate-limited (429), retrying after ${retryAfter}ms`)
        if (attempt === 0) { await new Promise(r => setTimeout(r, retryAfter)); continue }
        console.warn(`[discord] ${label} dropped after retry`)
        return false
      }
      if (!res.ok) {
        console.warn(`[discord] ${label} HTTP ${res.status}:`, await res.text().catch(() => ''))
        return false
      }
      return true
    } catch (err) {
      console.warn(`[discord] ${label} failed:`, err.message)
      return false
    }
  }
  return false
}

/**
 * postTruckAlert — called once per distributor / store detection.
 *
 * @param {object} opts
 * @param {string}   opts.distributor  — e.g. "Breakthru Beverage"
 * @param {string}   opts.storeName    — e.g. "Orland Park"
 * @param {Array}    opts.checkFor     — [{tier, names}] or string[]
 */
export async function postTruckAlert({ distributor, storeName, checkFor }) {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return

  const flatBottles = (checkFor ?? [])
    .flatMap(item => (typeof item === 'string' ? [item] : item.names))
    .slice(0, 8)
    .map(n => `· ${n}`)
    .join('\n')

  const emoji = DIST_EMOJI[distributor] ?? '🚛'

  const payload = {
    username:   'Tater Tracker',
    avatar_url: 'https://whiskey-hunter.vercel.app/CURRENT.png',
    embeds: [{
      title:       `${emoji} ${distributor} truck detected`,
      description: `**Binny's ${storeName}** — head over and check the shelves`,
      color:       0xe8943a,
      fields: [{
        name:   'Bottles to look for',
        value:  flatBottles || 'See the Distributor Map in the app',
        inline: false,
      }],
      footer:    { text: 'Tater Tracker' },
      timestamp: new Date().toISOString(),
    }],
  }

  const ok = await postWebhook(url, payload, `truck alert ${distributor} @ ${storeName}`)
  if (ok) console.log(`[discord] Truck alert sent: ${distributor} @ ${storeName}`)
}

/**
 * postNewFind — posts every new community find to the Patreon finds channel.
 * Uses DISCORD_FINDS_WEBHOOK (separate from the truck-alert webhook).
 *
 * @param {object} find — the find entry from lib/finds.js
 */
export async function postNewFind(find) {
  const url = process.env.DISCORD_FINDS_WEBHOOK
  if (!url) {
    console.warn('[discord] DISCORD_FINDS_WEBHOOK not set — skipping find post')
    return
  }
  console.log('[discord] Posting find to Discord:', find.bottleName)

  const fields = []
  if (find.store?.name)    fields.push({ name: '📍 Store',       value: find.store.name,    inline: true  })
  if (find.store?.address) fields.push({ name: '🗺️ Address',     value: find.store.address, inline: true  })
  if (find.price)          fields.push({ name: '💵 Price',        value: `$${find.price}`,   inline: true  })
  if (find.notes)          fields.push({ name: '📝 Notes',        value: `"${find.notes}"`,  inline: false })

  const payload = {
    username:   'Tater Tracker',
    avatar_url: 'https://whiskey-hunter.vercel.app/CURRENT.png',
    embeds: [{
      title:       `🥃 ${find.bottleName}`,
      description: `**${find.submitterName ?? 'Someone'}** just spotted this — tap below to see the full find`,
      url:         'https://whiskey-hunter.vercel.app/finds',
      color:       0xe8943a,
      fields,
      image:       find.photoUrl ? { url: find.photoUrl } : undefined,
      footer:      { text: 'Tater Tracker · log your own finds at the link above' },
      timestamp:   new Date().toISOString(),
    }],
  }

  const ok = await postWebhook(url, payload, `find ${find.bottleName}`)
  if (ok) console.log(`[discord] Find posted: ${find.bottleName}`)
}

/**
 * postFindAlert — posts to a #watchlist-hits channel when a watched bottle
 * appears in a new find.
 *
 * @param {string} watchedBottle — the bottle name from the user's watchlist
 * @param {object} find          — the find entry from lib/finds.js
 */
export async function postFindAlert(watchedBottle, find) {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return

  const payload = {
    username:   'Tater Tracker',
    avatar_url: 'https://whiskey-hunter.vercel.app/CURRENT.png',
    embeds: [{
      title:       `🎯 Watchlist match: ${watchedBottle}`,
      description: `**${find.bottleName}** was just spotted at **${find.store?.name ?? 'a store'}**`,
      color:       0x4ade80,
      fields: [
        find.store?.address ? { name: 'Address', value: find.store.address, inline: true } : null,
        find.notes          ? { name: 'Notes',   value: `"${find.notes}"`,  inline: false } : null,
      ].filter(Boolean),
      footer:    { text: 'Tater Tracker' },
      timestamp: new Date().toISOString(),
    }],
  }

  await postWebhook(url, payload, `watchlist hit ${watchedBottle}`)
}

/**
 * postGoldFoilAlert — fires when ReserveBar Gold Foil Edition goes live.
 * Uses DISCORD_WEBHOOK_URL (same channel as truck alerts).
 *
 * @param {object} opts
 * @param {string}   opts.productUrl  — direct buy URL or collection fallback
 * @param {number}   opts.price       — detected price, or null if unknown
 * @param {boolean}  opts.isTest      — if true, prefixes title with [TEST]
 */
export async function postGoldFoilAlert({ productUrl, price, isTest = false }) {
  const url = process.env.DISCORD_FINDS_WEBHOOK
  if (!url) return

  const priceStr = price ? `$${price}` : '~$400'
  const title    = isTest
    ? '[TEST] 🥃 Gold Foil Monitor — push delivery check'
    : '🥃 GOLD FOIL IS LIVE ON RESERVEBAR'

  const payload = {
    username:   'Tater Tracker',
    avatar_url: 'https://whiskey-hunter.vercel.app/CURRENT.png',
    embeds: [{
      title,
      description: `**Wild Turkey Austin Nichols Archives Gold Foil Edition** is live for purchase.\nOpen ReserveBar and check out now — it won't last long.`,
      url:         productUrl,
      color:       0xfbbf24,
      fields: [
        { name: '💵 Price',  value: priceStr,                        inline: true  },
        { name: '🔗 Buy',    value: `[ReserveBar](${productUrl})`,   inline: true  },
      ],
      footer:    { text: 'Tater Tracker · ReserveBar monitor' },
      timestamp: new Date().toISOString(),
    }],
  }

  const ok = await postWebhook(url, payload, 'Gold Foil alert')
  if (ok) console.log(`[discord] Gold Foil alert sent (test=${isTest})`)
}

/**
 * postRetailerFind — fires when a multi-retailer check detects a new
 * in-stock allocated bottle at a Chicagoland retailer (Liquor Barn, Joe's, etc.)
 *
 * @param {object} find
 * @param {string}       find.bottle    — canonical bottle name
 * @param {string}       find.retailer  — store name
 * @param {string}       find.location  — city/suburb
 * @param {number|null}  find.price     — current price
 * @param {string}       find.url       — direct product or category URL
 */
export async function postRetailerFind(find) {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return

  const priceStr = find.price ? `$${find.price.toFixed(2)}` : 'price unknown'

  const payload = {
    username:   'Tater Tracker',
    avatar_url: 'https://whiskey-hunter.vercel.app/CURRENT.png',
    embeds: [{
      title:       `🥃 ${find.bottle} — NOW IN STOCK`,
      description: `**${find.retailer}** (${find.location}) has this in stock`,
      url:         find.url,
      color:       0x4ade80,
      fields: [
        { name: '💵 Price',    value: priceStr,           inline: true },
        { name: '📍 Retailer', value: find.retailer,      inline: true },
        { name: '🛒 Link',     value: `[View product](${find.url})`, inline: false },
      ],
      footer:    { text: 'Tater Tracker · Multi-Retailer Monitor' },
      timestamp: new Date().toISOString(),
    }],
  }

  const ok = await postWebhook(url, payload, `retailer find ${find.bottle} @ ${find.retailer}`)
  if (ok) console.log(`[discord] Retailer find posted: ${find.bottle} @ ${find.retailer}`)
}

/**
 * postBoBFind — posts a user-reported find to the Bonding of Bourbon Discord
 * as a forum thread post (requires thread_name in the payload).
 *
 * Routing:
 *   BOB_TEST_MODE=true  → BOB_TEST_WEBHOOK (test channel, visible only to us)
 *   otherwise           → BOB_CHICAGO_WEBHOOK  if store address contains "Chicago, IL"
 *                       → BOB_SUBURBS_WEBHOOK  for all other Chicagoland addresses
 *
 * @param {object} find — the find entry from lib/finds.js
 */
export async function postBoBFind(find) {
  const testMode = process.env.BOB_TEST_MODE === 'true'

  let webhookUrl
  if (testMode) {
    webhookUrl = process.env.BOB_TEST_WEBHOOK?.trim()
  } else {
    const address  = find.store?.address ?? ''
    const isCity   = /\bChicago,\s*IL\b/i.test(address)
    webhookUrl     = isCity
      ? process.env.BOB_CHICAGO_WEBHOOK?.trim()
      : process.env.BOB_SUBURBS_WEBHOOK?.trim()
  }

  if (!webhookUrl) {
    console.warn('[discord] BOB webhook not configured — skipping')
    return
  }

  const threadName = `🥃 ${find.bottleName} — ${find.store?.name ?? 'Unknown Store'}`

  const fields = []
  if (find.store?.name)    fields.push({ name: '📍 Store',   value: find.store.name,    inline: true  })
  if (find.price)          fields.push({ name: '💵 Price',   value: `$${find.price}`,   inline: true  })
  if (find.store?.address) fields.push({ name: '🗺️ Address', value: `[${find.store.address}](https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(find.store.address)})`, inline: false })
  if (find.notes)          fields.push({ name: '📝 Notes',   value: `"${find.notes}"`,  inline: false })

  const payload = {
    thread_name: threadName,
    username:    'Tater Tracker',
    avatar_url:  'https://whiskey-hunter.vercel.app/CURRENT.png',
    embeds: [{
      description: `**${find.submitterName ?? 'Someone'}** just spotted this — [tap here to see the full find](https://whiskey-hunter.vercel.app/finds)`,
      color:       0xe8943a,
      fields,
      image:       find.photoUrl ? { url: find.photoUrl } : undefined,
      footer:      { text: 'Tater Tracker · log your own finds at the link above' },
      timestamp:   new Date().toISOString(),
    }],
  }

  const label = `BOB find ${find.bottleName} (${testMode ? 'test' : find.store?.address})`
  const ok    = await postWebhook(webhookUrl, payload, label)
  if (ok) console.log(`[discord] BOB find posted: ${find.bottleName} (test=${testMode})`)
}

/**
 * postTateraAlert — relays a Costco bourbon alert (sourced from Tatera's Illinois
 * Discord feed) to a dedicated webhook (TATERA_DISCORD_WEBHOOK_URL).  Falls
 * silent if that env var is not set, so the relay can be smoke-tested via
 * email/push first before opening the Discord firehose.  Only fires for
 * in-stock transitions; out-of-stock changes are silently dropped.
 */
export async function postTateraAlert(alert) {
  const url = process.env.TATERA_DISCORD_WEBHOOK_URL
  if (!url) return
  if (alert.status !== 'in_stock') return

  const storeStr = `${alert.storeName} (${alert.storeNumber}), ${alert.state}`

  const payload = {
    username:   'Tater Tracker',
    avatar_url: 'https://whiskey-hunter.vercel.app/CURRENT.png',
    embeds: [{
      title:       `🥃 Costco ${alert.state}: ${alert.productName}`,
      description: `**Now available** at **${storeStr}**`,
      color:       0xe8943a,
      fields: [
        { name: '📍 Store',   value: storeStr,                   inline: true  },
        { name: '🏷️ Item #',  value: `\`${alert.itemNumber}\``,  inline: true  },
      ],
      footer:    { text: 'Costco Illinois feed · Tater Tracker' },
      timestamp: alert.observedAt ?? new Date().toISOString(),
    }],
  }

  const ok = await postWebhook(url, payload, `Tatera ${alert.productName} @ ${storeStr}`)
  if (ok) console.log(`[discord] Tatera alert relayed: ${alert.productName} @ ${storeStr}`)
}
