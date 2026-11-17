import { useMemo, useState } from "react";
import { Grid3x3, ListTodo, X, Check, Minus, HelpCircle } from "lucide-react";
import { Spinner, Empty } from "@/features/agents/ui";
import { CopyButton } from "./AreaView";
import { checkKindFor, industryGroup, updateEntity, sweepPrompt } from "./data";

const KIND_TABS = [["site", "Sites"], ["app", "Apps"], ["business", "Business"]];
const STATUS = [["pass", "Pass", Check], ["fail", "Fail", X], ["unknown", "Unknown", HelpCircle], ["not_applicable", "N/A", Minus]];

function CellEditor({ check, standard, target, onClose, onSaved }) {
  const [status, setStatus] = useState(check.status || "unknown");
  const [note, setNote] = useState(check.note || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    setBusy(true); setErr("");
    try {
      await updateEntity("StandardCheck", check.id, { status, note: note.slice(0, 600), checked_at: new Date().toISOString(), checked_by: "justin" });
      onSaved({ ...check, status, note });
      onClose();
    } catch (e) { setErr(String(e.message || e)); setBusy(false); }
  };
  return (
    <div className="glass fixed inset-x-3 bottom-3 z-50 rounded-xl p-4 shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:w-[420px]" role="dialog" aria-label="Set standard status">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow !text-[9.5px]">{target.client_name} · {target.app_name}</p>
          <p className="mt-1 text-[14px] font-medium text-white">{standard.title}</p>
          <p className="mt-1 text-[12px] text-[var(--ink-m)]">{standard.rule}</p>
          {standard.how_to_check ? <p className="mt-1 text-[11.5px] text-[var(--ink-s)]">Check: {standard.how_to_check}</p> : null}
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="text-[var(--ink-s)] hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUS.map(([k, l, I]) => <button key={k} type="button" className={`chip ${status === k ? "on" : ""}`} onClick={() => setStatus(k)}><I className="h-3 w-3" />{l}</button>)}
      </div>
      <input className="inp mt-2.5 w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional, no secrets)" aria-label="Note" />
      {err ? <p className="mt-2 text-[12px] text-[#ff8a7f]">{err}</p> : null}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-d" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-f" onClick={save} disabled={busy}>{busy ? <Spinner size={12} /> : null}Save</button>
      </div>
    </div>
  );
}

