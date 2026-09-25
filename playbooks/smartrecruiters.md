# SmartRecruiters

Cost: **medium-to-expensive** in practice (~100 tool calls for one application). Skip borderline fits. Read `_common.md` first.

## Getting to the form
The job page's "I'm interested" is a link, and `/apply` doesn't work. Read its href:
`https://jobs.smartrecruiters.com/oneclick-ui/company/{Company}/publication/{uuid}?dcr_ci={Company}` — the publication uuid is not the job id.

## The form lives in Shadow DOM
Inputs are inside `SPL-*` web components. `querySelectorAll`, `read_page`, `find` and `form_input` can't reach them.
Real clicks + typing are the main method.

Map all fields (read-only):
```js
function walk(root,out){root.querySelectorAll('*').forEach(e=>{
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)){const lab=(e.labels&&e.labels[0]?e.labels[0].textContent:'')||e.getAttribute('aria-label')||e.name||e.placeholder||e.id;
    out.push(e.tagName+'['+(e.type||'')+'] '+String(lab).trim().slice(0,60))}
  if(e.shadowRoot)walk(e.shadowRoot,out)});return out}
walk(document,[]).join(' ~~ ')
```

## Resume upload: proxy input
1. Create a visible light-DOM `<input type=file id="proxy_resume_input" aria-label="Proxy resume upload helper">`.
2. `find` it → `file_upload` the staged path.
3. Copy the file into the shadow inputs with `DataTransfer` and dispatch `input`/`change` with `{bubbles:true, composed:true}` (composed is what crosses the shadow boundary). Remove the proxy.
Usually two file inputs: the top one parses the resume into the form, the lower one is the attachment — dispatch to both. `files.length` reading 0 afterwards is normal.

## Parser defects to fix
Merged sub-role dates (a misstatement — must fix), a multi-role title collapsed into the newest one, missing company on sub-roles, bullets glued together, ALL-CAPS companies. **Upload clears Confirm email / LinkedIn / Website — refill them.**
Edit via the pencil icon on each entry → Save.

## Controlled fields
Company and Title are autocompletes: if you don't click a suggestion, the value is discarded on blur. Pick the correctly named option even if its capitalization is ugly; use the same option for all sub-roles of one employer.
Dates are pickers: typing shows a value but the picker keeps the old one — navigate to the month and click it.

## ⏰ Idle timeout wipes everything
After a few idle minutes the form closes ("session expired") and reopening resets all fields and attachments.
**Ask every screening question before opening the form**, then fill in one go.

## Other
- Conditional follow-ups push everything down ~110 px — re-screenshot after each Yes/No.
- The "Message to the Hiring Team" textarea counts as a cover letter slot (text route, ≤ 400 words).
- Two steps: main form → Next → preliminary questions → Submit (user). Success URL ends in `/success`.
