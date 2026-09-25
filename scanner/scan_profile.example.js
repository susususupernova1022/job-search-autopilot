/* scan_profile.js — YOUR filters for the daily scan.
 *
 * Copy this file to scanner/scan_profile.js (gitignored) and edit, or let the setup prompt generate it.
 * Claude pastes this file BEFORE jd_scanner.js. Tune filters here, never in the engine or the prompt.
 *
 * This example is set up for someone targeting Product / Finance / Strategy & Ops / Product Marketing roles
 * in California and Washington, with fintech/payments as the core domain, who needs visa sponsorship
 * and wants to skip people-manager roles. Change every section to match your own search.
 */
window.SCAN_PROFILE = {
  // ---- freshness ----
  windowDays: 5,           // ignore postings older than this
  freshDays: 2,            // label FRESH at or under this
  flagYearsAtOrAbove: 7,   // flag "requires N+ yrs" when the JD minimum is at/above this

  // ---- JD knockouts: matching jobs are DROPPED silently (counted in __STATS__) ----
  knockouts: {
    noSponsorship: true,     // "will not sponsor", "without the need for ... sponsorship" … — set false if you don't need a visa
    citizenshipOnly: true,   // "must be a U.S. citizen" (but not "citizen, green card holder or U.S. person")
    clearance: true,         // security clearance
    peopleManagement: true,  // "manage a team of", "direct reports" … — false if you're fine managing people
  },
  extraNoSponsor: [],        // add phrases you see in the wild that slipped through

  // ---- title gate ----
  // Pass = NOT titleExclude AND (roleStrict OR (roleNoun AND laneWord)).
  // Note the negative lookbehind so "Chief of Staff" survives the "staff" (Staff Engineer) exclusion.
  titleExclude: /\b(director|vp|vice president|head of|(?<!chief of )staff|principal|intern|new grad|university|phd|engineer|engineering|scientist|designer|counsel|recruiter|sales development|account executive|support|business development|account manager|key account|solutions? architect|architect|sales engineer|customer success|technical account|leader|controller|accountant|auditor|payroll)\b/i,
  roleStrict: /(product manager|product owner|product lead|product operations|product delivery|product marketing|product strategy|program manager|business operations|biz ?ops|revenue operations|rev ?ops|gtm operations|go-to-market operations|marketing operations|growth manager|growth marketing|lifecycle marketing|marketing manager|partnerships? manager|financial analyst|finance analyst|fp&a|finance business partner|finance manager|strategic finance|strategy (?:&|and) operations|strategy manager|strategy analyst|business analyst|pricing analyst|pricing manager|operations manager|operations analyst|chief of staff|ai enablement|ai operations)/i,
  roleNoun: /\b(manager|lead|analyst|associate|owner|strategist|specialist)\b/i,
  laneWord: /\b(product|payments?|card|issuing|partnerships?|gtm|go-to-market|revenue|finance|financial|fp&a|strategy|strategic|operations|marketing|pricing|bizops|growth)\b/i,
  // Titles containing these jump the sort order (your core domain). null to disable.
  priorityTitle: /(payment|card|issuing|interchange|acquiring|ledger|fintech|merchant|\bbank|credit|money|billing|wallet)/i,

  // ---- location ----
  locInclude: /California|,\s*CA\b|San Francisco|Los Angeles|Palo Alto|Menlo Park|Culver City|Sunnyvale|Mountain View|San Mateo|San Jose|Oakland|San Diego|Irvine|Seattle|Bellevue|Redmond|,\s*WA\b|Washington State|Bay Area/i,
  locIncludeAbbr: /\bSFO?\b|\bSEA\b/,   // case-sensitive airport codes some boards use ("SF, NYC, US-Remote")
  allowUsRemote: true,                 // accept US-remote postings
  // US places OUTSIDE your area. Used to veto a platform "isRemote" flag on office-bound jobs
  // (seen: Ashby marks "New York, NY (HQ)" as remote).
  nonTargetUs: /(new york|,\s*NY\b|brooklyn|austin|,\s*TX\b|dallas|houston|chicago|,\s*IL\b|boston|,\s*MA\b|denver|,\s*CO\b|atlanta|,\s*GA\b|miami|,\s*FL\b|phoenix|,\s*AZ\b|washington,? d\.?c\.?|,\s*DC\b|,\s*VA\b|,\s*MD\b|salt lake|,\s*UT\b|portland|,\s*OR\b|nashville|,\s*TN\b|philadelphia|,\s*PA\b|minneapolis|,\s*MN\b|detroit|,\s*MI\b|columbus|,\s*OH\b|charlotte|raleigh|,\s*NC\b|,\s*NJ\b|,\s*CT\b|,\s*NV\b|las vegas|,\s*MO\b|kansas city|,\s*IN\b|,\s*WI\b|,\s*NE\b|,\s*OK\b)/i,

  // ---- soft flags (annotate, never drop) ----
  // Background requirements you DON'T have. Flagged as "(required)" or "(plus)" from nearby wording.
  backgroundTerms: ["investment banking", "management consulting", "private equity", "bulge bracket", "mbb", "mckinsey", "bain", "boston consulting"],
  backgroundLabel: "IB/consulting",
  domainTerms: ["payments", "card", "issuing", "interchange", "acquiring", "ledger", "kyc", "underwriting", "fintech", "merchant"],

  // ---- board slug → company name exactly as written in your Tracker ----
  // Needed only when norm(slug) != norm(company). Otherwise dedupe silently misses.
  boardToCompany: {
    doordashusa: "DoorDash",
    billcom: "BILL",
    sigmacomputing: "Sigma Computing",
    moderntreasury: "Modern Treasury",
    launchdarkly: "LaunchDarkly",
    "marqeta-inc": "Marqeta",
    tripactions: "Navan",   // Greenhouse slug still uses the company's old name
  },
};
