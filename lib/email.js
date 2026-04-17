import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function bottleRow(bottle) {
  const priceStr = bottle.price != null ? `$${bottle.price.toFixed(2)}` : '—'
  const link = bottle.url
    ? `<a href="${bottle.url}" style="color:#e8943a;font-weight:600;text-decoration:none;">${bottle.name}</a>`
    : `<span style="font-weight:600;">${bottle.name}</span>`
  return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #2a2118;font-size:15px;">${link}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #2a2118;font-size:15px;color:#4ade80;font-weight:700;text-align:center;">IN STOCK</td>
      <td style="padding:12px 16px;border-bottom:1px solid #2a2118;font-size:15px;text-align:right;">${priceStr}</td>
    </tr>`
}

function truckSection(truckEvents) {
  if (!truckEvents.length) return ''

  const cards = truckEvents.map((t) => {
    const triggeredList = t.triggeredBy.map((n) => `<li style="margin:2px 0;">${n}</li>`).join('')

    // checkFor is [{tier, names}] — render each tier as its own labelled group
    const tierGroups = (t.checkFor || []).map(({ tier, names }) => {
      const items = names.map((n) => `<li style="margin:3px 0;">${n}</li>`).join('')
      return `
            <div style="margin-bottom:10px;">
              <div style="font-size:11px;color:#8a6840;margin-bottom:4px;">${tier}</div>
              <ul style="margin:0;padding-left:18px;font-size:13px;color:#c9a87a;">${items}</ul>
            </div>`
    }).join('')

    const checkSection = tierGroups
      ? `
          <div>
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b5030;margin-bottom:8px;">Head in and ask about</div>
            ${tierGroups}
          </div>`
      : ''

    return `
      <div style="margin-bottom:16px;background:#1a1008;border:1px solid #4a2e10;border-radius:8px;overflow:hidden;">
        <div style="background:#2a1500;padding:10px 16px;font-size:13px;font-weight:700;color:#e8943a;letter-spacing:0.3px;">
          🚛 ${t.distributor} Delivery Detected
        </div>
        <div style="padding:14px 16px;">
          <div style="margin-bottom:${tierGroups ? '12px' : '0'};">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b5030;margin-bottom:6px;">Triggered by</div>
            <ul style="margin:0;padding-left:18px;font-size:13px;color:#9a7c55;">${triggeredList}</ul>
          </div>
          ${checkSection}
        </div>
      </div>`
  }).join('')

  return `
    <tr>
      <td style="padding:0 32px 8px;">
        <div style="margin-top:8px;">
          ${cards}
        </div>
      </td>
    </tr>`
}

// ── Subject line ──────────────────────────────────────────────────────────────

function buildSubject(inStockBottles, truckEvents) {
  const hasAlerts = inStockBottles.length > 0
  const hasTrucks = truckEvents.length > 0

  if (hasAlerts && hasTrucks) {
    const truckNames = truckEvents.map((t) => t.distributor).join(' + ')
    return inStockBottles.length === 1
      ? `🥃🚛 ${inStockBottles[0].name} in stock + ${truckNames} delivery at Binny's Orland Park`
      : `🥃🚛 ${inStockBottles.length} bottles in stock + ${truckNames} delivery at Binny's Orland Park`
  }

  if (hasAlerts) {
    return inStockBottles.length === 1
      ? `🥃 ${inStockBottles[0].name} is in stock at Binny's Orland Park!`
      : `🥃 ${inStockBottles.length} allocated bottles in stock at Binny's Orland Park!`
  }

  // Trucks only
  const distributorNames = truckEvents.map((t) => t.distributor).join(' + ')
  const topCheck = truckEvents
    .flatMap((t) => (t.checkFor ?? []).flatMap((item) =>
      typeof item === 'string' ? [item] : item.names
    ))
    .slice(0, 3)
    .join(', ')
  return `🚛 ${distributorNames} delivery detected at Binny's — check for ${topCheck}`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Send an alert email.
 *
 * @param {Array}  inStockBottles - alert bottle results where inStock === true
 * @param {Array}  truckEvents    - truck_detected events from this cron run
 * @param {string} checkedAt      - ISO timestamp of the check
 */
