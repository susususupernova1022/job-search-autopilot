/* jd_scanner.js — in-page job board scanner (engine)
 *
 * How it is used
 * --------------
 * Claude pastes TWO files into Claude in Chrome's `javascript_tool`, in this order:
 *   1. scanner/scan_profile.js   (sets window.SCAN_PROFILE: titles, locations, knockouts — generated at setup)
 *   2. scanner/jd_scanner.js     (this file — generic, don't edit for personal preferences; defines window.runScan)
 * and ends the paste with:
 *
 *   await runScan({
 *     greenhouse: ["stripe", "affirm"],                 // board slugs (blocked companies already removed)
 *     ashby:      ["ramp", "plaid"],
 *     lever:      ["finix"],
 *     smartrecruiters: [{ slug: "ServiceNow", company: "ServiceNow" }],
 *     workday:    [{ tenant: "visa", host: "visa.wd5.myworkdayjobs.com", site: "Visa", company: "Visa" }],
 *                 // ⚠️ Workday only works when the tab is ALREADY on that host (same-origin). See daily scan prompt §1.5.
 *     appliedLooseKeys: [...],   // from tracker/tracker_state.py
 *     excludedKeys:     [...],
 *     maxSurvivors: 30,
 *     maxPerBoard:  6
 *   })
 *
 * Output: a plain string, one job per line, 9 pipe-separated columns:
 *   board|id|title|shortLoc|date|fresh|minYrs|flags|jdSummary
 * followed by footer lines:
 *   __STATS__|{json}   counts for every filter stage
 *   __LINKS__|{json}   full job URLs for Workday / SmartRecruiters (can't be rebuilt from board+id)
 *   __FAIL__|...       boards that failed to fetch — NEVER treat a failure as "no new jobs"
 *
 * Never return full URLs with query strings from javascript_tool: the output filter blocks the
 * whole result ("[BLOCKED: Cookie/query string data]"). Cheap-platform links are rebuilt later.
 *
 * Why these data sources: the public JSON boards return LIVE data. A server-side web fetch of the
 * same endpoints has been observed returning stale cached snapshots months old, so run this in a
 * real browser tab.
 */

(() => {
// Wrapped in an IIFE so it can be pasted into the same tab more than once (no "already declared" errors).
const W = typeof window !== "undefined" ? window : globalThis;

// ---------- profile (from scan_profile.js), with safe defaults ----------

const P = W.SCAN_PROFILE || {};

const DEFAULTS = {
  windowDays: 5,          // drop postings older than this
  freshDays: 2,           // mark FRESH at or under this
  flagYearsAtOrAbove: 7,  // add "requires N+ yrs" flag when JD minimum >= this
  knockouts: { noSponsorship: true, citizenshipOnly: true, clearance: true, peopleManagement: false },
  titleExclude: /\b(director|vp|vice president|head of|intern|new grad|engineer|scientist|designer|recruiter)\b/i,
  roleStrict: /(product manager|program manager|business operations|financial analyst|marketing manager)/i,
  roleNoun: /\b(manager|lead|analyst|associate|specialist)\b/i,
  laneWord: /\b(product|finance|strategy|operations|marketing)\b/i,
  priorityTitle: null,    // regex: titles that jump the queue (e.g. your core domain words)
  locInclude: /(California|,\s*CA\b|San Francisco|Los Angeles|Bay Area)/i,
  locIncludeAbbr: null,   // case-sensitive regex for airport-style codes, e.g. /\bSFO?\b|\bSEA\b/
  allowUsRemote: true,
  nonTargetUs: null,      // regex of US places outside your area — vetoes a "remote" flag on office-bound jobs
  backgroundTerms: [],    // e.g. ["investment banking","management consulting"] → flagged hard-req vs. plus
  backgroundLabel: "background",
  domainTerms: [],        // words that signal your domain; listed in flags
  boardToCompany: {},     // board slug → company name as written in your Tracker
  extraNoSponsor: [],     // extra phrases to treat as "no sponsorship"
};
const CFG = Object.assign({}, DEFAULTS, P, { knockouts: Object.assign({}, DEFAULTS.knockouts, P.knockouts || {}) });

// ---------- text helpers ----------

const plain = (s) => {
  if (!s) return "";
  const t = document.createElement("textarea");
  t.innerHTML = s; // decode HTML entities first (Greenhouse content is entity-encoded)
  const d = new DOMParser().parseFromString(t.value, "text/html");
  return (d.body.textContent || "").replace(/\s+/g, " ").trim();
};

// Must match norm() in tracker/tracker_state.py: lowercase, drop parentheses, legal suffixes, punctuation.
const LEGAL = /\b(inc|llc|ltd|limited|corp|corporation|co|company|holdings|technologies|technology|labs|group|plc|gmbh|pte|sa|nv|ag)\b/gi;
const norm = (s) =>
  String(s == null ? "" : s)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\w\s&+/-]/gu, " ")
    .replace(LEGAL, " ")
    .replace(/\s+/g, " ")
    .trim();

