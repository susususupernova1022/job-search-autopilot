# Ashby (`jobs.ashbyhq.com`)

Cost: **cheap**. Single-page React form. Read `_common.md` first.

## Basics
- Job: `https://jobs.ashbyhq.com/{board}/{job_id}` → form at the same URL + `/application` (keep any `?locationId=`).
- Board JSON: `https://api.ashbyhq.com/posting-api/job-board/{board}` (add `?includeCompensation=true` for pay). Each job has `descriptionPlain`, `location`, **`secondaryLocations`** (the main location is often just HQ), `isRemote`, `publishedAt`.
- If the in-page fetch fails from the job page (CORS), just read the JD with page text.

## Traps
1. **Two file inputs** on many forms: the top "Autofill from resume" one parses and **overwrites** fields you've filled; the real Resume field is lower (`_systemfield_resume`). Upload to the Resume field only.
2. **Location comboboxes** are search-type: type ("San Diego, California"), wait ~2–3 s, then real-click the suggestion. Typing alone selects nothing. Some companies use a plain text field instead — check.
3. **Yes/No are `<button>`s**, not radios. Real click (ref clicks can hit a hidden input and do nothing). Selected state = a class containing `active`.
4. Some radio groups report checked only by id suffix (`-radio-0/1/2`), not label text.
5. Answering sponsorship = Yes can reveal a required "Visa type" text field.
6. hCaptcha / reCAPTCHA may appear at the bottom — the user solves challenges.
7. Backgrounded Ashby tabs can be frozen by Chrome and come back empty — fill and hand over for Submit straight away.

## Verify in one call
```js
({
  yesno: [...document.querySelectorAll('button')].filter(b=>/^(yes|no)$/i.test(b.innerText.trim())).map(b=>b.innerText.trim()+(/active/i.test(b.className)?'*':'')),
  radios: [...document.querySelectorAll('input[type=radio]')].filter(e=>e.checked).map(e=>e.id),
  checks: [...document.querySelectorAll('input[type=checkbox]')].map(e=>e.checked),
  files: [...document.querySelectorAll('input[type=file]')].map(e=>e.files[0]?.name ?? '(none)')
})
```
(`*` = selected.)

## Company caps (posted policies, may change)
- **Ramp:** 1 application per 100 days, company-wide. Enforced only at final Submit — check the Tracker before tailoring.
- **Persona:** 2 applications per 60 days; same role not within 180 days.
- **Plaid / Airwallex:** 3 applications per rolling window (60–90 days).
- Put these in the Tracker's Company_Quota sheet so the scan skips capped companies.

## Company notes
- **Vanta:** JDs have carried "authorized to work … without the need for current or future employer sponsorship" inside a bullet list, not under Requirements.
- **Snowflake / Zip / Sentry:** in-office-days and relocation questions can be knockouts — decide before opening the form.
- **Marqeta:** moved from Greenhouse to Ashby (board `marqeta-inc`); very short form.
- **Whatnot:** the careers list is its own page, but Apply goes to Ashby.
