# Setup prompt — paste this into your first session

**Before you paste:**
1. Put this repo on your computer in a folder **without spaces** in its name, e.g. `~/job-search-autopilot`.
2. In the Claude desktop app, create a Project for your job search (e.g. "Job Search"). Start a new session inside it.
3. Connect the `job-search-autopilot` folder to the session.
4. Attach **every resume version you have** (PDF or DOCX), plus your LinkedIn profile PDF if you like. More versions = a richer bullet database.
5. Paste everything inside the block below.

Plan on 2–3 sessions; the prompt tells Claude to stop at each ⏸ checkpoint. If a session ends midway, start a new one in the same Project, reconnect the folder, and say "continue setup from Phase N".

````markdown
You are setting up my Job Search Autopilot from the connected `job-search-autopilot` folder:
a daily target-company scan plus the Mode B application pipeline. Work through the phases in order.
Stop at every ⏸ and wait for me. Use multiple-choice questions where you can. Never invent facts about me.

## Phase 0 — Environment
1. Confirm the folder is connected. Read README.md, prompts/, playbooks/_common.md, scanner/, tracker/.
2. `cp autopilot_config.example.json autopilot_config.json` (if missing), then
   `python3 tracker/init_workbooks.py --with-sample-quotas` and run both test suites:
   `python3 tracker/tests/test_tracker.py`, `node scanner/tests/test_scanner.mjs`, `node scanner/tests/test_runscan_mock.mjs`.
   (Install openpyxl if needed.) Report pass/fail.
3. Check Claude in Chrome is reachable. If not, tell me and continue with the offline phases.
4. Check free disk space on my computer; warn under 10 GB (a full disk silently corrupts xlsx writes).

## Phase 1 — Intake from my resumes
1. Read every attached resume version.
2. Build one timeline: every employer, every sub-role with exact MM/YYYY dates, city/country, title, paid or unpaid, and every metric claimed anywhere.
3. ⏸ List every conflict between versions (dates, numbers, titles, employer names) and ask me to resolve each. The resolved version is the truth from now on.
4. ⏸ Per role, ask: which numbers can I defend in an interview, and how was each measured? What did I NOT do that a reader might assume (e.g. "no management consulting background", "used Salesforce only as an end user", "never managed direct reports")?

## Phase 2 — Search direction ⏸ (one structured questionnaire)
**Targets**
- **Start from my resumes:** propose 3–6 target titles that my experience supports (with one line of evidence each, e.g. "Product Manager — 2 yrs PM title at X, launched Y"), grouped into 2–4 lanes (e.g. Finance/FP&A · Strategy&Ops · PM · PMM/Marketing). Ask me to keep / drop / add, and to set the lane priority order.
- Titles I never want. Title words that should be excluded (e.g. Director, Staff, Engineer, Account Executive).
- Seniority: max years a JD may require (default 6). Auto-skip Director/VP/Head-of? New-grad/APM programs?
- Can I apply to roles that manage people, or should "must manage a team" be a knockout?
- Industries/domains ranked: Tier A (best fit), Tier B (acceptable), Tier C (only at fit ≥ 90%).
- Company size/stage; companies to always exclude (e.g. current/former employers).
- Background requirements I don't have that should be flagged (e.g. investment banking, management consulting).

**Location & terms**
- States/cities; US-remote OK? Hybrid days OK? Relocation willingness, and at my own expense?
- Salary floor; a rule for "desired compensation" (e.g. midpoint of disclosed band, never below $X; blank when optional?).
- Earliest start date / notice period.

**Work authorization** (branching — ask in this order)
1. Will you now or in the future need visa sponsorship to work in the US?
   - **No** → skip the rest of this block (no visa questions, no sponsorship section, no sponsorship reads in Phase 7).
   - **Yes** → ask a.
     a. What is your current visa / work-authorization status? (e.g. F-1 OPT, H-1B, TN, E-3, other)
     b. Its start and end date (MM/DD/YYYY – MM/DD/YYYY, as printed on the EAD / approval notice). Ask this for every status.
     c. Only if a. is F-1 OPT, OPT, or anything meaning the same (e.g. "post-completion OPT", "OPT EAD"): are you eligible for the 24-month STEM OPT extension? (Yes / No). Any other status → skip c.
   With Yes: Phase 7 adds a sponsorship read per company, and the master gets the sponsorship section filled with these answers.
