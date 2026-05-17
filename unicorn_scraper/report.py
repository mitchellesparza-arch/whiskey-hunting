"""
HTML report generator and JSON export for Unicorn Auctions whiskey bargains.
"""

import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

REDIS_KEY = "wh:unicorn:deals"


def _push_to_redis(export: dict) -> None:
    """Push the deals export blob to Upstash Redis via REST API."""
    url   = os.getenv("UPSTASH_REDIS_REST_URL", "").rstrip("/")
    token = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
    if not (url and token):
        print("Redis not configured — skipping push (set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)")
        return
    try:
        payload = json.dumps(["SET", REDIS_KEY, json.dumps(export)]).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            print(f"Redis push OK: {result}")
    except Exception as exc:
        print(f"Warning: Redis push failed: {exc}")

REPORT_PATH = Path(__file__).parent / "weekly_report.html"
JSON_PATH   = Path(__file__).parent / "latest_deals.json"

SECTION_COLORS = {
    "Horn of Unicorn": "#c9a84c",  # gold
    "Bargain Buys":    "#3aafa9",  # teal
    "General":         "#6c757d",  # muted
}

SECTION_ICONS = {
    "Horn of Unicorn": "🦄",
    "Bargain Buys":    "💰",
    "General":         "🔍",
}


def _badge(section: str) -> str:
    color = SECTION_COLORS.get(section, "#555")
    icon  = SECTION_ICONS.get(section, "")
    return (
        f'<span style="background:{color};color:#fff;padding:2px 8px;'
        f'border-radius:12px;font-size:0.75rem;font-weight:600;white-space:nowrap">'
        f'{icon} {section}</span>'
    )


def _fmt_usd(val: float | None, display: str | None = None) -> str:
    if display:
        return display
    if val is None:
        return '<span style="color:#666">—</span>'
    return f"${val:,.0f}"


def _fmt_pct(val: float | None, flip: bool = False) -> str:
    """Render a discount percentage with color coding."""
    if val is None:
        return '<span style="color:#666">—</span>'
    if val >= 20:
        color = "#22c55e"   # green — great deal
    elif val >= 10:
        color = "#eab308"   # yellow — decent
    elif val > 0:
        color = "#f97316"   # orange — slight
    else:
        color = "#ef4444"   # red — over estimate
    sign = "−" if val >= 0 else "+"
    return f'<span style="color:{color};font-weight:700">{sign}{abs(val):.1f}%</span>'


