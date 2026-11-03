// Ads Studio policy guard: the one rule set every creative / campaign is checked against before it can be
// pushed to an ad platform. Rules are data (regex strings) so Settings can switch them off, change severity
// (AdSettings.policy_overrides) or add custom ones (AdSettings.custom_rules) without a code change.
//
// severity: "hard" blocks submission, "soft" warns (Justin can still approve), "info" is a note.
// verified: true  = the source page was fetched and read when this rule was written (2026-11-03).
//           false = the rule follows the platform's published intent but its exact wording on the source page
//                   was NOT verified (Meta's transparency pages render client-side and could not be fetched);
//                   the "verified_note" says what it was checked against instead.
// Nothing here is legal advice and passing it does not guarantee a platform approval: Meta and Google still
// review every ad themselves.

export const RULES_VERSION = "2026-11-03";

export const SOURCES = {
  meta_standards: "https://transparency.meta.com/policies/ad-standards/",
  meta_personal: "https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes/",
  meta_sac: "https://developers.facebook.com/docs/marketing-api/audiences/special-ad-category",
  google_overview: "https://support.google.com/adspolicy/answer/6008942",
  google_editorial: "https://support.google.com/adspolicy/answer/6021546",
  google_unreliable: "https://support.google.com/adspolicy/answer/15936857",
  google_destination: "https://support.google.com/adspolicy/answer/6368661",
  google_misrep: "https://support.google.com/adspolicy/answer/6020955",
  agency_voice: "moethership://settings/agency-knowledge",
};

export type Rule = {
  key: string;
  platforms: string[]; // meta | google
  applies_to: string[]; // creative | campaign
  severity: "hard" | "soft" | "info";
  title: string;
  message: string;
  patterns?: string[]; // case-insensitive regex sources, tested against the ad text
  check?: string; // built-in checker name
  source_url: string;
  verified: boolean;
  verified_note?: string;
  enabled?: boolean;
};

const SENSITIVE =
  "(struggl\\w*|broke|in debt|debt|bankrupt\\w*|behind on (bills|payments)|losing money|failing|desperate|overweight|obese|depressed|depression|anxious|anxiety|diabet\\w*|disabled|disability|divorced|single|lonely|unemployed|out of work|criminal record|over (40|50|55|60|65)|under (18|21|25)|christian|catholic|muslim|jewish|gay|lesbian|transgender|pregnant|addict\\w*)";

