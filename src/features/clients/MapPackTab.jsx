// Map pack tab (client cockpit): every client gets a map pack plan. Footprint, primary GBP location,
// service areas, GBP categories, map pack keywords and rank-tracking grids, all editable; Approve
// locks it in; "Draft with Claude" queues a map_pack_plan ClaudeJob built from the shared client
// context (approving that job saves its plan here). Rank history stays empty until tracking is
// connected: no numbers are shown that did not come from a tracker.
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, MapPin, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { useClientRecords } from "@/features/clients/hooks";
import { Panel, Tag, Empty } from "@/features/clients/ui";
import { timeAgo } from "@/lib/useData";
import { useJobs, useRefreshJobs, approveJob, requestChanges, cancelJob, JOB_STATUS } from "@/features/claude/jobs";
import {
  FOOTPRINTS, AREA_TYPES, PRIORITIES, INTENTS, footprintOf, gridPoints, gridSpacing, normalizeMapPack, queueMapPackPlan, mapPackFromJob,
} from "@/features/claude/mapPack";

const MapPackGridMap = lazy(() => import("./MapPackGridMap"));

const inp = "w-full border border-hair bg-paper px-2.5 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink/35 focus:border-[#ff3c00]";
const sel = `${inp} pr-6`;
const blank = () => normalizeMapPack({});