def generate_report(listings: list[dict], run_id: int) -> Path:
    now = datetime.now(timezone.utc)
    date_str = now.strftime("%A, %B %d, %Y at %I:%M %p UTC")

    # Sort: best discount vs UA estimate first; no-estimate lots at bottom
    def sort_key(l):
        d = l.get("discount_vs_estimate")
        return (-d if d is not None else 9999)

    sorted_listings = sorted(listings, key=sort_key)

    # Separate into tiers for the summary banner
    great   = [l for l in listings if (l.get("discount_vs_estimate") or 0) >= 20]
    decent  = [l for l in listings if 10 <= (l.get("discount_vs_estimate") or 0) < 20]
    slight  = [l for l in listings if 0 < (l.get("discount_vs_estimate") or 0) < 10]

    rows_html = ""
    for i, l in enumerate(sorted_listings):
        bg = "#1a1a1a" if i % 2 == 0 else "#141414"
        name     = l.get("bottle_name", "Unknown")
        dist     = l.get("distillery", "") or "—"
        url      = l.get("lot_url", "#")
        bid      = _fmt_usd(l.get("current_bid"))
        est      = _fmt_usd(l.get("ua_estimate_mid"), l.get("ua_estimate_display"))
        msrp     = _fmt_usd(l.get("msrp"))
        d_est    = _fmt_pct(l.get("discount_vs_estimate"))
        d_msrp   = _fmt_pct(l.get("discount_vs_msrp"))
        time_rem = l.get("time_remaining") or "—"
        section  = l.get("section", "General")

        rows_html += f"""
        <tr style="background:{bg}">
          <td style="padding:12px 14px">
            <a href="{url}" target="_blank" rel="noopener"
               style="color:#e8c87d;text-decoration:none;font-weight:600;font-size:0.9rem"
               onmouseover="this.style.textDecoration='underline'"
               onmouseout="this.style.textDecoration='none'">{name}</a>
            <div style="color:#999;font-size:0.78rem;margin-top:2px">{dist}</div>
          </td>
          <td style="padding:12px 14px;text-align:center">{_badge(section)}</td>
          <td style="padding:12px 14px;text-align:right;font-weight:700;color:#fff">{bid}</td>
          <td style="padding:12px 14px;text-align:right;color:#ccc">{est}</td>
          <td style="padding:12px 14px;text-align:right;color:#ccc">{msrp}</td>
          <td style="padding:12px 14px;text-align:center">{d_est}</td>
          <td style="padding:12px 14px;text-align:center">{d_msrp}</td>
          <td style="padding:12px 14px;text-align:center;color:#aaa;font-size:0.82rem">{time_rem}</td>
        </tr>
        """

    if not rows_html:
        rows_html = """
        <tr>
          <td colspan="8" style="padding:40px;text-align:center;color:#666;font-style:italic">
            No whiskey bargains found this run.
          </td>
        </tr>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unicorn Auctions — Whiskey Bargains</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: #0d0d0d;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      min-height: 100vh;
    }}
    .header {{
      max-width: 1200px;
      margin: 0 auto 28px;
      border-bottom: 2px solid #c9a84c;
      padding-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 12px;
    }}
    .header-title {{ font-size: 1.8rem; font-weight: 800; color: #e8c87d; letter-spacing: -0.5px; }}
    .header-sub   {{ color: #888; font-size: 0.85rem; margin-top: 4px; }}
    .summary-grid {{
      max-width: 1200px;
      margin: 0 auto 28px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 14px;
    }}
    .stat-card {{
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      padding: 16px 18px;
    }}
    .stat-label {{ font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }}
    .stat-value {{ font-size: 1.6rem; font-weight: 700; margin-top: 4px; }}
    .legend {{
      max-width: 1200px;
      margin: 0 auto 20px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 0.8rem;
    }}
    .legend-item {{ display: flex; align-items: center; gap: 6px; color: #aaa; }}
    .legend-dot {{ width: 10px; height: 10px; border-radius: 50%; }}
    .table-wrapper {{
      max-width: 1200px;
      margin: 0 auto;
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid #2a2a2a;
    }}
    table {{ width: 100%; border-collapse: collapse; }}
    thead th {{
      background: #111;
      color: #c9a84c;
      padding: 12px 14px;
      text-align: left;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
      border-bottom: 1px solid #2a2a2a;
    }}
    thead th:not(:first-child) {{ text-align: center; }}
    thead th:nth-child(3),
    thead th:nth-child(4),
    thead th:nth-child(5) {{ text-align: right; }}
    tbody tr:hover td {{ background: #222 !important; transition: background 0.15s; }}
    .footer {{
      max-width: 1200px;
      margin: 28px auto 0;
      text-align: center;
      color: #555;
      font-size: 0.78rem;
    }}
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="header-title">🦄 Unicorn Auctions — Whiskey Bargains</div>
      <div class="header-sub">Run #{run_id} &nbsp;·&nbsp; {date_str}</div>
    </div>
    <div style="color:#888;font-size:0.82rem">{len(listings)} whiskey lots tracked</div>
  </div>

  <div class="summary-grid">
    <div class="stat-card">
      <div class="stat-label">Total Lots</div>
      <div class="stat-value" style="color:#e8c87d">{len(listings)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Great Deals ≥ 20% off</div>
      <div class="stat-value" style="color:#22c55e">{len(great)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Decent Deals 10–19%</div>
      <div class="stat-value" style="color:#eab308">{len(decent)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Slight Deals 1–9%</div>
      <div class="stat-value" style="color:#f97316">{len(slight)}</div>
    </div>
  </div>

  <div class="legend">
    <div class="legend-item"><div class="legend-dot" style="background:#22c55e"></div> ≥ 20% below UA estimate</div>
    <div class="legend-item"><div class="legend-dot" style="background:#eab308"></div> 10–19% below</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f97316"></div> 1–9% below</div>
    <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div> At or above estimate</div>
  </div>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Bottle</th>
          <th>Section</th>
          <th>Current Bid</th>
          <th>UA Estimate</th>
          <th>MSRP</th>
          <th>Disc. vs Est.</th>
          <th>Disc. vs MSRP</th>
          <th>Time Left</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Generated by Unicorn Auctions Whiskey Bargain Scraper
    &nbsp;·&nbsp; Discounts calculated against UA estimated value
    &nbsp;·&nbsp; Always verify prices before bidding
  </div>

</body>
</html>
"""

    REPORT_PATH.write_text(html, encoding="utf-8")
    return REPORT_PATH


