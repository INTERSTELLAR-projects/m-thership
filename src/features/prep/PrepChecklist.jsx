// New client prep: a reusable walkthrough Justin starts for any prospect or new client. Shown on the dashboard
// (every active prep) and on the client profile (that client's prep). Every step ticks and links to where it's done.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, ArrowUpRight, Rocket, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { stepsOf, progressOf, toggleStep, newPrep, linkFor } from "./steps";

const KEY = ["PrepChecklist", "all"];
const arr = (v) => (Array.isArray(v) ? v : (v && v.items) || []);

export function usePreps() {
  return useQuery({ queryKey: KEY, queryFn: async () => arr(await base44.entities.PrepChecklist.list("-updated_date", 200).catch(() => [])), staleTime: 30_000 });
}

function useMutatePrep() {
  const qc = useQueryClient();
  const set = (fn) => qc.setQueryData(KEY, (old) => fn(arr(old)));
  return {
    toggle: async (prep, key) => {
      const { steps, complete } = toggleStep(prep, key);
      const patch = { steps, status: complete ? "done" : "active", completed_at: complete ? new Date().toISOString() : null };
      set((l) => l.map((p) => (p.id === prep.id ? { ...p, ...patch } : p)));
      try { await base44.entities.PrepChecklist.update(prep.id, patch); } catch { qc.invalidateQueries({ queryKey: KEY }); }
    },
    start: async (client) => {
      const row = await base44.entities.PrepChecklist.create(newPrep(client));
      set((l) => [row, ...l]);
      return row;
    },
  };
}

function Bar({ pct }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]"><div className="h-full rounded-full bg-[#ff3c00] transition-all" style={{ width: `${pct}%` }} /></div>;
}

