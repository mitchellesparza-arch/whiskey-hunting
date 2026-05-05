# Handoff: Tater Tracker — Full Redesign

## Overview

Tater Tracker is a private club tool for **Jon and the Juice**, a Chicagoland Discord bourbon community. It has four core features accessed via a persistent bottom tab bar:

1. **Finds** (home tab) — Members report spotted allocated bottles with store location, photo, and notes. Displayed on a map or list.
2. **Tracker** — Detects Breakthru, Southern Glazer's, RNDC, and BC Merchants delivery trucks at any Chicagoland Binny's by monitoring canary bottle restocks via Algolia. Checked 6× daily.
3. **Auctions** — Scrapes Unicorn Auctions and surfaces whiskey lots selling below UA's estimated value.
4. **Profile** — Personal whiskey collection tracker with barcode scanning, MSRP/secondary value display, a random pour picker, and a Beli-style blind tasting ranking system.

Additionally, a **Notifications drawer** and **Settings drawer** are accessible via icons in the top bar.

## About the Design Files

`Tater Tracker.html` is a **high-fidelity interactive prototype** in React + Babel. It is a **design reference only** — do not ship it. Recreate these designs inside the existing Next.js 14 App Router codebase using the established Tailwind + CSS variable patterns already in `app/globals.css`.

## Fidelity

**High-fidelity.** Colors, typography, spacing, component hierarchy, and interactions should match the prototype precisely. The existing codebase has the correct design tokens in `globals.css` — use those everywhere.

---

## Design Tokens (use exactly — already in globals.css)

```css
--bg-base:      #0f0a05   /* page background */
--bg-card:      #1a1008   /* card background */
--bg-card-2:    #1f1308   /* slightly lighter card */
--border:       #3d2b10   /* card/input borders */
--border-2:     #2a1c08   /* subtler dividers */
--text-primary: #f5e6cc   /* headings, body */
--text-2:       #c9a87a   /* secondary text */
--text-muted:   #9a7c55   /* labels, hints */
--text-dim:     #6b5030   /* timestamps, placeholders */
--accent:       #e8943a   /* CTA buttons, active states */
--accent-2:     #d4832a   /* hover state for accent */
--green:        #4ade80
--red:          #f87171
--amber:        #fbbf24
--purple:       #c084fc
--blue:         #818cf8
```

**Typography:** `DM Sans` (400/500/600/700/800) + `DM Mono` (400/500) for UPC strings and code. Add to `app/layout.jsx`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**Animations (add to globals.css):**
```css
@keyframes fadeUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes scaleIn  { from{opacity:0;transform:scale(0.93)} to{opacity:1;transform:scale(1)} }
@keyframes slideLeft{ from{transform:translateX(100%)} to{transform:translateX(0)} }
```

---

## Branding

| Field | Value |
|-------|-------|
| App name | **Tater Tracker** |
| Club name | **Jon and the Juice** |
| App icon / emoji | 🥃 |
| Location scope | Chicagoland |

Replace all instances of "Whiskey Hunter" → **Tater Tracker** and "Chicagoland Bourbon Club" → **Jon and the Juice** throughout the codebase.

---

## Change 1 — App Name & Club Rename

**Files to update:**
- `app/layout.jsx` — `<title>Tater Tracker</title>` and `<meta name="application-name">`
- `app/manifest.js` — `name: 'Tater Tracker'`, `short_name: 'Tater Tracker'`
- `app/page.jsx` — header h1 text
- `app/unicorn/page.jsx` — back nav text
- `app/finds/page.jsx` — header text and footer
- Any Discord webhook messages in `lib/discord.js` — `username: 'Tater Tracker'`
- Footer text everywhere: `"Tater Tracker · Jon and the Juice"`

---

## Change 2 — Tab Reorder & Bottom Nav

### New tab order (left → right):

| Position | Tab | Icon | Route |
|----------|-----|------|-------|
| 1 (default) | Finds | 📍 | `/finds` → move to `/` |
| 2 | Tracker | 🚛 | `/` → move to `/tracker` |
| 3 | Auctions | 🦄 | `/unicorn` |
| 4 | Profile | 👤 | `/profile` (new) |