function Row({ children, onRemove }) {
  return (
    <div className="flex items-start gap-2">
      <div className="grid min-w-0 flex-1 gap-2">{children}</div>
      <button type="button" onClick={onRemove} className="mt-1.5 text-ink/35 hover:text-red-700" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function AddBtn({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#ff3c00] hover:text-ink">
      <Plus className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function JobRow({ job, onDone }) {
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState("");
  const [asking, setAsking] = useState(false);
  const s = JOB_STATUS[job.status] || JOB_STATUS.queued;
  const plan = mapPackFromJob(job);
  const run = async (k, fn) => { setBusy(k); try { await fn(); onDone(); } catch (e) { window.alert(e.message || String(e)); } finally { setBusy(""); } };
  return (
    <div className="border-b border-hair px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`mono-label px-1.5 py-0.5 text-[9px] ${s.tone}`}>{s.label}</span>
          <span className="truncate text-[13px] font-medium">{job.title}</span>
          <span className="text-[11.5px] text-ink/45">{timeAgo(job.updated_date || job.created_date)}</span>
        </div>
        <Link to={`/claude?job=${job.id}`} className="mono-label text-[9px] text-ink/45 hover:text-[#ff3c00]">open in queue</Link>
      </div>
      {job.result_summary && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/70">{job.result_summary}</p>}
      {job.status === "needs_approval" && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!!busy || !plan} onClick={() => run("ok", () => approveJob(job))} className="inline-flex h-8 items-center gap-1.5 bg-[#ff3c00] px-3 text-[12.5px] font-medium text-white disabled:opacity-50" title={plan ? "Saves this draft as the client's approved map pack plan" : "No plan in result_data"}>
            {busy === "ok" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve and save to plan
          </button>
          <button type="button" onClick={() => setAsking((v) => !v)} className="h-8 border border-hair px-3 text-[12.5px] text-ink/70 hover:border-ink/40">Request changes</button>
          <button type="button" disabled={!!busy} onClick={() => run("x", () => cancelJob(job))} className="h-8 px-2 text-[12.5px] text-ink/50 hover:text-red-700">Cancel</button>
        </div>
      )}
      {asking && (
        <div className="mt-2 flex gap-2">
          <input className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What should Claude change?" />
          <button type="button" disabled={!notes.trim() || !!busy} onClick={() => run("rc", () => requestChanges(job, notes.trim()))} className="h-8 shrink-0 bg-ink px-3 text-[12.5px] text-white disabled:opacity-50">Send</button>
        </div>
      )}
    </div>
  );
}

export default function MapPackTab({ client }) {
  const plans = useClientRecords("MapPackPlan", client.id, { sort: "-updated_date", limit: 5 });
  const record = plans.rows[0] || null;
  const [plan, setPlan] = useState(blank);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [gridIx, setGridIx] = useState(0);
  const [extra, setExtra] = useState("");
  const [composing, setComposing] = useState(false);
  const { data: allJobs = [] } = useJobs();
  const refreshJobs = useRefreshJobs();
  const jobs = allJobs.filter((j) => j.client_id === client.id && j.kind === "map_pack_plan");
  const inFlight = jobs.some((j) => ["queued", "running", "changes_requested"].includes(j.status));

  useEffect(() => {
    if (!dirty) setPlan(record ? normalizeMapPack(record) : blank());
  }, [record && record.id, record && record.updated_date]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => { setPlan((p) => ({ ...p, ...patch })); setDirty(true); };
  const setIn = (key, i, patch) => set({ [key]: plan[key].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const removeIn = (key, i) => set({ [key]: plan[key].filter((_, j) => j !== i) });
  const fp = footprintOf(plan.footprint);
  const grid = plan.rank_grids[Math.min(gridIx, Math.max(0, plan.rank_grids.length - 1))];
  const points = useMemo(() => (grid ? gridPoints(grid.center, grid.radius_miles, grid.grid_size).length : 0), [grid]);

  const save = async (status) => {
    setBusy(status);
    try {
      const now = new Date().toISOString();
      const data = { ...plan, client_id: client.id, client_name: client.business, status, updated_at: now, ...(status === "approved" ? { approved_at: now } : {}) };
      if (record) await plans.update(record.id, data); else await plans.create(data);
      setDirty(false);
    } catch (e) { window.alert(e.message || String(e)); } finally { setBusy(""); }
  };
  const draftWithClaude = async () => {
    setBusy("claude");
    try { await queueMapPackPlan(client, record, extra.trim()); setExtra(""); setComposing(false); refreshJobs(); } catch (e) { window.alert(e.message || String(e)); } finally { setBusy(""); }
  };

  if (plans.isLoading) return <div className="py-16 text-center text-ink/50">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-cross">(Map pack plan)</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {record ? <Tag tone={record.status === "approved" && !dirty ? "green" : "amber"}>{dirty ? "Unsaved changes" : record.status === "approved" ? "Approved" : "Draft"}</Tag> : <Tag>No plan yet</Tag>}
            {record && <span className="text-[12px] text-ink/50">Updated {timeAgo(record.updated_at || record.updated_date)}{record.approved_at ? ` · approved ${timeAgo(record.approved_at)}` : ""}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setComposing((v) => !v)} disabled={inFlight} title={inFlight ? "A map pack job is already in the queue" : "Queue a draft for Claude, built from this client's profile"} className="inline-flex h-10 items-center gap-1.5 border border-hair px-4 text-[13px] font-medium text-ink hover:border-ink/40 disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5 text-[#ff3c00]" /> Draft with Claude
          </button>
          <button type="button" onClick={() => save("draft")} disabled={!!busy || (!dirty && !!record)} className="inline-flex h-10 items-center gap-1.5 border border-hair px-4 text-[13px] font-medium text-ink hover:border-ink/40 disabled:opacity-50">
            {busy === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save draft
          </button>
          <button type="button" onClick={() => save("approved")} disabled={!!busy || (record && record.status === "approved" && !dirty)} className="inline-flex h-10 items-center gap-1.5 bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 text-[13px] font-medium text-white disabled:opacity-50">
            {busy === "approved" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
          </button>
        </div>
      </div>

      {composing && (
        <Panel label="Draft with Claude" title="Queue a map pack plan">
          <div className="space-y-3 p-4">
            <p className="text-[12.5px] leading-relaxed text-ink/60">Claude gets this client's full profile (Client Criteria, services, goals){record ? " and the current plan" : ""}, researches the GBP, site and listings, and returns a draft for your OK. Approving it saves it here.</p>
            <textarea rows={3} className={inp} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Anything to add (optional): a city to push, a category to test…" />
            <div className="flex gap-2">
              <button type="button" onClick={draftWithClaude} disabled={busy === "claude"} className="inline-flex h-9 items-center gap-1.5 bg-[#ff3c00] px-4 text-[13px] font-medium text-white disabled:opacity-50">
                {busy === "claude" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Send to Claude
              </button>
              <button type="button" onClick={() => setComposing(false)} className="h-9 px-3 text-[13px] text-ink/55 hover:text-ink"><X className="inline h-3.5 w-3.5" /> Close</button>
            </div>
          </div>
        </Panel>
      )}

      {jobs.length > 0 && (
        <Panel label="Claude Queue" title="Map pack drafts">
          {jobs.slice(0, 5).map((j) => <JobRow key={j.id} job={j} onDone={refreshJobs} />)}
        </Panel>
      )}

      {/* Footprint */}
      <Panel label="Footprint" title="How far does this business reach?">
        <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {FOOTPRINTS.map((f) => (
            <button key={f.key} type="button" onClick={() => set({ footprint: f.key })} className={`border p-3 text-left transition-colors ${plan.footprint === f.key ? "border-[#ff3c00] bg-[#ff3c00]/[0.05]" : "border-hair hover:border-ink/40"}`}>
              <span className="text-[14px] font-semibold">{f.label}</span>
              <p className="mt-1 text-[12px] leading-relaxed text-ink/60">{f.help}</p>
            </button>
          ))}
        </div>
        <p className="border-t border-hair px-4 py-3 text-[12.5px] text-ink/65"><span className="font-medium text-ink">{fp.label}:</span> {fp.help}</p>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        {/* Rank grids */}
        <Panel label="Rank grids" title="Where rankings are checked from">
          <div className="space-y-4 p-4">
            <div>
              <p className="mono-label mb-1.5 text-[9.5px] text-ink/55">Primary location (GBP address)</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_120px_120px]">
                <input className={inp} value={plan.primary_location.address} placeholder="Address exactly as on the GBP" onChange={(e) => set({ primary_location: { ...plan.primary_location, address: e.target.value } })} />
                <input className={inp} type="number" step="any" value={plan.primary_location.lat ?? ""} placeholder="lat" onChange={(e) => set({ primary_location: { ...plan.primary_location, lat: e.target.value === "" ? null : Number(e.target.value) } })} />
                <input className={inp} type="number" step="any" value={plan.primary_location.lng ?? ""} placeholder="lng" onChange={(e) => set({ primary_location: { ...plan.primary_location, lng: e.target.value === "" ? null : Number(e.target.value) } })} />
              </div>
            </div>
            {plan.rank_grids.map((g, i) => (
              <Row key={i} onRemove={() => { removeIn("rank_grids", i); setGridIx(0); }}>
                <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr_1fr_80px_70px]">
                  <input className={inp} value={g.label} placeholder="Label" onFocus={() => setGridIx(i)} onChange={(e) => setIn("rank_grids", i, { label: e.target.value })} />
                  <input className={inp} type="number" step="any" value={g.center.lat ?? ""} placeholder="center lat" onFocus={() => setGridIx(i)} onChange={(e) => setIn("rank_grids", i, { center: { ...g.center, lat: e.target.value === "" ? null : Number(e.target.value) } })} />
                  <input className={inp} type="number" step="any" value={g.center.lng ?? ""} placeholder="center lng" onFocus={() => setGridIx(i)} onChange={(e) => setIn("rank_grids", i, { center: { ...g.center, lng: e.target.value === "" ? null : Number(e.target.value) } })} />
                  <input className={inp} type="number" min="0.5" step="0.5" value={g.radius_miles ?? ""} title="Radius (miles)" onFocus={() => setGridIx(i)} onChange={(e) => setIn("rank_grids", i, { radius_miles: Number(e.target.value) || 0 })} />
                  <select className={sel} value={g.grid_size} title="Grid size" onFocus={() => setGridIx(i)} onChange={(e) => setIn("rank_grids", i, { grid_size: Number(e.target.value) })}>
                    {[3, 5, 7, 9, 11, 13].map((n) => <option key={n} value={n}>{n}×{n}</option>)}
                  </select>
                </div>
              </Row>
            ))}
            <AddBtn onClick={() => { set({ rank_grids: [...plan.rank_grids, { label: plan.rank_grids.length ? "Extra grid" : "Main grid", center: { lat: plan.primary_location.lat, lng: plan.primary_location.lng }, radius_miles: plan.footprint === "regional" ? 15 : 5, grid_size: plan.footprint === "regional" ? 9 : 7 }] }); setGridIx(plan.rank_grids.length); }}>Add grid{plan.primary_location.lat != null ? " on the GBP location" : ""}</AddBtn>
            {grid ? (
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {plan.rank_grids.length > 1 && plan.rank_grids.map((g, i) => (
                    <button key={i} type="button" onClick={() => setGridIx(i)} className={`h-7 border px-2.5 text-[12px] ${i === gridIx ? "border-ink bg-ink text-white" : "border-hair text-ink/70"}`}>{g.label}</button>
                  ))}
                  <span className="text-[12px] text-ink/55">{grid.grid_size}×{grid.grid_size} = {points} points · {grid.radius_miles} mi radius · {gridSpacing(grid.radius_miles, grid.grid_size).toFixed(2)} mi apart</span>
                </div>
                {points ? (
                  <Suspense fallback={<div className="grid h-[360px] place-items-center border border-hair text-[12px] text-ink/45">Loading map…</div>}>
                    <MapPackGridMap grid={grid} office={plan.primary_location} />
                  </Suspense>
                ) : <p className="text-[12.5px] text-ink/50">Enter the grid's center lat/lng to preview it.</p>}
              </div>
            ) : <Empty>No rank grid yet. Add one centred on the GBP location.</Empty>}
          </div>
        </Panel>

        <div className="space-y-6">
          {/* Categories */}
          <Panel label="Google Business Profile" title="Categories">
            <div className="space-y-3 p-4">
              <div>
                <p className="mono-label mb-1.5 text-[9.5px] text-ink/55">Primary category</p>
                <input className={inp} value={plan.gbp_categories.primary} onChange={(e) => set({ gbp_categories: { ...plan.gbp_categories, primary: e.target.value } })} />
              </div>
              <div>
                <p className="mono-label mb-1.5 text-[9.5px] text-ink/55">Secondary categories (comma separated)</p>
                <input className={inp} value={plan.gbp_categories.secondary.join(", ")} onChange={(e) => set({ gbp_categories: { ...plan.gbp_categories, secondary: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })} />
              </div>
              <div>
                <p className="mono-label mb-1.5 text-[9.5px] text-ink/55">Note</p>
                <textarea rows={2} className={inp} value={plan.gbp_categories.note} onChange={(e) => set({ gbp_categories: { ...plan.gbp_categories, note: e.target.value } })} />
              </div>
            </div>
          </Panel>

          {/* Service areas */}
          <Panel label="Service areas" title={`${plan.service_areas.length} area${plan.service_areas.length === 1 ? "" : "s"}`}>
            <div className="space-y-2 p-4">
              {plan.service_areas.map((a, i) => (
                <Row key={i} onRemove={() => removeIn("service_areas", i)}>
                  <div className="grid gap-2 sm:grid-cols-[1fr_96px_86px]">
                    <input className={inp} value={a.name} placeholder="Bluffton, SC" onChange={(e) => setIn("service_areas", i, { name: e.target.value })} />
                    <select className={sel} value={a.type} onChange={(e) => setIn("service_areas", i, { type: e.target.value })}>{AREA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                    <input className={inp} value={a.priority} placeholder="core" onChange={(e) => setIn("service_areas", i, { priority: e.target.value })} />
                  </div>
                  <input className={`${inp} text-[12px] text-ink/60`} value={a.source} placeholder="Source URL" onChange={(e) => setIn("service_areas", i, { source: e.target.value })} />
                </Row>
              ))}
              <AddBtn onClick={() => set({ service_areas: [...plan.service_areas, { name: "", type: "city", priority: "", source: "" }] })}>Add area</AddBtn>
            </div>
          </Panel>
        </div>
      </div>

      {/* Keywords */}
      <Panel label="Map pack keywords" title={`${plan.keywords.length} keyword${plan.keywords.length === 1 ? "" : "s"}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-hair text-left">
                <th className="mono-label px-4 py-2 text-[9.5px] font-normal text-ink/50">Keyword</th>
                <th className="mono-label w-32 px-2 py-2 text-[9.5px] font-normal text-ink/50">Priority</th>
                <th className="mono-label w-32 px-2 py-2 text-[9.5px] font-normal text-ink/50">Intent</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {plan.keywords.map((k, i) => (
                <tr key={i} className="border-b border-hair last:border-b-0">
                  <td className="px-4 py-1.5"><input className={inp} value={k.term} onChange={(e) => setIn("keywords", i, { term: e.target.value })} /></td>
                  <td className="px-2 py-1.5"><select className={sel} value={k.priority} onChange={(e) => setIn("keywords", i, { priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></td>
                  <td className="px-2 py-1.5"><select className={sel} value={k.intent} onChange={(e) => setIn("keywords", i, { intent: e.target.value })}>{INTENTS.map((p) => <option key={p} value={p}>{p.replace("_", " ")}</option>)}</select></td>
                  <td className="px-2 py-1.5 text-center"><button type="button" onClick={() => removeIn("keywords", i)} className="text-ink/35 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4"><AddBtn onClick={() => set({ keywords: [...plan.keywords, { term: "", priority: "medium", intent: "local" }] })}>Add keyword</AddBtn></div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel label="Notes & sources" title="Where this came from">
          <div className="space-y-3 p-4">
            <textarea rows={4} className={inp} value={plan.notes} placeholder="Notes" onChange={(e) => set({ notes: e.target.value })} />
            {plan.sources.length ? (
              <ul className="space-y-1">
                {plan.sources.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                    {s.url && /^https?:/.test(s.url) ? <a href={s.url} target="_blank" rel="noreferrer" className="truncate text-ink/70 hover:text-[#ff3c00]">{s.label || s.url}</a> : <span className="truncate text-ink/70">{s.label || s.url}</span>}
                    <button type="button" onClick={() => removeIn("sources", i)} className="text-ink/35 hover:text-red-700"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[12.5px] text-ink/45">No sources recorded.</p>}
          </div>
        </Panel>

        <Panel label="Rank history" title="Rankings over time">
          <div className="flex items-start gap-3 p-4">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink/35" />
            <p className="text-[13px] leading-relaxed text-ink/55">Rank history — appears once tracking is connected. Each grid point above becomes a tracked search; nothing is shown here until real results come in.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