def enrich_with_msrp(listings: list[dict]) -> None:
    """
    Fuzzy-match each active listing against market-prices-data.json and fill in
    listing['msrp'] and listing['discount_vs_msrp'] where a match is found.
    Bottles with no catalog match keep msrp=None; the UI shows secondary avg instead.
    """
    import re

    data_path = Path(__file__).parent.parent / "lib" / "market-prices-data.json"
    if not data_path.exists():
        print("Warning: market-prices-data.json not found — skipping MSRP enrichment")
        return

    with open(data_path, encoding="utf-8") as f:
        catalog = json.load(f)

    def _norm(s: str) -> str:
        s = (s or "").lower()
        s = re.sub(r"['''‚‛′‵]", "", s)
        s = re.sub(r"[^a-z0-9\s]", " ", s)
        return re.sub(r"\s+", " ", s).strip()

    def _score(query_norm: str, candidate_norm: str) -> float:
        qw = [w for w in query_norm.split() if len(w) >= 3]
        cw = [w for w in candidate_norm.split() if len(w) >= 3]
        if not qw or not cw:
            return 0.0
        hits = sum(1 for w in qw if any(w in c or c in w for c in cw))
        s = hits / max(len(qw), len(cw))
        if query_norm in candidate_norm or candidate_norm in query_norm:
            s = max(s, 0.8)
        return s

    def _best_match(bottle_name: str):
        q = _norm(bottle_name)
        best_entry, best_score = None, 0.0
        for entry in catalog:
            names = [entry.get("name", "")] + (entry.get("aliases") or [])
            for name in names:
                s = _score(q, _norm(name))
                if s > best_score:
                    best_score = s
                    best_entry = entry
        return best_entry if best_score >= 0.5 else None

    enriched = 0
    for listing in listings:
        if listing.get("msrp"):
            continue
        match = _best_match(listing.get("bottle_name", ""))
        if match and match.get("msrp"):
            msrp = match["msrp"]
            listing["msrp"] = msrp
            bid = listing.get("current_bid")
            if bid and msrp > 0:
                listing["discount_vs_msrp"] = round((msrp - bid) / msrp * 100, 1)
            enriched += 1

    print(f"MSRP enrichment: {enriched}/{len(listings)} listings matched")