### Route changes
- **Finds** becomes the home route (`/`). Move `app/finds/page.jsx` → `app/page.jsx` (rename current `app/page.jsx` → `app/tracker/page.jsx`)
- **Tracker** moves to `/tracker`
- **Unicorn** stays at `/unicorn`
- **Profile** is new at `/profile`

### BottomNav component (`app/components/BottomNav.jsx`)

```
Position: fixed bottom-0 left-0 right-0 z-[100]
Background: rgba(15,10,5,0.97), backdrop-filter: blur(12px)
Border-top: 1px solid #3d2b10
Padding-bottom: env(safe-area-inset-bottom)
```

Each tab button: `flex: 1`, column flex, centered.
- Icon: 20px, relative-positioned for badge
- Label: 10px, font-weight 700 active / 500 inactive
- Active color: `#e8943a`; inactive: `#6b5030`
- Active indicator: 18×2px accent bar below label

**Finds tab badge:** count of finds where `timestamp > Date.now() - 6*3600*1000` (fresh finds). Red pill `#f87171`, 9px text.

---

## Change 3 — Top Bar with Notification Bell + Settings Gear

Replace all per-page headers with a shared `<AppHeader>` component.

### AppHeader spec
```
sticky top-0 z-50
background: rgba(15,10,5,0.95), backdrop-filter: blur(12px)
border-bottom: 1px solid #3d2b10
padding: 11px 16px
```

Left: 🥃 22px + `"Tater Tracker"` (800 weight, 15px) + contextual subtitle (11px, muted)

Right: two icon buttons (no border, 18px emoji, 6px 8px padding, 8px border-radius):
1. **🔔 Bell** — opens NotificationsDrawer; shows red badge with unread count
2. **⚙️ Gear** — opens SettingsDrawer

Contextual subtitles by route:
- `/` → `"Community Finds · Chicagoland"`
- `/tracker` → `"Chicagoland Binny's · Truck Tracker"`
- `/unicorn` → `"Unicorn Auctions · Live Deals"`
- `/profile` → `"Your Collection & Tastings"`

---

## Change 4 — Fix Finds Page Color Scheme

The current `app/finds/page.jsx` uses a mismatched blue color scheme. Replace all hardcoded styles with the shared token system (see Design Tokens above). Detailed spec in the previous handoff README — apply the same fixes here, plus:

- Submit button: `.btn-primary` class (accent background)
- Card backgrounds: `.card` class
- Form inputs: `background: var(--bg-base)`, `border: 1px solid var(--border)`, `color: var(--text-primary)`
- Freshness badge on each find card:
  - `< 6h old` → `"🔥 Fresh"` badge — green
  - `> 20h old` → `"⏰ Aging"` badge — dim

---

## Change 5 — Improved Tracker Empty State

When no truck events exist, replace the raw `curl` block with:

**Hero section:**
- Background: `linear-gradient(160deg, #1e1004 0%, #0f0a05 60%)`
- Center: 🚛 48px, H2 "No truck deliveries detected yet", body copy explaining the 6× daily cadence
- Three pill badges: "Next check: [time] CDT", "20+ Binny's stores monitored", "6× daily cadence"

**"How it works" 3-card grid** (shown only when empty):
- Step 1: Canary scan
- Step 2: Truck detected
- Step 3: Check the map

---

## New Feature — Notifications Drawer

### Component: `app/components/NotificationsDrawer.jsx`

A slide-in panel from the right edge, full height, `min(360px, 100vw)` wide.

```
background: var(--bg-card)
border-left: 1px solid var(--border)
animation: slideLeft 0.25s ease
z-index: 150
```

Backdrop: `rgba(0,0,0,0.5)` behind — clicking it closes the drawer.

**Sections:**

**1. Notification feed**
Each notification has: icon (emoji), title (bold if unread), subtitle, time-ago, unread dot (7px accent circle). Clicking marks as read (opacity 0.5 when read).

