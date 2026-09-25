// End-to-end smoke test of runScan() with mocked board APIs (no network).
// Run: node scanner/tests/test_runscan_mock.mjs
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const scannerDir = path.resolve(dir, "..");
const day = 864e5;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * day).toISOString();

const JD_OK = "<p>About you: 4+ years of experience in payments product management. We sponsor visas.</p>";
const JD_NOSPON = "<p>Requirements: 3+ years of experience. We are unable to sponsor visas.</p>";

const routes = {
  "https://boards-api.greenhouse.io/v1/boards/acme/jobs": { jobs: [
    { id: 1, title: "Product Manager, Payments", location: { name: "San Francisco, CA" }, first_published: iso(1), updated_at: iso(0) },
    { id: 2, title: "Senior Financial Analyst", location: { name: "New York, NY" }, first_published: iso(1) },
    { id: 3, title: "Staff Engineer", location: { name: "San Francisco, CA" }, first_published: iso(1) },
    { id: 4, title: "Business Operations Manager", location: { name: "Remote - US" }, first_published: iso(30), updated_at: iso(0) },
    { id: 5, title: "Pricing Manager", location: { name: "Seattle, WA" }, first_published: iso(2) },
  ]},
  "https://boards-api.greenhouse.io/v1/boards/acme/jobs/1": { content: JD_OK },
  "https://boards-api.greenhouse.io/v1/boards/acme/jobs/5": { content: JD_NOSPON },
  "https://boards-api.greenhouse.io/v1/boards/emptyco/jobs": { jobs: [] },
  "https://api.ashbyhq.com/posting-api/job-board/beta": { jobs: [
    { id: "a1", title: "Product Operations Manager", location: "New York, NY (HQ)", secondaryLocations: [{ location: "San Francisco, CA" }], isRemote: false, publishedAt: iso(0), descriptionPlain: "What you'll need: 3+ years of experience." },
  ]},
  "https://api.lever.co/v0/postings/gamma?mode=json": [
    { id: "l1", text: "Partnerships Manager", categories: { location: "San Francisco, CA" }, createdAt: Date.now() - 400 * day, descriptionPlain: "old" },
    { id: "l2", text: "Strategy & Operations Manager", categories: { location: "Los Angeles, CA" }, createdAt: Date.now() - 1 * day, descriptionPlain: "You have 5+ years of experience." },
  ],
  "https://api.smartrecruiters.com/v1/companies/Delta/postings?limit=100": { content: [
    { id: "s1", name: "Marketing Manager", location: { city: "San Jose", region: "CA", country: "us" }, releasedDate: iso(1) },
  ]},
  "https://api.smartrecruiters.com/v1/companies/Delta/postings/s1": { jobAd: { sections: { jobDescription: { text: "Qualifications: 6+ years of experience" } } } },
};

const fetchMock = async (url, opts = {}) => {
  if (url === "https://boards-api.greenhouse.io/v1/boards/moved/jobs") return { ok: false, status: 404, json: async () => ({}) };
  if (!(url in routes)) throw new TypeError("Failed to fetch " + url);
  return { ok: true, status: 200, json: async () => routes[url] };
};

const ctx = {
  console, fetch: fetchMock,
  document: { createElement: () => { const o = { _h: "" }; Object.defineProperty(o, "innerHTML", { set(v) { this._h = v; } }); Object.defineProperty(o, "value", { get() { return this._h; } }); return o; } },
  DOMParser: class { parseFromString(s) { return { body: { textContent: s.replace(/<[^>]+>/g, " ") } }; } },
  location: { host: "example.com" },
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(scannerDir, "scan_profile.example.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(scannerDir, "jd_scanner.js"), "utf8"), ctx);

const out = await ctx.runScan({
  greenhouse: ["acme", "emptyco", "moved"], ashby: ["beta"], lever: ["gamma"],
  smartrecruiters: [{ slug: "Delta", company: "Delta" }],
  workday: [{ tenant: "visa", host: "visa.wd5.myworkdayjobs.com", site: "Visa", company: "Visa" }],
  appliedLooseKeys: [], excludedKeys: [],
});
console.log(out + "\n");

const lines = out.split("\n");
const jobs = lines.filter((l) => !l.startsWith("__"));
const stats = JSON.parse(lines.find((l) => l.startsWith("__STATS__")).slice(10));
const fail = lines.find((l) => l.startsWith("__FAIL__"));
let bad = 0;
const check = (name, cond) => { if (!cond) bad++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };
check("GH PM Payments kept, tier sorted first", jobs[0].startsWith("acme|1|Product Manager, Payments"));
check("GH uses first_published (stale job with fresh updated_at dropped)", !jobs.some((l) => l.startsWith("acme|4|")));
check("GH NY-only dropped", !jobs.some((l) => l.startsWith("acme|2|")));
check("GH no-sponsor JD dropped", !jobs.some((l) => l.startsWith("acme|5|")) && stats.no_sponsor === 1);
check("Ashby secondaryLocations rescues SF", jobs.some((l) => l.startsWith("beta|a1|")));
check("Lever epoch createdAt: 400-day-old job dropped", !jobs.some((l) => l.startsWith("gamma|l1|")));
check("Lever fresh job kept", jobs.some((l) => l.startsWith("gamma|l2|")));
check("SmartRecruiters kept with Medium cost flag", jobs.some((l) => l.startsWith("sr:Delta|s1|") && l.includes("Medium(SmartRecruiters)")));
check("SR link in __LINKS__", out.includes('"sr:Delta|s1":"https://jobs.smartrecruiters.com/Delta/s1"'));
check("404 board reported as failure", fail.includes("greenhouse:moved(HTTP 404)"));
check("Workday cross-origin reported as skipped, not silent", fail.includes("wd:visa(skipped"));
check("empty board noted separately", stats.emptyBoards.includes("greenhouse:emptyco"));
console.log(bad ? `\n${bad} FAILED` : "\nALL PASS");
process.exit(bad ? 1 : 0);
