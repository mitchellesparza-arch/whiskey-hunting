"""
SQLite database layer for whiskey bargain tracking.
"""

import sqlite3
import json
import os
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent / "whiskey_bargains.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS scrape_runs (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                run_at      TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'running',
                total_found INTEGER DEFAULT 0,
                errors      TEXT DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS listings (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id              INTEGER NOT NULL REFERENCES scrape_runs(id),
                scraped_at          TEXT NOT NULL,
                section             TEXT NOT NULL,
                bottle_name         TEXT NOT NULL,
                distillery          TEXT,
                lot_url             TEXT,
                lot_id              TEXT,
                current_bid         REAL,
                ua_estimate         REAL,
                msrp                REAL,
                discount_vs_estimate REAL,
                discount_vs_msrp    REAL,
                time_remaining      TEXT,
                raw_json            TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_listings_run_id ON listings(run_id);
            CREATE INDEX IF NOT EXISTS idx_listings_lot_id ON listings(lot_id);
        """)


def start_run() -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO scrape_runs (run_at, status) VALUES (?, 'running')",
            (datetime.now(timezone.utc).isoformat(),)
        )
        return cur.lastrowid


def finish_run(run_id: int, total_found: int, errors: list[str]) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE scrape_runs SET status='done', total_found=?, errors=? WHERE id=?",
            (total_found, json.dumps(errors), run_id)
        )


def fail_run(run_id: int, errors: list[str]) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE scrape_runs SET status='failed', errors=? WHERE id=?",
            (json.dumps(errors), run_id)
        )


def save_listing(run_id: int, listing: dict) -> None:
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO listings (
                run_id, scraped_at, section, bottle_name, distillery,
                lot_url, lot_id, current_bid, ua_estimate, msrp,
                discount_vs_estimate, discount_vs_msrp, time_remaining, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            run_id,
            datetime.now(timezone.utc).isoformat(),
            listing.get("section", ""),
            listing.get("bottle_name", ""),
            listing.get("distillery", ""),
            listing.get("lot_url", ""),
            listing.get("lot_id", ""),
            listing.get("current_bid"),
            listing.get("ua_estimate"),
            listing.get("msrp"),
            listing.get("discount_vs_estimate"),
            listing.get("discount_vs_msrp"),
            listing.get("time_remaining", ""),
            json.dumps(listing),
        ))


def get_run_listings(run_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM listings WHERE run_id = ? ORDER BY discount_vs_estimate DESC",
            (run_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_recent_runs(limit: int = 10) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM scrape_runs ORDER BY id DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