Notification types:
- `truck` 🚛 — distributor + store + bottles to check
- `find` 📍 — bottle name + store + who posted
- `watchlist` 🎯 — bottle name + store match

"Mark all read" button in header when unread > 0.

**2. Bottle Watchlist**
Input + "+" button to add a bottle name string.
Each watchlist item renders as a row: `"🔔 {name}"` + ✕ remove button.
Store in Redis per user: `watchlist:{email}` → JSON string array.

**3. Alert Settings toggles**
Four toggles (ON by default):
- Truck deliveries detected
- New club finds
- Watchlist matches
- Auction price drops

Toggle component: 40×22px pill, accent when on, `#3d2b10` when off, 16px white circle slides left/right.

---

## New Feature — Settings Drawer

### Component: `app/components/SettingsDrawer.jsx`

Same slide-in pattern as NotificationsDrawer.

**Sections:**

**Profile**
- Avatar: 52px circle, gradient `linear-gradient(135deg, #e8943a, #b05a10)`, initials
- Display name input (editable)
- Discord handle input (editable)
- "Change avatar" link (for future)

**Club**
- Read-only card: "Jon and the Juice" + join date

**App Preferences** (read-only display for now, editable later)
- Default tab on open: Finds
- Truck check schedule: 6× daily
- Find expiry: 24 hours
- Finds badge alerts: < 6h fresh

**Account**
- "Sign out" button — red border, red text

---

## New Feature — Profile Tab

### Route: `app/profile/page.jsx`

**Profile hub (default view):**

```
Max-width: 700px, centered, 16px padding
```

**Header row:**
- Avatar: 60px circle, `linear-gradient(135deg, #e8943a, #b05a10)`, initials (2 chars from display name)
- Display name `@whiskeydave`, 20px 800 weight
- Subtitle: `"Jon and the Juice · Member since [date]"`, 12px muted

**Stats row (4-column grid):**
- Bottles (total qty across collection)
- Tastings (sum of tastings field)
- Est. Value (sum of `secondary × qty`)
- Top Score (highest blindScore in collection)

**Top bottle callout card** (accent-tinted):
- 🏆 icon
- "Your Top Bottle" label
- Bottle name + blind score

**2×2 Feature tile grid:**

| Tile | Icon | Route/action |
|------|------|-------------|
| My Collection | 📦 | Opens CollectionView |
| Pick My Pour | 🎲 | Opens PickMyPour |
| Pick My Blind | 🫣 | Opens PickMyBlind |
| Taste Scores | 📊 | Placeholder — "Coming soon" |

Each tile: icon 30px, title 14px 700, subtitle 12px muted, "Open →" link in tile accent color.

---

## New Feature — My Collection (`app/profile/collection/page.jsx`)

### Data model (add to your existing data store)

```ts
type BottleEntry = {
  id:          string
  userId:      string           // owner
  name:        string           // e.g. "Blanton's Original Single Barrel"
  distillery:  string
  category:    'Bourbon' | 'Rye' | 'Scotch' | 'Japanese' | 'American' | 'Irish'
  proof:       number           // ABV × 2
  msrp:        number           // retail price in USD
  secondary:   number           // secondary market estimate in USD
  qty:         number           // bottles owned
  blindScore:  number           // 0–100, starts at 75.0 for new entries
  tastings:    number           // count of blind sessions this bottle participated in
  flavors:     string[]         // e.g. ["Caramel", "Citrus", "Vanilla"]
  addedAt:     string           // ISO timestamp
  upc?:        string
  photoUrl?:   string
}
```

Store in Redis: `collection:{userId}` → JSON array.

### API routes (`app/api/collection/route.js`)
```
GET    /api/collection              → { bottles: BottleEntry[] }
POST   /api/collection              → { bottle: BottleEntry } → adds, returns { bottles }
DELETE /api/collection?id=...       → removes, returns { bottles }
PATCH  /api/collection              → { id, ...updates } → partial update, returns { bottles }
```
All routes require session.

### UI spec

**Header:** back arrow + "📦 My Collection" + "+ Add" button (accent)

