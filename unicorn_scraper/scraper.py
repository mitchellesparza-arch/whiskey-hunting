"""
Unicorn Auctions whiskey bargain scraper.

Architecture:
  - Playwright: navigates /auctions to bypass anti-bot protection and collect
                active auction UUIDs (age gate + JS rendering)
  - Direct HTTP: GraphQL API at graphql.beta.unicornauctions.com for all lot
                 data (fast paginated queries, no per-page navigation)

Usage:
    python scraper.py --now          # Run immediately
    python scraper.py --debug        # Verbose logging + screenshots
    python scraper.py --report-only  # Re-generate report from last DB run
"""

import argparse
import asyncio
import json
import logging
import os
import re
import smtplib
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from playwright.async_api import async_playwright, Page, TimeoutError as PWTimeout

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
    load_dotenv(Path(__file__).parent.parent / ".env.local", override=False)
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("unicorn")

# ── constants ──────────────────────────────────────────────────────────────────
BASE_URL = "https://www.unicornauctions.com"
GQL_URL  = "https://graphql.beta.unicornauctions.com/graphql"

# Only these categories are considered whiskey
WHISKEY_CATEGORIES = {
    "Bourbon", "Rye", "Tennessee", "Scotch", "American",
    "Japanese", "Irish", "Canadian", "Corn", "Blended",
    "Taiwanese", "Indian", "Australian", "Distilled Spirits",
}

GQL_BATCH_SIZE   = 100   # lots per GraphQL page
DELAY_SECONDS    = 0.5   # polite delay between GQL pages
PW_DELAY_SECONDS = 2.0   # delay after page load before scraping links

DEBUG = False
SCREENSHOTS_DIR = Path(__file__).parent / "debug_screenshots"

_UUID_RE = re.compile(
    r'/auction/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}'
    r'-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
)

# ── GraphQL query ─────────────────────────────────────────────────────────────
SEARCH_LOTS_QUERY = """
query SearchLots($input: SearchLotInput!) {
  searchLots(input: $input) {
    count
    next
    previous
    results {
      uuid
      auctionUuid
      number
      title
      category
      tagStatus
      state
      endDatetime
      lowEstimate
      highEstimate
      reservePrice
      reservePriceMet
      currentBid {
        amount
        currency
      }
    }
    categoryFilter {
      category
      count
    }
  }
}
"""

GET_AUCTIONS_QUERY = """
query GetActiveAuctions {
  auctions(filter: { state: { _in: ["active", "live"] } }) {
    uuid
    name
    endDatetime
    state
  }
}
"""


# ── helpers ───────────────────────────────────────────────────────────────────