def push_bottle_catalog_to_redis(bottles: list[dict]) -> None:
    """
    Upsert unique bottle names seen in this scrape into wh:ua:catalog Redis hash.
    Field = normalized name, value = JSON {name, category, imageUrl, lotUrl, firstSeen, lastSeen}.

    Canonicalization rules (applied across runs, not just within a scrape):
      - firstSeen: set once on the first write, never overwritten
      - imageUrl / lotUrl: preserved from a prior run if the new scrape lacks one
      - lastSeen: always updated to the current run timestamp
    """
    import re

    url   = os.getenv("UPSTASH_REDIS_REST_URL", "").rstrip("/")
    token = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
    if not (url and token):
        print("Redis not configured — skipping catalog push")
        return

    def _norm(s: str) -> str:
        s = (s or "").lower()
        s = re.sub(r"['''‚‛′‵]", "", s)
        s = re.sub(r"[^a-z0-9\s]", " ", s)
        return re.sub(r"\s+", " ", s).strip()

    def _pipeline(cmds: list) -> list:
        payload = json.dumps(cmds).encode("utf-8")
        req = urllib.request.Request(
            f"{url}/pipeline",
            data=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())

    now_iso = datetime.now(timezone.utc).isoformat()
    seen: dict[str, dict] = {}

    for b in bottles:
        name      = (b.get("bottle_name") or b.get("name") or "").strip()
        category  = b.get("category", "")
        image_url = b.get("image_url") or None
        lot_url   = b.get("lot_url") or None
        if not name:
            continue
        nk = _norm(name)
        if not nk:
            continue
        if nk not in seen:
            seen[nk] = {"name": name, "category": category, "lastSeen": now_iso}
        if image_url and not seen[nk].get("imageUrl"):
            seen[nk]["imageUrl"] = image_url
        if lot_url and not seen[nk].get("lotUrl"):
            seen[nk]["lotUrl"] = lot_url

    if not seen:
        print("No bottles to push to catalog")
        return

    # Fetch existing catalog entries in bulk so we can preserve firstSeen and
    # any imageUrl/lotUrl that was captured in a prior scrape run.
    BATCH_SIZE  = 200
    norm_keys   = list(seen.keys())
    existing: dict[str, dict] = {}

    for i in range(0, len(norm_keys), BATCH_SIZE):
        batch_keys = norm_keys[i : i + BATCH_SIZE]
        try:
            results = _pipeline([["HGET", "wh:ua:catalog", nk] for nk in batch_keys])
            for nk, result in zip(batch_keys, results):
                raw = result.get("result")
                if raw:
                    try:
                        existing[nk] = json.loads(raw)
                    except (json.JSONDecodeError, TypeError):
                        pass
        except Exception as exc:
            print(f"Warning: catalog fetch batch failed: {exc}")

    # Merge new scrape data with existing entries.
    new_count = 0
    for nk, entry in seen.items():
        prev = existing.get(nk)
        if prev:
            entry["firstSeen"] = prev.get("firstSeen", now_iso)
            if not entry.get("imageUrl") and prev.get("imageUrl"):
                entry["imageUrl"] = prev["imageUrl"]
            if not entry.get("lotUrl") and prev.get("lotUrl"):
                entry["lotUrl"] = prev["lotUrl"]
        else:
            entry["firstSeen"] = now_iso
            new_count += 1

    # Write merged entries back in batches.
    items        = list(seen.items())
    total_pushed = 0
    for i in range(0, len(items), BATCH_SIZE):
        batch = items[i : i + BATCH_SIZE]
        cmd   = ["HSET", "wh:ua:catalog"]
        for nk, meta in batch:
            cmd += [nk, json.dumps(meta)]
        try:
            _pipeline([cmd])
            total_pushed += len(batch)
        except Exception as exc:
            print(f"Warning: catalog batch push failed: {exc}")

    print(f"UA catalog: pushed {total_pushed} entries ({new_count} new) to wh:ua:catalog")


