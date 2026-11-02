import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ClipboardCopy, Flag, Loader2, Lock, Plane, Rocket, Send, ShieldCheck, Sparkles } from "lucide-react";
import Panel from "@/features/tasks/ui-kit/Panel";
import { inputClass } from "@/features/tasks/lib/ui";
import { cn } from "@/lib/utils";
import FieldControl from "./FieldControl";
import { CARE_PLANS, SALES, SALES_FOR_PACKAGE, STEPS, defaultPrice, evaluate, missingAsText, needsCare, nextAction, saleByKey } from "./catalog";
import { applyIntake, createFlight, kickoff, loadContext, patchFlight, saveAnswers, sendIntake } from "./store";

const plusDays = (iso, n) => {
  const d = new Date((iso || new Date().toLocaleDateString("en-CA")) + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};

/* ---------- step 2: the deal lives on the flight record itself ---------- */
function DealEditor({ flight, client, pkgKey, onPatch }) {
  const allowed = SALES_FOR_PACKAGE[pkgKey] || [];
  const options = SALES.filter((s) => allowed.includes(s.key));
  const others = SALES.filter((s) => !allowed.includes(s.key));
  const sale = saleByKey(flight.sale_package);
  const care = needsCare(flight, client);
  const [price, setPrice] = useState(String(flight.price || ""));
  const [careValue, setCareValue] = useState(String(flight.care_value || ""));
  useEffect(() => setPrice(String(flight.price || "")), [flight.price]);
  useEffect(() => setCareValue(String(flight.care_value || "")), [flight.care_value]);

  const pickSale = (key) => {
    const s = saleByKey(key);
    const patch = { sale_package: key, price: defaultPrice(key), include_onboarding: Boolean(s && s.onboarding) };
    if (s && s.needsCare && !flight.care_plan) Object.assign(patch, { care_plan: "orbit_local", care_value: 750, care_start_date: plusDays(flight.start_date, s.careDelay || 30) });
    onPatch(patch);
  };

  return (
    <div className="space-y-3 rounded-md border border-hair bg-canvas/60 p-3.5">
      <div>
        <p className="mono-label mb-1.5 text-[9px] text-ink/50">Package sold</p>
        <div className="flex flex-wrap gap-1.5">
          {options.map((s) => (
            <button key={s.key} type="button" onClick={() => pickSale(s.key)} className={cn("rounded-sm border px-2.5 py-1.5 text-left text-[12px]", flight.sale_package === s.key ? "border-[#ff3c00] bg-[#ff3c00]/[0.07]" : "border-hair bg-card hover:border-ink/40")}>
              <span className="font-medium">{s.label}</span> <span className="font-mono text-[10px] text-ink/50">{s.price}</span>
            </button>
          ))}
          <select value={allowed.includes(flight.sale_package) ? "" : flight.sale_package || ""} onChange={(e) => e.target.value && pickSale(e.target.value)} className="h-8 rounded-sm border border-hair bg-card px-2 text-[11.5px] text-ink/60">
            <option value="">Other…</option>
            {others.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        {sale && sale.key === "intel_briefing" ? <p className="mt-1 text-[11px] text-[#c24100]">The Intel Briefing is never sold alone; it comes with every build.</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mono-label text-[9px] text-ink/50">{sale && /\/mo/.test(sale.price || "") ? "Monthly price ($)" : "Price ($)"}</span>
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} onBlur={() => Number(price) !== Number(flight.price) && onPatch({ price: Number(price) || 0 })} className={cn(inputClass, "mt-1")} />
        </label>
        <label className="block">
          <span className="mono-label text-[9px] text-ink/50">Start date</span>
          <input type="date" value={flight.start_date || ""} onChange={(e) => onPatch({ start_date: e.target.value })} className={cn(inputClass, "mt-1")} />
        </label>
        <label className="flex items-end gap-2 pb-2 text-[12px]">
          <input type="checkbox" checked={Boolean(flight.include_onboarding)} onChange={(e) => onPatch({ include_onboarding: e.target.checked })} className="h-4 w-4 accent-[#ff3c00]" />
          New client (run onboarding SOP)
        </label>
      </div>
      {care ? (
        <div className="rounded-md border border-[#ff3c00]/40 bg-[#ff3c00]/[0.04] p-3">
          <p className="mono-label flex items-center gap-1.5 text-[9px] text-[#ff3c00]"><ShieldCheck className="h-3.5 w-3.5" /> Required care plan</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {CARE_PLANS.map((c) => (
              <button key={c.key} type="button" onClick={() => onPatch({ care_plan: c.key, care_value: c.base })} className={cn("rounded-sm border px-2 py-1 text-[11.5px]", flight.care_plan === c.key ? "border-ink bg-ink text-white" : "border-hair bg-card hover:border-ink/40")}>
                {c.label} <span className="font-mono text-[10px] opacity-70">${c.base}/mo</span>
              </button>
            ))}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mono-label text-[9px] text-ink/50">Care monthly ($)</span>
              <input value={careValue} onChange={(e) => setCareValue(e.target.value.replace(/[^\d.]/g, ""))} onBlur={() => Number(careValue) !== Number(flight.care_value) && onPatch({ care_value: Number(careValue) || 0 })} className={cn(inputClass, "mt-1 h-8")} />
            </label>
            <label className="block">
              <span className="mono-label text-[9px] text-ink/50">Care starts (billing at launch)</span>
              <input type="date" value={flight.care_start_date || ""} onChange={(e) => onPatch({ care_start_date: e.target.value })} className={cn(inputClass, "mt-1 h-8")} />
            </label>
          </div>
        </div>
      ) : sale && sale.needsCare ? (
        <p className="text-[11.5px] text-ink/55">{client.business} is already on a care plan, so none is added.</p>
      ) : null}
    </div>
  );
}

/* ---------- stepper ---------- */
function Stepper({ ev, current, onPick }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {ev.steps.map((s) => {
        const locked = ev.lock[s.id];
        const active = s.id === current;
        const state = s.complete ? "done" : s.missing.length ? "missing" : s.flagged.length ? "flagged" : "clear";
        return (
          <button key={s.id} type="button" onClick={() => onPick(s.id)} title={locked || s.why} className={cn("flex min-w-[104px] flex-1 flex-col gap-1 rounded-md border px-2.5 py-2 text-left transition-colors", active ? "border-ink bg-ink text-white" : "border-hair bg-card hover:border-ink/40")}>
            <span className="flex items-center gap-1.5">
              <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full font-mono text-[9px]", state === "done" ? (active ? "bg-white text-ink" : "bg-ink text-white") : state === "missing" ? "border border-[#ff3c00] text-[#ff3c00]" : active ? "border border-white/60" : "border border-ink/30 text-ink/50")}>
                {state === "done" ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : s.num}
              </span>
              <span className="truncate text-[11.5px] font-medium">{s.short}</span>
              {locked ? <Lock className={cn("ml-auto h-3 w-3", active ? "text-white/60" : "text-ink/30")} /> : null}
            </span>
            <span className={cn("mono-label text-[8px]", active ? "text-white/70" : state === "missing" ? "text-[#ff3c00]" : "text-ink/40")}>
              {state === "done" ? "Done" : state === "missing" ? s.missing.length + " blocking" : state === "flagged" ? s.flagged.length + " flagged" : s.optionalMissing.length ? s.optionalMissing.length + " optional" : "Clear"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- the panel ---------- */
export default function FlightWalkthrough({ pkg, client: baseClient, startedProjects = [], onChanged }) {
  const [ctx, setCtx] = useState(null);
  const [flight, setFlight] = useState(null);
  const [step, setStep] = useState("client");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  // Saves run one after another on the latest record, so two quick edits never overwrite each other.
  const flightRef = useRef(null);
  const queueRef = useRef(Promise.resolve());
  useEffect(() => { flightRef.current = flight; }, [flight]);
  const serial = (fn) => {
    const p = queueRef.current.then(async () => {
      const next = await fn(flightRef.current);
      if (next) {
        flightRef.current = next;
        setFlight(next);
      }
      return next;
    });
    queueRef.current = p.catch(() => null);
    return p;
  };

  const reload = useCallback(async () => {
    const c = await loadContext(baseClient.id, pkg.key);
    setCtx(c);
    setFlight(c.flight);
    if (c.flight && c.flight.current_step) setStep(c.flight.current_step);
  }, [baseClient.id, pkg.key]);

  useEffect(() => {
    setCtx(null);
    setFlight(null);
    setMsg(null);
    reload().catch((e) => setMsg({ tone: "err", text: e.message }));
  }, [reload]);

  const client = (ctx && ctx.client) || baseClient;
  const sources = useMemo(() => ({ client, dossier: ctx && ctx.dossier, intake: ctx && ctx.intake }), [client, ctx]);
  const ev = useMemo(() => (flight ? evaluate(flight, client, sources, { startedProjects }) : null), [flight, client, sources, startedProjects]);
  const pending = useMemo(() => ((ctx && ctx.responses) || []).filter((r) => !((flight && flight.intake_applied) || []).includes(r.id)), [ctx, flight]);
  const action = ev ? nextAction(ev, flight, { pendingAnswers: pending.length }) : null;

  const run = async (label, fn, ok) => {
    setBusy(label);
    setMsg(null);
    try {
      const out = await fn();
      if (ok) setMsg({ tone: "ok", text: typeof ok === "function" ? ok(out) : ok });
      if (onChanged) onChanged();
      return out;
    } catch (e) {
      setMsg({ tone: "err", text: (e && e.response && e.response.data && e.response.data.error) || e.message || "Something went wrong" });
      return null;
    } finally {
      setBusy("");
    }
  };

  const goStep = (id) => {
    setStep(id);
    serial((f) => (f && f.current_step !== id ? patchFlight(f, { current_step: id }) : null)).catch(() => null);
  };
  const patch = (p) => run("save", () => serial((f) => patchFlight(f, p)));
  const saveField = (key, value) => run("save", () => serial((f) => saveAnswers(f, client, { [key]: value })));
  const skip = (key, reason) => run("save", () => serial((f) => patchFlight(f, { skipped: { ...(f.skipped || {}), [key]: { reason, at: new Date().toISOString() } } })));
  const unskip = (key) =>
    run("save", () => serial((f) => {
      const next = { ...(f.skipped || {}) };
      delete next[key];
      return patchFlight(f, { skipped: next });
    }));
  const toggleCheck = (key) =>
    run("save", () => serial((f) => {
      const next = { ...(f.launch_checks || {}) };
      if (next[key]) delete next[key];
      else next[key] = new Date().toISOString();
      return patchFlight(f, { launch_checks: next });
    }));

  const doIntake = () => run("intake", () => serial((f) => sendIntake(f, client, ev)), client.portal_enabled ? "Intake request is live in their portal. Their answers land back here to apply." : "Intake form created. Their portal is off: turn it on in the cockpit, or copy the list and email it.");
  const doApply = () => run("apply", async () => {
    await serial(async (start) => {
      let f = start;
      for (const r of pending) f = await applyIntake(f, client, r);
      return f;
    });
    await reload();
  }, "Client answers applied and copied to the CRM + intake audit.");
  const doKickoff = () => run("kickoff", async () => {
    let result = null;
    await serial(async (f) => {
      const out = await kickoff(f, client, ev);
      result = out.result;
      return out.flight;
    });
    setStep("launch");
    return result;
  }, (r) => "Service started: " + ((r && r.tasks) || 0) + " SOP steps created" + (r && r.care ? " plus the care plan" : "") + ".");
  const doLaunched = () => run("launch", () => serial((f) => patchFlight(f, { status: "launched", launched_at: new Date().toISOString() })), "Marked launched.");
  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(missingAsText(ev, client.business));
      setMsg({ tone: "ok", text: "Missing-items list copied." });
    } catch {
      setMsg({ tone: "err", text: "Clipboard blocked by the browser." });
    }
  };

  const onAction = () => {
    if (!action) return;
    if (action.kind === "step") goStep(action.step);
    else if (action.kind === "intake") doIntake();
    else if (action.kind === "apply") doApply();
    else if (action.kind === "kickoff") { goStep("kickoff"); doKickoff(); }
    else if (action.kind === "launched") doLaunched();
  };

  if (!ctx) {
    return (
      <Panel kicker="Flight plan" title="Onboarding walkthrough">
        <p className="flex items-center gap-2 text-[12px] text-ink/50"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading what is already on file…</p>
      </Panel>
    );
  }

  if (!flight) {
    return (
      <Panel kicker="Flight plan" title="Onboarding walkthrough">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-[12.5px] leading-relaxed text-ink/60">
            No flight plan for {client.business} on {pkg.label} yet. It walks one fixed order — client, deal, business info, brand, access, goals, kickoff, launch — and asks only what this package's SOPs need. Anything already in the CRM, dossier or intake audit is prefilled.
          </p>
          <button type="button" disabled={Boolean(busy)} onClick={() => run("create", async () => { const f = await createFlight(client, pkg); setFlight(f); setStep("client"); })} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#ff3c00] px-4 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-50">
            {busy === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plane className="h-3.5 w-3.5" />} Start flight plan
          </button>
        </div>
        {msg ? <p className={cn("mt-3 text-[12px]", msg.tone === "err" ? "text-red-700" : "text-ink/70")}>{msg.text}</p> : null}
      </Panel>
    );
  }

  const cur = ev.steps.find((s) => s.id === step) || ev.steps[0];
  const locked = ev.lock[cur.id];
  const sale = saleByKey(flight.sale_package);
  const allMissing = ev.steps.flatMap((s) => s.missing.map((i) => ({ ...i, step: s })));
  const allFlagged = ev.steps.flatMap((s) => s.flagged.map((i) => ({ ...i, step: s })));
  const idx = STEPS.findIndex((s) => s.id === cur.id);

  return (
    <Panel
      kicker={"Flight plan · " + (sale ? sale.label : "pick a package")}
      title={"Onboarding " + client.business + " · " + ev.progress + "% of blocking info in"}
      action={busy === "save" ? <span className="mono-label inline-flex items-center gap-1.5 text-[9px] text-ink/45"><Loader2 className="h-3 w-3 animate-spin" /> Saving</span> : flight.status === "launched" ? <span className="mono-label rounded-sm bg-ink px-2 py-1 text-[9px] text-white">Launched</span> : null}
      bodyClassName="p-0"
    >
      {/* next action */}
      <div className="flex flex-wrap items-center gap-3 border-b border-hair bg-canvas/60 px-5 py-3">
        <div className="h-1.5 w-28 overflow-hidden rounded-sm bg-ink/[0.07]">
          <div className="h-full bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00] transition-all duration-700" style={{ width: ev.progress + "%" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mono-label text-[8.5px] text-ink/45">Next action</p>
          <p className="truncate text-[13px] font-semibold text-ink">{action.label} <span className="font-normal text-ink/50">· {action.hint}</span></p>
        </div>
        {action.kind !== "done" ? (
          <button type="button" onClick={onAction} disabled={Boolean(busy && busy !== "save")} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#ff3c00] px-4 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-50">
            {busy && busy !== "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.kind === "kickoff" ? <Rocket className="h-3.5 w-3.5" /> : action.kind === "intake" ? <Send className="h-3.5 w-3.5" /> : action.kind === "apply" ? <Sparkles className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
            {action.kind === "step" ? "Go" : action.label}
          </button>
        ) : null}
      </div>

      <div className="px-5 pt-4">
        <Stepper ev={ev} current={cur.id} onPick={goStep} />
      </div>

      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* current step */}
        <div className="min-w-0 space-y-3">
          <div>
            <p className="mono-label text-[9px] text-ink/45">Step {cur.num} of 8</p>
            <h4 className="text-[16px] font-semibold tracking-[-0.02em]">{cur.title}</h4>
            <p className="mt-0.5 text-[12px] text-ink/60"><span className="font-medium text-ink/75">Why this step:</span> {cur.why}</p>
          </div>
          {msg ? <p className={cn("rounded-md border px-3 py-2 text-[12px]", msg.tone === "err" ? "border-red-600/30 bg-red-50 text-red-700" : "border-hair bg-canvas text-ink/75")}>{msg.text}</p> : null}
          {locked ? (
            <p className="flex items-start gap-2 rounded-md border border-dashed border-hair bg-canvas/60 px-3 py-2.5 text-[12px] text-ink/60"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {locked} You can still look; the action unlocks once that is done.</p>
          ) : null}

          {cur.id === "deal" ? <DealEditor flight={flight} client={client} pkgKey={pkg.key} onPatch={patch} /> : null}

          {cur.id === "kickoff" ? (
            <div className="rounded-md border border-hair bg-canvas/60 p-3.5">
              {ev.started ? (
                <div className="space-y-1.5 text-[12.5px]">
                  <p className="flex items-center gap-2 font-medium"><Check className="h-4 w-4" /> Service started{flight.kicked_off_at ? " " + flight.kicked_off_at.slice(0, 10) : ""}.</p>
                  {[...(flight.project_ids || []), ...startedProjects.map((p) => p.id)].filter((v, i, a) => a.indexOf(v) === i).map((id) => (
                    <Link key={id} to={"/projects/" + id} className="block text-[12px] text-[#ff3c00] hover:underline">Open project →</Link>
                  ))}
                  {flight.followup_task_id ? <p className="text-[11.5px] text-ink/55">Flagged items were turned into one follow-up task on the project.</p> : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-md text-[12px] text-ink/60">Creates the {sale ? sale.label : ""} project{needsCare(flight, client) ? " and its care plan" : ""} with every SOP step dated from {flight.start_date || "today"}. {allFlagged.length ? allFlagged.length + " flagged item(s) become one follow-up task." : ""}</p>
                  <button type="button" disabled={Boolean(locked) || Boolean(busy)} onClick={doKickoff} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#ff3c00] px-4 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-40">
                    {busy === "kickoff" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />} Start the service
                  </button>
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            {cur.items.filter((i) => i.field).sort((a, b) => (a.level === b.level ? 0 : a.level === "blocking" ? -1 : 1)).map((i) => (
              <FieldControl key={i.key} item={i} onSave={(v) => saveField(i.key, v)} onSkip={(r) => skip(i.key, r)} onUnskip={() => unskip(i.key)} />
            ))}
            {cur.items.filter((i) => i.check).map((i) => (
              <div key={i.key} className={cn("flex items-center gap-3 rounded-md border px-3.5 py-2.5", i.done ? "border-hair bg-card" : i.skipped ? "border-dashed border-[#ff3c00]/50" : "border-[#ff3c00]/40 bg-card")}>
                <button type="button" disabled={Boolean(locked)} onClick={() => toggleCheck(i.key)} className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-sm border", i.done ? "border-ink bg-ink text-white" : "border-ink/30 hover:border-[#ff3c00]")} aria-label="Tick">
                  {i.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </button>
                <span className={cn("min-w-0 flex-1 text-[12.5px]", i.done && "text-ink/50 line-through")}>{i.label}</span>
                {!i.done ? (
                  i.skipped ? (
                    <button type="button" onClick={() => unskip(i.key)} className="mono-label text-[8.5px] text-[#c24100]">Flagged · unflag</button>
                  ) : (
                    <button type="button" onClick={() => skip(i.key, "")} className="inline-flex items-center gap-1 text-[10.5px] text-ink/40 hover:text-[#ff3c00]"><Flag className="h-3 w-3" /> Skip</button>
                  )
                ) : null}
              </div>
            ))}
            {!cur.items.length ? <p className="text-[12px] text-ink/50">Nothing this package needs here.</p> : null}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button type="button" disabled={idx <= 0} onClick={() => goStep(STEPS[idx - 1].id)} className="text-[12px] text-ink/50 hover:text-ink disabled:opacity-30">← {idx > 0 ? STEPS[idx - 1].short : ""}</button>
            {idx < STEPS.length - 1 ? (
              <button type="button" onClick={() => goStep(STEPS[idx + 1].id)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink hover:text-[#ff3c00]">
                {cur.missing.length ? "Continue (" + cur.missing.length + " still blocking)" : "Next: " + STEPS[idx + 1].short} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* what's missing + intake */}
        <aside className="space-y-3">
          <div className="rounded-md border border-hair bg-canvas/60 p-3">
            <p className="mono-label text-[9px] text-ink/50">What's missing</p>
            {allMissing.length ? (
              <ul className="mt-2 max-h-[260px] space-y-1 overflow-y-auto">
                {allMissing.map((i) => (
                  <li key={i.step.id + i.key}>
                    <button type="button" onClick={() => goStep(i.step.id)} className="flex w-full items-start gap-2 text-left text-[11.5px] hover:text-[#ff3c00]">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff3c00]" />
                      <span className="min-w-0 flex-1">{i.label}</span>
                      <span className="mono-label shrink-0 text-[8px] text-ink/40">{i.step.short}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11.5px] text-ink/60">Nothing blocking.</p>
            )}
            {allFlagged.length ? <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#c24100]"><Flag className="h-3 w-3" /> {allFlagged.length} skipped with a flag</p> : null}
            <p className="mt-1 text-[10.5px] text-ink/45">{ev.steps.reduce((n, s) => n + s.optionalMissing.length, 0)} optional item(s) open</p>
          </div>

          <div className="rounded-md border border-hair bg-canvas/60 p-3">
            <p className="mono-label text-[9px] text-ink/50">Client intake request</p>
            <p className="mt-1.5 text-[11.5px] text-ink/65">
              {flight.intake_sent_at ? "Sent " + flight.intake_sent_at.slice(0, 10) + " · " + (flight.intake_fields || []).length + " questions." : "One form with every missing thing the client owns: " + ev.askable.length + " item(s)."}
              {!client.portal_enabled ? " Portal is off for this client." : ""}
            </p>
            {pending.length ? (
              <button type="button" onClick={doApply} disabled={Boolean(busy)} className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-ink px-3 text-[11.5px] text-white disabled:opacity-50">
                {busy === "apply" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Apply {pending.length} response(s)
              </button>
            ) : null}
            <div className="mt-2 flex gap-1.5">
              <button type="button" onClick={doIntake} disabled={Boolean(busy) || !ev.askable.length} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-hair bg-card px-2 text-[11.5px] hover:border-ink/40 disabled:opacity-40">
                {busy === "intake" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {flight.intake_sent_at ? "Update request" : "Send request"}
              </button>
              <button type="button" onClick={copyList} title="Copy the missing list (for email)" className="inline-flex h-8 items-center justify-center rounded-md border border-hair bg-card px-2 text-ink/60 hover:border-ink/40">
                <ClipboardCopy className="h-3.5 w-3.5" />
              </button>
            </div>
            {!client.portal_enabled ? <Link to={"/clients/" + client.id} className="mt-1.5 block text-[10.5px] text-[#ff3c00] hover:underline">Turn on their portal in the cockpit →</Link> : null}
          </div>

          <p className="text-[10.5px] leading-snug text-ink/45">Everything saved here also fills the CRM and the client's intake audit, so Claude jobs, briefs and later forms never ask again. Access is recorded as who granted what — never passwords.</p>
        </aside>
      </div>
    </Panel>
  );
}
