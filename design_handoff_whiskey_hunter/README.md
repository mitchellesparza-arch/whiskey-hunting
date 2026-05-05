# Handoff: Whiskey Hunter — UI Polish & Feature Roadmap

## Overview

Whiskey Hunter is a private club tool for a Chicagoland Discord bourbon community. It has three core features:

1. **Truck Tracker** (`app/page.jsx`) — Detects when a Breakthru, Southern Glazer's, RNDC, or BC Merchants delivery truck visits any Chicagoland Binny's by monitoring canary bottle restocks via Algolia. Checked 6× daily.
2. **Unicorn Auctions** (`app/unicorn/page.jsx`) — Scrapes Unicorn Auctions and surfaces whiskey lots selling below UA's estimated value.
3. **Finds** (`app/finds/page.jsx`) — Club members report spotted allocated bottles with store location, photo, and notes. Displayed on a map.

This handoff documents UI polish changes and new features to implement. The design reference is `Whiskey Hunter.html` in this package.

## About the Design Files

`Whiskey Hunter.html` is a **high-fidelity interactive prototype** built in React + Babel. It is a **design reference only** — do not ship it directly. Your task is to recreate these designs inside the existing Next.js 14 App Router codebase, using the established Tailwind CSS + CSS variables patterns already in `app/globals.css`.

## Fidelity

**High-fidelity.** Colors, typography, spacing, component hierarchy, and interactions should match the prototype precisely. The existing codebase already has the correct design tokens in `globals.css` — use those everywhere.

---

## Design System (existing — use exactly)

These values are already defined in `app/globals.css`. Do not invent new ones.

```css
--bg-base:   #0f0a05   /* page background */
--bg-card:   #1a1008   /* card background */
--border:    #3d2b10   /* card borders */
--text-primary: #f5e6cc  /* headings, body */
--text-muted:   #9a7c55  /* secondary text */
--accent:    #e8943a   /* CTA buttons, active states */
--green:     #4ade80
--red:       #f87171
```

**Typography:** `DM Sans` (400/500/600/700/800) + `DM Mono` for code/UPC strings. Add these Google Fonts imports to `app/layout.jsx`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Existing utility classes** (already in `globals.css`, keep using):
- `.card` — rounded-xl, bg-card, border, transition
- `.btn-primary` — accent background CTA
- `.section-header`, `.section-title`

---

## Change 1 — Persistent Bottom Tab Navigation

### What to build
A fixed bottom nav bar that appears on **all pages**, replacing the current per-page link approach.

### Files to create/edit
- Create `app/components/BottomNav.jsx`
- Edit `app/layout.jsx` to mount `<BottomNav>` globally

### BottomNav spec

```
Position: fixed, bottom: 0, left: 0, right: 0, z-index: 100
Background: rgba(15,10,5,0.97) with backdrop-filter: blur(12px)
Border-top: 1px solid #3d2b10
Bottom padding: env(safe-area-inset-bottom)   ← critical for iPhone home bar
Height: ~60px content + safe area
```

**Four tabs:**
| Tab | Icon | href |
|-----|------|------|
| Tracker | 🚛 | `/` |
| Auctions | 🦄 | `/unicorn` |
| Finds | 📍 | `/finds` |

Each tab button:
- `flex: 1`, column flex, center-aligned
- Icon: `font-size: 20px`
- Label: `font-size: 10px`, `font-weight: 700` when active, `500` when inactive
- Active color: `#e8943a` (accent)
- Inactive color: `#6b5030`
- Active indicator: `width: 18px, height: 2px, background: #e8943a, border-radius: 1px` — sits below the label

**Notification badge** (for Finds tab — when there are finds posted in the last 6h):
```
position: absolute, top: -4px, right: -6px
background: #f87171, color: #fff
font-size: 9px, font-weight: 700
border-radius: 999px, padding: 1px 4px
```
Fetch count from `/api/finds` and count items where `timestamp > Date.now() - 6*3600000`.

**Body padding:** Add `padding-bottom: 80px` to the `<main>` wrapper in `layout.jsx` so page content doesn't hide behind the nav.

**Active detection:** Use Next.js `usePathname()` to determine which tab is active.

---

## Change 2 — Unified Top Header (all pages)

The current `app/page.jsx` has a good sticky header. The Unicorn and Finds pages need to match it.

### Shared `<AppHeader>` component
Create `app/components/AppHeader.jsx`:

```
Position: sticky, top: 0, z-index: 50
Background: rgba(15,10,5,0.92) with backdrop-filter: blur(12px)
Border-bottom: 1px solid #3d2b10
Height: ~52px
Padding: 12px 16px
```

Left side:
- 🥃 emoji (22px)
- `"Whiskey Hunter"` — `font-weight: 800, font-size: 15px, color: #f5e6cc`
- Contextual subtitle per page — `font-size: 11px, color: #9a7c55`

Right side (per-page): Refresh button using `.btn-primary` class. Remove all the per-page nav links from the header — they're now in the bottom tab bar.

**Subtitle by page:**
- `/` → `"Chicagoland Binny's · Truck Tracker"`
- `/unicorn` → `"Unicorn Auctions · Live Deals"`
- `/finds` → `"Community Finds · Chicagoland"`

---

## Change 3 — Fix Finds Page Visual Inconsistency

**Problem:** `app/finds/page.jsx` currently uses a completely different color scheme from the rest of the app:
- Background: `#1a1a2e` (bluish) → should be `var(--bg-base)` = `#0f0a05`
- Cards: `#1a1a2e` → should use `.card` class
- Accent: `#d4a054` → should be `#e8943a`
- Font: `system-ui` → should be `DM Sans` (handled by layout)
- Border: `#4a3728` → should be `#3d2b10`

### What to do
Replace all hardcoded inline styles in `finds/page.jsx` with the shared CSS variables and Tailwind classes that the rest of the app uses. Specifically:

1. Wrap the page in `<div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>` (matching `page.jsx`)
2. Replace the hardcoded `cardStyle` object with `className="card p-4 mb-5"`
3. Replace `inputStyle` background `#0d0d1a` → `var(--bg-base)`, border `#4a3728` → `var(--border)`
4. Replace `labelStyle` color `#aaa` → `var(--text-muted)`
5. Replace the submit button background `#8B4513` → `var(--accent)` and use `.btn-primary` class
6. Replace heading color `#d4a054` → `var(--text-primary)` with accent for h1 icon only
7. Replace find list item background `#0d0d1a` / border `#2d2d2d` → `.card` class pattern
8. Map/List toggle buttons: active = accent bg, inactive = `var(--bg-card)` bg

The form layout, functionality, and Google Places autocomplete logic should remain unchanged.

---

## Change 4 — Improved Tracker Empty State

**Problem:** When no truck events exist, the current empty state shows a raw `curl` command — not appropriate for non-technical club members.

**Replace the current empty-state card** in `app/page.jsx` (the block inside `truckEvents.length === 0`) with:

### Hero banner (shown when empty)
```
Background: linear-gradient(160deg, #1e1004 0%, #0f0a05 60%)
Padding: 32px 16px 24px
Border-bottom: 1px solid #2a1c08
Text-align: center
```

Content:
- 🚛 emoji at 48px
- H2: `"No truck deliveries detected yet"` — `font-weight: 800, font-size: 22px, color: #f5e6cc`
- Body: `"The tracker checks Binny's inventory 6× daily — at 7, 9, 11 AM and 1, 3, 5 PM CDT. When a delivery truck is detected at any Chicagoland location, it shows up here."` — `font-size: 14px, color: #9a7c55, line-height: 1.6`
- Three pill badges: `"Next check: [time] CDT"`, `"All [N] Binny's stores monitored"`, `"6× daily cadence"`
  - Badge style: `font-size: 12px, color: #9a7c55, background: var(--bg-card), border: 1px solid var(--border), border-radius: 999px, padding: 4px 12px`

### "How it works" section (3 cards, shown when empty)
Below the hero, render a 3-column grid (1-col on mobile, 3-col on lg) of `.card` components:

| Step | Label | Description |
|------|-------|-------------|
| 1 | Canary scan | Every 6h, the tracker checks if high-volume bottles (Old Forester, Benchmark, etc.) have restocked at each store. |
| 2 | Truck detected | A sudden restock of canary bottles means a delivery truck likely just visited. We flag it and log which distributor. |
| 3 | Check the map | Use the Distributor Map below to know which allocated bottles may be on that truck — then head to the store. |

Card layout:
- Step number: `font-size: 28px, font-weight: 800, color: #e8943a, opacity: 0.3, margin-bottom: 4px`
- Label: `font-weight: 700, font-size: 13px, color: #f5e6cc, margin-bottom: 4px`
- Description: `font-size: 12px, color: #9a7c55, line-height: 1.6`

