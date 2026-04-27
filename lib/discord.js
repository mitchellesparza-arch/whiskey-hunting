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

  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    console.log(`[discord] Truck alert sent: ${distributor} @ ${storeName}`)
  } catch (err) {
    console.warn('[discord] Webhook failed:', err.message)
  }
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

  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  } catch (err) {
    console.warn('[discord] Find alert failed:', err.message)
  }
}