const clean = (s) => String(s || "").replace(/[|\n\r]+/g, " ").replace(/\s+/g, " ").trim();
const has = (text, terms) => terms.some((t) => text.includes(t));

// ---------- location ----------

/* Non-US places. Also checked against the TITLE: "Field Marketing Manager - France" often has
 * location "Remote", so the location field alone doesn't catch it. */
const FOREIGN = CFG.foreign || /(canada|toronto|vancouver|montreal|united kingdom|\bu\.?k\.?\b|london|poland|krakow|warsaw|ireland|dublin|india|bangalore|bengaluru|delhi|hyderabad|australia|sydney|melbourne|japan|tokyo|france|paris|germany|berlin|munich|netherlands|amsterdam|singapore|hong kong|china|shanghai|brazil|sao paulo|são paulo|mexico|spain|madrid|portugal|lisbon|israel|tel aviv|colombia|bogota|estonia|tallinn|costa rica|argentina|chile|peru|philippines|manila|vietnam|thailand|indonesia|malaysia|korea|seoul|taiwan|taipei|new zealand|sweden|stockholm|denmark|copenhagen|norway|oslo|finland|helsinki|switzerland|zurich|austria|vienna|belgium|brussels|czech|prague|romania|bucharest|bulgaria|sofia|ukraine|turkey|istanbul|\buae\b|dubai|abu dhabi|south africa|nigeria|kenya|egypt|italy|milan|rome|greece|athens|hungary|budapest|lithuania|vilnius|latvia|serbia|belgrade|croatia)/i;

const US_REMOTE = /(us[\s-]*remote|remote[\s-]*(in[\s-]*the[\s-]*)?(us|u\.s\.|usa|united states)|united states[\s-]*[-–]?[\s-]*remote|remote[\s-]*[-–,]?[\s-]*(usa|us)\b|nationwide)/i;
/* A specific state code ("New York, NY") means an office-bound job — don't trust a platform "remote" flag. */
const HAS_STATE_CODE = /,\s*[A-Z]{2}\b/;

function locOne(l, isRemote) {
  if (!l) return false;
  if (FOREIGN.test(l)) return false;
  if (CFG.locInclude && CFG.locInclude.test(l)) return true;
  if (CFG.locIncludeAbbr && CFG.locIncludeAbbr.test(l)) return true;
  if (CFG.allowUsRemote && US_REMOTE.test(l)) return true;
  // No anchor in your area but names another US city → veto, whatever isRemote says
  if (CFG.nonTargetUs && CFG.nonTargetUs.test(l)) return false;
  if (CFG.allowUsRemote && /remote/i.test(l)) return true;
  if (CFG.allowUsRemote && isRemote && !HAS_STATE_CODE.test(l)) return true;
  return false;
}

/* Multi-location jobs: judge each location separately; any pass = pass.
 * Joining them into one string lets a single foreign city veto the whole job
 * (real case: "New York, NY (HQ) / San Francisco, CA / Toronto, ON"). */
function locOK(locText, isRemote) {
  const parts = (Array.isArray(locText) ? locText : [locText])
    .flatMap((s) => String(s || "").split(/;|\|| and /i))
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.some((p) => locOne(p, isRemote));
}

// ---------- JD knockouts ----------

