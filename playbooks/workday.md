# Workday (`*.myworkdayjobs.com`)

Cost: **expensive** — follow the expensive-platform rule in your Master Instruction. Account creation, login, email verification and Submit are the user's.
Read `_common.md` first. **Tenants differ**: a trick verified on one tenant can break another. Try the least destructive method first.

## Finding the job
- With a requisition number, skip the company's careers front end:
  `https://{tenant}.wdN.myworkdayjobs.com/en-US/{site}?q={req number}` → one result.
- Careers front ends sometimes say "no longer available" for jobs that are live on Workday. Always re-check on the tenant.
- Get `{tenant}`/`{site}` once from any Apply click and record it in Target_Companies. Guessing a tenant lands on a fake "maintenance" page.
- Don't build job URLs from the title; take the href from search results (slug text can differ from the current title).
- ⚠️ A slug whose words don't match the current title = the req was renamed. Check your Tracker before applying (it may be one you already interviewed for).
- The Apply button may be an `<a>`; navigating straight to `{job_url}/apply` is fastest.

## Three entry paths
| Path | Steps | Notes |
|---|---|---|
| Autofill with Resume | 7 | Upload a **.docx** for a clean parse; swap to PDF later |
| Apply Manually | 6 | Work history empty |
| **Use My Last Application** | 6 | Fastest on a tenant you've used: carries My Information, history, education, links, old attachments. Does NOT carry "How did you hear" or Application Questions. ⚠️ Descriptions are from the LAST lane — rewrite them. On some tenants it imports history 2–3 times over; delete down to the right count first. |

Typical steps: My Information → My Experience → Application Questions → Voluntary Disclosures → Self Identify (CC-305) → Review.

## Golden rules
1. One snapshot per step; before "Save and Continue" verify every required field in one read.
2. After Save fails, search page text for **"Errors Found"** — some errors (e.g. an invalid LinkedIn URL) appear only there, not next to the field.
3. Finish a Workday form in one sitting. Idle drafts start throwing page errors that no fix clears; restarting is cheaper.
4. Only "Save and Continue" persists a step. A draft resumed in a new session loses unsaved steps.
5. Going **Back** from Review re-runs steps and on some tenants drops data (see My Experience). Fix everything before moving forward.

## Field methods (see `_common.md` table for the general rule)
- Text / textarea: `form_input` by ref. Some stubborn fields (Address Line 1, visa textareas on some tenants) only take **real typing**: click the field → select all → type. Don't try a third JS method.
- Standard listbox dropdowns: on many tenants JS works — click the button, then click the option inside **that button's own** listbox (`document.getElementById(btn.getAttribute('aria-controls'))`). Max ~2 dropdowns per JS call (45 s timeout). On other tenants JS clicks break the page ("Something went wrong") — use real clicks there.
- Radios (e.g. "previously worked here"): real click; `form_input` looks set but doesn't persist on some tenants.
- "I have a preferred name": call the checkbox's own `.click()` so the extra fields render (setting `checked` doesn't).
- Dates: focus the spinbutton (JS `focus()` is OK) and type `MMYYYY` on the real keyboard. Tick "I currently work here" first (it removes To fields and shifts indexes).
- Buttons in the fixed footer (Save and Continue) can ignore JS clicks silently on some tenants — scroll, screenshot, real-click.
- End each typed field with Tab before Save, or the last value may not be sent.

## Search-type fields (Skills, Field of Study, School, Location, "How did you hear")
Six-step loop: **click box → type → Enter → pick the row → clear the box (X) → click the box again.**
- No Enter = "No Items." forever. That's not a broken search.
- The box does NOT clear itself; the next term gets glued to the old one and still returns plausible wrong results.
- Each chip pushes the box down ~35–42 px — re-screenshot every time. Some tenants flip the results panel above the box after ~9 chips.
- If you see the unfiltered A–Z list after Enter, Enter will pick the highlighted first row (e.g. "Accounting"). Check for "Search Results (N)" first.
- Some tenants use checkbox multi-select (tick several per search), others single chips.
- Controlled vocabulary — type the shortest term, read what exists: SQL → "Structured Query Language (SQL)"; Tableau → "Tableau (Software)"; Excel → "Microsoft Excel"; Power BI → "Microsoft Power Business Intelligence (PBI)"; Month-end close → "Monthly Close Process"; Financial Reporting → "Financial Reports".
- Usually max 10 skills. Replace the parser's generic suggestions with JD terms you can defend.
- "How did you hear" is often a **multi-level menu** (parent → child) — real clicks; confirm "1 item selected".
- Verify the final skills list from page text (after "Type to Add Skills"), expanding "MORE (N)" on Review.

