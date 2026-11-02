import { useMemo, useState } from "react";
import { Copy, Check, ExternalLink, Search, Mail, Globe, Bot } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Tag, Empty, Panel } from "@/features/clients/ui";
import { timeAgo } from "@/lib/useData";
import TargetCard from "./TargetCard";
import { BOARD_COLUMNS, KIND_LABEL, METHOD_LABEL, HUMAN_METHODS, CLOSED, inputCls, nowIso, napBlock } from "./lib";

// ---------------- KPI tiles + per-client table ----------------

export function countsFor(targets, messages) {
  return {
    found: targets.length,
    qualified: targets.filter((t) => !["discovered", ...CLOSED].includes(t.status)).length,
    awaiting: messages.filter((m) => m.status === "needs_approval").length,
    sent: messages.filter((m) => ["sent", "replied", "bounced"].includes(m.status)).length,
    replies: messages.filter((m) => m.status === "replied").length,
    won: targets.filter((t) => t.status === "won").length,
  };
}

const TILES = [
  ["found", "Targets found"], ["qualified", "Qualified"], ["awaiting", "Awaiting approval"],
  ["sent", "Sent"], ["replies", "Replies"], ["won", "Live links won"],
];

export function KpiTiles({ targets, messages }) {
  const c = countsFor(targets, messages);
  return (
    <div className="grid grid-cols-2 rounded-md border border-hair bg-card sm:grid-cols-3 xl:grid-cols-6">
      {TILES.map(([k, l]) => (
        <div key={k} className="border-b border-r border-hair px-4 py-4 xl:border-b-0">
          <p className={`text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${k === "won" || (k === "awaiting" && c[k]) ? "text-[#ff3c00]" : ""}`}>{c[k]}</p>
          <p className="mono-label mt-2 text-[9.5px] text-ink/50">{l}</p>
        </div>
      ))}
    </div>
  );
}