export const DEFAULT_RULES: Rule[] = [
  {
    key: "personal_attributes",
    platforms: ["meta"],
    applies_to: ["creative"],
    severity: "hard",
    title: "Asserts or implies a personal attribute",
    message:
      "Meta ads can't assert or imply the viewer's personal attributes (financial status, health, age, religion, sexual orientation, disability, criminal record, etc.). Describe what Interstellar does instead of what the viewer is, e.g. \"Websites and local SEO for home-service businesses\" rather than \"Are you a business owner struggling…\".",
    patterns: [
      `\\b(are|r) (you|u)\\b[^.?!]{0,60}\\b${SENSITIVE}`,
      `\\byou(?:'re| are)\\b[^.?!]{0,40}\\b${SENSITIVE}`,
      `\\byour (debt|credit score|weight|diagnosis|disability|age|religion|race|bankruptcy|divorce)\\b`,
      `\\b(tired of|sick of) (being|your)\\b[^.?!]{0,40}\\b${SENSITIVE}`,
      "\\byou (who|that) (can'?t|cannot|don'?t)\\b",
    ],
    source_url: SOURCES.meta_personal,
    verified: false,
    verified_note:
      "Meta's page renders client-side and could not be fetched. Wording checked against Jon Loomer's quote of the policy (ads can't \"assert or imply the personal attributes of the viewer\", e.g. \"We can help you finally get out of debt\" is rejected) and the attribute list in Meta's standards as summarised by Stackmatix.",
  },
  {
    key: "direct_identity_question",
    platforms: ["meta"],
    applies_to: ["creative"],
    severity: "soft",
    title: "Direct \"Are you a …?\" identity framing",
    message:
      "Questions like \"Are you a contractor?\" or \"As a business owner, you…\" are often rejected under the personal-attributes rule even without a sensitive word. Prefer \"For contractors who…\" or describe the service.",
    patterns: ["\\bare (you|u) (a|an)\\s+\\w+", "\\bas (a|an) [a-z ]{3,30}, (you|your)\\b", "\\bcalling all\\b"],
    source_url: SOURCES.meta_personal,
    verified: false,
    verified_note: "Conservative reading of the personal-attributes rule (see above); Meta's page itself not fetched.",
  },
  {
    key: "guaranteed_results",
    platforms: ["meta", "google"],
    applies_to: ["creative"],
    severity: "hard",
    title: "Guaranteed or improbable results",
    message:
      "No guarantees of rankings, leads, revenue or ROI. Google prohibits claims that entice with an improbable result and requires a clear refund policy for any guarantee; Meta's standards prohibit misleading claims. Describe the work and the process instead.",
    patterns: [
      "\\bguarantee(d|s)?\\b[^.?!]{0,40}\\b(result|rank|ranking|page one|first page|#?1|number one|leads?|sales|revenue|roi|traffic|customers|growth)\\b",
      "\\b(rank|ranked|ranking) #?1\\b",
      "\\b#1 on google\\b",
      "\\b(first|top) (page|spot) (of|on) google\\b[^.?!]{0,20}\\b(guarantee|in \\d+ (days|weeks))",
      "\\b(double|triple|10x|5x|3x|2x) (your )?(revenue|sales|leads|traffic|business)\\b",
      "\\b100% (guaranteed|results|success)\\b",
      "\\bget rich\\b|\\bpassive income\\b|\\bovernight success\\b",
    ],
    source_url: SOURCES.google_unreliable,
    verified: true,
    verified_note: "Google \"Unreliable claims\" fetched 2026-11-03. Meta side follows its Advertising Standards (page not fetchable).",
  },
  {
    key: "fake_urgency",
    platforms: ["meta", "google"],
    applies_to: ["creative"],
    severity: "hard",
    title: "Fake urgency or scarcity",
    message:
      "Interstellar's voice rules forbid invented urgency or scarcity. Remove countdown / \"only N spots\" / \"ends tonight\" language unless it is literally true and in Agency Knowledge.",
    patterns: [
      "\\bonly \\d+ (spots?|slots?|seats?|openings?|clients?) (left|remaining|available)\\b",
      "\\b(last chance|ends tonight|ends today|expires (today|tonight|soon)|act now|hurry|don'?t miss out|before it'?s too late|limited[- ]time only|while supplies last|selling fast)\\b",
      "\\b(\\d+) (people|businesses) (are )?(viewing|looking at) this\\b",
    ],
    source_url: SOURCES.agency_voice,
    verified: true,
    verified_note: "Internal rule (Justin / Agency Knowledge voice rules), not a platform policy.",
  },
  {
    key: "price_not_in_knowledge",
    platforms: ["meta", "google"],
    applies_to: ["creative"],
    severity: "hard",
    title: "Price not found in Agency Knowledge",
    message: "Every price in an ad must match an offer price in Settings > Agency knowledge. Fix the price or update Agency Knowledge first.",
    check: "prices",
    source_url: SOURCES.agency_voice,
    verified: true,
    verified_note: "Internal rule.",
  },
  {
    key: "before_after",
    platforms: ["meta", "google"],
    applies_to: ["creative"],
    severity: "soft",
    title: "Before/after framing",
    message:
      "Before/after visuals or copy can read as a promised outcome. Keep it to real, labelled client work, no timeframe-to-result promises, and add \"results vary\" if numbers are shown. Google requires a visible disclaimer for testimonials that claim specific results.",
    patterns: ["\\bbefore (and|&|/) ?after\\b", "\\bfrom \\$?[\\d,.]+k? to \\$?[\\d,.]+k?\\b[^.?!]{0,30}\\b(in|within) \\d+ (days|weeks|months)\\b", "\\bresults? in (just )?\\d+ (days|hours)\\b"],
    check: "before_after_template",
    source_url: SOURCES.google_unreliable,
    verified: true,
    verified_note: "Google testimonial/disclaimer requirement fetched 2026-11-03. Meta's before-and-after rule applies chiefly to health/weight-loss and was not fetched; treated as a warning here.",
  },
  {
    key: "unsubstantiated_stats",
    platforms: ["meta", "google"],
    applies_to: ["creative"],
    severity: "soft",
    title: "Statistic needs a source",
    message: "Percentages, multipliers and superlatives (\"#1\", \"best\") need proof on the landing page. Use only real numbers from real client data.",
    patterns: ["\\b\\d{2,4}% (more|increase|growth|boost|higher|lift)\\b", "\\b(the )?(best|#1|number one|top[- ]rated) (agency|seo|web|marketing|in (oregon|the (us|country|world)))\\b"],
    source_url: SOURCES.google_unreliable,
    verified: true,
  },
  {
    key: "special_ad_category",
    platforms: ["meta"],
    applies_to: ["creative", "campaign"],
    severity: "hard",
    title: "Special Ad Category may apply",
    message:
      "The copy mentions credit, financing, employment or housing. Meta requires the campaign to declare the matching special_ad_categories (CREDIT, EMPLOYMENT, HOUSING, FINANCIAL_PRODUCTS_SERVICES) which limits targeting. Declare it on the campaign or remove the wording.",
    check: "special_ad_category",
    patterns: [
      "\\b(loans?|credit cards?|credit score|line of credit|financing available|0% apr|apr\\b|mortgage|refinanc\\w*|insurance quotes?)\\b",
      "\\b(now hiring|we'?re hiring|job openings?|careers? at|apply for (this|the) job|join our team|hiring)\\b",
      "\\b(for rent|apartments?|homes? for sale|real estate listings?|rental|tenants?)\\b",
    ],
    source_url: SOURCES.meta_sac,
    verified: true,
    verified_note: "Marketing API docs fetched 2026-11-03: every campaign must send special_ad_categories (NONE/[] if none apply).",
  },
  {
    key: "prohibited_content",
    platforms: ["meta", "google"],
    applies_to: ["creative"],
    severity: "hard",
    title: "Prohibited content",
    message: "Prohibited products/practices (weapons, illegal drugs, tobacco/vapes, adult content, counterfeit goods, spyware, payday loans, multi-level marketing, fake documents).",
    patterns: [
      "\\b(guns?|firearms?|ammo|ammunition|explosives?|cocaine|heroin|meth|vape|vaping|e-?cig\\w*|cigarettes?|tobacco|porn\\w*|xxx|escort|counterfeit|replica (watches|bags)|spy ?ware|payday loans?|mlm|multi-level marketing|fake (ids?|reviews|diplomas?))\\b",
    ],
    source_url: SOURCES.google_overview,
    verified: true,
    verified_note: "Google policy categories fetched 2026-11-03; Meta's prohibited list not fetched (same categories in its Advertising Standards intro page, unverified).",
  },
  {
    key: "restricted_content",
    platforms: ["meta", "google"],
    applies_to: ["creative"],
    severity: "soft",
    title: "Restricted content",
    message: "Restricted category (alcohol, gambling, crypto, dating, supplements/weight loss, healthcare, political or social issues). Allowed only with authorisation/targeting limits — check before pushing.",
    patterns: ["\\b(alcohol|beer|wine|liquor|casino|gambling|betting|sweepstakes|crypto\\w*|bitcoin|nft|dating|supplements?|weight loss|lose \\d+ ?(lbs|pounds)|prescription|cbd|election|vote for|ballot)\\b"],
    source_url: SOURCES.google_overview,
    verified: true,
  },
  {
    key: "editorial_caps",
    platforms: ["google", "meta"],
    applies_to: ["creative"],
    severity: "soft",
    title: "Gimmicky capitalisation",
    message: "Use capital letters only for their intended purpose (Google Editorial). ALL-CAPS words read as spam on Meta too.",
    check: "caps",
    source_url: SOURCES.google_editorial,
    verified: true,
  },
  {
    key: "editorial_punctuation",
    platforms: ["google", "meta"],
    applies_to: ["creative"],
    severity: "soft",
    title: "Gimmicky punctuation or symbols",
    message: "Repeated punctuation (!!, ??), excessive emoji or symbols used for attention break Google's Editorial policy.",
    patterns: ["[!?]{2,}", "(\\p{Extended_Pictographic}.*){4,}", "[★☆✓✔➡→]{2,}"],
    source_url: SOURCES.google_editorial,
    verified: true,
  },
  {
    key: "phone_in_text",
    platforms: ["google"],
    applies_to: ["creative"],
    severity: "soft",
    title: "Phone number in ad text",
    message: "Google doesn't allow phone numbers in ad text — use a call asset instead.",
    patterns: ["\\(?\\b\\d{3}\\)?[ .-]\\d{3}[ .-]\\d{4}\\b"],
    source_url: SOURCES.google_editorial,
    verified: true,
  },
  {
    key: "unidentified_business",
    platforms: ["google", "meta"],
    applies_to: ["creative"],
    severity: "info",
    title: "Business not named",
    message: "Name the business (Interstellar Strategies) in the copy or creative so the advertiser is identifiable (Google Editorial: unidentified business).",
    check: "brand_named",
    source_url: SOURCES.google_editorial,
    verified: true,
  },
  {
    key: "destination",
    platforms: ["meta", "google"],
    applies_to: ["creative", "campaign"],
    severity: "hard",
    title: "Landing page must work",
    message: "The destination must be an https URL that loads (2xx) and stays on the advertised domain.",
    check: "landing",
    source_url: SOURCES.google_destination,
    verified: true,
    verified_note: "Google destination requirements fetched 2026-11-03. Meta has equivalent landing-page rules in its Advertising Standards (not fetched).",
  },
  {
    key: "landing_match",
    platforms: ["meta", "google"],
    applies_to: ["creative"],
    severity: "soft",
    title: "Landing page doesn't match the ad",
    message: "The landing page should mention what the ad promises (the offer name and any price). A mismatch is a common rejection reason and wastes spend.",
    check: "landing_match",
    source_url: SOURCES.google_destination,
    verified: true,
  },
  {
    key: "text_length",
    platforms: ["meta", "google"],
    applies_to: ["creative"],
    severity: "info",
    title: "Copy length",
    message:
      "Meta truncates long copy (roughly 40 characters for headlines and 125 for primary text show in full on most placements). Google responsive search ads cap headlines at 30 and descriptions at 90 characters.",
    check: "length",
    source_url: SOURCES.meta_standards,
    verified: false,
    verified_note: "Display-length guidance from common Meta/Google practice; not a policy page and not re-verified.",
  },
];

