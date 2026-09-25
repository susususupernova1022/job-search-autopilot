# Cross-platform form-filling rules

Read once per Mode B session before the platform playbook. These were learned the expensive way across
~150 real applications on Greenhouse, Workday, Ashby, SmartRecruiters, Phenom, Avature, Pinpoint and LinkedIn.

## The one idea behind everything
ATS forms are React apps that keep their own state and only trust **real user edit events**.
"The screen shows the value" and "the form stored the value" are different things. Always verify the stored value.

## Tool choice by field type

| Field | Reliable method | Don't |
|---|---|---|
| Text input / textarea | `form_input` by ref | Batch-set with `javascript_tool` (React reverts it, sometimes only after you Save or the session reconnects) |
| Custom dropdown / combobox (react-select, Workday listbox) | Real click → read the option list → click the option. Or type a short filter + Enter **only when exactly one option is left** | `form_input` (fills the search box, commits nothing); Down+Enter (first option is pre-highlighted, Down skips it); Enter with 0 matches (can submit the whole form) |
| Radio / checkbox / Yes-No buttons | Real click (sometimes on the text label, not the box) | Setting `.checked` in JS |
| Typeahead that needs a search (Workday Skills, Field of Study, Location) | Click → type → **Enter** → pick the row → clear the box → next | Waiting for suggestions without pressing Enter ("No Items." just means you didn't press Enter) |
| Date spinbuttons | Focus the month segment, type `MMYYYY` on the real keyboard | JS value setting |
| Phone with country flag (intl-tel-input) | Type the number with `+1…` into the phone field — the flag sets itself | Fighting the flag dropdown |
| File input | See "File upload" below | Clicking a visible Attach/Upload button (opens the native file dialog, which can't be driven) |

## Finding refs
- `read_page` often returns only what's in the viewport (and on some Greenhouse pages only 3 elements). Use `find` with a plain-language query ("all application form inputs, selects and buttons") — it returns refs anywhere on the page, including hidden file inputs.
- Refs change after the DOM re-renders (e.g. after removing an attachment). Re-`find`, don't reuse.
- Shadow DOM (SmartRecruiters) hides inputs from `find`/`read_page` entirely — see that playbook.

## Coordinates
- `computer` coordinates are **screenshot pixels**, not viewport pixels. `getBoundingClientRect()` × (screenshot width / `innerWidth`) if you must convert.
- Anything that changes layout (adding a chip, answering a question that reveals another, a cookie banner) moves everything below it. **Re-screenshot before every click** that follows a change.
- For small targets (checkboxes, date segments), take a full-resolution screenshot; scaled ones are off by more than the element's height.
- If a screenshot looks tiled/duplicated or the window is 0×0, stop using coordinates: switch to refs, and ask the user to bring the Chrome window to the front (minimized window → clicks/typing silently fail; `form_input` still works).

## Verifying (before every Next/Save and before Submit)
- Plain inputs: read `.value` in one read-only JS call, or page text.
- react-select: count/read `[class*="single-value"]` (committed values) — `input.value` is empty even when filled. A committed field usually shows a small × clear button.
- Workday: page text around the field ("1 item selected" vs "0 items selected"); some wrapper inputs are always empty — don't "fix" them.
- `javascript_tool` output containing an email or a URL with a query string gets replaced by `[BLOCKED: …]`. Read selects and text fields in separate calls, or strip `?&=`.
- Forms can silently reset (tab reloaded, backgrounded, idle timeout). Do a full dump + attachment check right before handing over for Submit — never rely on "I filled that earlier".

## File upload (in this order)
1. **`file_upload` with a path the session can read.** A path on the user's computer is usually rejected with *"only files this session is allowed to read can be uploaded"* — even when the folder is connected. Stage/copy the file into the session first (the tool that copies files from the connected computer into the session), then pass the **staged path**. Costs ~0 tokens. Verified on Greenhouse, Workday, Ashby, LinkedIn.
2. If the error says **"file_upload is unavailable here"**, that session can't upload at all — don't retry other paths. Ask the user to click Attach and tell them the exact file name and folder.
3. Only when the user is away: base64 DataTransfer injection with `tools/make_upload_js.py` (~20k tokens for a 1-page PDF). Probe with a 9-byte dummy first. Never print the payload twice.

After upload: the file input often **disappears from the DOM** and a filename chip appears — that's success, not failure. `files.length` may read 0 afterwards for the same reason. Check for the filename in page text.
Replacing a file: upload the new one first (if the field allows multiple), then delete the old one; re-`find` refs after each delete. Delete toasts sometimes name the wrong file — trust the file list.

## Parsed-resume cleanup (Workday, Phenom, SmartRecruiters, Avature, Ashby autofill)
1. Fix the **number of entries** first (sub-roles merged or duplicated as empty "parent" entries), then field contents, then description formatting. Delete extra entries bottom-up so refs don't shift.
2. ALL-CAPS names/companies → Title Case, keeping real acronyms.
3. `City, , Country` → `City, Country`.
4. Merged sub-role dates → fix; they'd be a misstatement.
5. Descriptions: one bullet per line, each starting with `• `.
6. Parsers can overwrite fields you already filled (Ashby location). Upload first, fill after, verify at the end.
7. Workday parses a **.docx** far more cleanly than a PDF. Autofill from docx, then swap the attachment to the PDF before review (and check the extension on the review page).

## Answers
- "How did you hear about us": the company careers site option by default.
- Option wording varies by company (Female/Woman, "I am not a protected veteran"/"I AM NOT A VETERAN", "US"/"United States"/"USA"). Type the shortest distinctive fragment, then read the list.
- Relocation and in-office questions on the same form use different option wording — answer each on its own.
- Legal/consent boxes, e-signatures, arbitration, NDA-bundled T&C, AI-conduct pledges → the user ticks.

## Session hygiene
- Long single-page forms: fill and hand over for Submit in one go. A backgrounded tab can be frozen and lose everything; SmartRecruiters and Workday drafts expire when idle.
- Ask the user every judgment question **before** opening a timeout-prone form.
- Don't close tabs in Claude's tab group if the user dragged their own tab into it — closing can dissolve the group.
- After a platform error, screenshot and think before reloading; a reload has cost a logged-in session.
- A JS call that times out (~45 s) may still have run. Check state before re-running (re-running can toggle things back).
