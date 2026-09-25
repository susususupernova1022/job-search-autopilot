# Job Search Autopilot

A daily target-company job scan plus an end-to-end application pipeline, run by Claude inside a Claude Project with the Claude desktop app and Claude in Chrome.

Claude scans company job boards every morning, reads each JD in full, drops the ones you can't or shouldn't apply to, and scores the rest. You pick by number. Claude tailors your resume from a bullet database, writes a cover letter when it's worth it, and fills the application form. You read the review page and press Submit. Everything is logged in one Excel tracker, so nothing gets scanned or applied to twice.

Built and refined over ~150 real applications in 2026. The playbooks record what actually works on each ATS, including the fixes for problems that cost the most time.

---

## How a day works

```
Scheduled scan (e.g. 07:47 weekdays)
  └─ report: qualified jobs by tier · fit % with matched/missing requirements · platform cost · knockout stats
     · fetch failures · company caps · stuck "In progress" rows
        │
        ▼  you reply "apply 1, 3, 6"   (or "exclude 2 too senior")
Lane split (same session)
  └─ Tracker rows reserved as "In progress | <lane> | <date>"
  └─ outputs/Session_Prompts_<date>.md — one copy-paste block per lane
        │
        ▼  open one new session per lane (same Project), paste its block
Mode B lane session
  └─ tailor resume from the lane master + Bullet DB → docx + pdf
  └─ cover letter if triggered
  └─ fill the form from the Question Bank + platform playbook
  └─ read the review page back to you → YOU press Submit
  └─ Tracker → "Submitted | <lane>"; new bullets and answers saved
```

Why reserve rows before applying: lane sessions can take a day or two. The reservation stops tomorrow's scan from showing you the same job again.

---

## What you need

- Claude desktop app on a paid plan. The pipeline uses a lot of tokens, so expect long sessions to hit usage limits.
- A Claude **Project** for the job search. Every session runs inside it.
- **Claude in Chrome**, signed in, with permission on the job sites you use.
- **Scheduled tasks** in the desktop app, for the daily scan.
- This repo cloned to a folder **without spaces**, connected at the start of every session. Folder access doesn't carry over between sessions.
- Python 3 with `openpyxl`; Node 18+ (only for the scanner tests).
- About 10 GB free disk space. A full disk corrupts xlsx saves without any warning.

## Quick start

```bash
git clone <this repo> ~/job-search-autopilot
cd ~/job-search-autopilot
cp autopilot_config.example.json autopilot_config.json
pip install openpyxl
python3 tracker/init_workbooks.py --with-sample-quotas
python3 tracker/tests/test_tracker.py && node scanner/tests/test_scanner.mjs && node scanner/tests/test_runscan_mock.mjs
```

Then open **[SETUP_PROMPT.md](SETUP_PROMPT.md)**, attach all your resume versions to a new session in your Project, and paste the prompt. Claude will interview you, build your profile, bullet database, lane master resumes, question bank, target company list and scan filters, schedule the daily scan, and do a dry run that stops before Submit.

---

## Repo layout

```
job-search-autopilot/
├── README.md
├── SETUP_PROMPT.md                     paste into your first session
├── autopilot_config.example.json       file locations, lanes, stale threshold
├── prompts/
│   ├── master_instruction.template.md  → filled copy goes in your Project instructions
│   ├── daily_scan_prompt.template.md   → filled copy goes in the scheduled task
│   ├── lane_session_prompt.template.md one block per lane after "apply N"
│   └── snippets/sponsorship_section.md for visa holders
├── scanner/
│   ├── jd_scanner.js                   in-browser board scanner (engine — generic)
│   ├── scan_profile.example.js         your filters: titles, locations, knockouts
│   └── tests/                          regression tests (real JD sentences that once broke it)
├── tracker/
│   ├── init_workbooks.py               creates the data workbooks
│   ├── tracker_state.py                dedupe / excluded / quota / in-progress → JSON for the scan
│   ├── mark_in_progress.py             reserve picked jobs
│   ├── clear_in_progress.py            Submitted / Not applied / Skipped
│   ├── exclude_job.py                  "exclude N <reason>"
│   └── tests/
├── playbooks/                          how to fill each ATS; _common.md first
│   ├── _common.md  greenhouse.md  workday.md  ashby.md  smartrecruiters.md
│   ├── phenom.md  avature.md  pinpoint.md  lever_and_linkedin.md  _template.md
├── templates/
│   ├── question_bank_seed.csv          ~60 screening questions with type + answering rule
│   ├── target_companies_sample.csv     ~80 verified public board slugs (US tech/fintech)
│   └── company_quota_sample.csv        posted per-company application caps
├── tools/make_upload_js.py             last-resort file upload (base64 injection)
│
├── data/        ← private, gitignored: Master_Profile, Bullet DB, Tracker, Question Bank, Target Companies, masters
└── outputs/     ← private, gitignored: CV/, Cover Letter/, Session_Prompts_*.md
```

