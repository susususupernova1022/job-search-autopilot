# Lane session prompt (template)

The lane-split step fills one of these per lane and writes them all to `outputs/Session_Prompts_<date>.md`.
You open a **new session in the same Project**, connect the folder, and paste one block. Each block must be
self-contained — the new session can't see the scan conversation.

````markdown
Mode B lane session — {{LANE}} — {{DATE}}. Follow the Project's Master Instruction (Steps 2–6).

## Opening check (hard stop if any fails)
1. Connect/verify folder `{{FOLDER_NAME}}`; run
   `python3 "$BASE/tracker/tracker_state.py" --compact` and confirm these jobs show as In progress.
2. Confirm Claude in Chrome is reachable.
Then say "Ready" and start with job 1.

## Jobs in this lane
1. **{{TITLE}}** — {{COMPANY}} ({{ATS}}, platform cost {{COST}})
   Link: {{URL}} · Job ID: {{JOB_ID}} · Location: {{LOCATION}} · Pay: {{PAY}}
   Already done in the scan: Tracker dedupe ✓ · knockouts ✓ · sponsorship read: {{SPONSORSHIP_READ}} ({{RISK_TIER}})
   Fit {{FIT}}% — matches: {{MATCHES}} · gaps: {{GAPS}}
   JD must-haves to mirror: {{KEYWORDS}}
   Watch-outs: {{WATCH_OUTS}}   (e.g. "company cap 2/3 used", "form asks for portfolio", "posting closes 10/02")
2. …

## Resume
Start from `data/resume_masters/{{LANE_MASTER}}` (layout only). Bullets from the Bullet DB filtered to lane "{{LANE}}".
Never start from an earlier tailored resume.

## Per job, in order
Step 2 tailor → Step 3 fill (read `playbooks/_common.md` + `playbooks/{{PLATFORM}}.md` first) → Step 4 cover letter if triggered
→ Step 5 read the review page back to me and WAIT for my OK; I press Submit
→ Step 6 `clear_in_progress.py` (Submitted / --abandon / --skip).

## Wrap-up
Bullet DB + Question Bank appended; `tracker_state.py --compact` shows no In progress for these jobs;
all docx/pdf in `outputs/`; new platform lessons written to the playbook.
````