def push_price_history_to_redis(completed_sales: list[dict]) -> None:
    """
    Push completed auction sale prices into Redis price-history hashes.

    Each sale: { name, price, source, date (ISO string or None) }
    Redis schema: wh:price-history:{normKey}  →  hash field=YYYY-MM, value=JSON
    """
    import re
    from collections import defaultdict

    url   = os.getenv("UPSTASH_REDIS_REST_URL", "").rstrip("/")
    token = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")
    if not (url and token):
        print("Redis not configured — skipping price history push")
        return

    def _norm(name: str) -> str:
        s = (name or "").lower()
        s = re.sub(r"['‘’‚‛′‵]", "", s)
        s = re.sub(r"[^a-z0-9\s]", " ", s)
        s = re.sub(r"\s+", " ", s).strip()
        return s

    # Group prices by (redis_key, YYYY-MM)
    buckets: dict[tuple[str, str], list[float]] = defaultdict(list)
    for sale in completed_sales:
        name  = sale.get("name", "")
        price = sale.get("price")
        if not name or not price or float(price) <= 0:
            continue
        nk = _norm(name)
        if not nk:
            continue
        date_raw = sale.get("date") or ""
        try:
            month = str(date_raw)[:7]
            if len(month) < 7 or month[4] != "-":
                raise ValueError
        except (ValueError, TypeError):
            month = datetime.now(timezone.utc).strftime("%Y-%m")
        buckets[(f"wh:price-history:{nk}", month)].append(float(price))

    if not buckets:
        print("No valid completed sales to push to price history")
        return

    # Aggregate per bucket → group by redis_key for one HSET per key
    key_months: dict[str, dict[str, str]] = defaultdict(dict)
    for (redis_key, month), prices in buckets.items():
        key_months[redis_key][month] = json.dumps({
            "avg":    round(sum(prices) / len(prices)),
            "low":    round(min(prices)),
            "high":   round(max(prices)),
            "count":  len(prices),
            "source": "auction",
        })

    # Build pipeline: one HSET command per key
    pipeline = []
    for redis_key, months in key_months.items():
        cmd = ["HSET", redis_key]
        for month, value_json in months.items():
            cmd += [month, value_json]
        pipeline.append(cmd)

    # Send in batches of 100 keys
    total_pushed = 0
    for i in range(0, len(pipeline), 100):
        batch = pipeline[i : i + 100]
        try:
            payload = json.dumps(batch).encode("utf-8")
            req = urllib.request.Request(
                f"{url}/pipeline",
                data=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                json.loads(resp.read())  # consume response
                total_pushed += len(batch)
        except Exception as exc:
            print(f"Warning: price history batch push failed: {exc}")

    print(
        f"Price history: pushed {total_pushed} key updates "
        f"for {len(buckets)} (bottle, month) buckets"
    )


def write_json_export(listings: list[dict], run_id: int, total_lots: int) -> Path:
    """
    Write latest_deals.json for the Next.js frontend.
    Includes top 1000 deals sorted by discount % so the UI can filter and
    paginate.  The 100-cap previously here caused the Reserve filter to
    surface zero lots — the deepest discounts skew heavily toward
    "reserve not met" (low bid vs estimate), so the top 100 was effectively
    a single bucket.  1000 gives every filter combo a real population.
    """
    sorted_deals = sorted(
        [l for l in listings if l.get("discount_vs_estimate") is not None],
        key=lambda x: x["discount_vs_estimate"],
        reverse=True,
    )

    # Build category summary
    cat_counts: dict[str, int] = {}
    for l in listings:
        cat = l.get("category", "Other")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    deals_out = []
    for l in sorted_deals[:1000]:
        deals_out.append({
            "lot_number":           l.get("lot_number"),
            "lot_url":              l.get("lot_url", ""),
            "lot_id":               l.get("lot_id", ""),
            "image_url":            l.get("image_url"),
            "bottle_name":          l.get("bottle_name", ""),
            "distillery":           l.get("distillery", ""),
            "category":             l.get("category", ""),
            "section":              l.get("section", "General"),
            "auction_name":         l.get("auction_name", ""),
            "current_bid":          l.get("current_bid"),
            "ua_estimate_low":      l.get("ua_estimate_low"),
            "ua_estimate_high":     l.get("ua_estimate_high"),
            "ua_estimate_mid":      l.get("ua_estimate_mid"),
            "ua_estimate_display":  l.get("ua_estimate_display", ""),
            "msrp":                 l.get("msrp"),
            "discount_vs_msrp":     l.get("discount_vs_msrp"),
            "discount_vs_estimate": l.get("discount_vs_estimate"),
            "reserve_price":        l.get("reserve_price"),
            "reserve_met":          l.get("reserve_met"),
            "time_remaining":       l.get("time_remaining", ""),
            "end_datetime":         l.get("end_datetime", ""),
        })

    export = {
        "scraped_at":         datetime.now(timezone.utc).isoformat(),
        "run_id":             run_id,
        "total_lots":         total_lots,
        "total_with_discount": len(sorted_deals),
        "category_counts":    dict(sorted(cat_counts.items(), key=lambda x: -x[1])),
        "deals":              deals_out,
    }

    JSON_PATH.write_text(json.dumps(export, indent=2), encoding="utf-8")
    _push_to_redis(export)
    return JSON_PATH