export function PerClientTable({ clients, targets, messages, criteria, onPick }) {
  const rows = clients
    .map((c) => ({ c, n: countsFor(targets.filter((t) => t.client_id === c.id), messages.filter((m) => m.client_id === c.id)), crit: criteria[c.id] }))
    .filter((r) => r.n.found || r.crit?.profile?.enabled);
  if (!rows.length) return null;
  return (
    <Panel label="Per client" title="Where each client stands" bodyClass="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[12.5px]">
        <thead>
          <tr className="mono-label text-left text-[9px] text-ink/45">
            <th className="px-4 py-2 font-normal">Client</th>
            {TILES.map(([k, l]) => <th key={k} className="px-2 py-2 text-right font-normal">{l}</th>)}
            <th className="px-4 py-2 text-right font-normal">Research</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, n, crit }) => (
            <tr key={c.id} className="border-t border-hair hover:bg-paper">
              <td className="px-4 py-2"><button onClick={() => onPick(c.id)} className="font-medium hover:text-[#ff3c00]">{c.business}</button></td>
              {TILES.map(([k]) => <td key={k} className={`px-2 py-2 text-right tabular-nums ${k === "won" && n[k] ? "font-semibold text-[#ff3c00]" : ""}`}>{n[k]}</td>)}
              <td className="px-4 py-2 text-right">
                {!crit?.profile?.enabled ? <Tag>off</Tag> : crit.ready ? <Tag tone="green">ready</Tag> : <Tag tone="amber">{crit.missing.length} missing</Tag>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

// ---------------- Pipeline board ----------------

export function PipelineBoard({ targets, onPatch, showClient = true }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return targets;
    return targets.filter((t) => [t.name, t.url, t.client_name, KIND_LABEL[t.kind]].join(" ").toLowerCase().includes(s));
  }, [targets, q]);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink/35" />
          <input className={`${inputCls} pl-8`} value={q} placeholder="Filter targets" onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-[11.5px] text-ink/45">{shown.length} targets</span>
      </div>
      <div className="no-scrollbar -mx-5 overflow-x-auto px-5 pb-2 md:-mx-8 md:px-8">
        <div className="flex min-w-max gap-3">
          {BOARD_COLUMNS.map((col) => {
            const items = shown.filter((t) => col.statuses.includes(t.status || "discovered"));
            return (
              <div key={col.key} className="w-[240px] shrink-0 rounded-md border border-hair bg-card">
                <div className="flex items-center justify-between border-b border-hair px-3 py-2">
                  <p className="mono-label text-[9.5px] text-ink/60">{col.label}</p>
                  <span className={`text-[12px] font-semibold tabular-nums ${col.key === "won" && items.length ? "text-[#ff3c00]" : "text-ink/50"}`}>{items.length}</span>
                </div>
                <div className="max-h-[62vh] space-y-2 overflow-y-auto p-2">
                  {items.length === 0 && <p className="px-1 py-3 text-center text-[11.5px] text-ink/35">—</p>}
                  {items.slice(0, 80).map((t) => <TargetCard key={t.id} t={t} onPatch={onPatch} showClient={showClient} />)}
                  {items.length > 80 && <p className="px-1 text-[11px] text-ink/45">+{items.length - 80} more, use the filter</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- Needs you: web forms / signups / phone ----------------

function CopyBtn({ text, label = "Copy NAP" }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); }} className="inline-flex h-8 items-center gap-1.5 border border-hair px-2.5 text-[12px] text-ink/70 hover:border-ink/40">
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {label}
    </button>
  );
}

function ManualRow({ t, crit, onPatch }) {
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const mark = async (fields) => {
    setBusy(true);
    const f = { ...fields, last_action_at: nowIso() };
    onPatch("OutreachTarget", t.id, f);
    try { await base44.entities.OutreachTarget.update(t.id, f); } finally { setBusy(false); }
  };
  const link = t.submission_url || t.contact_form_url || t.url;
  return (
    <div className="border border-hair bg-paper px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[13.5px] font-semibold">{t.name}</p>
            <Tag>{METHOD_LABEL[t.submission_method] || "Manual"}</Tag>
            <Tag>{KIND_LABEL[t.kind] || t.kind}</Tag>
            {t.cost === "paid" && <Tag tone="amber">paid{t.cost_amount ? ` ${t.cost_amount}` : ""}</Tag>}
            {t.status === "sent" && <Tag tone="ink">submitted</Tag>}
          </div>
          <p className="mt-0.5 text-[11.5px] text-ink/50">{t.client_name}{t.requirements ? ` · Needs: ${t.requirements}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {link && <a href={link} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 bg-ink px-3 text-[12px] font-medium text-white hover:bg-[#ff3c00]">Open form <ExternalLink className="h-3.5 w-3.5" /></a>}
          {crit && <CopyBtn text={napBlock(crit.merged)} />}
          {t.status !== "sent" && <button disabled={busy} onClick={() => mark({ status: "sent" })} className="h-8 border border-hair px-2.5 text-[12px] text-ink/70 hover:border-ink/40">Mark submitted</button>}
          <button disabled={busy} onClick={() => mark({ status: "skip" })} className="h-8 px-2 text-[12px] text-ink/50 hover:text-red-700">Skip</button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <input className={`${inputCls} h-8 max-w-sm py-1`} placeholder="Paste the live listing URL once it's up" value={live} onChange={(e) => setLive(e.target.value)} />
        <button disabled={!live.trim() || busy} onClick={() => mark({ status: "won", live_url: live.trim() })} className="h-8 bg-[#ff3c00] px-3 text-[12px] font-medium text-white disabled:opacity-40">Won</button>
      </div>
    </div>
  );
}

export function ManualQueue({ targets, criteria, onPatch }) {
  const rows = targets
    .filter((t) => HUMAN_METHODS.includes(t.submission_method) && ["qualified", "drafted", "approved", "sent"].includes(t.status))
    .sort((a, b) => (a.status === "sent") - (b.status === "sent") || (a.client_name || "").localeCompare(b.client_name || ""));
  if (!rows.length)
    return <Panel><Empty>No web-form or signup submissions waiting. Claude queues directory forms, account signups and phone-only listings here instead of emailing them.</Empty></Panel>;
  return (
    <div className="space-y-2">
      <p className="text-[12.5px] text-ink/55">These can't be done by email. Open the form, paste the NAP block, then mark it submitted. When the listing goes live, paste its URL and hit Won; the verify task keeps checking it.</p>
      {rows.map((t) => <ManualRow key={t.id} t={t} crit={criteria[t.client_id]} onPatch={onPatch} />)}
    </div>
  );
}

// ---------------- Activity feed ----------------

const RUN_ICON = { research: Search, send: Mail, check_replies: Mail, verify_links: Globe };

export function ActivityFeed({ runs, targets, messages, limit = 25 }) {
  const items = useMemo(() => {
    const out = [];
    for (const r of runs) out.push({ at: r.finished_at || r.started_at || r.created_date, kind: "run", r });
    for (const t of targets.filter((x) => x.found_by === "claude").slice(0, 40)) out.push({ at: t.found_at || t.created_date, kind: "find", t });
    for (const t of targets.filter((x) => x.status === "won")) out.push({ at: t.last_action_at || t.updated_date, kind: "won", t });
    for (const m of messages.filter((x) => x.status === "replied")) out.push({ at: m.replied_at || m.updated_date, kind: "reply", m });
    return out.filter((i) => i.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
  }, [runs, targets, messages, limit]);

  if (!items.length) return <Panel><Empty>No agent activity yet. Runs, finds, replies and won links show up here live.</Empty></Panel>;
  return (
    <ul className="divide-y divide-hair rounded-md border border-hair bg-card">
      {items.map((i, n) => {
        if (i.kind === "run") {
          const Icon = RUN_ICON[i.r.kind] || Bot;
          const tone = i.r.status === "error" ? "red" : i.r.status === "running" ? "amber" : i.r.status === "ok" ? "green" : "muted";
          return (
            <li key={`r${i.r.id}${n}`} className="flex gap-3 px-4 py-2.5">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/45" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px]"><span className="font-medium">{i.r.kind.replace(/_/g, " ")}</span>{i.r.client_name ? ` · ${i.r.client_name}` : " · all clients"} <Tag tone={tone} className="ml-1">{i.r.status}</Tag></p>
                <p className="text-[11.5px] text-ink/50">
                  {[i.r.found_count && `${i.r.found_count} found`, i.r.drafted_count && `${i.r.drafted_count} drafted`, i.r.sent_count && `${i.r.sent_count} sent`, i.r.replied_count && `${i.r.replied_count} replies`, i.r.won_count && `${i.r.won_count} won`].filter(Boolean).join(" · ")}
                  {i.r.message ? ` ${i.r.message}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-ink/40">{timeAgo(i.at)}</span>
            </li>
          );
        }
        const label = i.kind === "find" ? "Found" : i.kind === "won" ? "Won" : "Reply";
        const name = i.t?.name || i.m?.target_name;
        const client = i.t?.client_name || i.m?.client_name;
        return (
          <li key={`${i.kind}${(i.t || i.m).id}${n}`} className="flex gap-3 px-4 py-2.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${i.kind === "won" ? "bg-[#ff3c00]" : i.kind === "reply" ? "bg-green-600" : "bg-ink/30"}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px]"><span className="font-medium">{label}</span> · {name} <span className="text-ink/45">for {client}</span></p>
              {i.kind === "reply" && i.m.reply_snippet && <p className="truncate text-[11.5px] text-ink/50">“{i.m.reply_snippet}”</p>}
              {i.kind === "find" && i.t.kind && <p className="text-[11.5px] text-ink/45">{KIND_LABEL[i.t.kind]}</p>}
            </div>
            <span className="shrink-0 text-[11px] text-ink/40">{timeAgo(i.at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