**Summary strip (3 cols):**
- Bottles (total qty)
- Est. Value (secondary × qty sum)
- Avg Score (mean blindScore)

**Sort bar (horizontal scroll chips):**
`🏆 Score` | `💰 Secondary` | `MSRP` | `Name`

**Each bottle card (`.card` pattern):**
```
Left:  Score column — label "Score" (10px uppercase), large number (24px 800 weight),
       color: green if ≥85, accent if ≥75, muted if <75
       Below: "{N} tastings" (9px dim)

Middle: Name (700 13px), distillery + proof + qty (11px muted),
        flavor chips (10px, dim bg, border, pill)

Right:  MSRP label + value (14px 700, t2 color)
        Secondary label + value (14px 700, green if secondary > msrp×1.4, else muted)
```

**Add Bottle — bottom sheet modal:**
- Slides up from bottom (`border-radius: 16px 16px 0 0`)
- Bottle name input (full width) + 📷 barcode scan button
- 3-col grid: MSRP | Secondary | Qty
- "+ Add to Collection" button (full width, accent)
- Barcode scan: uses existing `BarcodeScanner.jsx` component; on scan, calls `/api/upc?code=` to pre-fill name

---

## New Feature — Pick My Pour (`app/profile/pour/page.jsx`)

**Header:** back arrow + "🎲 Pick My Pour"

**Main area (centered, max 480px):**
- Default state: 🥃 52px + "Can't decide what to pour tonight?" + bottle count
- Spinning state: CSS animation cycling through bottle names (blur effect)
- Result state: `scaleIn` animation showing:
  - "TONIGHT'S POUR" label (10px uppercase spaced)
  - Bottle name (24px 800)
  - Distillery (13px muted)
  - Proof + MSRP row
  - Blind score badge (accent tinted pill) — only shown if tastings > 0

**Buttons:**
- "🎲 Pick for me" / "↺ Re-roll" (full width, accent, 800 weight)
- "✓ Pour it — log this tasting" (secondary, outline) — shown after result

**Logic:** Pick randomly from `collection.filter(b => b.qty > 0)`. Animation duration: 1100ms.

---

## New Feature — Pick My Blind (`app/profile/blind/page.jsx`)

A multi-step Beli-style blind tasting flow. All state lives in this component; results are persisted via PATCH to `/api/collection`.

### Scoring algorithm

Uses ELO adapted to 0–100 range:

```js
function eloUpdate(aScore, bScore, result) {
  // result: 'a' (A wins) | 'b' (B wins) | 'tie'
  const K = 12;
  const expectedA = 1 / (1 + Math.pow(10, (bScore - aScore) / 25));
  const actualA   = result === 'a' ? 1 : result === 'tie' ? 0.5 : 0;
  return {
    newA: +Math.max(0, Math.min(100, aScore + K * (actualA - expectedA))).toFixed(1),
    newB: +Math.max(0, Math.min(100, bScore + K * ((1 - actualA) - (1 - expectedA)))).toFixed(1),
  };
}
```

New bottles start at `blindScore: 75.0`. Scores only change through comparisons — never self-rated.

**Score interpretation:**
- 90+ → One of the best bottles you own
- 80–89 → Reliably excellent
- 70–79 → Solid, enjoyable
- < 70 → Fine, but rarely your first pick

### Steps

**Step 0 — Intro hub**
- Explanation of how the scoring works
- Score interpretation table (4 rows)
- "Start a Session →" button

**Step 1 — Select bottles**
- Scrollable list of collection bottles, each tappable
- Selected bottles show a checkmark circle + blind label (A, B, C…)
- Min 2, max 5 bottles
- Header shows: "Select bottles" + "Start (N bottles)" CTA (disabled until ≥2 selected)
- Hint: "→ N comparisons" where N = `bottles*(bottles-1)/2`

**Step 2 — Blind setup**
- Shows the blind key: `A = Blanton's Original`, `B = Eagle Rare`, etc. (shuffled order)
- Each row: accent 38px tile with label letter + bottle name
- "I've poured them blind — Start Tasting →" button

