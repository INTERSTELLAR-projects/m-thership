import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Clipboard, Clock, Hourglass, Plus, RefreshCw, Rocket } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { CHECKPOINTS, REBUILD_VERSION, TOTAL, WHO, progressOf } from "@/features/rebuild/checklist";
import { btnGhost } from "@/features/tasks/lib/ui";
import { cn } from "@/lib/utils";

/*
 * Packages › 40-Day Rebuild (Nov 25 2026). One package, one checklist, every client.
 * List: where each client is on the 40 days, what's next, what the client still owes.
 * Client: the ordered checklist, checkpoint by checkpoint; tick, note, or mark "waiting on client".
 * Start payment and launch date are read from the client's 40-Day Rebuild row in Financing.
 */
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => (d ? new Date(String(d).length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");
const list = (p) => p.then((r) => (Array.isArray(r) ? r : r?.items || [])).catch(() => []);

function useRebuildData() {
  const [state, setState] = useState({ recs: [], clients: [], fin: [], loading: true });
  const load = async () => {
    const [recs, clients, fin] = await Promise.all([
      list(base44.entities.RebuildProgress.list("-updated_date", 300)),
      list(base44.entities.CRMClient.list("business", 500)),
      list(base44.entities.ClientFinancing.filter({ kind: "package" })),
    ]);
    setState({ recs, clients, fin, loading: false });
  };
  useEffect(() => {
    load();
    let un = null;
    try { un = base44.entities.RebuildProgress.subscribe(() => load()); } catch { /* live updates optional */ }
    return () => typeof un === "function" && un();
  }, []);
  return { ...state, reload: load };
}

// Items Møthership already knows: start payment and launch from the Financing package row.
function withDerived(rec, fin) {
  const f = fin.find((x) => x.client_id && x.client_id === rec.client_id);
  if (!f) return rec;
  const items = { ...(rec.items || {}) };
  const mark = (k, date, by) => { if (date && !items[k]?.done) items[k] = { done: true, done_at: date, by, auto: true }; };
  mark("financing", f.created_date, "Financing");
  mark("start_paid", f.start_paid_date, "Stripe");
  if (f.launch_date && f.launch_date <= today() && f.stripe_subscription_id) mark("billing_on", f.launch_date, "Stripe");
  return { ...rec, items };
}

function Bar({ p }) {
  return (
    <div className="flex h-1.5 w-full gap-[3px]">
      {p.cps.map((c) => (
        <div key={c.key} className="h-full flex-1 overflow-hidden rounded-[1px] bg-ink/[0.08]" title={`${c.title}: ${c.done}/${c.total}`} style={{ flexGrow: c.total }}>
          <div className="h-full rounded-[1px]" style={{ width: `${(c.done / c.total) * 100}%`, background: c.complete ? "#1a1a1a" : "linear-gradient(90deg,#ff3c00,#ff6a00)" }} />
        </div>
      ))}
    </div>
  );
}

function DayChip({ p, rec }) {
  if (p.launched || rec.launched_at) return <span className="mono-label rounded-sm bg-ink px-1.5 py-[2px] text-[9px] text-white">Launched</span>;
  if (p.dayNum === null) return <span className="mono-label rounded-sm border border-hair px-1.5 py-[2px] text-[9px] text-ink/55">Intake pending</span>;
  return <span className={cn("mono-label rounded-sm px-1.5 py-[2px] text-[9px]", p.dayNum > 40 ? "bg-[#ff3c00] text-white" : p.behind ? "border border-[#ff3c00]/50 text-[#ff3c00]" : "border border-hair text-ink/70")}>Day {Math.max(0, p.dayNum)} / 40</span>;
}

function StartDialog({ clients, existing, onClose, onCreate }) {
  const [id, setId] = useState("");
  const taken = new Set(existing.map((r) => r.client_id));
  const options = clients.filter((c) => c.business && !taken.has(c.id) && c.status !== "Inactive");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-md border border-hair bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-[15px] font-semibold">Start a 40-Day Rebuild</p>
        <p className="mt-1 text-[12px] text-ink/60">Pick the client. Their checklist starts at checkpoint 0 (signed & paid).</p>
        <select value={id} onChange={(e) => setId(e.target.value)} className="mt-4 w-full rounded-md border border-hair bg-canvas px-3 py-2 text-[13px]">
          <option value="">Choose a client…</option>
          {options.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="button" disabled={!id} onClick={() => onCreate(clients.find((c) => c.id === id))} className="rounded-md bg-[#ff3c00] px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40">Start checklist</button>
        </div>
      </div>
    </div>
  );
}

function ItemRow({ item, state, onToggle, onWaiting, onNote, locked }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(state?.note || "");
  const done = !!state?.done;
  const waiting = !done && (item.who === "client" || state?.waiting);
  return (
    <li className={cn("rounded-md border px-3 py-2.5 transition-colors", done ? "border-hair bg-canvas/40" : locked ? "border-hair bg-card opacity-60" : "border-hair bg-card")}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={onToggle} aria-label={done ? "Mark not done" : "Mark done"}
          className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border transition-colors", done ? "border-ink bg-ink text-white" : "border-ink/30 hover:border-[#ff3c00]")}>
          {done ? <Check className="h-3.5 w-3.5" /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[13px] leading-snug", done ? "text-ink/45 line-through" : "text-ink")}>{item.t}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full border px-1.5 py-px text-[10px] font-medium", WHO[item.who].tone)}>{WHO[item.who].label}</span>
            {item.mins ? <span className="inline-flex items-center gap-1 text-[10.5px] text-ink/45"><Clock className="h-3 w-3" />{item.mins} min</span> : null}
            {item.auto ? <span className="text-[10.5px] text-ink/45">Auto: {item.auto}</span> : null}
            {done && state?.done_at ? <span className="text-[10.5px] text-ink/45">Done {fmt(state.done_at)}{state.by ? ` · ${state.by}` : ""}</span> : null}
            {waiting && item.who !== "client" ? <span className="rounded-full bg-[#ffaa00]/15 px-1.5 py-px text-[10px] font-medium text-[#8a4b00]">Waiting on client</span> : null}
            {state?.note && !open ? <span className="truncate text-[10.5px] text-ink/60">· {state.note}</span> : null}
          </div>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-ink/35 hover:text-ink" aria-label="Notes"><ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} /></button>
      </div>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
          <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (state?.note || "") && onNote(note)} placeholder="Note (link, what's left, who has it)…" className="min-w-0 flex-1 rounded-md border border-hair bg-canvas px-2.5 py-1.5 text-[12px]" />
          {item.who !== "client" && !done ? (
            <button type="button" onClick={onWaiting} className={cn("rounded-md border px-2 py-1 text-[11px]", state?.waiting ? "border-[#ffaa00] bg-[#ffaa00]/15 text-[#8a4b00]" : "border-hair text-ink/60")}>
              <Hourglass className="mr-1 inline h-3 w-3" />{state?.waiting ? "Waiting on client" : "Mark waiting on client"}
            </button>
          ) : null}
        </div>
      )}
    </li>
  );
}

