import { useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { AUTONOMY, KIND_SHORT, StatusPill, relTime } from "./ui";

const ORDER = { broken: 0, live: 1, paused: 2, planned: 3 };
const COLS = [
  ["name", "Agent"], ["status", "Status"], ["kind", "Kind"], ["schedule", "Schedule"], ["last_run_at", "Last run"], ["autonomy", "Autonomy"], ["approval_required", "Approval"],
];

export default function ListView({ agents, depts, onPick, selectedKey, showClient }) {
  const [sort, setSort] = useState({ key: "status", dir: 1 });
  const groups = useMemo(() => {
    const cmp = (a, b) => {
      const k = sort.key;
      let v = 0;
      if (k === "status") v = (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || (a.build_order || 0) - (b.build_order || 0);
      else if (k === "last_run_at") v = String(b.last_run_at || "").localeCompare(String(a.last_run_at || ""));
      else v = String(a[k] ?? "").localeCompare(String(b[k] ?? ""));
      return v * sort.dir || String(a.name).localeCompare(String(b.name));
    };
    const extra = [...new Set(agents.map((a) => a.department))].filter((d) => !depts.some((x) => x.key === d)).map((d) => ({ key: d, label: d === "ceo" ? "Client CEO" : d === "brain" ? "Brain" : d }));
    return [...extra, ...depts].map((d) => ({ d, list: agents.filter((a) => a.department === d.key).sort(cmp) })).filter((g) => g.list.length);
  }, [agents, depts, sort]);

  if (!agents.length) return <div className="grid h-full place-items-center text-[13px] text-[var(--ink-s)]">No agents match these filters.</div>;

  return (
    <div className="scroll-d absolute inset-0 overflow-auto px-3 pb-24 pt-2 md:px-6">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left">
        <thead className="sticky top-0 z-10">
          <tr>
            {COLS.map(([k, l]) => (
              <th key={k} className={`border-b border-[var(--hair-d)] bg-[rgba(8,9,14,.94)] px-3 py-2.5 backdrop-blur ${k === "schedule" || k === "autonomy" ? "hidden lg:table-cell" : ""}`}>
                <button type="button" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : 1 }))} className="eyebrow inline-flex items-center gap-1 hover:text-white">
                  {l}{sort.key === k ? <ArrowDownUp className="h-3 w-3 text-[#ff8a3d]" /> : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(({ d, list }) => (
            <FragmentRows key={d.key} d={d} list={list} onPick={onPick} selectedKey={selectedKey} showClient={showClient} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRows({ d, list, onPick, selectedKey, showClient }) {
  const live = list.filter((a) => a.status === "live").length;
  const planned = list.filter((a) => a.status === "planned").length;
  return (
    <>
      <tr>
        <td colSpan={7} className="px-3 pb-2 pt-6">
          <span className="mono text-[11px] uppercase tracking-[.18em] text-white">{d.label}</span>
          <span className="mono ml-3 text-[10.5px] text-[var(--ink-s)]">{live} live · {planned} planned · {list.length} total</span>
        </td>
      </tr>
      {list.map((a) => (
        <tr key={a.key} onClick={() => onPick(a)} className={`cursor-pointer transition hover:bg-white/[0.035] ${selectedKey === a.key ? "bg-[rgba(255,60,0,.08)]" : ""}`}>
          <td className="border-b border-[var(--hair-d)] px-3 py-2.5">
            <p className="text-[13px] font-medium text-white">{a.name}</p>
            <p className="max-w-[420px] truncate text-[11.5px] text-[var(--ink-s)]">{showClient && a.client_name ? `${a.client_name} · ` : ""}{a.branch ? `${a.branch} · ` : ""}{a.role}</p>
          </td>
          <td className="border-b border-[var(--hair-d)] px-3 py-2.5"><StatusPill status={a.status} /></td>
          <td className="border-b border-[var(--hair-d)] px-3 py-2.5 text-[12px] text-[var(--ink-m)]">{KIND_SHORT[a.kind] || a.kind}</td>
          <td className="hidden border-b border-[var(--hair-d)] px-3 py-2.5 text-[12px] text-[var(--ink-m)] lg:table-cell">{a.schedule || "—"}</td>
          <td className="border-b border-[var(--hair-d)] px-3 py-2.5 text-[12px] text-[var(--ink-m)]">
            {a.status === "planned" ? <span className="text-[var(--ink-s)]">{a.build_order ? `build #${a.build_order}` : "—"}</span> : <>{relTime(a.last_run_at)}{a.last_status && a.last_status !== "success" ? <span className={`ml-1.5 ${a.last_status === "failed" ? "text-[#ff8a7f]" : "text-[var(--ink-s)]"}`}>· {a.last_status.replace("_", " ")}</span> : null}</>}
          </td>
          <td className="hidden border-b border-[var(--hair-d)] px-3 py-2.5 text-[12px] text-[var(--ink-m)] lg:table-cell">{AUTONOMY[a.autonomy] || (a.autonomy_target ? `→ ${AUTONOMY[a.autonomy_target]}` : "—")}</td>
          <td className="border-b border-[var(--hair-d)] px-3 py-2.5 text-[12px]">{a.approval_required ? <span className="text-[#ffb27a]">Justin</span> : <span className="text-[var(--ink-s)]">Auto</span>}</td>
        </tr>
      ))}
    </>
  );
}
