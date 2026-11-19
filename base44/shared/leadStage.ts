// deno-lint-ignore-file no-explicit-any
// Lead pipeline stage moves (CRMClient.pipeline_stage). One code path for every mover: the board (drag, dropdown,
// "next stage"), the admin assistant, Claude jobs, Claude updating the record directly, and the automatic triggers.
// Every move writes a LeadStageMove row (who, when, from → to, why). Moves by Claude or an automation are tagged
// auto and can be undone. A move never emails or texts anyone.
export const STAGES = ["new", "contacted", "call_booked", "call_held", "proposal_sent", "won", "lost"];
export const STAGE_LABEL: Record<string, string> = { new: "New", contacted: "Contacted", call_booked: "Call booked", call_held: "Call held", proposal_sent: "Proposal sent", won: "Won", lost: "Lost" };
export const nextStage = (s: string) => { const i = STAGES.indexOf(s); return i >= 0 && i < 4 ? STAGES[i + 1] : null; };

const nowIso = () => new Date().toISOString();
const str = (v: unknown) => (v == null ? "" : String(v));
const noteDate = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
export const stageOf = (c: any) => str(c?.pipeline_stage) || (Array.isArray(c?.notes) && c.notes.some((n: any) => /Strategy call booked/i.test(str(n?.text || n))) ? "call_booked" : "new");

const PREP_KEYS: [string, string][] = [
  ["research", "Research the brand"], ["spec_site", "Build the spec website"], ["spec_cmd", "Build the spec Command System"],
  ["demo_videos", "Demo videos (website, system, portal)"], ["invite_email", "Invite email (Mission Sequence)"], ["call_structure", "Call structure + four-slide close"],
  ["closing_film", "Closing film"], ["call", "Call"], ["audit_video", "Same-day audit video"], ["quote", "Custom quote"], ["invoice", "Invoice"],
  ["thanks_email", "Thank-you + next-call email"], ["process_call", "Process call"], ["build", "Build"], ["launch", "Launch"],
];

// Won: the lead becomes a client (status Active, started today), its deal value carries over as committed billing
// lines ("not in Stripe yet" until the Stripe subscription exists; Stripe wins after that), and new-client prep starts.
async function convertWon(db: any, c: any, by: string) {
  const today = nowIso().slice(0, 10);
  const patch: any = { status: "Active", started_on: c.started_on || today };
  const lines: any[] = Array.isArray(c.services) ? [...c.services] : [];
  const one = c.deal_one_time || {};
  const mon = c.deal_monthly || {};
  if (Number(one.amount) > 0 && !lines.some((l) => l.from_deal === "one_time")) {
    lines.push({ id: `deal-one-${Date.now()}`, name: one.label || "Build (one-time)", price: 0, one_time_amount: Number(one.amount), interval: "one_time", off_stripe: true, note: `From the won deal · ${str(one.status || "quoted").replace(/_/g, " ")}`, from_deal: "one_time", status: "active" });
  }
  if (mon.plan && mon.plan !== "none" && !lines.some((l) => l.from_deal === "monthly")) {
    const name = mon.plan === "gravitycare" ? "GravïtyCare" : "HyperCare+";
    lines.push({ id: `deal-mon-${Date.now()}`, name, price: Number(mon.amount) || 0, interval: "month", off_stripe: true, committed: true, note: `Committed, not in Stripe yet · starts ${mon.start === "date" && mon.start_date ? mon.start_date : mon.start === "build_done" ? "when the build is done" : "now"}`, starts_on: mon.start === "date" ? mon.start_date || null : mon.start === "now" ? today : null, from_deal: "monthly", status: "active" });
  }
  patch.services = lines;
  await db.CRMClient.update(c.id, patch);
  const existing = await db.PrepChecklist.filter({ client_id: c.id }, "-created_date", 1).catch(() => []);
  if (!(existing || []).length) {
    const done = new Set(["research", "call", "quote"]);
    await db.PrepChecklist.create({ client_id: c.id, client_name: c.business, title: `New client prep · ${c.business}`, status: "active", started_at: nowIso(), steps: PREP_KEYS.map(([key, label]) => ({ key, label, done: done.has(key), done_at: done.has(key) ? nowIso() : null })) }).catch(() => null);
  }
  return { converted: true, by };
}

export type MoveOpts = { by: string; reason?: string; source?: string; auto?: boolean; force?: boolean };

