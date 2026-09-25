# Pinpoint (`{company}.pinpointhq.com/en/postings/{uuid}/applications/new`)

Cost: **cheap** — one page, no login. Read `_common.md` first.

- Often reached through a job-board front end like CareerPuck (`app.careerpuck.com/job-board/...`), which is a SPA: page text may be empty — read `document.body.innerText` with JS. Its "Start application" button navigates away; don't sleep in the same JS call (navigation aborts it).
- Required: first/last name, email, phone (country defaults to +1). `form_input` works for all text fields.
- `cv` file input (upload it even if optional), optional `summary` textarea with no length limit, ~10 optional equality-monitoring dropdowns, one required data-processing consent (user ticks).
- Equality-monitoring dropdowns are custom widgets over a hidden `<select>`; setting either doesn't reliably sync. They're optional — leave them for the user.
- There's usually no cover letter field and no structured history. The **summary** box is the only place to speak for yourself: offer to draft it (specific company observation + recent news → what you'd do → proof from 2–3 roles → positive close) and show it before submitting.
- Verify with one JS read of each field's `.value`, `cv.files.length` and the consent `checked`.