export default function StandardsMatrix({ data, setData }) {
  const { standards, checks, areas, clients } = data;
  const [kind, setKind] = useState("site");
  const [view, setView] = useState("matrix");
  const [areaF, setAreaF] = useState("");
  const [indF, setIndF] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [edit, setEdit] = useState(null);

  const industryOf = useMemo(() => new Map(clients.map((c) => [c.id, industryGroup(c.industry)])), [clients]);
  const industries = useMemo(() => [...new Set([...industryOf.values()].filter(Boolean))].sort(), [industryOf]);
  const kindsPresent = useMemo(() => new Set(standards.filter((s) => s.active !== false).map((s) => checkKindFor(s.kind))), [standards]);

  const cols = useMemo(() => standards.filter((s) => s.active !== false && checkKindFor(s.kind) === kind && (!areaF || s.area_id === areaF) && (!indF || !s.industry || s.industry === indF)).sort((a, b) => (a.order || 0) - (b.order || 0)), [standards, kind, areaF, indF]);
  const colIds = useMemo(() => new Set(cols.map((c) => c.id)), [cols]);

  const { rows, byKey } = useMemo(() => {
    const map = new Map();
    const bk = new Map();
    for (const c of checks) {
      if (c.app_kind !== kind || !colIds.has(c.standard_id)) continue;
      if (indF && industryOf.get(c.client_id) !== indF) continue;
      const rk = `${c.client_id}|${c.app_or_site}`;
      if (!map.has(rk)) map.set(rk, { key: rk, client_id: c.client_id, client_name: c.client_name, app_or_site: c.app_or_site, app_name: c.app_name, app_kind: c.app_kind });
      bk.set(`${rk}|${c.standard_id}`, c);
    }
    let list = [...map.values()].sort((a, b) => `${a.client_name}${a.app_name}`.localeCompare(`${b.client_name}${b.app_name}`));
    if (gapsOnly) list = list.filter((r) => cols.some((s) => { const c = bk.get(`${r.key}|${s.id}`); return c && c.status !== "pass" && c.status !== "not_applicable"; }));
    return { rows: list, byKey: bk };
  }, [checks, kind, colIds, indF, industryOf, gapsOnly, cols]);

  const colStats = (s) => {
    const cs = rows.map((r) => byKey.get(`${r.key}|${s.id}`)).filter((c) => c && c.status !== "not_applicable");
    return cs.length ? Math.round((cs.filter((c) => c.status === "pass").length / cs.length) * 100) : 0;
  };
  const gapsFor = (r) => cols.map((s) => ({ s, c: byKey.get(`${r.key}|${s.id}`) })).filter((x) => x.c && x.c.status !== "pass" && x.c.status !== "not_applicable");

  const totals = useMemo(() => {
    let pass = 0, fail = 0, unknown = 0;
    rows.forEach((r) => cols.forEach((s) => { const c = byKey.get(`${r.key}|${s.id}`); if (!c) return; if (c.status === "pass") pass++; else if (c.status === "fail") fail++; else if (c.status === "unknown") unknown++; }));
    return { pass, fail, unknown };
  }, [rows, cols, byKey]);

  const onSaved = (c) => setData((d) => ({ ...d, checks: d.checks.map((x) => (x.id === c.id ? { ...x, ...c } : x)) }));

  return (
    <div className="space-y-4 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="tablist" aria-label="Matrix">
            {KIND_TABS.filter(([k]) => k !== "business" || kindsPresent.has("business")).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          <div className="seg" role="tablist" aria-label="View">
            <button type="button" role="tab" aria-selected={view === "matrix"} className={view === "matrix" ? "on" : ""} onClick={() => setView("matrix")}><Grid3x3 className="h-3.5 w-3.5" />Matrix</button>
            <button type="button" role="tab" aria-selected={view === "sweep"} className={view === "sweep" ? "on" : ""} onClick={() => setView("sweep")}><ListTodo className="h-3.5 w-3.5" />Sweep list</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="inp" value={areaF} onChange={(e) => setAreaF(e.target.value)} aria-label="Filter by area"><option value="">All areas</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <select className="inp" value={indF} onChange={(e) => setIndF(e.target.value)} aria-label="Filter by industry"><option value="">All industries</option>{industries.map((v) => <option key={v} value={v}>{v}</option>)}</select>
          <button type="button" className={`chip !h-[34px] ${gapsOnly ? "on" : ""}`} onClick={() => setGapsOnly((v) => !v)}>Only gaps</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11.5px] text-[var(--ink-m)]">
        <span className="flex items-center gap-1.5"><span className="cell pass !m-0 !h-3.5 !w-3.5" />{totals.pass} pass</span>
        <span className="flex items-center gap-1.5"><span className="cell fail !m-0 !h-3.5 !w-3.5" />{totals.fail} fail</span>
        <span className="flex items-center gap-1.5"><span className="cell unknown !m-0 !h-3.5 !w-3.5" />{totals.unknown} not checked yet</span>
        <span className="flex items-center gap-1.5"><span className="cell not_applicable !m-0 !h-3.5 !w-3.5" />n/a</span>
        <span className="text-[var(--ink-s)]">Click a cell to record what you found. Nothing is guessed.</span>
      </div>

      {!rows.length || !cols.length ? <Empty>No {KIND_TABS.find(([k]) => k === kind)?.[1].toLowerCase()} to show with these filters. Run the agent to add checks for new standards or clients.</Empty> : view === "matrix" ? (
        <div className="card scroll-d overflow-auto" style={{ maxHeight: "70vh" }}>
          <table className="mx w-max min-w-full text-left">
            <thead>
              <tr>
                <th className="rowh min-w-[220px] px-4 pb-2 align-bottom"><span className="eyebrow">{rows.length} {kind === "app" ? "apps" : kind === "site" ? "sites" : "clients"} × {cols.length} standards</span></th>
                {cols.map((s) => (
                  <th key={s.id} className="colh" title={`${s.title}: ${s.rule}`}>
                    <span>{s.title}</span>
                    <p className="mono mt-1.5 text-center text-[9px] text-[#ff8a3d]">{colStats(s)}%</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const gaps = gapsFor(r).length;
                return (
                  <tr key={r.key} className="hover:bg-white/[0.02]">
                    <td className="rowh px-4 py-1.5">
                      <p className="truncate text-[12.5px] font-medium text-white" title={r.app_name}>{r.client_name}</p>
                      <p className="mono truncate text-[10px] text-[var(--ink-s)]">{r.app_name !== r.client_name ? r.app_name : kind}{gaps ? <span className="text-[#ff8a3d]"> · {gaps} open</span> : " · complete"}</p>
                    </td>
                    {cols.map((s) => {
                      const c = byKey.get(`${r.key}|${s.id}`);
                      if (!c) return <td key={s.id}><span className="cell none" title="Not applicable to this client" /></td>;
                      return (
                        <td key={s.id}>
                          <button type="button" className={`cell ${c.status || "unknown"}`} title={`${s.title} · ${c.status}${c.note ? ` · ${c.note}` : ""}`} aria-label={`${r.client_name} ${s.title}: ${c.status}`} onClick={() => setEdit({ check: c, standard: s, target: r })}>
                            {c.status === "fail" ? <X className="h-3 w-3" /> : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => {
            const items = gapsFor(r);
            return (
              <div key={r.key} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-white">{r.client_name}</p>
                    <p className="mono text-[10.5px] text-[var(--ink-s)]">{r.app_name} · {items.length ? `${items.length} to confirm or fix` : "every standard confirmed"}</p>
                  </div>
                  {items.length ? <CopyButton text={sweepPrompt({ target: r, items })} label="Copy sweep prompt" /> : <span className="mono text-[10.5px] text-[#ff8a3d]">COMPLETE</span>}
                </div>
                {items.length ? (
                  <ul className="mt-3 space-y-1">
                    {items.map(({ s, c }) => (
                      <li key={s.id}>
                        <button type="button" className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/[0.04]" onClick={() => setEdit({ check: c, standard: s, target: r })}>
                          <span className={`cell ${c.status} !m-0 !mt-0.5 !h-3.5 !w-3.5 shrink-0`} />
                          <span className="min-w-0 text-[12.5px]"><span className="text-[var(--ink-d)]">{s.title}</span>{c.note ? <span className="text-[var(--ink-s)]"> · {c.note}</span> : null}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {edit ? <CellEditor key={edit.check.id} {...edit} onClose={() => setEdit(null)} onSaved={onSaved} /> : null}
    </div>
  );
}
