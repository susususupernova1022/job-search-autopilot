# Phenom (company-hosted career sites, e.g. `careers.{company}.com/.../apply?...&stepname=...`)

Cost: **expensive**. Treat like Workday (expensive-platform rule in your Master Instruction). Read `_common.md` first.

## Identify it
Apply URLs carry `jobSeqNo=…&step=N&stepname=…`. Phenom is often only a front end — the ATS of record may be Workday (the confirmation email comes from Workday). Then status, the candidate account and re-applying all live in Workday; logging into that Workday account first makes the application attach to your profile. If a req sends you straight to `*.myworkdayjobs.com`, use `workday.md` instead.

## Tool limits (observed on one large employer — confirm on others)
| Tool | Works? |
|---|---|
| `javascript_tool` | Blocked (`[BLOCKED: …]`) — no JS field dumps |
| page text | Labels only, no values; dumps huge `<select>` lists (expensive — don't re-read) |
| `read_page` | Refs without values; truncates on big steps |
| `find` | Yes — best way to get a ref (incl. hidden file input) |
| `file_upload` | Yes, on the ref from `find` |
| Screenshots | The only way to see values → scroll + screenshot is the verification loop |

## Parser defects
Bullets collapsed into one paragraph (rewrite as `• ` lines), `City, , Country`, ALL-CAPS companies, sub-roles merged or dropped (check the entry count).

## Fields seen
Degree select without "MBA" (use Masters); Field of Study is a ~400-option select; School typeahead with an "Other" fallback; Websites may be required and need an `http(s)://` prefix. Check every step and any generic Attachments uploader for a cover-letter slot before deciding there is none.