Keep the existing `<TruckCard>` and `<StoreActivityCard>` components and the Distributor Map section — only the empty state changes.

---

## Change 5 — Find Card "Fresh" Badge

In the Finds list, add a freshness badge to each find card based on age:

```js
const hoursOld = (Date.now() - new Date(find.timestamp).getTime()) / 3600000;
const isFresh = hoursOld < 6;
const isStale = hoursOld > 20;
```

- `isFresh` → show badge: `"🔥 Fresh"`, color `#4ade80`, bg `rgba(74,222,128,0.1)`, border `rgba(74,222,128,0.3)`
- `isStale` → show badge: `"⏰ Aging"`, color `#6b5030`, bg `transparent`, border `#3d2b10`
- Neither → no badge

Place badge in the top-right of the find card header, alongside the bottle name.

---

## New Feature 1 — Discord Webhook Alerts

**Priority: HIGH. Effort: Low.**

When the cron (`app/api/cron/route.js`) detects a truck delivery, post a message to a Discord webhook.

### Environment variable
Add to `.env.local` and Vercel dashboard:
```
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

### Implementation

In `lib/checker.js` (or wherever truck events are persisted after detection), add a call to a new `lib/discord.js` helper:

```js
// lib/discord.js
export async function postTruckAlert({ distributor, storeName, checkFor }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  const bottles = checkFor
    .flatMap(item => typeof item === 'string' ? [item] : item.names)
    .slice(0, 8)
    .map(n => `· ${n}`)
    .join('\n');

  const distEmoji = {
    'Breakthru Beverage': '🟠',
    "Southern Glazer's":  '🟢',
    'RNDC':               '🔵',
    'BC Merchants':       '🟣',
  }[distributor] ?? '🚛';

  const payload = {
    username: 'Whiskey Hunter',
    avatar_url: 'https://whiskey-hunter.vercel.app/icon.png',
    embeds: [{
      title: `${distEmoji} ${distributor} truck detected`,
      description: `**Binny's ${storeName}** — check for allocated bottles`,
      color: 0xe8943a,
      fields: [{
        name: 'Bottles to look for',
        value: bottles || 'See distributor map',
      }],
      footer: { text: 'Whiskey Hunter · Chicagoland' },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[discord] Webhook failed:', err.message);
  }
}
```

Call `postTruckAlert(...)` immediately after saving each new truck event to Redis. One message per distributor per store detection.

**Discord channel setup:** Create a `#truck-alerts` channel in the Discord server, create a webhook for it, and paste the URL into the env var. Members should @everyone-mute it but keep notifications on for the channel.

---

## New Feature 2 — Auto-Expiring Finds

**Priority: HIGH. Effort: Low.**

Finds older than 24h should be automatically moved to an "archived" state so stale data doesn't mislead club members.

### API changes (`app/api/finds/route.js`)

In the GET handler, return two arrays:
```js
{ finds: activeFinds, archived: archivedFinds }
```
Where active = `timestamp > Date.now() - 24*3600*1000`, archived = the rest.

Alternatively, add a `status` field computed at read time — don't store it:
```js
const EXPIRY_MS = 24 * 3600 * 1000;
const enriched = finds.map(f => ({
  ...f,
  status: (Date.now() - f.timestamp) < EXPIRY_MS ? 'active' : 'archived',
}));
```

### UI changes (`app/finds/page.jsx`)

- Active finds render normally in the main list
- Archived finds render in a collapsible "Archived" section below (collapsed by default), with muted styling (`opacity: 0.5`, `font-style: italic` on bottle name)
- Add a `"— archived after 24h"` note in the card footer of archived finds
- Show count: `"Club Finds (3 active · 2 archived)"`

---

## New Feature 3 — Personal Watchlist

**Priority: HIGH. Effort: Medium.**

Club members add bottle names they're hunting. When a matching find is submitted, they get notified. When a matching distributor truck is detected, they get notified.

### Data model
Store watchlists in Redis per user email:
```
key: watchlist:{email}
value: JSON array of strings — ["Blanton's Original", "Eagle Rare 10yr"]
```

### New API route: `app/api/watchlist/route.js`
```
GET  /api/watchlist         → { bottles: string[] }
POST /api/watchlist         → { bottle: string } → adds to list, returns { bottles }
DELETE /api/watchlist?bottle=... → removes from list, returns { bottles }
```
All routes require session (use existing NextAuth pattern).

### UI: New page `app/watchlist/page.jsx`

Simple page, same design language as the rest of the app:
- Header: `"🎯 My Watchlist"` with subtitle `"Bottles you're hunting — we'll flag them when spotted"`
- Text input + `"+ Add"` button to add a bottle name
- List of watched bottles as removable chips/badges (accent color, ✕ to remove)
- Empty state: `"Add a bottle name above to start tracking it"`

Add `"🎯 Watchlist"` as a fourth tab in `BottomNav` linking to `/watchlist`.

### Matching logic

In `lib/finds.js`, after saving a new find, check all users' watchlists:
```js
// pseudo-code
const allWatchlists = await getAllWatchlists(); // iterate keys watchlist:*
for (const [email, bottles] of allWatchlists) {
  const match = bottles.find(b =>
    find.bottleName.toLowerCase().includes(b.toLowerCase())
  );
  if (match) {
    await postDiscordDM(email, find); // or post to a #watchlist-hits channel
  }
}
```

For MVP: post matches to a `#watchlist-hits` Discord channel (no DMs needed) with `"Hey @username, your watchlist bottle **Eagle Rare** was just spotted at Binny's Lincoln Park!"`. Tag the user by Discord username if you store it, otherwise just name the bottle.

---

## New Feature 4 — Find Leaderboard

**Priority: MEDIUM. Effort: Low.**

Show who in the club has submitted the most finds this month.

### API: `app/api/finds/route.js` — add leaderboard to GET response

```js
// Add to existing GET handler
const startOfMonth = new Date();
startOfMonth.setDate(1);
startOfMonth.setHours(0, 0, 0, 0);

const leaderboard = Object.entries(
  finds
    .filter(f => f.timestamp >= startOfMonth.getTime())
    .reduce((acc, f) => {
      const key = f.submittedBy ?? f.userEmail ?? 'Anonymous';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {})
).sort((a,b) => b[1]-a[1]).slice(0, 5);

// Return: { finds, leaderboard: [["@whiskeydave", 4], ["@bourbonbob", 2]] }
```

### UI: Add leaderboard to `app/finds/page.jsx`

Place it between the submit form and the finds list. A compact horizontal scroll strip on mobile:

```
"🏆 This Month" heading (section-title class)
Ranked list: #1 medal + username + count badge
```

Medal colors: `#fbbf24` (gold), `#94a3b8` (silver), `#b45309` (bronze).
Count badge: `.badge-in-stock` class for the leader, plain text for others.

---

## File Map

| File | Changes |
|------|---------|
| `app/layout.jsx` | Add DM Sans font import; add `<BottomNav />` globally; add `pb-20` to `<body>` or main wrapper |
| `app/page.jsx` | New empty state hero + how-it-works cards |
| `app/finds/page.jsx` | Fix all color tokens; add freshness badges; add leaderboard strip; add archived section |
| `app/unicorn/page.jsx` | Replace ad-hoc back nav with `<AppHeader>`; remove manual link bar |
| `app/components/BottomNav.jsx` | **New** — fixed bottom nav, 4 tabs, notification badge logic |
| `app/components/AppHeader.jsx` | **New** — shared sticky header used by all pages |
| `app/watchlist/page.jsx` | **New** — watchlist management UI |
| `app/api/watchlist/route.js` | **New** — CRUD for watchlist |
| `lib/discord.js` | **New** — Discord webhook helper |
| `lib/finds.js` | Add `status` enrichment + leaderboard aggregation |

---

## Implementation Order

Do these in order — each builds on the last:

1. **Font + BottomNav + AppHeader** — gets every page looking consistent immediately
2. **Fix Finds page colors** — purely visual, no logic changes
3. **Tracker empty state** — copy change + 3 new card components
4. **Freshness badges on Finds** — 3 lines of logic
5. **Discord webhook** — highest club value, lowest code complexity
6. **Auto-expiring finds** — adds `status` field, minimal UI change
7. **Leaderboard** — fun, drives engagement
8. **Watchlist** — new page + new API + matching logic

---

## Reference Files

- `Whiskey Hunter.html` — Full interactive prototype showing all screens and states
- `app/globals.css` — Source of truth for all design tokens
- `lib/bottles.js` — Distributor → bottle mapping (do not change)
- `lib/stores.js` — Store registry (do not change)