const NO_SPONSOR = [
  "will not sponsor", "does not sponsor", "do not sponsor", "cannot sponsor",
  "unable to sponsor", "not able to sponsor", "sponsorship is not available",
  "without sponsorship", "now or in the future require sponsorship",
  "now or in future require sponsorship", "without the need for current or future",
  "must be authorized to work in the united states without",
].concat(CFG.extraNoSponsor || []);
const CITIZEN_ONLY = [
  "citizenship required", "u.s. citizenship required", "us citizenship required",
  "must be a u.s. citizen", "must be a us citizen", "must be a united states citizen",
  "u.s. citizen only", "us citizen only", "only u.s. citizens", "only us citizens",
  "requires u.s. citizenship", "requires us citizenship",
];
// Export-control boilerplate often says "U.S. citizen, green card holder, or U.S. person" — not citizen-only.
const GREEN_CARD_OK = ["green card", "green-card", "permanent resident", "u.s. person", "us person"];
const CLEARANCE = ["security clearance", "secret clearance", "top secret", "ts/sci"];

function knockout(jdLower) {
  const k = CFG.knockouts;
  if (k.noSponsorship && has(jdLower, NO_SPONSOR)) return "no_sponsor";
  if (k.citizenshipOnly && has(jdLower, CITIZEN_ONLY) && !has(jdLower, GREEN_CARD_OK)) return "citizenship";
  if (k.clearance && has(jdLower, CLEARANCE)) return "clearance";
  return null;
}

/* People-management requirement (optional knockout: knockouts.peopleManagement = true).
 * Known false positives the regex avoids — re-test these if you edit it (scanner/tests):
 *   "We are hiring a Finance Manager…", "Use of AI in Our Hiring Process",
 *   "supervising system results", "manage the team's roadmap". */
const PEOPLE_MGMT = /(people manag|people leader|managing (a |an )?(high[- ]impact |cross[- ]functional )?team|manage (a |an |the )?team of|direct reports|manager of managers|player[- ]coach|experience (managing|leading) (teams|people|a team)|lead(ing)? (a|the) team of|coaching (employees|and develop)|supervis(e|ing) (a |the )?(team|people|staff|analysts)|grow(ing)? and scal(e|ing) (impact|the team)|hir(?:e|ing),?\s+(?:and\s+)?(?:develop|mentor|coach|grow)|lead\s+(?:an?|the)\s+(?:[\w-]+,?\s+){0,5}(?:high[- ]performing|engaged|inclusive)\s+team|\b(?:lead|leading|leads|manage|manages|managing|coach|coaches|coaching|mentor|mentors|mentoring|supervise|supervises|supervising)\b\s+(?:and\s+\w+\s+)?(?:an?|the)\s+(?:[\w-]+\s+){0,3}team\b(?!'s|s'))/gi;
/* HARD_NEG anywhere in JD → role explicitly has no reports → keep, flag "IC".
 * SOFT_NEG near a hit → management is a "plus" / IC context → keep, flag "check".
 * Neither → drop. */
const HARD_NEG = /(no direct reports|without direct reports|does not include people manag|do not include people manag|this role does not manage|not a people manag|non[- ]people[- ]manag)/i;
const SOFT_NEG = /(bonus points?|nice to have|is a plus|are a plus|would be a plus|a plus\b|preferred qualifications|preferred:|individual[- ]contributor)/i;

function peopleMgmtVerdict(jd) {
  PEOPLE_MGMT.lastIndex = 0;
  const hits = [];
  let m;
  while ((m = PEOPLE_MGMT.exec(jd)) !== null) hits.push(m);
  if (!hits.length) return null;
  if (HARD_NEG.test(jd)) return "ic";
  const allSoft = hits.every((h) => SOFT_NEG.test(jd.slice(Math.max(0, h.index - 110), h.index + h[0].length + 90)));
  return allSoft ? "soft" : "drop";
}

// ---------- JD annotations ----------

const YR_RE = /(\d{1,2})\s*\+?\s*(?:to|-|–|—)?\s*(\d{1,2})?\s*\+?\s*(?:years|yrs)/gi;
const PROSE_BEFORE = /(founded|for the past|over the last|in the last|spent|history of|anniversary|since)\W{0,20}$/i;
const AGO_AFTER = /^\s*ago\b/i;

/** Minimum years: smallest number followed within 80 chars by "experience".
 *  Deliberately the MINIMUM ("5+ overall, 3+ in payments" → 3): better to over-report than wrongly drop. */
function minYears(jd) {
  const out = [];
  YR_RE.lastIndex = 0;
  let m;
  while ((m = YR_RE.exec(jd)) !== null) {
    const tail = jd.slice(m.index + m[0].length, m.index + m[0].length + 80);
    if (!/experience/i.test(tail)) continue;
    if (AGO_AFTER.test(tail)) continue;
    if (PROSE_BEFORE.test(jd.slice(Math.max(0, m.index - 40), m.index))) continue;
    out.push(parseInt(m[1], 10));
  }
  return out.length ? Math.min(...out) : null;
}

