#!/usr/bin/env python3
"""tracker_state.py — the daily scan's filter state, read from the Tracker.

Prints JSON:
  applied_loose_keys   company|title for everything that counts as applied (dedupe)
  excluded_keys        company|title|job_id you rejected after review (Excluded sheet)
  blocked_companies    companies at their application cap (Company_Quota sheet) — skip the whole board
  quota_status         every capped company's usage, for the report
  in_progress          rows marked "In progress" (picked, not yet submitted)
  stale_in_progress    in-progress rows older than in_progress_stale_days — the report asks you about them

Usage:
  python3 tracker/tracker_state.py            # full JSON
  python3 tracker/tracker_state.py --compact  # what the scan prompt needs
  python3 tracker/tracker_state.py --today 2026-10-01   # test a different date
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import date, timedelta

import openpyxl

from common import (
    APPLICATIONS_SHEET, EXCLUDED_SHEET, IN_PROGRESS, NOT_APPLIED, QUOTA_SHEET,
    find_tracker, load_config, make_key, make_loose_key, norm, parse_date, read_rows,
    split_status, status_of,
)

_NOTE_DATE = re.compile(r"(\d{4})[/-](\d{1,2})[/-](\d{1,2})")


def _date_in_status(status: str) -> date | None:
    m = _NOTE_DATE.search(status or "")
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def build_state(tracker, today: date) -> dict:
    cfg = load_config()
    stale_days = int(cfg.get("in_progress_stale_days", 3))
    wb = openpyxl.load_workbook(tracker, data_only=True)

    # "Not applied" rows don't count: not deduped, not against quota, so the job can come back.
    apps = [r for r in read_rows(wb, APPLICATIONS_SHEET) if not status_of(r).startswith(NOT_APPLIED)]

    in_progress = []
    for row in apps:
        status = status_of(row)
        if not status.startswith(IN_PROGRESS):
            continue
        marked_on = parse_date(row.get("Date")) or _date_in_status(status)
        days_open = (today - marked_on).days if marked_on else None
        parts = split_status(status)
        in_progress.append({
            "company": row.get("Company"),
            "title": row.get("Title"),
            "job_id": row.get("Job ID"),
            "lane": row.get("Lane") or (parts[1] if len(parts) > 1 else None),
            "status": status,
            "marked_on": str(marked_on) if marked_on else None,
            "days_open": days_open,
            "stale": days_open is not None and days_open > stale_days,
        })
    in_progress.sort(key=lambda e: (-(e["days_open"] or 0), str(e["company"])))

    applied_keys, applied_loose = set(), set()
    for row in apps:
        company, title = row.get("Company"), row.get("Title")
        if not company and not title:
            continue
        applied_keys.add(make_key(company, title, row.get("Job ID")))
        applied_loose.add(make_loose_key(company, title))

    excluded_keys, excluded_detail = set(), []
    for row in read_rows(wb, EXCLUDED_SHEET):
        company, title = row.get("Company"), row.get("Title")
        if not company and not title:
            continue
        key = make_key(company, title, row.get("Job ID"))
        excluded_keys.add(key)
        excluded_detail.append({"key": key, "company": company, "title": title,
                                "reason": row.get("Reason"), "date": str(parse_date(row.get("Date")) or "")})

    blocked, quota_status = [], []
    for row in read_rows(wb, QUOTA_SHEET):
        if str(row.get("Active", "Y")).strip().upper() in {"N", "NO", "FALSE", "0"}:
            continue
        company = row.get("Company")
        try:
            limit = int(row.get("Max applications") or 0)
            window = int(row.get("Window days") or 0)
        except (TypeError, ValueError):
            continue
        if not company or limit <= 0 or window <= 0:
            continue
        aliases = [norm(company)] + [norm(a) for a in str(row.get("Aliases") or "").split(";") if norm(a)]
        cutoff = today - timedelta(days=window)
        hits = []
        for app in apps:
            c = norm(app.get("Company"))
            if c and any(a and (a == c or a in c) for a in aliases):
                d = parse_date(app.get("Date"))
                if d and d >= cutoff:
                    hits.append((d, app.get("Title")))
        hits.sort()
        entry = {
            "company": company, "limit": limit, "window_days": window, "count": len(hits),
            "blocked": len(hits) >= limit,
            # To get back under the cap, the (count - limit + 1)th-oldest application must age out.
            "unblock_on": (str(hits[len(hits) - limit][0] + timedelta(days=window + 1)) if len(hits) >= limit else None),
            "recent": [{"date": str(d), "title": t} for d, t in hits],
            "notes": row.get("Notes"),
        }
        quota_status.append(entry)
        if entry["blocked"]:
            blocked.append(entry)

    return {
        "generated_on": str(today),
        "tracker": str(tracker),
        "applied_count": len(applied_keys),
        "applied_keys": sorted(applied_keys),
        "applied_loose_keys": sorted(applied_loose),
        "in_progress_count": len(in_progress),
        "in_progress": in_progress,
        "stale_in_progress": [e for e in in_progress if e["stale"]],
        "excluded_count": len(excluded_keys),
        "excluded_keys": sorted(excluded_keys),
        "excluded_detail": excluded_detail,
        "blocked_companies": [b["company"] for b in blocked],
        "blocked_detail": blocked,
        "quota_status": quota_status,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--compact", action="store_true")
    ap.add_argument("--today", help="override today (YYYY-MM-DD) for testing")
    args = ap.parse_args()
    today = parse_date(args.today) or date.today()
    state = build_state(find_tracker(), today)
    if args.compact:
        state = {
            "generated_on": state["generated_on"],
            "applied_count": state["applied_count"],
            "excluded_count": state["excluded_count"],
            "in_progress_count": state["in_progress_count"],
            "in_progress": state["in_progress"],
            "stale_in_progress": state["stale_in_progress"],
            "blocked_companies": state["blocked_companies"],
            "blocked_detail": [{k: b[k] for k in ("company", "count", "limit", "window_days", "unblock_on")} for b in state["blocked_detail"]],
            "quota_status": [{"company": q["company"], "used": f"{q['count']}/{q['limit']}", "window_days": q["window_days"]} for q in state["quota_status"]],
            "applied_loose_keys": state["applied_loose_keys"],
            "excluded_keys": state["excluded_keys"],
        }
    print(json.dumps(state, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
