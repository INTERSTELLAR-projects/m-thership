import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/*
 * TEMPORARY (Nov 19-20 2026, Justin's data-only tasks). Removed after use. No input is trusted: every action is fixed.
 *   analyze      counts + top payees of the bank ledger, rules, and the Search Intel actions -> AppSettings data_tasks_1119
 *   seo_approve  approves every proposed Search Intel action with "Approved by Justin, Nov 19"; hard-gate ones get a
 *                HOLD FOR TAP line so the queue runner checkpoints but never deploys them.
 * Never moves money, never touches the bank connection, never deletes.
 */
const EXPIRES = Date.parse("2026-11-21T12:00:00Z");
const s = (v: unknown) => (v == null ? "" : String(v));
const norm = (v: unknown) => s(v).toLowerCase().replace(/\s+/g, " ").trim();
function payeePattern(v: unknown) {
  let p = norm(v)
    .replace(/(pos|debit|card|purchase|recurring|ach|withdrawal|payment|online|checkcard|visa|mc)\s+/g, " ")
    .replace(/[#*]\s*\w*\d\w*/g, " ").replace(/\b\d{2,}\b/g, " ").replace(/\b(xx+\d*|\d+x+)\b/g, " ")
    .replace(/[^a-z0-9 .&'-]/g, " ").replace(/\s+/g, " ").trim();
  p = p.replace(/\s+[a-z]{2}$/, "").trim();
  return p.split(" ").slice(0, 3).join(" ");
}
async function listAll(ent: any, q: any, sort: string, max = 5000) {
  const out: any[] = [];
  for (let skip = 0; skip < max; skip += 500) {
    const page = (await ent.filter(q, sort, 500, skip).catch(() => [])) || [];
    out.push(...page);
    if (page.length < 500) break;
  }
  return out;
}
// Ledger categories used here (src/features/accounting/ledger.js CATEGORIES), Schedule C lines by default.
const CATS: Record<string, { tax: string; lines: Record<string, string> }> = {
  transfer: { tax: "transfer", lines: {} }, owner_draw: { tax: "equity", lines: {} }, personal: { tax: "personal", lines: {} },
  hosting: { tax: "deductible", lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  ai_tools: { tax: "deductible", lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  software: { tax: "deductible", lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  education: { tax: "deductible", lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  dues: { tax: "deductible", lines: { schedule_c: "Sch C L27a (Part V)", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  taxes_licenses: { tax: "deductible", lines: { schedule_c: "Sch C L23", f1065: "1065 L14", f1120s: "1120-S L12", f1120: "1120 L17" } },
  est_tax_oregon: { tax: "tax_payment", lines: { schedule_c: "OR-40 estimated payments" } },
  utilities: { tax: "deductible", lines: { schedule_c: "Sch C L25", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  advertising: { tax: "deductible", lines: { schedule_c: "Sch C L8", f1065: "1065 L21", f1120s: "1120-S L16", f1120: "1120 L22" } },
  merchant_fees: { tax: "deductible", lines: { schedule_c: "Sch C L10", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  office: { tax: "deductible", lines: { schedule_c: "Sch C L18", f1065: "1065 L21", f1120s: "1120-S L19", f1120: "1120 L26" } },
  other_income: { tax: "income", lines: { schedule_c: "Sch C L6", f1065: "1065 L7", f1120s: "1120-S L5", f1120: "1120 L10" } },
};
const FORM: Record<string, string> = { smllc_schedule_c: "schedule_c", sole_prop: "schedule_c", mmllc_1065: "f1065", s_corp_1120s: "f1120s", c_corp_1120: "f1120" };
const lineFor = (cat: string, et: string) => CATS[cat]?.lines[FORM[et] || "schedule_c"] || CATS[cat]?.lines.schedule_c || "";
// [category, direction, patterns] — only vendors that are clearly one thing. Everything else goes to Needs review.
const PERSONAL = [
  "safeway", "fred meyer", "winco", "center market", "us market", "lil pantry", "plaid pantry", "get & go", "barton food mart", "fred's food", "mulino store", "beavercreek grocery", "sunrise food store", "dollar general", "target", "world market",
  "taco bell", "mcdonald", "five guys", "chipotle", "panda express", "wendy's", "carl's jr", "arby's", "burgerville", "domino's", "dairy queen", "firehouse subs", "wetzel's", "starbucks", "dutch bros", "black rock coffee", "hotshots espresso", "cowboy coffee", "doordash", "all mine frozen", "dot sugar",
  "amazon prime", "netflix", "xbox", "fabletics", "the north face", "arc'teryx", "vans", "nordstrom", "lululemon", "urban outfitters", "le d bug", "boot barn", "zales", "bass pro", "rei", "pop mart", "washington square", "build-a-bear", "bricks & minifigs", "tan republic", "gnc", "ag1", "planet fitness", "nw fitness", "hi-school pharmacy", "novacare", "oregon liquor control", "tobacco vape", "gofundme", "girl scout", "groupon",
  "oregon zoo", "oregon museum of science", "helium comedy", "seat engine", "chow comedy", "event tickets center", "dave & buster", "scooterbug", "ocean plays", "ami musicbox", "dtd parks", "havasupai",
  "white barn estate", "coomer dance", "portland general electric", "oregon city garbage", "payment alliance international",
];
const RULES: [string, string, string[]][] = [
  ["transfer", "in", ["transfer from mercury"]], ["transfer", "out", ["transfer to mercury"]], ["transfer", "any", ["interstellar llc"]],
  ["hosting", "out", ["framer", "webflow", "base44", "render", "mongodb", "godaddy", "squarespace", "google cloud"]],
  ["ai_tools", "out", ["anthropic", "openai", "genspark", "elevenlabs", "myclaw.ai", "aragon ai"]],
  ["software", "out", ["canva", "serpapi", "envato", "typeform", "quickbooks", "docusign", "cloudhq", "shopify", "microsoft", "custom esignature"]],
  ["taxes_licenses", "out", ["zenbusiness"]], ["est_tax_oregon", "out", ["oregon department of revenue"]],
  ["utilities", "out", ["verizon"]], ["advertising", "out", ["vistaprint"]], ["education", "out", ["coursera"]], ["dues", "out", ["skool"]],
  ["merchant_fees", "out", ["elavon"]], ["office", "out", ["usps"]], ["other_income", "in", ["impact radius"]],
  ["owner_draw", "out", PERSONAL],
];
const esc = (p: string) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (name: string, p: string) => new RegExp(`(^|[^a-z0-9])${esc(p)}($|[^a-z0-9])`).test(name);
// Short or generic words are matched here as whole words, but not saved as "contains" rules for future imports.
const NO_SAVE = new Set(["rei", "vans", "gnc", "ag1", "target", "render", "usps", "canva", "skool", "mercury"]);
function pick(name: string, dir: string, account: string): string {
  if (/\bstripe\b/.test(name)) return /capital|loan/.test(name) ? "" : dir === "in" || account === "Stripe" ? "transfer" : "";
  if (dir === "in" && name === "mercury") return "other_income";
  for (const [cat, d, pats] of RULES) {
    if (d !== "any" && d !== dir) continue;
    if (pats.some((p) => has(name, p))) return cat;
  }
  // Small refunds back from personal merchants.
  if (dir === "in" && PERSONAL.some((p) => has(name, p))) return "personal";
  return "";
}
function reviewReason(name: string) {
  if (/chevron|shell|conoco|\b76\b|space age|arrowhead|banwait|astro|carson/.test(name)) return "fuel: business vehicle or personal?";
  if (/car wash|autotech|detail|santander|u-haul|parkmobile|caltrain/.test(name)) return "vehicle / travel: business or personal?";
  if (/geico|progressive|prog universal|lemonade/.test(name)) return "insurance: business or personal policy?";
  if (/amazon|apple|best buy|ace hardware|home depot|tractor supply|arashi|tapstitch|bowker/.test(name)) return "purchase could be business supplies/equipment or personal";
  if (/cash app|paypal|apple wallet|onpoint|zillow/.test(name)) return "money app / credit union: transfer, payment or personal?";
  if (/clarkes|thai yo/.test(name)) return "spent at a client's business: meeting or personal?";
  if (/editor|asadkhaleel|contra|polar|red cube|innovative foto/.test(name)) return "possible contractor or software: confirm";
  if (/city hall|city of molalla|revenue department|sheriff|clackamas/.test(name)) return "government payment: tax, license, fee or personal?";
  if (/stripe/.test(name)) return "Stripe deposit that may be Stripe Capital (loan)";
  return "restaurant, bar or unknown merchant: business meal or personal?";
}
const HOLD_IDS = new Set(["A-1119-1", "A-1106-5", "A-1105-3", "A-1031-1", "A-1029-5", "A-1103-1"]);

async function save(db: any, patch: any) {
  const ex = ((await db.AppSettings.filter({ key: "data_tasks_1119" }, "-updated_date", 1).catch(() => [])) || [])[0];
  const value = { ...(ex?.pageSettings || {}), ...patch, at: new Date().toISOString() };
  if (ex) await db.AppSettings.update(ex.id, { pageSettings: value }); else await db.AppSettings.create({ key: "data_tasks_1119", pageSettings: value });
}

export default async function (req: Request) {
  try {
    if (Date.now() > EXPIRES) return Response.json({ error: "expired" }, { status: 410 });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = s(body?.action);

    if (action === "analyze") {
      const tx = await listAll(db.LedgerTransaction, {}, "date");
      const rules = await listAll(db.LedgerRule, {}, "priority", 1000);
      const by = (f: (t: any) => string) => tx.reduce((m: any, t: any) => { const k = f(t) || "(none)"; m[k] = (m[k] || 0) + 1; return m; }, {});
      const groups: Record<string, any> = {};
      for (const t of tx) {
        const k = `${t.direction}|${payeePattern(t.payee || t.description)}`;
        const g = groups[k] || (groups[k] = { k, n: 0, amt: 0, cats: {}, rs: {}, sample: s(t.payee || t.description).slice(0, 60), acct: s(t.account).slice(0, 30), sugg: {} });
        g.n++; g.amt += Number(t.amount) || 0;
        g.cats[t.category || "-"] = (g.cats[t.category || "-"] || 0) + 1;
        g.rs[t.review_status || "-"] = (g.rs[t.review_status || "-"] || 0) + 1;
        if (t.ai_suggestion?.category) g.sugg[t.ai_suggestion.category] = (g.sugg[t.ai_suggestion.category] || 0) + 1;
      }
      const top = Object.values(groups).sort((a: any, b: any) => b.n - a.n).slice(0, 260).map((g: any) => ({ ...g, amt: Math.round(g.amt) }));
      await save(db, {
        ledger: { total: tx.length, review: by((t) => t.review_status), category: by((t) => t.category), direction: by((t) => t.direction), source: by((t) => t.source), account: by((t) => t.account), years: by((t) => s(t.date).slice(0, 4)) },
        rules: rules.map((r: any) => ({ p: r.pattern, c: r.category, d: r.direction, pr: r.priority, l: !!r.learned, a: r.active !== false })),
        groups: top, group_count: Object.keys(groups).length,
      });
      return Response.json({ ok: true, n: tx.length });
    }

    if (action === "seo_approve") {
      const rows = await listAll(db.SeoIntel, { kind: "action", status: "proposed" }, "brief_date", 500);
      const done: string[] = [], held: string[] = [];
      for (const r of rows) {
        const hold = HOLD_IDS.has(s(r.action_id));
        const lines = [s(r.notes).trimEnd(), "Approved by Justin, Nov 19"];
        if (hold) lines.push("HOLD FOR TAP: changes are made and checkpointed, but nothing goes live until Justin taps Ready to publish (hard gate: live site change).");
        await db.SeoIntel.update(r.id, { status: "approved", notes: lines.join("\n") });
        (hold ? held : done).push(s(r.action_id));
      }
      await save(db, { seo: { approved: done.length + held.length, held } });
      return Response.json({ ok: true, approved: done.length + held.length, held });
    }
    if (action === "categorize") {
      const tp = ((await db.BusinessTaxProfile.filter({ business_id: "interstellar" }, "-updated_date", 1).catch(() => [])) || [])[0];
      const entityType = s(tp?.entity_type) || "smllc_schedule_c";
      const tx = await listAll(db.LedgerTransaction, { review_status: "needs_review" }, "date");
      const counts: Record<string, number> = {};
      const reviewWhy: Record<string, number> = {};
      let changed = 0;
      const t0 = Date.now();
      let more = false;
      for (const t of tx) {
        if (s(t.category) || s(t.notes).includes("Needs review (Nov 19)")) continue;
        if (Date.now() - t0 > 45000) { more = true; break; }
        await new Promise((r) => setTimeout(r, 220)); // stay under the 350 updates / 60s limit
        const name = norm(t.payee || t.description);
        const sug = s(t.ai_suggestion?.category);
        let cat = pick(name, t.direction, s(t.account));
        if (cat === "transfer" && /stripe/.test(name) && sug === "loan") cat = "";
        if (!cat) { counts.needs_review = (counts.needs_review || 0) + 1; const w = reviewReason(name); reviewWhy[w] = (reviewWhy[w] || 0) + 1;
          if (!s(t.notes).includes("Needs review (Nov 19)")) await db.LedgerTransaction.update(t.id, { notes: [s(t.notes), `Needs review (Nov 19): ${w}`].filter(Boolean).join("\n").slice(0, 2000) }).catch(() => null); continue; }
        const c = CATS[cat];
        await db.LedgerTransaction.update(t.id, { category: cat, tax_category: c.tax, form_line: lineFor(cat, entityType), review_status: "approved", notes: [s(t.notes), "Categorized by vendor rule (Justin's request, Nov 19)"].filter(Boolean).join("\n").slice(0, 2000) });
        counts[cat] = (counts[cat] || 0) + 1; changed++;
      }
      if (more) return Response.json({ ok: true, more, changed });
      // Save the vendor rules (learned) so future bank imports categorize the same way.
      const have = new Set(((await db.LedgerRule.list("priority", 1000).catch(() => [])) || []).map((r: any) => `${norm(r.pattern)}|${r.direction || "any"}`));
      let rulesAdded = 0;
      for (const [cat, dir, pats] of RULES) for (const p of pats) {
        if (have.has(`${p}|${dir}`) || NO_SAVE.has(p) || p.length < 5) continue;
        await db.LedgerRule.create({ business_id: "interstellar", pattern: p, match_field: "any", match_type: "contains", direction: dir, category: cat, priority: 40, learned: true, active: true, hits: 0, notes: "Vendor rule from the Nov 19 categorization (Justin)" }).catch(() => null);
        rulesAdded++;
      }
      // Final tally over every row touched by this job (all chunks).
      const all = await listAll(db.LedgerTransaction, { notes: { $regex: "Nov 19" } }, "date");
      const tally: Record<string, number> = {};
      const why: Record<string, number> = {};
      for (const t of all) {
        const n = s(t.notes);
        if (n.includes("Categorized by vendor rule")) tally[s(t.category)] = (tally[s(t.category)] || 0) + 1;
        else if (t.review_status === "needs_review") { tally.needs_review = (tally.needs_review || 0) + 1; const m = n.match(/Needs review \(Nov 19\): (.*)/); if (m) why[m[1]] = (why[m[1]] || 0) + 1; }
      }
      const left = (await listAll(db.LedgerTransaction, { review_status: "needs_review" }, "date")).length;
      await save(db, { categorize: { entityType, touched: all.length, tally, review_reasons: why, needs_review_total: left, rules_added: rulesAdded } });
      return Response.json({ ok: true, changed, counts });
    }
    return Response.json({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: s((e as Error)?.message).slice(0, 300) }, { status: 500 });
  }
}
