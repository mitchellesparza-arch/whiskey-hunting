// ==UserScript==
// @name         Tater Tracker — Tatera Illinois relay
// @namespace    https://whiskey-hunter.vercel.app/
// @version      0.2.0
// @description  Watch the Tatera.io #illinois Discord channel for Costco bourbon alerts and POST them to Tater Tracker's /api/ingest/tatera endpoint.
// @match        https://discord.com/channels/*
// @match        https://canary.discord.com/channels/*
// @match        https://ptb.discord.com/channels/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

/* ============================================================================
 * CONFIG — fill these in once.
 *
 *   1. CHANNEL_URL — open the Tatera #illinois channel in Discord, copy the
 *      address bar URL (looks like https://discord.com/channels/<guild>/<chan>)
 *      and paste it here.
 *   2. API_BASE — your Tater Tracker deployment (no trailing slash).
 *   3. INGEST_SECRET — must match TATERA_INGEST_SECRET in your Vercel env.
 *   4. BOT_AUTHOR — the username Discord shows for Tatera's bot. From the
 *      screenshots this is "Tatera.io". Adjust if Tatera renames it.
 * ========================================================================== */
const CONFIG = {
  CHANNEL_URL:    'https://discord.com/channels/REPLACE_GUILD/REPLACE_CHANNEL',
  API_BASE:       'https://whiskey-hunter.vercel.app',
  INGEST_SECRET:  'REPLACE_ME',
  BOT_AUTHOR:     'Tatera.io',
}

/* ========================================================================== */