## The data files

| File | What it holds | Written by |
|---|---|---|
| `data/Master_Profile.md` | The single source of truth for your history, metrics you can defend, and honest reframe boundaries | Setup, then you |
| `data/Bullet_Database.xlsx` | Every resume bullet you've ever used, tagged by lane, with `[MUTEX]` groups for the same project | Setup, then each session appends |
| `data/Application_Tracker.xlsx` | **Applications** (columns A–G owned by scripts, H onward yours) · **Excluded** · **Company_Quota** | Scripts |
| `data/Question_Bank.xlsx` | Screening answers typed fact / judgment / per-company / consent, plus a Work & Education Timeline | Setup, then each session appends |
| `data/Target_Companies.xlsx` | Company · ATS · slug or Workday tenant · platform cost · tier · lane fit · sponsorship read | Setup, then you |

Tracker status values:

| Status | Counts as applied? | Blocks re-scan? | Uses company quota? |
|---|---|---|---|
| `In progress \| lane \| date` | yes | yes | yes (on purpose) |
| `Submitted \| lane` | yes | yes | yes |
| `Not applied \| reason` | no | no (the job can come back) | no |
| `Skipped \| reason` | yes | yes, permanently | yes |

---

## Rules the system enforces

- **Accuracy.** Nothing invented or inflated. If you couldn't defend it in an interview, it doesn't go in.
- **You press Submit.** Claude also doesn't create accounts, enter passwords, solve CAPTCHAs, handle verification codes, tick legal boxes (privacy, arbitration, NDA, AI-conduct pledges), or sign.
- **No conditional auto-clicking.** A review page can contain the same button text, so "click it again if still on this step" can turn into a Submit.
- **One source of truth.** One Bullet DB, one Tracker, no versioned copies. Resumes start from the lane master, never from an old tailored resume.
- **Evidence before rule changes.** One rejection or one friendly recruiter email isn't enough to overturn structural data such as sponsorship records.
- **Quality over volume.** Three tailored applications beat six form-fills. Heavy users (daily scans and high volume for their plan) only take expensive platforms at fit ≥ 90%; setup decides this from your plan and volume.

## What the scanner handles

- Greenhouse, Ashby, Lever and SmartRecruiters public JSON boards, plus Workday via a same-origin fetch in the tenant's own tab. Everything runs in your real browser, because server-side fetches returned stale snapshots.
- Full-JD knockouts: no sponsorship, citizenship-only (export-control wording excepted), clearance, and optionally people management (with a check for "no direct reports" or "a plus" context).
- Flags for the minimum years required, background requirements you don't have (required vs. plus), domain terms, and platform cost.
- Fixes for real bugs:
  - Greenhouse `updated_at` gets refreshed daily, so the scanner uses `first_published`.
  - Lever dates are epoch milliseconds.
  - Workday only returns a real total on page 1, and localized "Posted" strings break the date parsing.
  - Ashby hides the second office in `secondaryLocations`.
  - A per-board cap stops one noisy company from filling every slot.
- Failed fetches are reported, never treated as "no new jobs". A 404 usually means the company changed its ATS or slug.

## Maintenance

- **The scheduled task runs the text stored in the task.** After changing board lists, tiers or rules, bump the prompt version and re-paste it. Filter tuning in `scanner/scan_profile.js` needs no re-paste.
- Every 2 weeks or 25 applications, run the review loop: interview, rejection and **no-response** rates by lane and title level, with applications sent as the denominator.
- After each session, add new platform lessons to that platform's playbook with a date.

## Privacy

Everything personal lives in `data/`, `outputs/`, `scanner/scan_profile.js`, `prompts/generated/` and `autopilot_config.json`, all gitignored. Check `git status` before pushing a fork. Don't put the Tracker or Bullet DB in Project knowledge either: those copies go stale, and the pipeline refuses to use them.

## Limits

- US-centric location and work-authorization logic. The location regexes are configurable, but the knockout phrases are English.
- ATS front ends change. The playbooks were accurate in September 2026, so treat each company note as a starting point to verify.
- Board slugs in the sample move over time: several companies switched ATS in 2026. The scanner's failure report tells you when that happens.