export type Finding = {
  rule_key: string;
  severity: string;
  title: string;
  message: string;
  matched?: string;
  source_url: string;
  verified: boolean;
  verified_note?: string;
};

export function mergedRules(settings: any): Rule[] {
  const over = (settings && settings.policy_overrides) || {};
  const custom: Rule[] = Array.isArray(settings?.custom_rules)
    ? settings.custom_rules
        .filter((r: any) => r && r.key && Array.isArray(r.patterns) && r.patterns.length)
        .map((r: any) => ({
          platforms: ["meta", "google"],
          applies_to: ["creative"],
          severity: "soft",
          source_url: r.source_url || SOURCES.agency_voice,
          verified: false,
          verified_note: "Custom rule added in Ads Studio settings.",
          title: r.title || r.key,
          message: r.message || "",
          ...r,
        }))
    : [];
  return [...DEFAULT_RULES, ...custom].map((r) => {
    const o = over[r.key] || {};
    return { ...r, enabled: o.enabled === false ? false : r.enabled !== false, severity: (o.severity || r.severity) as Rule["severity"] };
  });
}

const rx = (src: string) => {
  try {
    return new RegExp(src, "iu");
  } catch {
    return null;
  }
};

export function creativeText(c: any) {
  const spec = c?.spec || {};
  const parts = [c?.headline, c?.primary_text, c?.description, spec.eyebrow, spec.headline, spec.subhead, spec.body, spec.cta, ...(Array.isArray(spec.items) ? spec.items.map((i: any) => (typeof i === "string" ? i : i?.text || i?.label || "")) : [])];
  return parts.filter(Boolean).map(String).join("\n");
}

