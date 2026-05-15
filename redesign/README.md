# Tater Tracker — Brand Refresh Package
**For Jon and the Juice · May 2026**

This folder is a self-contained handoff. Open `Design Check-In.html` to start.

## What's here

| File | Purpose |
|------|---------|
| `Design Check-In.html` | The deliverable. Audit, principles, visual system, before/after screen mockups, copyable Claude Code prompt. **Open this first.** |
| `PROMPT.md` | The full kickoff prompt for Claude Code. Detailed working principles, scope, done criteria. |
| `SPRINT.md` | The day-by-day checklist. Six days of work, sequenced top-to-bottom. |
| `tokens.css` | The refreshed design token set. Drop-in replacement for the `:root` block in `app/globals.css`; legacy variable names preserved so the migration is non-breaking. |

## How to use it

1. **Review the design doc.** Open `Design Check-In.html` end-to-end. About 12 minutes to read.
2. **Drop the folder into the repo** at the project root: `Whiskey Hunting/redesign/`.
3. **Open Claude Code** in the repo, paste the prompt from `PROMPT.md` (or click the copy button at the bottom of the design doc), and let it work day-by-day through `SPRINT.md`.
4. **Review at the end of each day.** Each day is self-contained — Day 1 doesn't depend on Day 6 being done.

## Scope of this package

**In scope:** pixel work — colors, type, spacing, components, motion, empty states, copy polish.
**Out of scope:** backend, routes, schemas, scrape cadence, ELO math, Discord webhooks, Algolia, Redis. The product logic is healthy; we're not touching it.

## Why now

The app has shipped real value to the club fast — finds, tracker, marketplace, profile, blind tasting. But every screen was built independently with inline styles, and the seams are starting to show. A six-day pixel sprint converts a working product into a credible, App-Store-quality bourbon-club experience. The bourbon-on-dark direction is right; we're refining it, not pivoting.

— Design
