# Avature (`{company}.avature.net/.../JobApplication?pipelineId=…`)

Cost: **medium** — three steps, `javascript_tool` works, refs only for the visible viewport (scroll + re-read). Read `_common.md` first.

## Step 1 — resume upload (the trap)
The "My Computer" option is an anchor that opens the native dialog. The real input (e.g. `#resumeFile`) sits in a fieldset hidden with `display:none`.
1. `find` the file input → `file_upload` the staged PDF (it attaches even while hidden).
2. Show the fieldset (`style.display='block'`).
3. Real-click the **Continue** inside that fieldset.
Clicking Continue while it's hidden shows a misleading "username or password may be incorrect" banner — it belongs to the login form on the same page; ignore it.

## Step 2 — "Register" (personal info + history + account)
- ⚠️ This page **creates an account** (password fields at the bottom): fill everything else; password + final submit are the user's.
- Parser: good on names/address/dates; bad on ALL-CAPS employers, collapsed sub-roles (rebuild with ADD ANOTHER), mostly-empty education, "Current position?" left blank.
- School and "Areas of interest" are typeahead widgets whose `<select>` is empty until you type — click, type, wait, pick. "Areas of interest" is required, multi-select.
- Consent block: talent community, SMS, privacy policy (user ticks).

## Step 3 — EEO
Not yet documented — add notes here after your first run.