export async function moveStage(db: any, clientOrId: any, to: string, o: MoveOpts) {
  if (!STAGES.includes(to)) throw new Error(`Unknown stage "${to}". Use one of: ${STAGES.join(", ")}`);
  const c = typeof clientOrId === "string" ? await db.CRMClient.get(clientOrId) : clientOrId;
  if (!c) throw new Error("Lead not found");
  const from = stageOf(c);
  if (from === to && !o.force) return { ok: true, unchanged: true, stage: to };
  const reason = str(o.reason).slice(0, 300);
  const patch: any = { pipeline_stage: to, stage_changed_at: nowIso(), pipeline_stage_logged: to, pipeline_stage_by: o.by, pipeline_stage_reason: reason };
  if (to === "lost") patch.lost_reason = reason || c.lost_reason || "";
  if (to === "won") patch.lost_reason = "";
  const who = o.auto ? (o.by === "claude" ? "Moved by Claude" : `Moved automatically (${o.by.replace(/^automation:/, "")})`) : `Moved by ${o.by}`;
  patch.notes = [...(Array.isArray(c.notes) ? c.notes.filter((n: any) => n && typeof n === "object") : []), { id: Date.now(), text: `Pipeline: ${STAGE_LABEL[from] || from} → ${STAGE_LABEL[to]}. ${who}${reason ? `: ${reason}` : ""}.`, date: noteDate() }];
  await db.CRMClient.update(c.id, patch);
  const move = await db.LeadStageMove.create({ client_id: c.id, client_name: c.business, from_stage: from, to_stage: to, by: o.by, auto: !!o.auto, source: o.source || (o.auto ? "automation" : "dropdown"), reason, at: nowIso() });
  let won = null;
  if (to === "won" && c.status === "Lead") won = await convertWon(db, { ...c, ...patch }, o.by);
  return { ok: true, move_id: move?.id, from, to, won };
}

export async function undoMove(db: any, moveId: string, by: string) {
  const m = await db.LeadStageMove.get(moveId);
  if (!m) throw new Error("Move not found");
  if (m.undone_at) throw new Error("Already undone");
  const c = await db.CRMClient.get(m.client_id);
  if (!c) throw new Error("Lead not found");
  // Undoing a win only moves the stage back; a client record made from the win is left for Justin to decide.
  await db.CRMClient.update(c.id, { pipeline_stage: m.from_stage || "new", stage_changed_at: nowIso(), pipeline_stage_logged: m.from_stage || "new", pipeline_stage_by: by, pipeline_stage_reason: `Undo of ${STAGE_LABEL[m.to_stage] || m.to_stage}` });
  await db.LeadStageMove.update(m.id, { undone_at: nowIso(), undone_by: by });
  await db.LeadStageMove.create({ client_id: c.id, client_name: c.business, from_stage: m.to_stage, to_stage: m.from_stage || "new", by, auto: false, source: "dropdown", reason: "Undo", at: nowIso() });
  return { ok: true, stage: m.from_stage || "new" };
}

// A direct edit of pipeline_stage (Claude updating the record from chat, or any other writer) that the log hasn't
// seen yet: record it, attributed to pipeline_stage_by (default Claude) with its reason.
export async function observe(db: any, clientId: string) {
  const c = await db.CRMClient.get(clientId).catch(() => null);
  if (!c || !c.pipeline_stage || c.pipeline_stage === c.pipeline_stage_logged) return { ok: true, nothing: true };
  const by = str(c.pipeline_stage_by) || "claude";
  const auto = !/@/.test(by);
  const reason = str(c.pipeline_stage_reason);
  const from = str(c.pipeline_stage_logged) || "new";
  // First sighting of a record whose stage never changed (e.g. a new lead at "new"): just mark it logged.
  if (from === c.pipeline_stage) { await db.CRMClient.update(c.id, { pipeline_stage_logged: c.pipeline_stage }); return { ok: true, nothing: true }; }
  await db.LeadStageMove.create({ client_id: c.id, client_name: c.business, from_stage: from, to_stage: c.pipeline_stage, by, auto, source: by === "claude" ? "claude" : "direct", reason: auto && by === "claude" ? `Moved by Claude: ${reason || "no reason given"}` : reason, at: nowIso() });
  await db.CRMClient.update(c.id, { pipeline_stage_logged: c.pipeline_stage, stage_changed_at: c.stage_changed_at || nowIso() });
  if (c.pipeline_stage === "won" && c.status === "Lead") await convertWon(db, c, by);
  return { ok: true, logged: true };
}

