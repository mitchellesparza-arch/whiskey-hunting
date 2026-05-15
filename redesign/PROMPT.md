# Tater Tracker — Brand Refresh Sprint
**Handoff prompt for Claude Code · Prepared for Jon and the Juice**

> You are picking up a polished but maturing private-club PWA. The product works; the **design language** has drifted across screens because every page was built independently with inline styles. Your job over the next sprint is to **tighten the system, raise the visual bar, and ship a cohesive refresh** without breaking any feature.

---

## Read first
1. `redesign/Design Check-In.html` — the full design audit, rationale, screen-by-screen before/afters, and component spec. **This is your source of truth.** Open it, read it, refer back to it.
2. `redesign/tokens.css` — the new token set. Drop into `app/globals.css` (replace the `:root` block, keep legacy aliases).
3. `redesign/SPRINT.md` — the sequenced checklist. Work top-to-bottom.

If a decision isn't in those three files, ask before improvising — we want consistency over cleverness.

---

## Working principles (non-negotiable)
1. **Tokens, not magic numbers.** Every color, radius, shadow, spacing, font-size in new code must reference a `var(--…)` from `tokens.css`. No more `'#1a1008'` or `padding: '11px 16px'` literals. When you touch an inline style on an old page, port it to a token while you're there.
2. **One component, one place.** If a card pattern, chip, badge, or stat tile appears on more than one screen, lift it to `app/components/ui/` and import it. Kill duplicates as you find them.
3. **Less emoji as UI furniture.** Emoji stay for *content* (community finds, member-typed flavor notes, the 🥃 brand mark). Replace emoji used as **icons** in nav, buttons, headers, empty states, and chips with line icons from `lucide-react` (1.75 stroke, 18–20 px). The five tab icons in `BottomNav.jsx` are the most important swap.
4. **Motion is part of the design.** Every interactive element gets a tuned transition (`var(--t-base) var(--ease-out)`). Sheets and drawers spring in, don't slide. Buttons compress on press (`scale(0.97)`). The Pick My Pour reveal is the only "hero" animation — that one should feel ceremonial.
5. **Touch targets ≥ 44 px.** No exceptions on mobile.
6. **Type scale is locked.** Use only the seven sizes in `tokens.css` (`--fs-display` through `--fs-overline`). If you reach for a new size, the design needs a different fix.

---

## Scope of this sprint

### Phase 1 — Foundation (Day 1, blocking everything else)
- [ ] Replace `:root` block in `app/globals.css` with the contents of `redesign/tokens.css`.
- [ ] Add `lucide-react` to `package.json`.
- [ ] Create `app/components/ui/` and add: `Icon.jsx`, `Button.jsx`, `Card.jsx`, `Chip.jsx`, `StatTile.jsx`, `EmptyState.jsx`, `SectionHeader.jsx`, `Sheet.jsx`. Specs and props are in `Design Check-In.html` § Component Library. Write each as a tiny, single-purpose, prop-driven component — no inline-style sprawl.
- [ ] Add the motion utility classes (`@keyframes fadeUp`, `scaleIn`, `slideLeft`, `springIn`) to `globals.css` — the doc lists them.

### Phase 2 — Chrome (Day 2)
- [ ] **`AppHeader.jsx`** — switch to a real logo lockup (the 🥃 stays for now, but inside a 28 px copper-gradient pill), replace bell + gear with `lucide-react` `Bell` and `Settings` icons. Subtitle becomes a real breadcrumb element with the same overline styling everywhere.
- [ ] **`BottomNav.jsx`** — swap each tab's emoji for a lucide icon (`MapPin`, `Search`, `Truck`, `Store`, `User`). Active state: icon + label switch to `--copper-500`, plus a 4-px gradient pill **above** the icon (not under the label). Add `transform: scale(0.94)` press state. Badge stays red but becomes a 6-px filled dot when count > 0 (numbers only on Finds + Profile pending requests).
- [ ] **`NotificationsDrawer.jsx` / `SettingsDrawer.jsx`** — restyle to use the new `<Sheet>` component, add spring entrance, group sections with `<SectionHeader>`.

### Phase 3 — Screens (Days 3–5)
Work in this order. Each screen has a dedicated section in the design doc with annotated mockups.
- [ ] `app/page.jsx` (Finds home)
- [ ] `app/tracker/page.jsx`
- [ ] `app/profile/page.jsx`
- [ ] `app/profile/collection/page.jsx`
- [ ] `app/marketplace/page.jsx`
- [ ] `app/search/page.jsx` + `app/bottle/[name]/page.jsx`
- [ ] `app/profile/blind/page.jsx` (the most polish-deserving screen — keep the ELO logic untouched)
- [ ] `app/profile/pour/page.jsx`
- [ ] `app/profile/wishlist/page.jsx` + `app/profile/friends/page.jsx`
- [ ] `app/login/page.jsx` + `app/pending/page.jsx` (the front door — needs to feel like a club, not a form)

### Phase 4 — Polish pass (Day 6)
- [ ] Audit every page for stray `style={{…}}` attributes; convert to Tailwind utilities or token classes.
- [ ] Add empty states everywhere a list can be empty. Use `<EmptyState>`.
- [ ] Add focus rings (`outline: 2px solid var(--copper-400); outline-offset: 2px`) to all interactive elements.
- [ ] Verify dark-on-dark contrast ≥ 4.5:1 for body text, 3:1 for large headings — Lighthouse pass.
- [ ] Test on a real iPhone in Safari standalone-PWA mode. Check safe areas, the install prompt, and that the BottomNav clears the home indicator.

---

## What NOT to change
- Backend routes, Redis schemas, scrape cadence, ELO math, Discord webhooks, Algolia integration, or anything in `lib/`. **Logic is healthy. Pixels are the work.**
- The five-tab structure. Don't add or remove tabs.
- Feature scope. No new features in this sprint — refresh only.
- The bourbon-dark direction. We're refining it, not pivoting to light mode.

---

## Done criteria
- Every page renders with zero hardcoded color/spacing literals in `style={…}` props (Tailwind utilities + tokens only).
- A grep for `'#'` in `app/**/*.jsx` returns only emoji and lucide imports.
- The five tabs use lucide icons, not emoji.
- Lighthouse mobile scores: Performance ≥ 85, Accessibility ≥ 95, Best Practices = 100.
- Open `Design Check-In.html` side-by-side with the running app — the screens visually match the "AFTER" mockups within reasonable tolerance.

---

## When you're stuck
- The design doc is the spec. If something's ambiguous, screenshot the relevant section of `Design Check-In.html` and ask.
- Match neighboring components' patterns before inventing new ones.
- If you're about to write `style={{ background: '#…' }}` — stop. Open `tokens.css`. Use a variable.

Good hunting.
