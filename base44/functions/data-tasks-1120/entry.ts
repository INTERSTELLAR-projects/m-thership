import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/*
 * TEMPORARY (Nov 20 2026, Justin's data-only task). Removed after use. Takes no input beyond a fixed action.
 *   categorize  every LedgerTransaction still in Needs review gets Justin's conservative best call, a confidence tag
 *               (auto_tag "likely" | "guess") and a short reason, so his tax preparer can review the guesses.
 *               Time-boxed and rate-limited; the workflow runs it in several steps.
 *   tally       counts per category, likely vs guess, the 5 biggest-dollar guesses, and vendor rules for repeats.
 * Never moves money, never touches the bank connection, never deletes.
 */
const EXPIRES = Date.parse("2026-11-22T12:00:00Z");
const s = (v: unknown) => (v == null ? "" : String(v));
const arr = (r: any) => (Array.isArray(r) ? r : (r && r.items) || []);
const DEDUCT = "deductible";
const CAT: Record<string, { tax: string; line: string }> = {
  owner_draw: { tax: "equity", line: "" }, owner_contribution: { tax: "equity", line: "" }, personal: { tax: "personal", line: "" },
  loan: { tax: "transfer", line: "" }, transfer: { tax: "transfer", line: "" },
  car_truck: { tax: DEDUCT, line: "Sch C L9" }, merchant_fees: { tax: DEDUCT, line: "Sch C L10" }, contract_labor: { tax: DEDUCT, line: "Sch C L11" },
  insurance: { tax: DEDUCT, line: "Sch C L15" }, supplies: { tax: DEDUCT, line: "Sch C L22" }, taxes_licenses: { tax: DEDUCT, line: "Sch C L23" },
  software: { tax: DEDUCT, line: "Sch C L27a (Part V)" }, advertising: { tax: DEDUCT, line: "Sch C L8" },
  equipment: { tax: "non_deductible", line: "Sch C L13 via Form 4562" }, est_tax_oregon: { tax: "tax_payment", line: "OR-40 estimated payments" },
};
const name = (t: any) => s(t.payee || t.description).replace(/\s*\(.*$/, "").trim().toLowerCase();
type D = [string, "likely" | "guess", string];
const has = (n: string, re: RegExp) => re.test(n);

const FUEL = /^(chevron|shell|space age|arrowhead travel plaza|conoco|banwait oil|76|astro 239|carson hood river|arco|circle k)\b/;
const VEHICLE = /^(molalla car wash|oregon city car wash|autotech|empire mobile deta|u-haul|parkmobile|city center parking|caltrain bike station)\b/;
const RESTAURANT = /(cafe|caf\b|bar & grill|tavern|pub|taphouse|saloon|sushi|teriyaki|taqueria|bbq|red robin|cheesecake|el gaucho|sol tapatio|su casa|don chico|mac's place|gene.s hitchin|fire foods|sundowner|hearth & vine|coffin|birdie time|wildhorse|molalla whitehorse|bishops|lakeview|cascada|otis|biscuits|dixie|mayan twins|bear creek|redland|hog wild|45 east|happyvalley|main st molalla|perky|life of riley|the hilt|fir point farms|wilsonville f k|j milwaukie|2levy)/;

function decide(t: any): D {
  const n = name(t);
  const dir = t.direction;
  const a = Number(t.amount) || 0;
  const reason = s(t.ai_suggestion?.reason);
  if (n === "stripe") {
    if (dir === "in" && /capital|financing/i.test(reason + s(t.description))) return ["loan", "likely", "Stripe Capital financing payout: loan proceeds (liability), not income. Flag: confirm against the Capital agreement."];
    if (dir === "in") return ["loan", "guess", "Stripe deposit that may be Capital financing: treated as loan proceeds until confirmed."];
    return ["merchant_fees", "guess", "Stripe debit covering a negative balance (fees/refunds): processing cost."];
  }
  if (n === "apple wallet") return dir === "in" ? ["owner_contribution", "likely", "Apple Cash/Wallet to the business account: his own money moved in."] : ["owner_draw", "likely", "Business account to Apple Cash/Wallet: moving money to his own personal account."];
  if (/^(onpoint community credit union|oregon city onpoint cu)$/.test(n)) return ["owner_draw", "likely", "Payment to his OnPoint credit union account/loan: transfer to his own personal side."];
  if (n === "santander") return ["owner_draw", "guess", "Santander auto loan payment: principal isn't deductible; if the vehicle is used for business, only the business-use share of interest/costs counts. Business-use % needed."];
  if (n === "cash app") {
    if (dir === "in") return ["owner_contribution", "likely", "Cash App to the business account: his own money moved in."];
    if (a >= 100 && a % 50 === 0) return ["owner_draw", "likely", "Round-dollar Cash App out: moving money to his own account."];
    return ["owner_draw", "guess", "Cash App sent out, recipient unknown, no repeat pattern to one person: personal."];
  }
  if (n === "paypal") return ["owner_draw", "guess", "PayPal payment, purpose unknown (several are $200/month): personal unless it's a contractor; then move to Contractors with a W-9."];
  if (n === "amazon") return dir === "in" ? ["personal", "guess", "Amazon refund of a personal purchase."] : ["owner_draw", "guess", "Amazon order, items unknown: personal unless an order is clearly business supplies or a device."];
  if (n === "apple") return ["owner_draw", "guess", "Apple App Store / subscription, app unknown: personal unless it's business software."];
  if (n === "best buy") return ["owner_draw", "guess", "Best Buy, items unknown: personal unless it was a business device (then Equipment)."];
  if (/^(ace hardware|the home depot|tractor supply)/.test(n)) return ["owner_draw", "guess", "Hardware store: home/property use; no business signal."];
  if (n === "editor") return ["contract_labor", "guess", "Two ACH payments to an editor in January: likely a freelance editor (1099). Needs a W-9; confirm it was business work."];
  if (/^polar\*/.test(n)) return ["software", "likely", "Polar.sh developer-tool purchases: business software."];
  if (n === "contra") return ["software", "guess", "Contra freelance platform charge (subscription/fees): business tool."];
  if (n === "asadkhaleel") return ["owner_draw", "guess", "One payment to an individual, no repeat pattern: personal unless he was a contractor."];
  if (/^(geico|progressive|prog universal|lemonade|lemonade insurance)$/.test(n)) return dir === "in" ? ["personal", "likely", "Refund/credit from a personal auto or renters policy."] : ["owner_draw", "likely", "Personal auto/renters insurance (not a business policy name)."];
  if (FUEL.test(n)) return ["car_truck", "guess", "Fuel. Business-use % needed (mileage log)."];
  if (VEHICLE.test(n)) return dir === "in" ? ["car_truck", "guess", "Vehicle/travel refund. Business-use % needed."] : ["car_truck", "guess", "Vehicle cost (wash, repair, parking, rental, transit). Business-use % needed."];
  if (n === "city of molalla") return ["taxes_licenses", "likely", "City of Molalla payment: business license."];
  if (n === "revenue department") return ["est_tax_oregon", "guess", "Oregon DOR ACH payment: tax payment (payment plan or estimate), not a deductible expense."];
  if (/^(oregon state sheriffs|clackamas county boone|clackamas cnty trl|molalla public library)/.test(n)) return ["owner_draw", "likely", "Personal government/public fee (license, parks, library)."];
  if (n === "city hall") return ["owner_draw", "guess", "'City Hall' charges look like a bar/restaurant or a personal city fee, not a business license."];
  if (/^(clarkes general store|thai yo sushi|bobablastic)/.test(n)) return ["owner_draw", "likely", "Spent at a client's business: personal (owner draw) by Justin's rule."];
  if (n === "bowker") return ["owner_draw", "likely", "Bowker ISBNs: for the separate kids' book venture, not this business."];
  if (n === "arashi vision us") return ["equipment", "guess", "Insta360 camera: business content gear → depreciation list. Confirm business use."];
  if (n === "tapstitch") return ["advertising", "guess", "Tapstitch print-on-demand: branded merch for marketing. Confirm it was for Interstellar."];
  if (/^(zillow group|endthewokeness\.com|pokemon international|tattoo garden|innovative foto)/.test(n)) return ["owner_draw", "likely", "Personal purchase (no business connection)."];
  if (RESTAURANT.test(n)) return ["owner_draw", "likely", "Restaurant/bar with no known client meeting or trip that day: personal."];
  return ["owner_draw", "guess", "Unknown merchant, no business signal: personal by the conservative default."];
}

async function save(db: any, patch: Record<string, unknown>) {
  const rows = arr(await db.AppSettings.filter({ key: "data_tasks_1120" }, "-updated_date", 1).catch(() => []));
  if (rows[0]) await db.AppSettings.update(rows[0].id, { pageSettings: { ...(rows[0].pageSettings || {}), ...patch } });
  else await db.AppSettings.create({ key: "data_tasks_1120", pageSettings: patch });
}
async function listAll(ent: any, q: any) {
  const out: any[] = [];
  for (let skip = 0; skip < 5000; skip += 500) {
    const page = arr(await ent.filter(q, "date", 500, skip).catch(() => []));
    out.push(...page);
    if (page.length < 500) break;
  }
  return out;
}

export default async function (req: Request) {
  try {
    if (Date.now() > EXPIRES) return Response.json({ error: "expired" }, { status: 410 });
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    if (body?.action === "categorize") {
      const rows = await listAll(db.LedgerTransaction, { review_status: "needs_review" });
      const t0 = Date.now();
      let n = 0;
      for (const t of rows) {
        if (Date.now() - t0 > 45000) break;
        await new Promise((r) => setTimeout(r, 220));
        const [cat, tag, why] = decide(t);
        const c = CAT[cat];
        await db.LedgerTransaction.update(t.id, {
          category: cat, tax_category: c.tax, form_line: c.line, review_status: "approved", auto_tag: tag, auto_reason: why,
          notes: [s(t.notes), `auto: ${tag} (Nov 20) — ${why}`].filter(Boolean).join("\n").slice(0, 2000),
        });
        n++;
      }
      return Response.json({ ok: true, done: n, left: rows.length - n });
    }
    if (body?.action === "tally") {
      const rows = await listAll(db.LedgerTransaction, { auto_tag: { $in: ["likely", "guess"] } });
      const counts: Record<string, { n: number; likely: number; guess: number; total: number }> = {};
      let likely = 0, guess = 0;
      for (const t of rows) {
        const k = s(t.category);
        counts[k] = counts[k] || { n: 0, likely: 0, guess: 0, total: 0 };
        counts[k].n++; counts[k].total = Math.round((counts[k].total + Number(t.amount || 0)) * 100) / 100;
        if (t.auto_tag === "likely") { counts[k].likely++; likely++; } else { counts[k].guess++; guess++; }
      }
      const top = rows.filter((t: any) => t.auto_tag === "guess").sort((a: any, b: any) => Number(b.amount) - Number(a.amount)).slice(0, 5)
        .map((t: any) => ({ date: t.date, payee: t.payee, amount: t.amount, direction: t.direction, category: t.category, reason: t.auto_reason }));
      // Vendor rules for repeated payees (2+). Likely calls apply automatically on future imports; guesses only suggest.
      const byPayee = new Map<string, any[]>();
      for (const t of rows) { const k = `${name(t)}|${t.direction}`; if (!byPayee.has(k)) byPayee.set(k, []); byPayee.get(k)!.push(t); }
      const have = new Set(arr(await db.LedgerRule.list("priority", 1000).catch(() => [])).map((r: any) => `${s(r.pattern).toLowerCase()}|${r.direction || "any"}`));
      let rules = 0;
      for (const [k, list] of byPayee) {
        if (list.length < 2) continue;
        const [pat, dir] = k.split("|");
        const cats = new Set(list.map((t: any) => t.category));
        if (cats.size !== 1 || pat.length < 3 || /^\d+$/.test(pat) || have.has(k)) continue;
        const allLikely = list.every((t: any) => t.auto_tag === "likely");
        await db.LedgerRule.create({ business_id: "interstellar", pattern: pat, match_field: "any", match_type: "contains", direction: dir, category: list[0].category, priority: allLikely ? 40 : 60, learned: allLikely, active: true, hits: 0, notes: `Vendor rule from the Nov 20 categorization (${allLikely ? "likely: applies automatically" : "guess: suggests only"})` }).catch(() => null);
        rules++;
      }
      const left = (await listAll(db.LedgerTransaction, { review_status: "needs_review" })).length;
      const out = { total: rows.length, likely, guess, counts, top_guesses: top, rules_added: rules, still_needs_review: left };
      await save(db, { result: out });
      return Response.json({ ok: true, ...out });
    }
    return Response.json({ error: "unknown" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: s((e as Error)?.message).slice(0, 300) }, { status: 500 });
  }
}