2. Do you hold an active US security clearance (e.g. Secret, Top Secret)? It's required for many defense / government / government-contractor jobs and is generally only granted to US citizens.
   - No (default) → jobs requiring a clearance are dropped by the scanner.
   - Yes → record the level in the Master Profile, set `knockouts.clearance: false` in `scanner/scan_profile.js` (Phase 8), and consider adding cleared/defense employers in Phase 7.

**Form facts** — parse first, ask the rest, then review
1. Pull everything available from my resumes: legal name, preferred name, email, phone, city/state, LinkedIn (normalize to the full `https://www.linkedin.com/in/...` form), portfolio, current employer and title, degrees, languages and levels, certifications.
2. Ask me only for what's missing or unclear, plus: EEO answers (or decline wording); standing answers for how-did-you-hear, non-compete status, government-employment history, SMS opt-in, talent-community opt-in.
3. ⏸ Show me the complete list of form facts in one table for review and corrections before saving. Phase 6 reuses this list — no question is asked twice.

**Volume & effort**
- Which Claude plan do you use? (Pro / Max 5x / Max 20x / Team / Enterprise)
- How many applications do you want to do per session? Max per company per 2 weeks (default 2).
- (Scan frequency comes from "Schedule" below.)
- Don't ask me about expensive platforms — derive the rule in Phase 9 (see there).

**Resume & cover letter preferences**
- Page length, min font size, section order, summary (length / omit), bullet style (e.g. XYZ or Action-Project-Result).
- Any fixed formatting rules (e.g. how volunteer work is labelled, bold rules in Education).
- Cover letter trigger (e.g. Fortune 500 AND the portal has any CL slot; or whenever a CL field exists) and style rules (length, no en-dashes, don't mention sponsorship, never concede weaknesses).

**Schedule**
- Scan days and time (default weekdays at a non-round minute, e.g. 7:47 local), and time zone.

## Phase 3 — Master Profile
Write `data/Master_Profile.md`: identity and contact facts; the resolved timeline; per-role facts and defensible metrics; skills with 1–5 proficiency; tools actually used; **honest reframe boundaries** (what can be reframed, what must never be claimed); all Phase 2 answers. ⏸ Show me; get approval.

## Phase 4 — Bullet Database
Fill `data/Bullet_Database.xlsx` from every bullet in every version (+ Summary / Skills rows with Company = "—"):
ID | Company | Role | Resume Version | Skill Category | Lane | Metric | Bullet Text | Notes.
- Unique ID per row (e.g. `ACME-PM-03`). Company from a fixed canonical list.
- Lane: one or more of my lanes, comma-separated, fixed order.
- Bullets describing the SAME underlying project get `[MUTEX: <group>]` in Notes — max one per resume.
Report rows per lane and per company.

## Phase 5 — Lane masters
For each lane, build a master resume in `data/resume_masters/` and a cover letter master in `data/cover_letter_masters/` (placeholders for date, company, address, news paragraph).
Apply my Phase 2 format rules and the six structural rules in `prompts/master_instruction.template.md` (title level matches dates; domain years not title years; every summary noun backed by a bullet; ≥ 4 bullets with concrete JD terms; no visible gap; AI bullet in role 1–2 when relevant).
Run the Recruiter 20-second test on each. ⏸ Show me each master (docx + pdf in `outputs/`).

## Phase 6 — Question Bank
`data/Question_Bank.xlsx` is pre-seeded with ~60 common questions and a Type column (fact / judgment / per-company / consent).
1. **Fill from what we already have first.** Go through every row and fill "My answer" from the reviewed form facts (Phase 2), the resumes, and the Master Profile (years of experience, work authorization, etc.). In "Notes", record where each answer came from (e.g. "resume v3 header").
2. **Then list the gaps.** Show me a short list of the fact and judgment rows you could NOT fill, plus any filled answers where resume versions disagreed.
3. ⏸ **Ask me the gaps one question at a time**, in order: ask one, wait for my answer, write it into the bank, then ask the next. Skip visa rows entirely if I said I don't need sponsorship. Leave per-company and consent rows blank on purpose (they're asked per application / ticked by me).
4. Fill the **Work & Education Timeline** sheet: one row per sub-role / degree with exact dates, legal organization names, city, country — again from the resumes first, asking only for what's missing.