export function PrepSteps({ prep, onToggle, clientId }) {
  return (
    <ol className="divide-y divide-hair" data-testid="prep-steps">
      {stepsOf(prep).map((s, i) => (
        <li key={s.key} className="flex items-start gap-3 px-3.5 py-2.5">
          <button type="button" onClick={() => onToggle(prep, s.key)} aria-pressed={s.done} aria-label={`${s.done ? "Untick" : "Tick"} ${s.label}`}
            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-sm border transition-colors ${s.done ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-ink/30 text-transparent hover:border-[#ff3c00] hover:text-[#ff3c00]"}`}>
            <Check className="h-3 w-3" />
          </button>
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] leading-snug ${s.done ? "text-ink/45 line-through" : "font-medium text-ink"}`}><span className="mr-1.5 font-mono text-[10px] text-ink/35">{String(i + 1).padStart(2, "0")}</span>{s.label}</p>
            <p className="text-[11.5px] leading-snug text-ink/45">{s.hint}</p>
          </div>
          <Link to={linkFor(s, clientId || prep.client_id)} className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11.5px] text-ink/50 hover:text-[#ff3c00]">Open<ArrowUpRight className="h-3 w-3" /></Link>
        </li>
      ))}
    </ol>
  );
}

// Client profile strip: progress and the next step; expands to the full checklist. Offers to start one if none.
export function PrepStrip({ client }) {
  const q = usePreps();
  const m = useMutatePrep();
  const [open, setOpen] = useState(false);
  const prep = useMemo(() => arr(q.data).filter((p) => p.client_id === client.id && p.status !== "archived")[0] || null, [q.data, client.id]);
  if (q.isLoading) return null;
  if (!prep) {
    if (client.status !== "Lead" && client.started_on && Date.now() - new Date(client.started_on).getTime() > 90 * 864e5) return null;
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-hair bg-card/60 px-4 py-2.5">
        <p className="text-[12.5px] text-ink/60"><Rocket className="mr-1.5 inline h-3.5 w-3.5 text-[#ff3c00]" />New client prep: research to launch in 15 steps.</p>
        <button type="button" onClick={() => m.start(client).then(() => setOpen(true))} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#ff3c00] hover:underline"><Plus className="h-3.5 w-3.5" />Start</button>
      </div>
    );
  }
  const p = progressOf(prep);
  return (
    <section className="overflow-hidden rounded-md border border-hair bg-card" data-testid="prep-strip">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-4 px-4 py-3 text-left">
        <Rocket className="h-4 w-4 shrink-0 text-[#ff3c00]" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-[13.5px] font-semibold text-ink">New client prep <span className="font-mono text-[11px] font-normal text-ink/50">{p.done}/{p.total} done</span></p>
          <p className="truncate text-[12px] text-ink/55">{p.next ? <>Next: <b className="font-medium text-ink">{p.next.label}</b></> : "Every step is done."}</p>
        </div>
        <div className="hidden w-40 sm:block"><Bar pct={p.pct} /></div>
        {open ? <ChevronUp className="h-4 w-4 text-ink/40" /> : <ChevronDown className="h-4 w-4 text-ink/40" />}
      </button>
      {open ? <div className="border-t border-hair"><PrepSteps prep={prep} onToggle={m.toggle} clientId={client.id} /></div> : null}
    </section>
  );
}

// Dashboard card: every active prep with its progress, the next step (tick it right here) and a way to start one.
export function PrepBoard() {
  const q = usePreps();
  const m = useMutatePrep();
  const clientsQ = useQuery({ queryKey: ["CRMClient", "prep-pick"], queryFn: async () => arr(await base44.entities.CRMClient.list("business", 500).catch(() => [])), staleTime: 60_000 });
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const active = arr(q.data).filter((p) => p.status === "active");
  const taken = new Set(arr(q.data).filter((p) => p.status !== "archived").map((p) => p.client_id));
  const options = arr(clientsQ.data).filter((c) => !taken.has(c.id) && (!search.trim() || String(c.business || "").toLowerCase().includes(search.trim().toLowerCase()))).slice(0, 8);
  return (
    <section className="border border-hair bg-paper/80" aria-label="New client prep" data-testid="prep-board">
      <header className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <p className="label-cross text-[10.5px]">(New client prep)</p>
          <h2 className="mt-0.5 text-[16px] font-semibold tracking-[-0.02em] text-ink">{active.length ? `${active.length} in progress` : "Start one for your next prospect"}</h2>
        </div>
        <button type="button" onClick={() => setPicking((v) => !v)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#ff3c00] hover:underline"><Plus className="h-3.5 w-3.5" />Start for…</button>
      </header>
      {picking ? (
        <div className="border-b border-hair px-4 py-3">
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prospects and clients" aria-label="Search prospects and clients" className="h-9 w-full rounded-sm border border-hair bg-card px-3 text-[13px] outline-none focus:border-[#ff3c00]" />
          <ul className="mt-2 space-y-1">
            {options.map((c) => (
              <li key={c.id}><button type="button" onClick={() => m.start(c).then((r) => { setPicking(false); setSearch(""); setOpenId(r.id); })} className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-[#ff3c00]/[0.06]"><span>{c.business}</span><span className="font-mono text-[10px] text-ink/40">{c.status}</span></button></li>
            ))}
            {!options.length ? <li className="px-2 py-1.5 text-[12px] text-ink/45">{clientsQ.isLoading ? "Loading…" : "No match. Add the prospect on the Clients page first."}</li> : null}
          </ul>
        </div>
      ) : null}
      {active.length ? (
        <ul className="divide-y divide-hair">
          {active.map((prep) => {
            const p = progressOf(prep);
            const isOpen = openId === prep.id;
            return (
              <li key={prep.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  {p.next ? (
                    <button type="button" onClick={() => m.toggle(prep, p.next.key)} aria-label={`Tick ${p.next.label} for ${prep.client_name}`} title="Tick the next step"
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-sm border border-ink/30 text-transparent hover:border-[#ff3c00] hover:text-[#ff3c00]"><Check className="h-3 w-3" /></button>
                  ) : <Check className="h-5 w-5 text-green-700" />}
                  <button type="button" onClick={() => setOpenId(isOpen ? null : prep.id)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-baseline gap-2 text-[13.5px] font-semibold text-ink"><span className="truncate">{prep.client_name}</span><span className="shrink-0 font-mono text-[10.5px] font-normal text-ink/45">{p.done}/{p.total}</span></p>
                    <p className="truncate text-[12px] text-ink/55">{p.next ? <>Next: {p.next.label}</> : "Done"}</p>
                    <div className="mt-1.5"><Bar pct={p.pct} /></div>
                  </button>
                  {prep.client_id ? <Link to={`/clients/${prep.client_id}`} className="shrink-0 text-[11.5px] text-ink/50 hover:text-[#ff3c00]">Profile</Link> : null}
                </div>
                {isOpen ? <div className="border-t border-hair bg-card"><PrepSteps prep={prep} onToggle={m.toggle} /></div> : null}
              </li>
            );
          })}
        </ul>
      ) : !picking ? <p className="px-4 py-4 text-[12.5px] leading-relaxed text-ink/55">Research, spec website and Command System, demo videos, the invite, the call and the close, through to launch. Start one and tick each step as you go.</p> : null}
    </section>
  );
}
