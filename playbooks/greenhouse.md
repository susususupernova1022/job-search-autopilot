# Greenhouse

Cost: **cheap**. Single-page form. Read `_common.md` first.

## Getting to a fillable form
- Standalone: `job-boards.greenhouse.io/{board}/jobs/{id}` (or `boards.greenhouse.io/...`).
- Many companies redirect that URL to their own site and embed the form in a cross-origin iframe (you can't fill inside it). Also, on some standalone pages `read_page` only sees "Back to jobs / Apply".
- **Default: open the first-party embed URL directly** — it costs nothing and skips both problems:
  ```
  https://job-boards.greenhouse.io/embed/job_app?for={board}&token={job_id}
  ```
  Seen needed for: Stripe, Brex, Lyft, Coinbase, Payoneer, Samsara, Okta, BILL, Toast, Klaviyo, Databricks, Block, Vercel. Some embed pages need one click on "Apply" before the form renders.
- `{job_id}` is the number in the company listing URL or the `gh_jid=` parameter. Tip: a careers page with `gh_jid=` links means Greenhouse is behind it.
- Same title can exist in several cities with different IDs — list them all and pick the right location before taking the ID.
- Don't return `location.href` from JS (query string → blocked). Probe `document.title` and field counts instead.

## Fields
- Custom questions are `question_########` inputs; **IDs differ per posting**, even at the same company. Enumerate live:
  `[...document.querySelectorAll('input[id^="question_"],textarea[id^="question_"]')].map(e=>e.id+' :: '+(e.labels?.[0]?.innerText||'').slice(0,60))`
- Count real dropdowns: `document.querySelectorAll('[class*="select__control"]').length` — if it's lower than the number of "dropdown-looking" questions, some are free text.
- A question can be a dropdown at one company and free text at another ("How did you hear", conflict-of-interest questions).
- Some questions only appear after another is answered (e.g. Race appears after Hispanic/Latino = No; "Visa type" after sponsorship = Yes). Re-scan after answering.

## Dropdowns (react-select) — the main time sink
- `form_input` puts text in the box but **does not select** anything. The form then says "This field is required" at Submit.
- Reliable: click the control → read options → click the option. Type-to-filter + Enter is fine **only when one option remains**; with zero matches Enter can submit the form.
- Don't type a prefix + Enter on multi-option questions: "Yes" + Enter picked "Yes, I live here" instead of "Yes, I plan to relocate" — a false answer.
- Don't Down+Enter (skips the pre-highlighted first option). Months: typing "June" can land on "January"; open the list and click.
- Behaviour varies by board: some boards accept click-ref → type → Return reliably, others need screenshot clicks. Try the cheap way once, verify, then switch.
- Verify: `[...document.querySelectorAll('.select__container')].map(c=>(c.querySelector('label')?.innerText||'').slice(0,45)+' => '+(c.querySelector('.select__single-value')?.innerText||'(EMPTY)'))`
- Each selected value can appear twice in the DOM (live + a11y mirror) — not a double entry.

## Country fields — two vocabularies on one form
- Phone country (intl-tel-input): easiest is typing the phone as `+1 555 123 4567` into the phone field; the flag switches to +1. Otherwise open "Toggle flyout", type "United States", click "United States +1".
- Custom "country you reside in" questions often want **`US`** or **`USA`** ("United States" returns No options at some companies). Typing "US" can also match "Australia" — read the list.
- Address "Country" may list "United States Minor Outlying Islands" first.

## Education (controlled lists)
- School matches on a prefix with the list's own punctuation: "University of California - {Campus}" (hyphen), not the comma form. Type a distinctive fragment (the campus name) and pick.
- Schools abroad may be missing entirely — leave that education entry off the form (it's on the resume).
- Degree: prefer "Master of Business Administration (M.B.A.)" over generic "Master's Degree" when both exist.

## Attachments
- `#resume` / `#cover_letter` are real file inputs. Use `file_upload` on the ref from `find` (see `_common.md` for paths).
- Success = input disappears, filename chip appears. Check `document.body.innerText` for the filename.
- Replace: click the chip's remove (X) — sometimes only a screenshot click works — then re-`find` the new input.
- A Cover Letter field marked required (`*`) is the trigger to write one, regardless of company size.

## Plain text fields
`form_input` works. If one misbehaves, the native value setter + input/change events is fine for text inputs and textareas on same-origin pages (use `HTMLTextAreaElement.prototype` for textareas) — not for dropdowns.

## Company notes (public, may change)
- **Stripe:** Preferred First Name field; "countries you anticipate working in" is a checkbox list; remote question has two options.
- **Brex:** country question wants "USA"; data-processing consent option is literally "Consent"; relocation vs in-office questions have different option texts; has a former-employer (Capital One family) question.
- **Affirm:** sponsorship split into NOW and FUTURE; race is granular multi-select; standalone URL works without embed; privacy consent is implied by Submit.
- **Coinbase:** posted cap 3 applications / 6 months; AI-usage ladder question.
- **Block:** posted cap 9 active applications / 60 days; arbitration agreement (user ticks); legal-name e-signature fields.
- **Databricks:** three required short essays; sanctions checkbox pair ("None of the above" → "Not applicable").
- **Samsara / Okta / Braze:** multiple required consent dropdowns (user answers).

## Submit
Fill everything, verify, stop. The user clicks Submit. Confirmation usually redirects to `/confirmation` with "Thank you for applying…".
