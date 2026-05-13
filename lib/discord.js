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
    avatar_url: 'https://whiskey-hunter.vercel.app/icon.png',
    embeds: [{
      title:       `${emoji} ${distributor} truck detected`,
      description: `**Binny's ${storeName}** — head over and check the shelves`,
      color:       0xe8943a,
      fields: [{
        name:   'Bottles to look for',
        value:  flatBottles || 'See the Distributor Map in the app',
        inline: false,
      }],
      footer:    { text: 'Tater Tracker · Jon and the Juice' },
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
    avatar_url: 'https://whiskey-hunter.vercel.app/icon.png',
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
    avatar_url: 'https://whiskey-hunter.vercel.app/icon.png',
    embeds: [{
      title:       `🎯 Watchlist match: ${watchedBottle}`,
      description: `**${find.bottleName}** was just spotted at **${find.store?.name ?? 'a store'}**`,
      color:       0x4ade80,
      fields: [
        find.store?.address ? { name: 'Address', value: find.store.address, inline: true } : null,
        find.notes          ? { name: 'Notes',   value: `"${find.notes}"`,  inline: false } : null,
      ].filter(Boolean),
      footer:    { text: 'Tater Tracker · Jon and the Juice' },
      timestamp: new Date().toISOString(),
    }],
  }

  await postWebhook(url, payload, `watchlist hit ${watchedBottle}`)
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
    avatar_url: 'https://whiskey-hunter.vercel.app/icon.png',
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