## My Experience — parser cleanup
1. **Count entries first.** Sub-roles become an empty "parent" plus children without a company. Typical: 9-entry resume → 11–12 entries. Delete empty parents **bottom-up**. The first entry usually has no Delete button — rewrite it instead.
2. A title line like `Title A (dates) / Title B (dates)` gets split badly (one title lands in the Company field). Rebuild those entries.
3. Children lose company/location when parents are deleted — fill them.
4. ALL-CAPS names → Title Case. Legal Last Name may be forced back to caps by the account; if so, report it and move on.
5. Descriptions: `form_input` by ref, `• ` bullets, one per line. Refs within one entry are evenly spaced — find two, predict the rest, fill with one batch.
6. ⚠️ **Company-name linking:** typing a name that matches Workday's company dictionary can link it, and on one tenant that link made Save drop every other entry. Use the full legal name (e.g. "Bank Name (Country) Ltd.") if entries disappear.
7. ⚠️ On some tenants Save keeps only entries that were added or actually changed in that save; untouched ones vanish. Do all history edits in one pass; after Save, count entries on Review.
8. Newly added entries ("Add Another"): `form_input` may not register — focus + real typing + Tab.

## Education
- "Do not use abbreviations" → full school names.
- School may be a typeahead (injection picks the wrong campus — clear chip, type, Enter, verify) or plain text.
- Degree lists vary: ISCED-coded, "MBA or Equivalent", or no BBA (use BA). Curly apostrophes in option text.

## Attachments
- Resume input often allows **multiple** files — upload resume + cover letter to the same input when there's no separate cover letter field (check `input.multiple`).
- Upload new files, wait ~30 s, then delete old ones (trash icon may need a real click). Review must show only PDFs.
- No upload slot for a cover letter and single-file input → merging resume + letter into one PDF is an option; ask first.

## Application Questions
- Conditional chains: answering sponsorship = Yes can reveal visa type → STEM eligibility → work permit dates → more. Set one, re-read, continue. Indexes shift — match questions by label, not position.
- Formatted answers ("Format: MM/DD/YYYY to MM/DD/YYYY") must match exactly.
- Consent questions may be Opt-In / Opt-Out.
- Salary may be a textarea, base vs total, required vs optional — optional ones can stay blank.
- AI-conduct pledges, NDA-bundled terms, image-rights consents: user decides.

## Voluntary Disclosures / Self Identify
Decline wording differs per field ("Not Declared", "Prefer Not To Disclose", "I DO NOT WISH TO SELF-IDENTIFY", "I do not want to answer"). CC-305: the checkbox sometimes only registers when you click its **text**; date typed as `MMDDYYYY`.

## After submit
Submit date = what the candidate home ("My Applications") shows. Log that.

## Tab management
If the user already filled a tab outside Claude's tab group, ask them to drag it into the group rather than refilling. Don't close tabs in the group afterwards.

## Known tenant notes (public, may change)
- **Salesforce:** JD asks candidates to apply to max 3 roles per 12 months; "unrestricted right to work" defined as no expiring permit.
- **Expedia:** 5 applications / 45 days; reqs show a closing date; dropdown JS clicks crash the step — real clicks only; LinkedIn URL must be `https://www.linkedin.com/in/...`.
- **PayPal:** footer buttons need real clicks; "How did you hear" row needs a real click on the row; can post dozens of reqs at once.
- **Visa:** listbox JS works with aria-controls; skills search needs a real click on the row.
- **Adobe:** direct Workday apply; typing a dictionary company name can drop other entries on Save.