export async function sendAlertEmail(inStockBottles, truckEvents = [], checkedAt) {
  if (inStockBottles.length === 0 && truckEvents.length === 0) return

  const to = process.env.ALERT_EMAIL
  if (!to) {
    console.warn('ALERT_EMAIL not set — skipping email')
    return
  }

  const subject     = buildSubject(inStockBottles, truckEvents)
  const alertRows   = inStockBottles.map(bottleRow).join('')
  const truckHtml   = truckSection(truckEvents)
  const checkedDate = new Date(checkedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })

  const alertTable = inStockBottles.length > 0 ? `
    <tr>
      <td style="padding:0 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 16px;border-radius:8px;overflow:hidden;border:1px solid #2a2118;">
          <thead>
            <tr style="background:#2a1a08;">
              <th style="padding:10px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#b07040;">Bottle</th>
              <th style="padding:10px 16px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#b07040;">Status</th>
              <th style="padding:10px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#b07040;">Price</th>
            </tr>
          </thead>
          <tbody style="background:#1a1008;">
            ${alertRows}
          </tbody>
        </table>
      </td>
    </tr>` : ''

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
              <div style="font-size:36px;margin-bottom:8px;">🥃</div>
              <h1 style="margin:0;font-size:24px;color:#fff;font-weight:800;letter-spacing:-0.5px;">
                Binny's Orland Park Alert
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:#fde8c0;opacity:0.9;">
                ${inStockBottles.length > 0 && truckEvents.length > 0
                  ? 'Bottles in stock + delivery activity detected'
                  : inStockBottles.length > 0
                    ? 'The following allocated bottles are currently in stock'
                    : 'Distributor delivery activity detected'}
              </p>
            </td>
          </tr>

          <!-- Alert bottles table (if any) -->
          ${alertTable}

          <!-- Truck detection cards (if any) -->
          ${truckHtml}

          <!-- CTA -->
          <tr>
            <td style="padding:${inStockBottles.length > 0 ? '0' : '16px'} 32px 12px;text-align:center;">
              <a href="https://www.binnys.com/spirits/whiskey/bourbon-whiskey/?store=Orland+Park"
                 style="display:inline-block;background:linear-gradient(135deg,#c46c1a,#e8943a);color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:8px;">
                Shop at Binny's Orland Park →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #2a2118;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b5030;">
                Checked: ${checkedDate}<br/>
                Binny's Orland Park · 15521 S. LaGrange Rd, Orland Park, IL 60462
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
    const { data, error } = await getResend().emails.send({
      from: 'Whiskey Hunter <onboarding@resend.dev>',
      to,
      subject,
      html,
    })
    if (error) {
      console.error('Resend error:', error)
    } else {
      console.log('Email sent:', data?.id)
    }
  } catch (err) {
    console.error('Failed to send email:', err)
  }
}

// ── Social scan email ──────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function relativeTime(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins <  60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

/**
 * Send a digest email of new social media sightings.
 *
 * @param {Array}  posts      - normalised post objects from lib/social.js
 * @param {string} checkedAt  - ISO timestamp
 */
export async function sendSocialEmail(posts, checkedAt) {
  if (!posts.length) return

  const to = process.env.ALERT_EMAIL
  if (!to) { console.warn('ALERT_EMAIL not set — skipping social email'); return }

  const subject = posts.length === 1
    ? `📡 Bourbon sighting near Orland Park: ${posts[0].title.slice(0, 55)}…`
    : `📡 ${posts.length} bourbon sightings near Orland Park`

  const checkedDate = new Date(checkedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })

  const cards = posts.map((post) => {
    const age     = relativeTime(post.createdAt)
    const snippet = post.snippet
      ? `<p style="margin:6px 0 0;font-size:13px;color:#9a7c55;line-height:1.5;">${escapeHtml(post.snippet)}${post.snippet.length >= 280 ? '…' : ''}</p>`
      : ''
    return `
      <div style="margin-bottom:12px;background:#1a1008;border:1px solid #2a2118;border-radius:8px;overflow:hidden;">
        <div style="background:#1f1408;padding:8px 14px;border-bottom:1px solid #2a2118;display:flex;justify-content:space-between;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6b5030;">${escapeHtml(post.label)}</span>
          <span style="font-size:11px;color:#4a3020;">${age} · ${escapeHtml(post.author)}</span>
        </div>
        <div style="padding:12px 14px;">
          <a href="${escapeHtml(post.url)}" style="font-size:14px;font-weight:600;color:#e8943a;text-decoration:none;line-height:1.4;">${escapeHtml(post.title)}</a>
          ${snippet}
          <div style="margin-top:8px;">
            <a href="${escapeHtml(post.url)}" style="font-size:12px;color:#c46c1a;text-decoration:none;">View post →</a>
          </div>
        </div>
      </div>`
  }).join('')

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0f0a05;color:#f5e6cc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0a05;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1008;border-radius:12px;overflow:hidden;border:1px solid #3d2b10;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3a0a,#c46c1a);padding:28px 32px;text-align:center;">
              <div style="font-size:32px;margin-bottom:6px;">📡</div>
              <h1 style="margin:0;font-size:22px;color:#fff;font-weight:800;letter-spacing:-0.5px;">
                Bourbon Sightings Near Orland Park
              </h1>
              <p style="margin:6px 0 0;font-size:13px;color:#fde8c0;opacity:0.9;">
                ${posts.length} new ${posts.length === 1 ? 'mention' : 'mentions'} on Reddit &amp; Twitter/X
              </p>
            </td>
          </tr>

          <!-- Post cards -->
          <tr>
            <td style="padding:20px 24px 8px;">
              ${cards}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #2a2118;text-align:center;">
              <p style="margin:0;font-size:12px;color:#6b5030;">
                Scanned: ${checkedDate}<br/>
                Monitoring Reddit &amp; Twitter/X · ~30 min radius of Orland Park, IL
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
    const { data, error } = await getResend().emails.send({
      from: 'Whiskey Hunter <onboarding@resend.dev>',
      to,
      subject,
      html,
    })
    if (error) console.error('Resend error (social):', error)
    else console.log('Social email sent:', data?.id)
  } catch (err) {
    console.error('Failed to send social email:', err)
  }
}