def _gql_request(query: str, variables: dict, referer_auction_id: str = "") -> dict:
    """Execute a GraphQL request directly. Returns the full JSON response."""
    payload = json.dumps({
        "operationName": _operation_name(query),
        "query": query,
        "variables": variables,
    }).encode("utf-8")

    req = urllib.request.Request(
        GQL_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Origin": BASE_URL,
            "Referer": f"{BASE_URL}/auction/{referer_auction_id}" if referer_auction_id else BASE_URL,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def _operation_name(query: str) -> str:
    m = re.search(r"query\s+(\w+)", query)
    return m.group(1) if m else "Query"


def _discount_pct(bid: float | None, reference: float | None) -> float | None:
    if bid is None or reference is None or reference <= 0:
        return None
    return round((reference - bid) / reference * 100, 1)


def _lot_url(auction_uuid: str, lot_uuid: str) -> str:
    return f"{BASE_URL}/auction/{auction_uuid}/lot/{lot_uuid}"


def _section_from_tag(tag_status: str | None) -> str:
    if not tag_status:
        return "General"
    slug = tag_status.lower()
    if "horn" in slug:
        return "Horn of Unicorn"
    if "bargain" in slug:
        return "Bargain Buys"
    return "General"


async def _screenshot(page: Page, name: str) -> None:
    if not DEBUG:
        return
    SCREENSHOTS_DIR.mkdir(exist_ok=True)
    path = SCREENSHOTS_DIR / f"{name}_{int(time.time())}.png"
    await page.screenshot(path=str(path), full_page=False)
    log.debug("Screenshot: %s", path)


async def _dismiss_age_gate(page: Page) -> None:
    for sel in [
        'button:text("YES")', 'button:text("Yes")',
        'button:text("I am 21")', 'button:text("Enter")',
        'a:text("YES")', 'a:text("Yes")',
        '[class*="age"] button', '[class*="modal"] button:last-child',
    ]:
        try:
            el = page.locator(sel).first
            if await el.is_visible(timeout=1500):
                await el.click()
                log.info("Age gate dismissed")
                await asyncio.sleep(1)
                return
        except Exception:
            continue


# ── auction UUID discovery via Playwright ─────────────────────────────────────

async def _get_active_auction_uuids() -> list[dict]:
    """
    Use Playwright to load /auctions and extract active auction UUIDs.

    The original link-scraping regex only matched lowercase hex, missing any
    uppercase UUID characters the site may use, and used re.match() which
    won't find UUIDs inside full https:// href values.  This version uses
    page.evaluate() to get all hrefs, applies a case-insensitive UUID regex,
    and falls back to scanning the full page source (e.g. __NEXT_DATA__ JSON).
    """
    log.info("Discovering active auctions via browser...")
    seen: dict[str, None] = {}  # uuid (lowercase) → None, preserves insertion order

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = await ctx.new_page()

        try:
            await page.goto(f"{BASE_URL}/auctions", wait_until="networkidle", timeout=30000)
            await _dismiss_age_gate(page)
            await asyncio.sleep(PW_DELAY_SECONDS)
            await _screenshot(page, "auctions_list")

            # Pull all hrefs via JS so we get absolute URLs too
            hrefs: list[str] = await page.evaluate(
                "() => [...document.querySelectorAll('a[href]')].map(a => a.href)"
            )
            for href in hrefs:
                m = _UUID_RE.search(href)
                if m:
                    seen[m.group(1).lower()] = None

            # Fallback: scan the raw page source for any embedded UUIDs
            if not seen:
                source = await page.content()
                for m in _UUID_RE.finditer(source):
                    seen[m.group(1).lower()] = None

        except Exception as exc:
            log.error("Failed to load /auctions: %s", exc)
        finally:
            await browser.close()

    uuids = list(seen)
    if not uuids:
        log.warning("No auction UUIDs found on /auctions page")
        return []

    # Enrich with GQL details and keep only active/live auctions
    confirmed: list[dict] = []
    for uuid in uuids:
        try:
            resp = _gql_request(
                "query GetAuctionDetails($uuid: String!) "
                "{ auctionDetails(uuid: $uuid) { name state endDatetime } }",
                {"uuid": uuid},
                uuid,
            )
            details = (resp.get("data") or {}).get("auctionDetails") or {}
            if not details.get("name"):
                continue  # not a valid auction UUID
            state = (details.get("state") or "").lower()
            if state not in ("active", "live", "open", ""):
                log.debug("Skipping auction %s (state=%s)", uuid[:8], state)
                continue
            confirmed.append({
                "uuid": uuid,
                "name": details["name"],
                "endDatetime": details.get("endDatetime"),
            })
        except Exception as exc:
            log.debug("Could not verify auction %s: %s", uuid[:8], exc)

    log.info("Found %d active auction(s): %s", len(confirmed), [a["name"] for a in confirmed])
    return confirmed


# ── GraphQL lot scraper ───────────────────────────────────────────────────────

def _fetch_whiskey_lots_for_auction(auction: dict) -> tuple[list[dict], list[str]]:
    """
    Paginate through ALL whiskey categories for a given auction via GraphQL.
    Returns (listings, errors).
    """
    uuid     = auction["uuid"]
    auc_name = auction.get("name", uuid[:8])
    listings: list[dict] = []
    errors:   list[str]  = []
    seen_lot_uuids: set[str] = set()

    for category in sorted(WHISKEY_CATEGORIES):
        offset = 1
        cat_total = None

        while True:
            try:
                resp = _gql_request(
                    SEARCH_LOTS_QUERY,
                    {
                        "input": {
                            "offset":      offset,
                            "limit":       GQL_BATCH_SIZE,
                            "auctionUuid": uuid,
                            "category":    category,
                        }
                    },
                    uuid,
                )
            except urllib.error.URLError as exc:
                err = f"GQL request failed for {auc_name}/{category} offset={offset}: {exc}"
                log.warning(err)
                errors.append(err)
                break
            except Exception as exc:
                err = f"Unexpected error for {auc_name}/{category}: {exc}"
                log.warning(err)
                errors.append(err)
                break

            data = (resp.get("data") or {}).get("searchLots") or {}
            if cat_total is None:
                cat_total = data.get("count", 0)
                if cat_total:
                    log.info("  %-20s  %4d lots in %-18s  auction=%s",
                             category, cat_total, f"'{auc_name}'", uuid[:8])

            results = data.get("results") or []
            for lot in results:
                lot_uuid = lot.get("uuid", "")
                if lot_uuid in seen_lot_uuids:
                    continue
                seen_lot_uuids.add(lot_uuid)

                # Skip lots that aren't active/open
                state = (lot.get("state") or "").lower()
                if state in ("sold", "passed", "withdrawn", "cancelled"):
                    continue

                bid_obj  = lot.get("currentBid") or {}
                bid      = bid_obj.get("amount")   # dollars
                low_est  = lot.get("lowEstimate")
                high_est = lot.get("highEstimate")

                # UA midpoint estimate for discount calculation
                est_mid = None
                if low_est is not None and high_est is not None:
                    est_mid = (low_est + high_est) / 2
                elif low_est is not None:
                    est_mid = low_est
                elif high_est is not None:
                    est_mid = high_est

                est_display = (
                    f"${low_est:,.0f}–${high_est:,.0f}" if (low_est and high_est)
                    else f"${est_mid:,.0f}" if est_mid else None
                )

                # Time remaining
                end_dt = lot.get("endDatetime")
                time_remaining = _fmt_time_remaining(end_dt)

                listing = {
                    "section":             _section_from_tag(lot.get("tagStatus")),
                    "bottle_name":         lot.get("title", ""),
                    "distillery":          _infer_distillery(lot.get("title", "")),
                    "lot_url":             _lot_url(uuid, lot_uuid),
                    "lot_id":              lot_uuid,
                    "lot_number":          lot.get("number"),
                    "auction_name":        auc_name,
                    "category":            lot.get("category", ""),
                    "current_bid":         bid,
                    "ua_estimate_low":     low_est,
                    "ua_estimate_high":    high_est,
                    "ua_estimate_mid":     est_mid,
                    "ua_estimate_display": est_display,
                    "msrp":                None,   # UA doesn't publish MSRP
                    "reserve_price":       lot.get("reservePrice"),
                    "reserve_met":         lot.get("reservePriceMet"),
                    "discount_vs_estimate": _discount_pct(bid, est_mid),
                    "discount_vs_msrp":    None,
                    "time_remaining":      time_remaining,
                    "end_datetime":        end_dt,
                    "tag_status":          lot.get("tagStatus"),
                }
                listings.append(listing)

            # offset is a page number (1, 2, 3...). Stop when partial or empty page.
            if len(results) < GQL_BATCH_SIZE:
                break

            offset += 1
            time.sleep(DELAY_SECONDS)

    return listings, errors


def _fmt_time_remaining(end_datetime_str: str | None) -> str:
    if not end_datetime_str:
        return "—"
    try:
        # Parse ISO 8601 (e.g. "2026-04-26T18:00:00+00:00")
        end = datetime.fromisoformat(end_datetime_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta = end - now
        if delta.total_seconds() <= 0:
            return "Ended"
        days    = delta.days
        hours   = delta.seconds // 3600
        minutes = (delta.seconds % 3600) // 60
        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m"
    except Exception:
        return end_datetime_str or "—"


def _infer_distillery(title: str) -> str:
    """Extract a likely distillery/brand from the bottle name."""
    if not title:
        return ""
    # Strip year patterns and common suffixes
    cleaned = re.sub(
        r"\s+\(?\d{4}\)?\s*$|\s+\d+\s*[Yy](ear|r).*$|\s+Single\s.*$",
        "", title
    )
    # Take first 2-3 words
    words = cleaned.split()
    return " ".join(words[:3]) if words else ""


# ── main orchestrator ─────────────────────────────────────────────────────────

async def run_scraper(debug: bool = False) -> int:
    global DEBUG
    DEBUG = debug

    from db import init_db, start_run, finish_run, fail_run, save_listing, get_run_listings
    from report import generate_report, write_json_export

    init_db()
    run_id = start_run()
    all_listings: list[dict] = []
    all_errors:   list[str]  = []

    log.info("=" * 65)
    log.info("Unicorn Auctions Whiskey Bargain Scraper")
    log.info("Run ID: %d  |  %s", run_id, datetime.now().strftime("%Y-%m-%d %H:%M"))
    log.info("=" * 65)

    try:
        # Step 1: discover auctions (Playwright)
        auctions = await _get_active_auction_uuids()

        if not auctions:
            log.warning("No active auctions found — nothing to scrape")
            finish_run(run_id, 0, ["No active auctions found"])
            return run_id

        # Step 2: fetch whiskey lots via GraphQL (no browser needed)
        log.info("\nFetching whiskey lots via GraphQL API...")
        for auction in auctions:
            log.info("\nAuction: %s (%s)", auction["name"], auction["uuid"][:8])
            sec_listings, sec_errors = _fetch_whiskey_lots_for_auction(auction)
            all_listings.extend(sec_listings)
            all_errors.extend(sec_errors)
            log.info("  => %d whiskey lots found", len(sec_listings))

    except Exception as exc:
        all_errors.append(f"Fatal error: {exc}")
        log.exception("Fatal scraper error")
        fail_run(run_id, all_errors)
        raise

    # Step 3: save to DB
    for lst in all_listings:
        save_listing(run_id, lst)

    finish_run(run_id, len(all_listings), all_errors)

    # Step 4: generate report + JSON export
    report_listings = get_run_listings(run_id)
    report_path = generate_report(report_listings, run_id)
    write_json_export(all_listings, run_id, len(all_listings))

    _print_summary(all_listings, report_path)
    _maybe_send_email(report_path)

    return run_id


def _print_summary(listings: list[dict], report_path: Path) -> None:
    print("\n" + "=" * 65)
    print("  UNICORN AUCTIONS — WHISKEY BARGAINS SUMMARY")
    print("=" * 65)

    if not listings:
        print("  No whiskey lots found this run.")
        print(f"\n  Report: {report_path}")
        return

    discounted = sorted(
        [l for l in listings if (l.get("discount_vs_estimate") or 0) > 0],
        key=lambda x: x["discount_vs_estimate"],
        reverse=True,
    )

    cat_counts: dict[str, int] = {}
    for l in listings:
        cat_counts[l.get("category", "Other")] = cat_counts.get(l.get("category", "Other"), 0) + 1

    print(f"\n  Total whiskey lots:            {len(listings)}")
    print(f"  Lots below UA estimate:        {len(discounted)}")
    print(f"  Lots >= 20% below estimate:    {sum(1 for l in discounted if l['discount_vs_estimate'] >= 20)}")
    print(f"\n  Categories: {dict(sorted(cat_counts.items(), key=lambda x: -x[1]))}")

    if discounted:
        print("\n  TOP BARGAINS (bid below UA estimate):")
        print(f"  {'#':>4}  {'Bottle':<50}  {'Bid':>8}  {'Estimate':>18}  {'Disc':>6}  Section")
        print("  " + "-" * 100)
        for l in discounted[:15]:
            bid  = f"${l['current_bid']:,.0f}" if l.get("current_bid") is not None else "—"
            est  = l.get("ua_estimate_display") or "—"
            disc = f"{l['discount_vs_estimate']:.1f}%" if l.get("discount_vs_estimate") is not None else "—"
            num  = l.get("lot_number") or ""
            print(f"  {num:>4}  {l['bottle_name'][:50]:<50}  {bid:>8}  {est:>18}  {disc:>6}  {l['section']}")

    print(f"\n  Full report: {report_path}")
    print("=" * 65 + "\n")


def _maybe_send_email(report_path: Path) -> None:
    smtp_host   = os.getenv("SMTP_HOST")
    smtp_port   = int(os.getenv("SMTP_PORT", "587"))
    smtp_user   = os.getenv("SMTP_USER")
    smtp_pass   = os.getenv("SMTP_PASS")
    alert_email = os.getenv("ALERT_EMAIL", "mitchell.esparza@gmail.com")

    if not (smtp_host and smtp_user and smtp_pass):
        log.debug("SMTP not configured — skipping email")
        return

    log.info("Sending report email to %s", alert_email)
    try:
        html_content = report_path.read_text(encoding="utf-8")
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Unicorn Auctions Whiskey Bargains — {datetime.now().strftime('%b %d, %Y')}"
        msg["From"]    = smtp_user
        msg["To"]      = alert_email
        msg.attach(MIMEText(html_content, "html"))
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [alert_email], msg.as_string())
        log.info("Email sent")
    except Exception as exc:
        log.error("Failed to send email: %s", exc)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Unicorn Auctions whiskey bargain scraper")
    parser.add_argument("--now",         action="store_true", help="Run scraper immediately")
    parser.add_argument("--debug",       action="store_true", help="Verbose logging + screenshots")
    parser.add_argument("--report-only", action="store_true", help="Re-generate HTML from last DB run")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.report_only:
        from db import init_db, get_recent_runs, get_run_listings
        from report import generate_report, write_json_export
        init_db()
        runs = get_recent_runs(1)
        if not runs:
            print("No runs in database yet. Run with --now first.")
            sys.exit(1)
        run_id   = runs[0]["id"]
        db_rows  = get_run_listings(run_id)
        # Restore full listing dicts from stored raw_json
        full_listings = []
        for row in db_rows:
            if row.get("raw_json"):
                try:
                    full_listings.append(json.loads(row["raw_json"]))
                except Exception:
                    full_listings.append(row)
            else:
                full_listings.append(row)
        path = generate_report(db_rows, run_id)
        write_json_export(full_listings, run_id, len(full_listings))
        print(f"Report regenerated: {path}")
        print(f"JSON exported:      {path.parent / 'latest_deals.json'}")
        return

    if args.now:
        asyncio.run(run_scraper(debug=args.debug))
        return

    parser.print_help()
    print("\nTip: run with --now to scrape immediately.")


if __name__ == "__main__":
    main()