const PRICE_RX = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?\s?(k\b)?/gi;

export function pricesIn(text: string) {
  const out: number[] = [];
  for (const m of text.matchAll(PRICE_RX)) {
    let n = Number(String(m[1]).replace(/,/g, ""));
    if (m[2]) n *= 1000;
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function knowledgePrices(sections: any[]): number[] {
  const offers = (sections || []).find((s: any) => s.key === "offers");
  const list = offers?.data?.offers || [];
  const prices = list.map((o: any) => Number(o.price)).filter((n: number) => Number.isFinite(n) && n > 0);
  // Also accept dollar figures written in the offers/pricing bodies.
  for (const s of sections || []) if (["offers", "pricing_rules", "bonuses"].includes(s.key)) prices.push(...pricesIn(String(s.body || "")));
  return Array.from(new Set(prices));
}

export async function landingProbe(url: string, terms: string[]) {
  const out: any = { url, ok: false, status: 0, https: /^https:\/\//i.test(url || ""), matched_terms: [], missing_terms: [], final_url: "" };
  if (!url) return out;
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (Moethership Ads Studio policy check)" }, signal: AbortSignal.timeout(12000) });
    out.status = res.status;
    out.final_url = res.url;
    out.ok = res.ok;
    try {
      out.same_domain = new URL(res.url).hostname.replace(/^www\./, "") === new URL(url).hostname.replace(/^www\./, "");
    } catch {
      out.same_domain = true;
    }
    if (res.ok) {
      const html = (await res.text()).slice(0, 600_000);
      const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
      out.title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
      for (const t of terms.filter(Boolean)) (text.includes(String(t).toLowerCase()) ? out.matched_terms : out.missing_terms).push(t);
      out.thin = text.length < 400;
    }
  } catch (e) {
    out.error = String((e as Error)?.message || e).slice(0, 200);
  }
  return out;
}

/** Run every enabled rule for one subject. ctx: { platform, kind, creative?, campaign?, creatives?, sections, settings, landing? } */
export function runRules(ctx: any): Finding[] {
  const rules = mergedRules(ctx.settings).filter((r) => r.enabled !== false && r.platforms.includes(ctx.platform) && r.applies_to.includes(ctx.kind));
  const creatives = ctx.kind === "creative" ? [ctx.creative] : ctx.creatives || [];
  const text = creatives.map(creativeText).join("\n");
  const findings: Finding[] = [];
  const add = (r: Rule, message?: string, matched?: string, severity?: string) =>
    findings.push({ rule_key: r.key, severity: severity || r.severity, title: r.title, message: message || r.message, matched, source_url: r.source_url, verified: r.verified, verified_note: r.verified_note });

  for (const r of rules) {
    const hit = (r.patterns || []).map(rx).filter(Boolean).map((re) => text.match(re as RegExp)).find(Boolean);
    switch (r.check) {
      case "special_ad_category": {
        const declared = (ctx.campaign?.special_ad_categories || []).filter((x: string) => x && x !== "NONE");
        if (hit && !declared.length) add(r, undefined, hit[0]);
        break;
      }
      case "prices": {
        const allowed = knowledgePrices(ctx.sections || []);
        const bad = pricesIn(text).filter((p) => !allowed.includes(p));
        if (bad.length) add(r, `${r.message} Found: ${bad.map((b) => `$${b.toLocaleString("en-US")}`).join(", ")}${allowed.length ? "" : " (Agency Knowledge has no prices on file)"}.`, bad.join(", "));
        break;
      }
      case "before_after_template":
        if (hit) add(r, undefined, hit[0]);
        else if (creatives.some((c: any) => /before_after/.test(String(c?.template || "")))) add(r, `${r.message} (Template: before/after site.)`, "template");
        break;
      case "caps": {
        const caps = (text.match(/\b[A-Z]{4,}\b/g) || [] as string[]).filter((w: string) => !/^(SEO|HTML|CSS|AEO|GEO|AIO|USA|LLC|ROAS|ROI|CRM|ERP|GBP|API|FAQ|PDF|PNG|URL|CEO)$/.test(w));
        if (caps.length >= 2) add(r, undefined, caps.slice(0, 4).join(" "));
        break;
      }
      case "brand_named":
        if (creatives.length && !/interstellar/i.test(text + creatives.map((c: any) => JSON.stringify(c?.spec?.lockup || "")).join(" "))) add(r);
        break;
      case "length": {
        for (const c of creatives) {
          const notes: string[] = [];
          if (ctx.platform === "meta") {
            if ((c?.headline || "").length > 40) notes.push(`headline ${c.headline.length}/40`);
            if ((c?.primary_text || "").length > 125) notes.push(`primary text ${c.primary_text.length}/125 before "See more"`);
          } else {
            if ((c?.headline || "").length > 30) notes.push(`headline ${c.headline.length}/30 (hard limit on Google RSAs)`);
            if ((c?.description || "").length > 90) notes.push(`description ${c.description.length}/90`);
          }
          if (notes.length) add(r, `${r.message} ${notes.join(", ")}.`, notes.join(", "));
        }
        break;
      }
      case "landing": {
        const urls = creatives.map((c: any) => c?.destination_url).filter(Boolean);
        if (!urls.length) {
          add(r, "No destination URL set.");
          break;
        }
        const l = ctx.landing;
        if (l) {
          if (!l.https) add(r, "Destination must use https.", l.url);
          else if (!l.ok) add(r, `Destination did not load (${l.status || l.error || "no response"}).`, l.url);
          else if (l.same_domain === false) add(r, `Destination redirects to another domain (${l.final_url}).`, l.final_url, "soft");
          else if (l.thin) add(r, "Destination has very little text (insufficient original content risk).", l.url, "soft");
        }
        break;
      }
      case "landing_match": {
        const l = ctx.landing;
        if (l && l.ok && l.missing_terms?.length) add(r, `${r.message} Not found on the page: ${l.missing_terms.join(", ")}.`, l.missing_terms.join(", "));
        break;
      }
      default:
        if (hit) add(r, undefined, hit[0]);
    }
  }
  if (ctx.kind === "campaign" && ctx.platform === "meta" && !Array.isArray(ctx.campaign?.special_ad_categories)) {
    findings.push({ rule_key: "sac_missing", severity: "info", title: "special_ad_categories not set", message: "Will be sent as [] (none). Meta requires the field on every campaign.", source_url: SOURCES.meta_sac, verified: true });
  }
  return findings;
}

export const resultOf = (findings: Finding[]) => (findings.some((f) => f.severity === "hard") ? "fail" : findings.some((f) => f.severity === "soft") ? "warn" : "pass");
