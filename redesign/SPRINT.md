# Sprint Plan — Tater Tracker Refresh
**~6 days · 1 engineer · pixel-only scope**

## Day 1 — Foundation
- [ ] Drop `redesign/tokens.css` `:root` block into `app/globals.css`
- [ ] `npm i lucide-react`
- [ ] Build `app/components/ui/` primitives (8 files):
  - `Icon.jsx` — wraps `lucide-react`, defaults to 18 px, 1.75 stroke
  - `Button.jsx` — variants: `primary | secondary | ghost | danger`; sizes: `sm | md | lg`
  - `Card.jsx` — `padded | flush`; hover lift
  - `Chip.jsx` — `tone: copper | green | red | violet | neutral`; optional `count`
  - `StatTile.jsx` — label + big number + optional delta
  - `EmptyState.jsx` — icon + title + body + optional CTA
  - `SectionHeader.jsx` — overline label + title + optional action
  - `Sheet.jsx` — bottom sheet for mobile, side drawer for desktop
- [ ] Add 4 keyframes (`fadeUp`, `scaleIn`, `slideLeft`, `springIn`) to `globals.css`

## Day 2 — Chrome
- [ ] Refactor `AppHeader.jsx` (logo lockup, lucide icons, breadcrumb subtitle)
- [ ] Refactor `BottomNav.jsx` (lucide icons, gradient pill indicator above icon, press state)
- [ ] Refactor `NotificationsDrawer.jsx` to use `<Sheet>` + `<SectionHeader>`
- [ ] Refactor `SettingsDrawer.jsx` to use `<Sheet>` + `<SectionHeader>`
- [ ] Refactor `InstallPrompt.jsx` cosmetics

## Day 3 — Home & Tracker
- [ ] `app/page.jsx` (Finds) — split into 3 sub-components: `<FindForm>`, `<Leaderboard>`, `<FindsList>`. Replace inline-style FindCard with `<Card>` + `<Chip>`.
- [ ] `app/tracker/page.jsx` — port to `<Card>`, `<SectionHeader>`. Promote the empty state to a real hero with the new gradient and lucide `Truck` icon.
- [ ] Distributor map: 4-up grid with brand-colored top-bars instead of full bg fills.

## Day 4 — Profile cluster
- [ ] `app/profile/page.jsx` — refined avatar (gradient ring, member-tenure overline), `<StatTile>` row, redesigned tile grid (icon-first, 2x3 not 2x2)
- [ ] `app/profile/collection/page.jsx` — bottle row redesign per spec
- [ ] `app/profile/wishlist/page.jsx` — port to new card pattern
- [ ] `app/profile/friends/page.jsx` — new friend-row component, pending requests get a clear inbox section
- [ ] `app/profile/pour/page.jsx` — keep the slot-machine concept, refine the reveal moment with the copper glow
- [ ] `app/profile/blind/page.jsx` — head-to-head comparison gets large square tap targets, progress as a thin gradient line, results screen is the most polished moment in the app

## Day 5 — Marketplace, Search, Bottle Detail
- [ ] `app/marketplace/page.jsx` — auction & swap tabs each get a redesigned card; discount badge becomes a vertical chip on the card edge; the urgent (<2h) state pulses subtly
- [ ] `app/search/page.jsx` — search input becomes the hero, results are dense rows with bottle thumb/category/price-history sparkline
- [ ] `app/bottle/[name]/page.jsx` — full-page bottle detail; hero stack with name + category + price snapshot
- [ ] `app/components/BottleDetailSheet.jsx` — port to new `<Sheet>`
- [ ] `app/components/StoreHistorySheet.jsx` — port to new `<Sheet>`

## Day 6 — Polish & QA
- [ ] Sweep for inline styles. Goal: zero `style={{ background:'#…' }}` literals
- [ ] Add `:focus-visible` rings everywhere
- [ ] Add `<EmptyState>` to every list that can be empty
- [ ] Test on real iPhone (Safari standalone) — verify safe areas
- [ ] Lighthouse mobile pass
- [ ] Spot-check Discord webhook embed colors (now copper, not orange)

## Risk register
- **Inline style sprawl** is the biggest debt — budget time for it. Don't be tempted to skip.
- **Barcode scanner** UI is fragile across devices; touch only the wrapper styling, not the camera logic.
- **Leaflet map** has its own CSS — keep the existing `.pac-*` overrides intact, just port colors to tokens.
