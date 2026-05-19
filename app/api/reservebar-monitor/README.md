# ReserveBar Gold Foil Monitor

Polls ReserveBar every 60 seconds (6 AM–10 PM CT) for the Wild Turkey Austin Nichols Archives Gold Foil Edition (~$400) going live, and fires a Web Push notification the moment it does.

## Quick start

### 1. Add the env var

In Vercel dashboard → Project → Settings → Environment Variables, add:

```
RESERVEBAR_MONITOR_ENABLED=true
```

Everything else (VAPID, Upstash Redis, CRON_SECRET) is already configured for the app.

### 2. Deploy

Push to `master` → Vercel deploys. The endpoint is live but dormant until cron-jobs.org starts calling it.

### 3. Set up cron-jobs.org

The monitor is triggered by an external HTTP cron, not Vercel Cron (which caps at 1 call/day on the Hobby plan).

1. Go to **[cron-jobs.org](https://cron-jobs.org)** and create a free account.
2. Click **Create cronjob** and fill in:

   | Field | Value |
   |-------|-------|
   | URL | `https://whiskey-hunter.vercel.app/api/reservebar-monitor` |
   | Schedule | Every **1 minute** |
   | Request method | `GET` |
   | Request timeout | `30` seconds |

3. Under **Headers**, add:
   ```
   Authorization: Bearer <your CRON_SECRET value>
   ```

4. Save. The job starts immediately.

> The route's internal rate-limiter enforces the real cadence (60 s peak, 300 s off-peak) using Redis. Even if cron-jobs.org fires every minute, polls outside the window are skipped without touching ReserveBar.

### 4. Verify push delivery works

Confirm a notification reaches your actual device before the real event:

```bash
# From your machine (requires NEXT_PUBLIC_BASE_URL and CRON_SECRET in .env.local):
npm run test:gold-foil-e2e

# Or hit the endpoint directly:
curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://whiskey-hunter.vercel.app/api/reservebar-monitor?test_notify=1"
```

You should receive a push within ~5 seconds titled **"🥃 [TEST] Gold Foil Monitor"**.
If it doesn't arrive, check that push is enabled in your browser for the site (`/profile` → notifications toggle).

---

## Monitoring

### Health check (no auth required)

```bash
curl https://whiskey-hunter.vercel.app/api/reservebar-monitor/status
```

Returns:
```json
{
  "enabled": true,
  "phase": "staged_unbuyable",
  "lastPollAt": "2026-05-19T14:32:00.000Z",
  "lastPollSignals": 0,
  "alertFiredAt": null,
  "activeSince": "2026-05-19T14:00:00.000Z",
  "expired": false,
  "consecutiveErrors": 0,
  "currentInterval": 60,
  "directProductUrl": null
}
```

| Field | Meaning |
|-------|---------|
| `phase` | `unknown` → `staged_unbuyable` → `live` |
| `lastPollSignals` | Bitmask of last detected signals (see below) |
| `currentInterval` | 60 = peak window, 300 = off-peak |
| `expired` | True after 30 days — monitor stops automatically |

If `lastPollAt` is more than 2 minutes old during peak hours, cron-jobs.org isn't firing — check the job's execution log on the cron-jobs.org dashboard.

### Signal bitmask

| Bit | Signal |
|-----|--------|
| 1  | Product appears on Wild Turkey collection page |
| 2  | Direct product URL returns HTTP 200 |
| 4  | `available` / `availableForSale` / `inventoryQuantity > 0` |
| 8  | Price in $350–$450 range |
| 16 | Appears in `/search?q=gold+foil` results |

Fire condition: any 2+ signals simultaneously, OR bits 2+8 together (decisive — direct URL live with real price).

### Logs

Every poll emits a one-liner in Vercel function logs:

```
[reservebar] 2026-05-19T15:00:00.000Z | phase=staged_unbuyable | signals=[COLLECTION] | candidates=1 | fire=false
```

On first sighting of any candidate product, the full raw JSON is logged once so you can verify the schema before the real event.

---

## Kill switch

To stop polling immediately without redeploying:

1. Pause or delete the job on cron-jobs.org (instant — no deploy needed)
2. Or: Vercel dashboard → Environment Variables → set `RESERVEBAR_MONITOR_ENABLED` to anything other than `"true"` → redeploy

The monitor also self-terminates after 30 days from `activeSince` regardless of the cron schedule.

---

## Manual trigger

```bash
# Run one poll cycle right now:
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://whiskey-hunter.vercel.app/api/reservebar-monitor

# Fire a test push (no ReserveBar fetch — push pipeline only):
curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://whiskey-hunter.vercel.app/api/reservebar-monitor?test_notify=1"
```

---

## Architecture

```
cron-jobs.org (every 1 minute)
    → GET /api/reservebar-monitor  [Authorization: Bearer <CRON_SECRET>]
        ├── feature flag gate   (RESERVEBAR_MONITOR_ENABLED=true)
        ├── 30-day expiry check
        ├── rate-limit gate     (60s peak / 300s off-peak via Redis lastPollAt)
        └── lib/reservebar.js → pollReserveBar()
                ├── fetchPage(COLLECTION_URL)  — parse __NEXT_DATA__
                ├── fetchPage(SEARCH_URL)
                ├── evaluateSignals(candidate, ctx)
                ├── shouldFire(signals)
                └── saveMonitorState(state)   → wh:reservebar:state (Upstash Redis)
    └── (on fire) sendBroadcast(payload, null) → lib/push.js → VAPID Web Push
```

---

## Tests

```bash
npm install        # installs vitest if not already present
npm test           # unit tests — signal logic, parsing, name matching (26 tests)
```

Three fixture scenarios:

- **A — staged/not live:** Gold Foil in `__NEXT_DATA__` with `available: false`, `price: 0` → `shouldFire` returns false
- **B — live:** Gold Foil with `available: true`, `price: 400`, on collection page → `shouldFire` returns true
- **C — negative match:** "Cheesy Gold Foil 1990" → rejected by `matchesGoldFoil`, zero candidates