;(function () {
  'use strict'

  const LOG_TAG          = '[tatera-relay]'
  const SEEN_PREFIX      = 'tatera-il-seen:'
  const SEEN_TTL_MS      = 14 * 24 * 60 * 60 * 1000   // 14 days
  const BACKFILL_AGE_MS  = 60 * 60 * 1000             // process messages from last hour on attach
  const log              = (...a) => console.log(LOG_TAG, ...a)
  const warn             = (...a) => console.warn(LOG_TAG, ...a)

  // ── Channel match ─────────────────────────────────────────────────────────
  const channelPath = (() => {
    try { return new URL(CONFIG.CHANNEL_URL).pathname }
    catch { return null }
  })()

  function isOnTargetChannel() {
    return channelPath && location.pathname === channelPath
  }

  // ── localStorage dedup with TTL eviction ──────────────────────────────────
  function isSeen(messageId) {
    const v = localStorage.getItem(SEEN_PREFIX + messageId)
    if (!v) return false
    const stamp = Number(v)
    if (Number.isNaN(stamp)) return true
    if (Date.now() - stamp > SEEN_TTL_MS) {
      localStorage.removeItem(SEEN_PREFIX + messageId)
      return false
    }
    return true
  }
  function markSeen(messageId) {
    try { localStorage.setItem(SEEN_PREFIX + messageId, String(Date.now())) }
    catch (e) { warn('localStorage write failed:', e.message) }
  }

  // ── Parse one Discord message <li> node ───────────────────────────────────
  function parseMessage(node) {
    const id = node?.id || ''
    const m  = id.match(/^chat-messages-(\d+)-(\d+)$/)
    if (!m) return null
    const [, channelId, messageId] = m

    // Author — Discord wraps username in [class*="username"] or [id^="message-username-"]
    const authorEl = node.querySelector('[id^="message-username-"], [class*="username"]')
    const author   = authorEl?.textContent?.trim()
    if (!author || !author.toLowerCase().includes(CONFIG.BOT_AUTHOR.toLowerCase())) return null

    // Title — embeds put the headline in [class*="embedTitle"]
    const titleEl = node.querySelector('[class*="embedTitle"]')
    const title   = titleEl?.textContent?.trim() ?? ''
    if (!/costco/i.test(title)) return null

    // Status from leading emoji on the title (✅ vs ❌)
    let status = null
    if (title.startsWith('✅')) status = 'in_stock'
    else if (title.startsWith('❌')) status = 'out_of_stock'
    if (!status) return null

    // Product name = title minus leading emoji + "Costco:" prefix
    const productName = title
      .replace(/^[✅❌]\s*/, '')
      .replace(/^Costco:\s*/i, '')
      .trim()
    if (!productName) return null

    // Embed fields — find every embedField block, key by its name label
    const fields = {}
    node.querySelectorAll('[class*="embedField"]').forEach(fieldEl => {
      const name  = fieldEl.querySelector('[class*="embedFieldName"]')?.textContent?.trim()
      const value = fieldEl.querySelector('[class*="embedFieldValue"]')?.textContent?.trim()
      if (name && value) fields[name.toLowerCase()] = value
    })

    const itemNumber = (fields['item #'] || fields['item#'] || fields['item'] || '').replace(/[^\d]/g, '')
    const storeRaw   = fields['store'] || ''

    // Store format: "Naperville (342), IL"  or  "North Riverside IL (1153), IL"
    const storeMatch = storeRaw.match(/^(.+?)\s*\((\d+)\)\s*,\s*([A-Z]{2})\s*$/)
    if (!itemNumber || !storeMatch) {
      log('skipped — missing item# or unparseable store:', { productName, storeRaw, itemNumber, fields })
      return null
    }
    const [, storeName, storeNumber, state] = storeMatch

    // Timestamp from the <time> element on the message
    const timeEl    = node.querySelector('time[datetime]')
    const observedAt = timeEl?.getAttribute('datetime') || new Date().toISOString()

    return {
      discordMessageId: messageId,
      channelId,
      productName,
      itemNumber,
      storeName: storeName.trim(),
      storeNumber,
      state,
      status,
      observedAt,
    }
  }

  // ── POST to ingest endpoint via GM_xmlhttpRequest (bypasses Discord CSP) ──
  function postAlert(alert) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url:    CONFIG.API_BASE + '/api/ingest/tatera',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + CONFIG.INGEST_SECRET,
        },
        data: JSON.stringify(alert),
        timeout: 10000,
        onload:    r => (r.status >= 200 && r.status < 300) ? resolve(r) : reject(new Error(`${r.status} ${r.responseText?.slice(0, 200)}`)),
        onerror:   r => reject(new Error('network error: ' + (r?.error || 'unknown'))),
        ontimeout: () => reject(new Error('timeout')),
      })
    })
  }

  // ── Process a candidate message node (gates: channel, dedup, parse, send) ─
  async function processNode(node) {
    if (!isOnTargetChannel()) return
    const id = node?.id || ''
    const m  = id.match(/^chat-messages-(?:\d+)-(\d+)$/)
    if (!m) return
    const messageId = m[1]
    if (isSeen(messageId)) return

    const alert = parseMessage(node)
    if (!alert) {
      // Not a Tatera Costco alert (or unparseable) — mark seen so we don't retry
      markSeen(messageId)
      return
    }

    try {
      await postAlert(alert)
      markSeen(messageId)
      log('relayed:', alert.status, alert.productName, '@', alert.storeName, alert.storeNumber)
    } catch (e) {
      warn('relay failed for', messageId, '—', e.message)
      // Don't mark seen — we'll retry on next render
    }
  }

  // ── Backfill: when first attaching to a channel, walk every visible message.
  //    Messages older than BACKFILL_AGE_MS are silently marked as seen so we
  //    don't blast historical alerts.  Recent messages get processed normally
  //    — the server's atomic dedup (SET NX on the discord message id) prevents
  //    double fanout if the same message was already handled in another tab
  //    or session.  This way, if Discord refreshes during the day, we don't
  //    lose alerts that arrived while the tab was reloading.
  async function backfillProcess(root) {
    const cutoff = Date.now() - BACKFILL_AGE_MS
    const items  = root.querySelectorAll('li[id^="chat-messages-"]')
    let recent = 0, old = 0
    for (const li of items) {
      const m = li.id.match(/^chat-messages-(?:\d+)-(\d+)$/)
      if (!m) continue
      const messageId = m[1]
      const timeEl    = li.querySelector('time[datetime]')
      const ts        = timeEl?.getAttribute('datetime')
      const ageOk     = ts && new Date(ts).getTime() >= cutoff
      if (ageOk) {
        recent++
        await processNode(li)   // server dedup keeps duplicates safe
      } else {
        old++
        markSeen(messageId)
      }
    }
    log(`backfill: ${old} marked seen (>1h old), ${recent} processed (recent)`)
  }

  // ── MutationObserver — watch for new <li id="chat-messages-..."> insertions
  let observer = null
  let lastChannelPath = null

  function ensureObserver() {
    const onChannel = isOnTargetChannel()

    // Channel changed — reattach
    if (location.pathname !== lastChannelPath) {
      lastChannelPath = location.pathname
      if (observer) { observer.disconnect(); observer = null }
      if (!onChannel) return
    }

    if (!onChannel) return
    if (observer) return

    // Stable-ish chat root: ol[data-list-id="chat-messages"] is set by Discord
    const root = document.querySelector('ol[data-list-id="chat-messages"]')
    if (!root) return  // not yet rendered, retry on next tick

    log('observing chat for new alerts (channel:', location.pathname, ')')
    backfillProcess(root)   // fires async, doesn't block observer attach

    observer = new MutationObserver(records => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n.nodeType !== 1) continue
          if (n.matches?.('li[id^="chat-messages-"]')) processNode(n)
          n.querySelectorAll?.('li[id^="chat-messages-"]').forEach(processNode)
        }
      }
    })
    observer.observe(root, { childList: true, subtree: true })
  }

  // Discord is a SPA — re-evaluate observer every second and on URL changes
  setInterval(ensureObserver, 1000)
  window.addEventListener('popstate', ensureObserver)

  // Initial kick
  ensureObserver()
  log('loaded · channel target:', channelPath, '· api:', CONFIG.API_BASE)
})()