function ClientView({ rec, p, client, onUpdate }) {
  const [openCp, setOpenCp] = useState(() => new Set([p.current?.key || CHECKPOINTS[0].key]));
  const [copied, setCopied] = useState(false);
  const items = rec.items || {};
  const set = async (key, patch) => {
    const prev = items[key] || {};
    const next = { ...items, [key]: { ...prev, ...patch } };
    const extra = {};
    if (key === "intake_complete" && patch.done && !rec.intake_completed_at) extra.intake_completed_at = today();
    if (key === "system_live" && patch.done && items.domain_live?.done && !rec.launched_at) { extra.launched_at = today(); extra.status = "launched"; }
    await onUpdate(rec, { items: next, ...extra });
  };
  const toggle = (it) => set(it.key, items[it.key]?.done ? { done: false, done_at: null } : { done: true, done_at: new Date().toISOString(), waiting: false });
  const owe = p.waiting.filter((i) => i.who === "client" || items[i.key]?.waiting);
  const nudge = `Hi ${client?.contact_name?.split(" ")[0] || "there"}, to keep your 40-day rebuild on schedule we still need:\n${owe.map((i) => `• ${i.t}`).join("\n")}\n\nYou can send these in your portal or reply here. Thank you!\nJustin, Interstellar`;

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-md border border-hair bg-card p-4">
          <div className="flex items-center justify-between"><DayChip p={p} rec={rec} /><span className="font-mono text-[11px] text-ink/55">{p.done}/{p.total}</span></div>
          <p className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.04em]">{p.pct}%</p>
          <div className="mt-3"><Bar p={p} /></div>
          <dl className="mt-4 grid grid-cols-2 gap-y-1 text-[11.5px] text-ink/60">
            <dt>Started</dt><dd className="text-right">{fmt(rec.started_at)}</dd>
            <dt>Intake complete</dt><dd className="text-right">{fmt(rec.intake_completed_at)}</dd>
            <dt>Launch target</dt><dd className={cn("text-right", p.behind && "font-semibold text-[#ff3c00]")}>{p.target ? fmt(p.target.toISOString()) : "—"}</dd>
            <dt>Launched</dt><dd className="text-right">{fmt(rec.launched_at)}</dd>
            <dt>Your time left</dt><dd className="text-right">~{Math.round(p.minsLeft / 60 * 10) / 10} h</dd>
          </dl>
        </div>
        <nav className="rounded-md border border-hair bg-card p-2">
          {p.cps.map((c) => (
            <button key={c.key} type="button" onClick={() => { setOpenCp((s) => new Set([...s, c.key])); document.getElementById(`cp-${c.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px]", p.current?.key === c.key ? "bg-[#ff3c00]/[0.07] text-ink" : "text-ink/65 hover:bg-ink/[0.03]")}>
              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]", c.complete ? "bg-ink text-white" : p.current?.key === c.key ? "bg-[#ff3c00] text-white" : "border border-ink/25 text-ink/50")}>{c.complete ? <Check className="h-2.5 w-2.5" /> : c.n}</span>
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <span className="font-mono text-[10px] text-ink/40">{c.done}/{c.total}</span>
            </button>
          ))}
        </nav>
        {owe.length ? (
          <div className="rounded-md border border-[#ffaa00]/50 bg-[#ffaa00]/[0.07] p-3">
            <p className="text-[12px] font-semibold text-[#8a4b00]">Client owes {owe.length} item{owe.length === 1 ? "" : "s"}</p>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(nudge); setCopied(true); setTimeout(() => setCopied(false), 1600); }} className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#8a4b00] hover:underline">
              <Clipboard className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy a reminder message"}
            </button>
          </div>
        ) : null}
      </aside>

      <div className="space-y-3">
        {p.cps.map((c) => {
          const isOpen = openCp.has(c.key);
          const locked = p.current && c.n > p.current.n + 1;
          return (
            <section key={c.key} id={`cp-${c.key}`} className={cn("scroll-mt-4 rounded-md border bg-card", p.current?.key === c.key ? "border-[#ff3c00]/50" : "border-hair")}>
              <button type="button" onClick={() => setOpenCp((s) => { const n = new Set(s); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; })} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", c.complete ? "bg-ink text-white" : p.current?.key === c.key ? "bg-[#ff3c00] text-white" : "border border-ink/20 text-ink/55")}>{c.complete ? <Check className="h-4 w-4" /> : c.n}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{c.title} <span className="ml-1 font-mono text-[10.5px] font-normal text-ink/45">{c.day < 0 ? "before day 0" : `by day ${c.day}`}</span></p>
                  <p className="truncate text-[11.5px] text-ink/55">{c.why}</p>
                </div>
                <span className="font-mono text-[11px] text-ink/50">{c.done}/{c.total}</span>
                <ChevronDown className={cn("h-4 w-4 text-ink/40 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <ul className="space-y-1.5 border-t border-hair p-3">
                  {c.items.map((it) => (
                    <ItemRow key={it.key} item={it} state={items[it.key]} locked={locked && !items[it.key]?.done}
                      onToggle={() => toggle(it)} onWaiting={() => set(it.key, { waiting: !items[it.key]?.waiting })} onNote={(note) => set(it.key, { note })} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function RebuildPage({ tabs = null }) {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { recs, clients, fin, loading, reload } = useRebuildData();
  const [starting, setStarting] = useState(false);
  const [filter, setFilter] = useState("active");

  const rows = useMemo(() => recs.map((r) => {
    const rec = withDerived(r, fin);
    return { rec, p: progressOf(rec), client: clients.find((c) => c.id === r.client_id) };
  }), [recs, fin, clients]);
  const shown = rows.filter(({ rec, p }) => (filter === "all" ? true : filter === "launched" ? p.launched || rec.status === "launched" : rec.status !== "archived" && !(p.launched || rec.status === "launched")))
    .sort((a, b) => (b.p.behind - a.p.behind) || ((a.p.dayNum ?? -1) - (b.p.dayNum ?? -1)) * -1);
  const selected = rows.find((r) => r.rec.client_id === clientId || r.rec.id === clientId) || null;

  const create = async (c) => {
    const rec = await base44.entities.RebuildProgress.create({ client_id: c.id, client_name: c.business, checklist_version: REBUILD_VERSION, started_at: today(), status: "active", items: {} });
    setStarting(false);
    await reload();
    navigate(`/packages/rebuild/${rec.client_id || rec.id}`);
  };
  const update = async (rec, patch) => {
    // never persist derived (auto) marks; they're recomputed from Financing each load
    const items = Object.fromEntries(Object.entries(patch.items || rec.items || {}).filter(([, v]) => !v?.auto || v.done === false));
    await base44.entities.RebuildProgress.update(rec.id, { ...patch, items });
    await reload();
  };

  const counts = {
    active: rows.filter((r) => !(r.p.launched || r.rec.status === "launched") && r.rec.status !== "archived").length,
    behind: rows.filter((r) => r.p.behind).length,
    owed: rows.reduce((n, r) => n + (r.p.launched ? 0 : r.p.waiting.filter((i) => i.who === "client").length), 0),
    launched: rows.filter((r) => r.p.launched || r.rec.status === "launched").length,
  };

  return (
    <div className="min-h-screen pb-24">
      <PageHeader breadcrumb="Packages / 40-Day Business Rebuild" title="40-Day Rebuild" rightText={loading ? "loading" : `${TOTAL} steps · 9 checkpoints`}>
        <button type="button" onClick={reload} className={btnGhost}><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />Refresh</button>
      </PageHeader>
      {tabs}
      <div className="space-y-5 px-5 py-6 md:px-8">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => navigate("/packages/rebuild")} className="mono-label inline-flex items-center gap-2 text-[10px] text-ink/50 hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" />All rebuilds · {rows.length}</button>
              <div className="flex gap-2">
                <Link to="/financing" className={btnGhost}>Financing <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                {selected.rec.client_id ? <Link to={`/clients/${selected.rec.client_id}`} className={btnGhost}>Cockpit <ArrowUpRight className="h-3.5 w-3.5" /></Link> : null}
              </div>
            </div>
            <h2 className="text-[24px] font-semibold tracking-[-0.03em]">{selected.rec.client_name}</h2>
            <ClientView key={selected.rec.id} rec={selected.rec} p={selected.p} client={selected.client} onUpdate={update} />
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-[13px] leading-relaxed text-ink/60">One package, one checklist. Every client moves through the same {TOTAL} steps in an order where nothing waits on something unfinished: collect everything at intake, brand before website, system core before lead forms, launch, then month one.</p>
              <button type="button" onClick={() => setStarting(true)} className="inline-flex items-center gap-2 rounded-md bg-[#ff3c00] px-3 py-2 text-[12.5px] font-semibold text-white hover:opacity-90"><Rocket className="h-4 w-4" />Start a rebuild</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["In progress", counts.active], ["Behind schedule", counts.behind], ["Items clients owe", counts.owed], ["Launched", counts.launched]].map(([k, v], i) => (
                <div key={k} className="rounded-md border border-hair bg-card px-4 py-3">
                  <p className={cn("text-[24px] font-semibold leading-none tracking-[-0.04em]", i === 1 && v ? "text-[#ff3c00]" : "")}>{v}</p>
                  <p className="mono-label mt-1.5 text-[8.5px] text-ink/45">{k}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              {[["active", "In progress"], ["launched", "Launched"], ["all", "All"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setFilter(k)} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-medium", filter === k ? "border-ink bg-ink text-white" : "border-hair bg-card text-ink/70")}>{l}</button>
              ))}
            </div>
            <div className="overflow-hidden rounded-md border border-hair bg-card">
              {shown.length ? (
                <ul className="divide-y divide-hair">
                  {shown.map(({ rec, p }) => (
                    <li key={rec.id}>
                      <Link to={`/packages/rebuild/${rec.client_id || rec.id}`} className="group grid items-center gap-3 px-4 py-3 hover:bg-ink/[0.03] md:grid-cols-[220px_minmax(0,1fr)_260px_auto]">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-medium">{rec.client_name}</p>
                          <div className="mt-1 flex items-center gap-2"><DayChip p={p} rec={rec} /><span className="font-mono text-[10px] text-ink/45">{p.pct}%</span></div>
                        </div>
                        <div className="min-w-0">
                          <Bar p={p} />
                          <p className="mt-1.5 truncate text-[11.5px] text-ink/60">{p.current ? <><b className="font-semibold text-ink">{p.current.title}</b> · next: {p.next[0]?.t || "—"}</> : "All checkpoints done"}</p>
                        </div>
                        <p className="text-[11.5px] text-ink/55">{p.waiting.filter((i) => i.who === "client").length ? <span className="text-[#8a4b00]">Client owes {p.waiting.filter((i) => i.who === "client").length}</span> : "Nothing owed by client"}{p.behind ? <span className="ml-2 font-semibold text-[#ff3c00]">Behind</span> : null}</p>
                        <span className="hidden h-8 w-8 items-center justify-center border border-hair text-ink/40 group-hover:border-[#ff3c00] group-hover:bg-[#ff3c00] group-hover:text-white md:flex"><ArrowUpRight className="h-3.5 w-3.5" /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-5 py-12 text-center">
                  <p className="text-[13px] text-ink/55">{loading ? "Loading…" : "No rebuilds here yet."}</p>
                  {!loading && <button type="button" onClick={() => setStarting(true)} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#ff3c00]"><Plus className="h-4 w-4" />Start the first one</button>}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {starting && <StartDialog clients={clients} existing={recs} onClose={() => setStarting(false)} onCreate={create} />}
    </div>
  );
}