// Automatic triggers (scheduled): booked calls, calls that happened, proposals sent. Stripe → Won runs from the
// Stripe sync/webhook. Lost is Justin's (through the board or the assistant).
export async function runTriggers(db: any) {
  const leads = await db.CRMClient.filter({ status: "Lead" }, "-updated_date", 500).catch(() => []);
  const out: any[] = [];
  const now = Date.now();
  const drafts = await db.EmailDraft.filter({ status: "sent" }, "-updated_date", 300).catch(() => []);
  for (const c of leads || []) {
    const st = stageOf(c);
    if (["won", "lost"].includes(st)) continue;
    const booked = c.booked_call_at ? Date.parse(c.booked_call_at) : NaN;
    try {
      // Booked through Møthership's booking funnel (lead-intake sets booked_call_at).
      if (Number.isFinite(booked) && ["new", "contacted"].includes(st)) { out.push(await moveStage(db, c, "call_booked", { by: "automation:call booked", reason: `Sales call booked for ${new Date(booked).toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" })}`, auto: true, source: "automation" })); continue; }
      // The call's end time passed (calls are 30 minutes) and it was booked through Møthership.
      if (Number.isFinite(booked) && st === "call_booked" && now > booked + 30 * 60000) { out.push(await moveStage(db, c, "call_held", { by: "automation:call held", reason: "The booked call's end time passed", auto: true, source: "automation" })); continue; }
      // A proposal or deck email logged for this lead (Email Studio sends or Command's sent-email notes).
      if (["new", "contacted", "call_booked", "call_held"].includes(st)) {
        const emails = new Set((c.emails || []).map((e: string) => str(e).toLowerCase()));
        const sent = (drafts || []).find((d: any) => /proposal|deck|quote|mission (alpha|bravo)/i.test(str(d.subject)) && ([...(d.recipients || []), ...(d.results || [])].some((r: any) => r?.client_id === c.id || emails.has(str(r?.email).toLowerCase()))));
        const noted = (c.notes || []).find((n: any) => /Email sent from Command: ".*(proposal|deck|quote)/i.test(str(n?.text)));
        if (sent || noted) out.push(await moveStage(db, c, "proposal_sent", { by: "automation:proposal emailed", reason: sent ? `Email "${str(sent.subject).slice(0, 80)}" logged` : "Proposal email logged in Command", auto: true, source: "automation" }));
      }
    } catch (e: any) { out.push({ error: `${c.business}: ${str(e?.message)}` }); }
  }
  return out.filter(Boolean);
}

// Stripe invoice for a lead (created, finalized or paid): the lead is Won (auto), and the one-time deal value picks up
// what Stripe says was paid. Matched by Stripe customer id, then the invoice email.
export async function fromStripeInvoice(db: any, inv: any) {
  if (!inv) return null;
  const cust = str(typeof inv.customer === "object" ? inv.customer?.id : inv.customer);
  const email = str(inv.customer_email).toLowerCase();
  const all = await db.CRMClient.filter({ status: { $in: ["Lead", "Active"] } }, "-updated_date", 500).catch(() => []);
  const c = (all || []).find((x: any) => (cust && (x.stripe_customer_id === cust || (x.stripe_customer_ids || []).includes(cust))) || (email && (x.emails || []).map((e: string) => str(e).toLowerCase()).includes(email)));
  if (!c) return null;
  const paid = (Number(inv.amount_paid) || 0) / 100;
  const due = (Number(inv.amount_due) || 0) / 100;
  const one = c.deal_one_time || {};
  if (Number(one.amount) > 0 && (paid > 0 || inv.status === "open")) {
    const total = Math.max(Number(one.paid_amount) || 0, paid);
    const status = total >= Number(one.amount) ? "paid" : total > 0 ? "partly_paid" : "invoiced";
    await db.CRMClient.update(c.id, { deal_one_time: { ...one, status, paid_amount: total, source: "stripe", stripe_invoice_id: str(inv.id), amount_due: due } }).catch(() => null);
  }
  if (c.status === "Lead") return moveStage(db, c, "won", { by: "automation:stripe", reason: `Stripe invoice ${str(inv.number || inv.id)} ${inv.status || "created"}`, auto: true, source: "automation" });
  return { ok: true, updated: c.id };
}
