#!/usr/bin/env python3
"""Smoke test for the tracker scripts. Runs against a throwaway copy of the repo — your data is untouched.
Run: python3 tracker/tests/test_tracker.py"""
import json, shutil, subprocess, sys, tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
tmp = Path(tempfile.mkdtemp())
for d in ("tracker", "templates"):
    shutil.copytree(root / d, tmp / d)
shutil.copy(root / "autopilot_config.example.json", tmp / "autopilot_config.json")
T = tmp / "tracker"

def run(*args, stdin=None):
    r = subprocess.run([sys.executable, *args], cwd=T, input=stdin, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr); sys.exit(1)
    return json.loads(r.stdout) if r.stdout.strip().startswith("{") else r.stdout

bad = 0
def check(name, cond):
    global bad
    bad += not cond
    print(("PASS " if cond else "FAIL ") + name)

run("init_workbooks.py", "--with-sample-quotas")
r = run("mark_in_progress.py", "--stdin", stdin=json.dumps([
    {"company": "Plaid", "title": "PM, Credit", "job_id": "a1", "lane": "PM", "method": "Ashby"},
    {"company": "Stripe", "title": "Pricing Strategist", "job_id": "9", "lane": "Finance/FP&A"},
    {"company": "X", "title": "Y", "lane": "Not a lane"}]))
check("two rows reserved, bad lane rejected", len(r["added"]) == 2 and len(r["skipped"]) == 1)
r = run("mark_in_progress.py", "--company", "Plaid", "--title", "PM, Credit")
check("duplicate reservation skipped", not r["added"])
run("clear_in_progress.py", "--company", "Plaid", "--title", "PM, Credit")
run("clear_in_progress.py", "--company", "Stripe", "--title", "Pricing Strategist", "--abandon", "portal broken")
s = run("tracker_state.py", "--compact")
check("submitted row deduped", "plaid|pm credit" in s["applied_loose_keys"])
check("abandoned row resurfaces", "stripe|pricing strategist" not in s["applied_loose_keys"])
check("no in-progress left", s["in_progress_count"] == 0)
run("exclude_job.py", "--company", "Mercury", "--title", "PM, Payments", "--job-id", "Greenhouse 451")
s = run("tracker_state.py", "--compact")
check("job-id source prefix stripped", "mercury|pm payments|451" in s["excluded_keys"])
run("mark_in_progress.py", "--company", "Ramp", "--title", "Ops", "--lane", "PM")
s = run("tracker_state.py", "--compact")
check("in-progress counts against quota (Ramp 1/100d)", "Ramp" in s["blocked_companies"])
s = run("tracker_state.py", "--compact", "--today", "2099-01-01")
check("old in-progress flagged stale", len(s["stale_in_progress"]) == 1)
shutil.rmtree(tmp)
print("ALL PASS" if not bad else f"{bad} FAILED"); sys.exit(bool(bad))