function softFlags(jdLower) {
  const flags = [];
  for (const term of CFG.backgroundTerms || []) {
    const i = jdLower.indexOf(term);
    if (i === -1) continue;
    const ctx = jdLower.slice(Math.max(0, i - 120), i + term.length + 120);
    const L = CFG.backgroundLabel;
    if (/\b(required|must have|requirement)\b/.test(ctx)) flags.push(`⚠️${L}(required)`);
    else if (/\b(preferred|nice to have|a plus|bonus)\b/.test(ctx)) flags.push(`${L}(plus)`);
    else flags.push(L);
    break;
  }
  const domain = (CFG.domainTerms || []).filter((t) => jdLower.includes(t)).slice(0, 5);
  if (domain.length) flags.push("domain:" + domain.join("/"));
  return flags;
}

const REQ_HEAD = /(qualifications|requirements|what you.{0,5}ll need|what we.{0,5}re looking for|about you|you have|minimum qualifications|basic qualifications)/i;
function jdSummary(jd) {
  const m = jd.match(REQ_HEAD);
  if (m && m.index != null) return clean(jd.slice(m.index, m.index + 700));
  if (jd.length <= 700) return clean(jd);
  return clean(jd.slice(0, 350) + " … " + jd.slice(-350));
}

// ---------- title gate ----------

/** Pass = not excluded AND (strict role phrase OR (role noun AND lane word)).
 *  Returns sort tier: "A" if title matches priorityTitle, else "B". null = rejected.
 *  (Loose gates like "title contains payments" pull in sales/architect roles — keep it role-noun based.) */
function tierOf(title) {
  if (CFG.titleExclude && CFG.titleExclude.test(title)) return null;
  const pass = CFG.roleStrict.test(title) || (CFG.roleNoun.test(title) && CFG.laneWord.test(title));
  if (!pass) return null;
  return CFG.priorityTitle && CFG.priorityTitle.test(title) ? "A" : "B";
}

// ---------- platform helpers ----------

const companyOf = (board) => (CFG.boardToCompany || {})[board] || board;

/* Form-filling cost (not scan cost). Expensive = multi-step wizards. */
const COST_FLAG = { "wd:": "⚠️Expensive(Workday)", "ph:": "⚠️Expensive(Phenom)", "sr:": "Medium(SmartRecruiters)" };
const costFlagOf = (board) => COST_FLAG[String(board).slice(0, 3)] || "";

/* Workday list gives "Posted 3 Days Ago", not a timestamp. Unparseable → null → treated as "no date"
 * (kept, shown as "live"). Requires Accept-Language: en-US or you get localized strings. */
function postedOnToISO(text) {
  const t = String(text || "").toLowerCase();
  if (!t) return null;
  if (t.includes("today") || t.includes("just posted")) return new Date().toISOString();
  if (t.includes("yesterday")) return new Date(Date.now() - 864e5).toISOString();
  const m = t.match(/(\d+)\s*\+?\s*days?/);
  if (m) return new Date(Date.now() - Number(m[1]) * 864e5).toISOString();
  const w = t.match(/(\d+)\s*\+?\s*(?:weeks?|months?)/);
  if (w) return new Date(Date.now() - Number(w[1]) * (t.includes("month") ? 30 : 7) * 864e5).toISOString();
  return null;
}

// ---------- main ----------