## Phase 7 — Target companies
`templates/target_companies_sample.csv` has ~80 verified public board slugs (fintech/tech, US).
1. Propose a list of 40–80 companies from my Phase 2 answers — reuse sample rows that fit, add new ones.
2. For each new company, find the ATS and board slug (careers page apply links: `gh_jid=` → Greenhouse, `jobs.ashbyhq.com` → Ashby, `jobs.lever.co` → Lever, `myworkdayjobs.com` → Workday tenant/host/site). Verify each board in the browser (HTTP 200 and a job count). Record platform cost (cheap/medium/expensive).
3. If I need sponsorship: a sponsorship read per company using `prompts/snippets/sponsorship_section.md` (legal entity + job family + salary cross-check + same-name trap) → low / medium / high.
4. Record posted application caps in the Tracker's Company_Quota sheet.
5. ⏸ Show me the list in `data/Target_Companies.xlsx`; I'll prune and set tiers.

## Phase 8 — Scan profile
Create `scanner/scan_profile.js` from `scanner/scan_profile.example.js` using Phase 2: title gate regexes for my lanes, excluded title words, priority-title words for my Tier A domain, location include/veto regexes, knockouts (sponsorship / citizenship / clearance / people management), background terms to flag, domain terms, and `boardToCompany` for every slug whose normalized form differs from the company name I'll use in the Tracker.
Run `node scanner/tests/test_scanner.mjs` (it uses my profile). If a test fails because my preferences differ from the example (e.g. I'm fine managing people), explain and adjust the test expectation — don't weaken the regex silently.

## Phase 9 — Master Instruction
Fill `prompts/master_instruction.template.md` (+ `prompts/snippets/sponsorship_section.md` if I need a visa) → save as `data/Master_Instruction.md`.

**Expensive-platform rule (`{{EXPENSIVE_PLATFORM_RULE}}`) — decide it, don't ask me.** Workday/Phenom/iCIMS forms cost several times more tokens than Greenhouse/Ashby/Lever.
- My setup is **high effort** when the scan runs every day or more AND I plan more than 5 applications per session on Pro. Scale the session threshold by plan: Pro 5 · Max 5x 25 · Max 20x 100 · Team/Enterprise: judge from the plan's usage relative to Pro.
- High effort → "Expensive platforms (Workday/Phenom/iCIMS/custom) only at fit ≥ 90%; the scan recommends skipping below that."
- Otherwise → "Expensive platforms use the same fit threshold as every other platform; the scan only flags the cost."
Tell me which rule you picked and why, in one line. Re-evaluate if I change plan, schedule or volume.
⏸ Tell me to paste it into this Project's custom instructions, and wait until I confirm.

## Phase 10 — Daily scan
1. Fill `prompts/daily_scan_prompt.template.md` → `prompts/generated/daily_scan_prompt_v1.md` (board arrays from Target_Companies, Workday table, custom sources, tiers, a short profile summary for fit %, never-report list).
2. Do one live dry run now in Chrome, following the prompt exactly. Show me the report and the knockout stats; tune `scan_profile.js` if the results look wrong (too many sales roles, wrong cities, etc.).
3. ⏸ Create the scheduled task with my chosen schedule, with access to my computer and this folder, pasting the FULL prompt text. Tell me which approval setting it got. Remind me: every prompt change = bump version + re-paste.

## Phase 11 — Platforms
List which ATS platforms my targets use and whether `playbooks/` covers each. For uncovered ones, create a stub from `playbooks/_template.md`.

## Phase 12 — End-to-end dry run
Pick one cheap-platform job from the scan. Run Mode B through Step 5: lane split → tailor → fill → read the review page back to me. **Stop before Submit.** Then either I submit and you close out the Tracker, or you mark it `--abandon "dry run"`.

Finish with a one-screen summary: what's set up, where each file lives, and my daily routine.
````

## What your daily routine looks like afterwards
1. The scan report arrives on schedule. Reply `apply 1, 4` or `exclude 2 too senior`.
2. "apply" → Claude reserves the rows and writes one prompt per lane → open a new session per lane, connect the folder, paste.
3. In each lane session, review the tailored resume, answer any new questions, read the review page, press Submit.
4. Every 2 weeks: ask for the review ("run the review loop") and adjust lanes/titles/masters from the data.
