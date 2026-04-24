"""
HTML report generator and JSON export for Unicorn Auctions whiskey bargains.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

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


def write_json_export(listings: list[dict], run_id: int, total_lots: int) -> Path:
    """
    Write latest_deals.json for the Next.js frontend.
    Includes top 100 deals sorted by discount % so the UI can filter/paginate.
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
    for l in sorted_deals[:100]:
        deals_out.append({
            "lot_number":           l.get("lot_number"),
            "lot_url":              l.get("lot_url", ""),
            "lot_id":               l.get("lot_id", ""),
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
    return JSON_PATH