**Step 3 — Head-to-head comparisons**

For N bottles: `N*(N-1)/2` comparisons, shown one at a time.

```
Header: "Comparison {current} of {total}" + bottle count
Progress bar: accent fill, width = (current/total * 100)%

Two large tap targets (2-col grid):
  - Letter only (56px, 800 weight) filling ~44px height tap area
  - "Prefer {X}" label below
  - On hover: accent border + tinted bg

Below: "Too close to call — tie" text button
```

On vote: advance to next pair. On last pair: advance to results.

**Step 4 — Results**
- "🏆 Blind session complete" centered header
- "🫣 Reveal the bottles →" button (accent, full width) — tap to reveal
- After reveal: ranked list (1st → Nth) with medals 🥇🥈🥉4️⃣5️⃣
  - Each row: medal + bottle name + glass label + new score + delta (green if positive, red if negative)
  - Delta format: `+3.8` or `-1.2`
- "Save scores & finish" button — calls PATCH `/api/collection` for each updated bottle, increments `tastings` count

### State shape
```ts
{
  step:        0 | 1 | 2 | 3 | 4
  selected:    number[]          // indices into collection array
  blindOrder:  number[]          // shuffled selected, determines A/B/C labels
  pairs:       [number, number][] // genPairs(selected.length)
  pairIdx:     number
  votes:       Record<string, 'a' | 'b' | 'tie'>  // key: "${ai}-${bi}"
  revealed:    boolean
}
```

---

## Discord Webhook — Truck Alerts

(From previous handoff — ensure branding update)

In `lib/discord.js`, update:
```js
username: 'Tater Tracker',
// footer:
footer: { text: 'Tater Tracker · Jon and the Juice' },
```

---

## Implementation Order

1. **Branding** — rename app + club everywhere (5 min)
2. **Font import** — DM Sans + DM Mono in layout.jsx
3. **BottomNav + AppHeader** — shared components, consistent across all pages
4. **Tab reorder** — move Finds to `/`, Tracker to `/tracker`
5. **Fix Finds colors** — match token system
6. **Tracker empty state** — hero + how-it-works cards
7. **Top bar icons** — Notifications + Settings drawers
8. **Profile hub** — `/profile` page with stat cards + tile grid
9. **My Collection** — API + UI + Add Bottle sheet + barcode integration
10. **Pick My Pour** — random picker with animation
11. **Pick My Blind** — full 5-step flow with ELO scoring + score persistence

---

## File Map

| File | Status | Notes |
|------|--------|-------|
| `app/layout.jsx` | Edit | Font import, title, BottomNav global mount |
| `app/page.jsx` | Replace | Now Finds (was Tracker) |
| `app/tracker/page.jsx` | New | Move current page.jsx here |
| `app/unicorn/page.jsx` | Edit | AppHeader swap, branding |
| `app/finds/page.jsx` | Edit | Color fix, freshness badge, now at `/` |
| `app/profile/page.jsx` | New | Profile hub |
| `app/profile/collection/page.jsx` | New | Collection view |
| `app/profile/pour/page.jsx` | New | Pick My Pour |
| `app/profile/blind/page.jsx` | New | Pick My Blind |
| `app/api/collection/route.js` | New | Collection CRUD |
| `app/api/watchlist/route.js` | New | Watchlist CRUD |
| `app/components/BottomNav.jsx` | New | Fixed nav, 4 tabs, badge |
| `app/components/AppHeader.jsx` | New | Sticky header with icons |
| `app/components/NotificationsDrawer.jsx` | New | Slide-in notifications |
| `app/components/SettingsDrawer.jsx` | New | Slide-in settings |
| `lib/discord.js` | Edit | Rename to Tater Tracker |

---

## Reference Files

- `Tater Tracker.html` — Full interactive prototype. Click through all screens. The Pick My Blind flow is fully functional — try selecting 3–4 bottles and doing a session.
- `app/globals.css` — Source of truth for design tokens
- `lib/bottles.js` — Distributor → bottle mapping (do not change)
- `lib/stores.js` — Store registry (do not change)