async function runScan(cfg) {
  const now = Date.now();
  const FRESH_MS = CFG.freshDays * 864e5;
  const WINDOW_MS = CFG.windowDays * 864e5;
  const applied = new Set(cfg.appliedLooseKeys || []);
  const excluded = new Set(cfg.excludedKeys || []);
  const maxSurvivors = cfg.maxSurvivors || 30;

  const extraNames = {};
  for (const b of cfg.workday || []) extraNames["wd:" + b.tenant] = b.company || b.tenant;
  for (const b of cfg.smartrecruiters || []) extraNames["sr:" + b.slug] = b.company || b.slug;
  const nameOf = (board) => extraNames[board] || companyOf(board);

  const rows = [];
  const fails = [];
  const empty = [];   // boards that returned 200 with zero jobs — note, not failure
  const links = {};
  const stats = { fetched: 0, stale: 0, loc: 0, title: 0, no_sponsor: 0, citizenship: 0, clearance: 0, people_mgmt: 0, pm_ic: 0, pm_soft: 0, dup: 0, excluded: 0, jdFetch: 0 };

  /* Stage 1: cheap fields only. deferLoc = Workday "3 Locations" with no place names — decide after detail. */
  const stage1 = (board, id, title, locText, isRemote, tsRaw, deferLoc) => {
    stats.fetched++;
    // Lever createdAt is a NUMBER (epoch ms). Date.parse(number) = NaN → freshness silently skipped.
    const ts = tsRaw == null || tsRaw === ""
      ? NaN
      : (typeof tsRaw === "number" || /^\d+$/.test(String(tsRaw)) ? Number(tsRaw) : Date.parse(tsRaw));
    if (!isNaN(ts) && now - ts > WINDOW_MS) { stats.stale++; return null; }
    if (FOREIGN.test(title)) { stats.loc++; return null; }
    if (!deferLoc && !locOK(locText, isRemote)) { stats.loc++; return null; }
    const tier = tierOf(title);
    if (!tier) { stats.title++; return null; }
    const company = nameOf(board);
    if (applied.has(norm(company) + "|" + norm(title))) { stats.dup++; return null; }
    if (excluded.has(norm(company) + "|" + norm(title) + "|" + (norm(id) || "-"))) { stats.excluded++; return null; }
    return { board, id, title, locText, isRemote, ts, tier, deferLoc: !!deferLoc };
  };

  /* Stage 2+: full JD. */
  const stage2plus = (c, rawDesc) => {
    const jd = plain(rawDesc);
    const jdLower = jd.toLowerCase();
    const ko = knockout(jdLower);
    if (ko) { stats[ko]++; return; }
    const flags = softFlags(jdLower);
    if (CFG.knockouts.peopleManagement) {
      const pm = peopleMgmtVerdict(jd);
      if (pm === "drop") { stats.people_mgmt++; return; }
      if (pm === "ic") { stats.pm_ic++; flags.unshift("IC(no direct reports)"); }
      if (pm === "soft") { stats.pm_soft++; flags.unshift("⚠️people-mgmt: check"); }
    }
    const yrs = minYears(jd);
    if (yrs != null && yrs >= CFG.flagYearsAtOrAbove) flags.unshift(`requires ${yrs}+ yrs`);
    const cost = costFlagOf(c.board);
    if (cost) flags.unshift(cost);
    const fresh = !isNaN(c.ts) && now - c.ts <= FRESH_MS;
    rows.push({
      tier: c.tier,
      fresh,
      ts: isNaN(c.ts) ? 0 : c.ts,
      line: [
        c.board, c.id, clean(c.title), clean(String(c.locText || "")).slice(0, 40),
        isNaN(c.ts) ? "live" : new Date(c.ts).toISOString().slice(0, 10),
        fresh ? "FRESH" : "",
        yrs == null ? "?" : String(yrs),
        flags.join(";"),
        jdSummary(jd),
      ].join("|"),
    });
  };

  const pool = async (items, worker, size = 6) => {
    for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(worker));
  };

  /* Greenhouse: two-stage. The list call deliberately omits content=true (payload ~9x bigger).
   * Date = first_published, NOT updated_at: some boards refresh updated_at on every job daily, which made
   * one company's 300 stale jobs look "fresh" and crowd everything else out. */
  const ghPending = [];
  await pool(cfg.greenhouse || [], async (board) => {
    try {
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`, { cache: "no-store" });
      if (!r.ok) { fails.push(`greenhouse:${board}(HTTP ${r.status})`); return; }
      const j = await r.json();
      if (!(j.jobs || []).length) empty.push("greenhouse:" + board);
      for (const x of j.jobs || []) {
        const c = stage1(board, x.id, x.title, (x.location || {}).name, false, x.first_published || x.updated_at);
        if (c) ghPending.push(c);
      }
    } catch (e) { fails.push(`greenhouse:${board}(${e && e.name ? e.name : "error"})`); }
  });
  await pool(ghPending, async (c) => {
    try {
      stats.jdFetch++;
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${c.board}/jobs/${c.id}`, { cache: "no-store" });
      const d = await r.json();
      stage2plus(c, d.content);
    } catch (e) { fails.push(`gh-jd:${c.board}/${c.id}`); }
  });

  /* Ashby: list already has descriptionPlain. ALWAYS include secondaryLocations — the main location is often
   * just HQ ("New York, NY (HQ)") with the SF office hidden in secondaryLocations. */
  await pool(cfg.ashby || [], async (board) => {
    try {
      const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${board}`, { cache: "no-store" });
      if (!r.ok) { fails.push(`ashby:${board}(HTTP ${r.status})`); return; }
      const j = await r.json();
      if (!(j.jobs || []).length) empty.push("ashby:" + board);
      for (const x of j.jobs || []) {
        const locs = [x.location].concat((x.secondaryLocations || []).map((s) => s && s.location));
        const c = stage1(board, x.id, x.title, locs.filter(Boolean).join(" | "), !!x.isRemote, x.publishedAt);
        if (c) stage2plus(c, x.descriptionPlain || x.descriptionHtml);
      }
    } catch (e) { fails.push(`ashby:${board}(${e && e.name ? e.name : "error"})`); }
  });

  // Lever: list already has descriptionPlain.
  await pool(cfg.lever || [], async (board) => {
    try {
      const r = await fetch(`https://api.lever.co/v0/postings/${board}?mode=json`, { cache: "no-store" });
      if (!r.ok) { fails.push(`lever:${board}(HTTP ${r.status})`); return; }
      const j = await r.json();
      if (!Array.isArray(j) || !j.length) empty.push("lever:" + board);
      for (const x of Array.isArray(j) ? j : []) {
        const loc = (x.categories || {}).location || "";
        const isRemote = /remote/i.test(loc) || /remote/i.test(x.workplaceType || "");
        const c = stage1(board, x.id, x.text, loc, isRemote, x.createdAt);
        if (c) stage2plus(c, x.descriptionPlain || x.description);
      }
    } catch (e) { fails.push(`lever:${board}(${e && e.name ? e.name : "error"})`); }
  });

  /* Workday (expensive to APPLY, cheap to scan) — SAME-ORIGIN ONLY.
   * A cross-origin POST to *.myworkdayjobs.com triggers a CORS preflight and fails with TypeError for every
   * tenant, which looks exactly like "no new jobs". Navigate the tab to the tenant host first, then run
   * this with only that tenant. Pitfalls fixed here — don't undo:
   *  - Accept-Language en-US, or a non-English browser gets localized "Posted" strings and freshness breaks.
   *  - `total` is only real on page 1 (0 afterwards) — don't use it as a stop condition. Lists are newest
   *    first, so stop when a whole page is outside the window.
   *  - "3 Locations" → defer location check until the detail call returns real places. */
  const WD_HDR = { Accept: "application/json", "Accept-Language": "en-US" };
  const MULTI_LOC = /^\s*\d+\s+locations?\s*$/i;
  const wdPending = [];
  await pool(cfg.workday || [], async (b) => {
    const key = "wd:" + b.tenant;
    if (typeof location !== "undefined" && b.host && location.host !== b.host) {
      fails.push(`${key}(skipped: navigate to ${b.host} first)`);
      return;
    }
    try {
      const base = `/wday/cxs/${b.tenant}/${b.site}`;
      let seen = 0;
      for (let offset = 0; offset < (b.maxPages || 15) * 20; offset += 20) {
        const r = await fetch(`${base}/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...WD_HDR },
          body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: b.q || "" }),
          cache: "no-store",
        });
        if (!r.ok) { fails.push(`${key}(HTTP ${r.status})`); break; }
        const j = await r.json();
        const list = j.jobPostings || [];
        seen += list.length;
        let anyInWindow = false;
        for (const x of list) {
          // id = requisition number (matches what you record in the Tracker), not the URL path
          const id = (x.bulletFields || [])[0] || x.externalPath || "";
          const loc = x.locationsText || "";
          const iso = postedOnToISO(x.postedOn);
          const pts = iso ? Date.parse(iso) : NaN;
          if (isNaN(pts) || now - pts <= WINDOW_MS) anyInWindow = true;
          const c = stage1(key, id, x.title, loc, /remote/i.test(loc), iso, MULTI_LOC.test(loc));
          if (c) {
            c.wd = { base, path: x.externalPath };
            links[key + "|" + id] = `https://${b.host}/en-US/${b.site}${x.externalPath}`;
            wdPending.push(c);
          }
        }
        if (list.length < 20 || !anyInWindow) break;
      }
      if (!seen) empty.push(key);
    } catch (e) { fails.push(`${key}(${e && e.name ? e.name : "error"})`); }
  }, 3);
  await pool(wdPending, async (c) => {
    try {
      stats.jdFetch++;
      const r = await fetch(c.wd.base + c.wd.path, { headers: WD_HDR, cache: "no-store" });
      const d = await r.json();
      const info = d.jobPostingInfo || {};
      const locs = [info.location].concat(info.additionalLocations || []).filter(Boolean);
      if (locs.length) {
        c.locText = locs.join(" | ");
        if (c.deferLoc && !locOK(locs, /remote/i.test(c.locText))) { stats.loc++; return; }
      }
      const realTs = info.startDate ? Date.parse(info.startDate) : NaN; // real ISO date, better than "Posted N Days Ago"
      if (!isNaN(realTs)) {
        if (now - realTs > WINDOW_MS) { stats.stale++; return; }
        c.ts = realTs;
      }
      stage2plus(c, info.jobDescription || "");
    } catch (e) { fails.push(`wd-jd:${c.board}/${c.id}`); }
  }, 3);

  // SmartRecruiters (medium cost). Public postings API; JD needs a second call.
  const srPending = [];
  await pool(cfg.smartrecruiters || [], async (b) => {
    const key = "sr:" + b.slug;
    try {
      const r = await fetch(`https://api.smartrecruiters.com/v1/companies/${b.slug}/postings?limit=100`, { cache: "no-store" });
      if (!r.ok) { fails.push(`${key}(HTTP ${r.status})`); return; }
      const j = await r.json();
      if (!(j.content || []).length) empty.push(key);
      for (const x of j.content || []) {
        const loc = x.location || {};
        const locText = [loc.city, loc.region, loc.country].filter(Boolean).join(", ");
        const c = stage1(key, x.id, x.name, locText, !!loc.remote, x.releasedDate);
        if (c) { c.sr = b.slug; links[key + "|" + x.id] = `https://jobs.smartrecruiters.com/${b.slug}/${x.id}`; srPending.push(c); }
      }
    } catch (e) { fails.push(`${key}(${e && e.name ? e.name : "error"})`); }
  }, 3);
  await pool(srPending, async (c) => {
    try {
      stats.jdFetch++;
      const r = await fetch(`https://api.smartrecruiters.com/v1/companies/${c.sr}/postings/${c.id}`, { cache: "no-store" });
      const d = await r.json();
      const sec = ((d.jobAd || {}).sections) || {};
      stage2plus(c, [sec.jobDescription, sec.qualifications, sec.additionalInformation].map((x) => (x && x.text) || "").join("\n"));
    } catch (e) { fails.push(`sr-jd:${c.board}/${c.id}`); }
  }, 3);

  // Sort: fresh first → priority titles → newest.
  const order = { A: 0, B: 1 };
  rows.sort((a, b) => (b.fresh - a.fresh) || (order[a.tier] - order[b.tier]) || (b.ts - a.ts));
  /* Per-board cap: take each board's top N first, then backfill with overflow, so one noisy board
   * can't eat every slot. Total returned does not shrink. */
  const maxPerBoard = cfg.maxPerBoard || 6;
  const seenB = {};
  const primary = [], overflow = [];
  for (const r of rows) {
    const b = r.line.split("|")[0];
    seenB[b] = (seenB[b] || 0) + 1;
    (seenB[b] <= maxPerBoard ? primary : overflow).push(r);
  }
  const kept = primary.concat(overflow).slice(0, maxSurvivors);

  const out = kept.map((r) => r.line);
  out.push("__STATS__|" + JSON.stringify({ ...stats, survivors: rows.length, returned: kept.length, truncated: rows.length - kept.length, emptyBoards: empty }));
  const keptLinks = {};
  for (const r of kept) {
    const parts = r.line.split("|");
    const k = parts[0] + "|" + parts[1];
    if (links[k]) keptLinks[k] = links[k];
  }
  if (Object.keys(keptLinks).length) out.push("__LINKS__|" + JSON.stringify(keptLinks));
  out.push("__FAIL__|" + (fails.join(",") || "none"));
  return out.join("\n");
}

W.runScan = runScan;
// Pure functions exposed for scanner/tests/test_scanner.mjs
W.__jdScanner = { tierOf, locOK, knockout, peopleMgmtVerdict, minYears, softFlags, postedOnToISO, norm, CFG };
})();
