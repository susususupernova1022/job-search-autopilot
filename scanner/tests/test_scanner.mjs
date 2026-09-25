// Regression tests for the scanner's pure functions. Run: node scanner/tests/test_scanner.mjs
// Uses scan_profile.js if present, otherwise scan_profile.example.js.
// Every case here is a real JD sentence or title that once caused a wrong keep/drop.
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const scannerDir = path.resolve(dir, "..");
const profileFile = fs.existsSync(path.join(scannerDir, "scan_profile.js")) ? "scan_profile.js" : "scan_profile.example.js";

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(scannerDir, profileFile), "utf8"), ctx);
// These tests assume the people-management knockout is on; force it so the cases are meaningful.
ctx.SCAN_PROFILE.knockouts = Object.assign({}, ctx.SCAN_PROFILE.knockouts, { peopleManagement: true });
vm.runInContext(fs.readFileSync(path.join(scannerDir, "jd_scanner.js"), "utf8"), ctx);
const S = ctx.__jdScanner;

let bad = 0, n = 0;
const check = (name, got, exp) => {
  n++;
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`);
};

console.log(`profile: ${profileFile}\n\n-- people management --`);
[
  ["IC stated", "This is an individual contributor-style role with no direct reports, reporting to the Head of Pricing.", "ic"],
  ["mgmt is a bonus", "Bonus points Familiarity with SQL or other data query tools People management or team lead experience is helpful.", "soft"],
  ["IC to start", "This is an individual contributor role to start, with a clear path to people management as the team grows.", "soft"],
  ["does not include", "It does not include people management or ownership of the broader content portfolio.", "ic"],
  ["leading a team is a plus", "5+ years of related experience; experience leading a team are a plus. You will…", "soft"],
  ["direct reports", "You will also directly manage and develop a team of 2-3 direct reports.", "drop"],
  ["3+ yrs people mgmt", "3+ years of People management and development experience required.", "drop"],
  ["manage a team of", "Lead and manage a team of 3 associates and sr associates.", "drop"],
  ["lead a team of PMs", "Mentor and lead a team of high impact product managers across surfaces.", "drop"],
  ["lead a team", "You will lead a team responsible for keeping money movement running smoothly across rails.", "drop"],
  ["hire/develop/lead", "Hire, develop and lead an inclusive, engaged, and high performing team.", "drop"],
  ["GUARD team's roadmap", "You will manage the team's roadmap and backlog across quarters.", null],
  ["GUARD support the team", "You will be supporting the operations team with data and reporting.", null],
  ["GUARD hiring a FM", "We are hiring a Finance Manager to join our growing team in San Francisco.", null],
  ["GUARD AI hiring", "Use of AI in Our Hiring Process: we may use automated tools to review applications.", null],
  ["GUARD supervising systems", "Responsible for supervising system results and escalating discrepancies to the deal desk.", null],
].forEach(([name, t, exp]) => check(name, S.peopleMgmtVerdict(t), exp));

console.log("\n-- sponsorship / citizenship knockouts --");
[
  ["no sponsor", "we are unable to sponsor visas for this role.", "no_sponsor"],
  ["buried no-sponsor", "must be authorized to work in the u.s. without the need for current or future employer sponsorship.", "no_sponsor"],
  ["citizen only", "applicants must be a u.s. citizen.", "citizenship"],
  ["export-control boilerplate", "must be a u.s. citizen, green card holder, or u.s. person.", null],
  ["clearance", "active secret clearance required.", "clearance"],
  ["clean", "we sponsor visas where needed.", null],
].forEach(([name, t, exp]) => check(name, S.knockout(t), exp));

console.log("\n-- years of experience --");
[
  ["min of two", "5+ years overall experience, 3+ years of payments experience", 3],
  ["narrative ignored", "Founded 12 years ago, we… 4+ years of experience in FP&A", 4],
  ["none", "Great team, great mission.", null],
].forEach(([name, t, exp]) => check(name, S.minYears(t), exp));

console.log("\n-- location (example profile: CA/WA + US remote) --");
[
  ["SF", "San Francisco, CA", true],
  ["multi incl SF", "New York, NY (HQ) | San Francisco, CA | Toronto, ON", true],
  ["NY only", "New York, NY", false],
  ["Toronto", "Toronto, Canada", false],
  ["US remote", "Remote - US", true],
  ["airport codes", "Chicago, SEA, SF, NYC, US-Remote", true],
].forEach(([name, loc, exp]) => check(name, S.locOK(loc, false), exp));
check("isRemote flag on NY office job", S.locOK("New York, NY", true), false);

console.log("\n-- title gate --");
[
  ["PM payments → A", "Product Manager, Payments", "A"],
  ["FP&A → B", "Senior Financial Analyst, FP&A", "B"],
  ["Chief of Staff survives 'staff'", "Chief of Staff, Operations", "B"],
  ["Staff Engineer out", "Staff Engineer, Payments", null],
  ["architect out", "Solutions Architect - Financial Services (Banking and Payments)", null],
  ["sales leader out", "Cyber Security GTM Leader", null],
  ["Director out", "Director, Product Marketing", null],
].forEach(([name, t, exp]) => check(name, S.tierOf(t), exp));

console.log("\n-- Workday relative dates --");
check("today parses", S.postedOnToISO("Posted Today") !== null, true);
check("30+ days parses", S.postedOnToISO("Posted 30+ Days Ago") !== null, true);
check("localized string → null (why Accept-Language en-US matters)", S.postedOnToISO("今天刊登"), null);

console.log(bad ? `\n${bad}/${n} FAILED` : `\nALL ${n} PASS`);
process.exit(bad ? 1 : 0);
