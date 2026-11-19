import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Network, Trash2, RefreshCw, Search, X, ChevronDown, ChevronRight, Lightbulb, AlertTriangle, CheckCircle2, HelpCircle, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import "@/features/agents/agents.css";
import SystemsMap, { LINK_STATUS } from "./SystemsMap";
import { Spinner, relTime } from "@/features/agents/ui";

// Møthership > Agents > Systems: the systems brain. Every secret NAME on every app Justin manages, what it is for, how
// the apps connect, what is left over, and a Re-scan that flags new or missing secrets. Names only, never values.
// Ask about any key on the Command Ask bar ("what does WEBSITE_INTAKE_KEY do?", "what connects a client site to Møthership?").

const STATUS = {
  active: { label: "Active", cls: "text-[#ffb27a] border-[rgba(255,138,61,.45)] bg-[rgba(255,106,0,.1)]" },
  unused: { label: "Unused", cls: "text-[var(--ink-m)] border-[var(--hair-d2)] bg-white/[0.03]" },
  unknown: { label: "Unknown", cls: "text-[#ffd27a] border-[rgba(255,170,0,.45)] bg-[rgba(255,170,0,.08)]" },
};
const TABS = [["map", "How things connect", Network], ["keys", "Keys by app", KeyRound], ["leftover", "Unused / leftover", Trash2]];

function Pill({ status }) {
  const m = STATUS[status] || STATUS.unknown;
  return <span className={`mono inline-flex h-5 items-center rounded-full border px-2 text-[10px] uppercase tracking-[.08em] ${m.cls}`}>{m.label}</span>;
}
function Flag({ children, tone = "dim" }) {
  const cls = tone === "bad" ? "text-[#ff8a7f] border-[rgba(255,68,51,.45)]" : tone === "warn" ? "text-[#ffd27a] border-[rgba(255,170,0,.4)]" : tone === "ok" ? "text-[#9be7b0] border-[rgba(120,220,150,.35)]" : "text-[var(--ink-s)] border-[var(--hair-d2)]";
  return <span className={`mono inline-flex h-5 items-center rounded-full border px-2 text-[9.5px] uppercase tracking-[.08em] ${cls}`}>{children}</span>;
}
function List({ label, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="eyebrow !text-[9.5px]">{label}</p>
      <ul className="mt-1 space-y-0.5 text-[12.5px] text-[var(--ink-m)]">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}
function Field({ label, children }) {
  if (!children) return null;
  return (
    <div>
      <p className="eyebrow !text-[9.5px]">{label}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-m)]">{children}</p>
    </div>
  );
}

function KeyRow({ k, open, onToggle }) {
  return (
    <li className="border-b border-[var(--hair-d)] last:border-0">
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[18px_minmax(0,1fr)] gap-x-2 gap-y-1 px-3 py-3 text-left transition hover:bg-white/[0.025] md:grid-cols-[18px_minmax(180px,260px)_minmax(0,1fr)_auto] md:items-start">
        {open ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 text-[var(--ink-s)]" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-[var(--ink-s)]" />}
        <span className="mono min-w-0 break-all text-[12.5px] text-white">{k.name}</span>
        <span className="col-start-2 line-clamp-2 text-[12.5px] leading-snug text-[var(--ink-m)] md:col-start-auto">{k.purpose}</span>
        <span className="col-start-2 flex flex-wrap items-center gap-1.5 md:col-start-auto md:justify-end">
          <Pill status={k.status} />
          {k.presence === "referenced_not_set" ? <Flag tone="warn">not set</Flag> : null}
          {k.delete_safe ? <Flag tone="ok">safe to delete</Flag> : null}
          {k.scan_flag === "new" ? <Flag tone="warn">new</Flag> : null}
          {k.scan_flag === "missing" ? <Flag tone="bad">missing</Flag> : null}
        </span>
      </button>
      {open ? (
        <div className="grid gap-4 px-3 pb-4 pl-[34px] md:grid-cols-2">
          <Field label="What it does">{k.purpose}</Field>
          <Field label="What breaks without it">{k.what_breaks_without_it}</Field>
          <List label="Sent / used by" items={k.used_by} />
          <List label="Checked by" items={k.checked_by} />
          <Field label="Pair">{k.pair_with}</Field>
          <Field label="How to rotate">{k.rotate_how}</Field>
          {k.notes ? <Field label="Note">{k.notes}</Field> : null}
          <List label="Where in the code" items={k.source_files} />
          <p className="mono text-[10.5px] text-[var(--ink-s)] md:col-span-2">verified {relTime(k.verified_at)}{k.last_seen_at ? ` · last seen by re-scan ${relTime(k.last_seen_at)}` : ""} · value never stored here</p>
        </div>
      ) : null}
    </li>
  );
}

function AppPanel({ app, keys, links, onClose }) {
  if (!app) return null;
  const out = links.filter((l) => l.from_app_id === app.app_id);
  const inn = links.filter((l) => l.to_app_id === app.app_id);
  const L = (l, other) => (
    <li key={l.id} className="rounded-lg border border-[var(--hair-d)] px-3 py-2">
      <p className="text-[12.5px] text-white">{other}</p>
      <p className="text-[11.5px] text-[var(--ink-m)]">{l.mechanism}</p>
      <p className="mono mt-0.5 text-[10.5px] text-[var(--ink-s)]">{l.secret_name || "no key (public feed)"} · {(LINK_STATUS[l.status] || LINK_STATUS.unknown).label}</p>
      {l.what_flows ? <p className="mt-0.5 text-[11px] text-[var(--ink-s)]">{l.what_flows}</p> : null}
    </li>
  );
  return (
    <aside className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow !text-[9.5px]">{app.role?.replace("_", " + ")}{app.client_name ? ` · ${app.client_name}` : ""}</p>
          <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-white">{app.name}</h3>
          <p className="mono mt-0.5 text-[10.5px] text-[var(--ink-s)]">{app.app_id}{app.last_deployed_at ? ` · published ${relTime(app.last_deployed_at)}` : " · not published"}</p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="text-[var(--ink-s)] hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      {app.notes ? <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--ink-m)]">{app.notes}</p> : null}
      <div className="mt-4 space-y-4">
        <div>
          <p className="eyebrow !text-[9.5px]">Secrets ({keys.filter((k) => k.presence !== "referenced_not_set").length})</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {keys.map((k) => <li key={k.id} className={`mono rounded-md border px-2 py-1 text-[10.5px] ${k.presence === "referenced_not_set" ? "border-dashed border-[rgba(255,170,0,.4)] text-[#ffd27a]" : k.delete_safe ? "border-[rgba(120,220,150,.35)] text-[#9be7b0]" : "border-[var(--hair-d2)] text-[var(--ink-m)]"}`} title={k.purpose}>{k.name}</li>)}
            {!keys.length ? <li className="text-[12px] text-[var(--ink-s)]">None</li> : null}
          </ul>
        </div>
        {out.length ? <div><p className="eyebrow !text-[9.5px]">Sends to</p><ul className="mt-1.5 space-y-1.5">{out.map((l) => L(l, l.to_app))}</ul></div> : null}
        {inn.length ? <div><p className="eyebrow !text-[9.5px]">Receives from</p><ul className="mt-1.5 space-y-1.5">{inn.map((l) => L(l, l.from_app))}</ul></div> : null}
        <List label={`Backend functions (${app.functions?.length || 0})`} items={app.functions?.length ? [app.functions.join(", ")] : []} />
        <List label={`Workflows (${app.workflows?.length || 0})`} items={app.workflows || []} />
        <List label="Connectors" items={(app.connectors || []).map((c) => `${c.type}: ${c.connected ? (c.status === "expired" ? "connected, expired (reconnect)" : "connected") : "not connected"}`)} />
      </div>
    </aside>
  );
}

export default function SystemsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("map");
  const [q, setQ] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [statusF, setStatusF] = useState(new Set());
  const [showNotSet, setShowNotSet] = useState(true);
  const [linkStatus, setLinkStatus] = useState(new Set());
  const [onlyConnected, setOnlyConnected] = useState(true);
  const [selectedApp, setSelectedApp] = useState(null);
  const [openKey, setOpenKey] = useState(null);

  const data = useQuery({
    queryKey: ["systems", "overview"],
    staleTime: 60_000,
    retry: false,
    queryFn: async () => (await base44.functions.invoke("systems", { action: "overview" }))?.data || {},
  });
  const rescan = useMutation({
    mutationFn: async () => (await base44.functions.invoke("systems", { action: "rescan" }))?.data || {},
    onSuccess: () => qc.invalidateQueries({ queryKey: ["systems", "overview"] }),
  });

  const d = data.data || {};
  const apps = useMemo(() => d.apps || [], [d.apps]);
  const keys = useMemo(() => d.keys || [], [d.keys]);
  const links = useMemo(() => d.links || [], [d.links]);
  const scan = rescan.data?.scan || d.scan || null;

  const filteredKeys = useMemo(() => {
    const t = q.trim().toLowerCase();
    return keys.filter((k) => (!appFilter || k.app_id === appFilter) && (!statusF.size || statusF.has(k.status)) && (showNotSet || k.presence !== "referenced_not_set")
      && (!t || `${k.name} ${k.app_name} ${k.purpose} ${k.pair_with} ${(k.used_by || []).join(" ")} ${(k.checked_by || []).join(" ")}`.toLowerCase().includes(t)));
  }, [keys, q, appFilter, statusF, showNotSet]);
  const byApp = useMemo(() => {
    const m = new Map();
    for (const k of filteredKeys) { if (!m.has(k.app_id)) m.set(k.app_id, { name: k.app_name, list: [] }); m.get(k.app_id).list.push(k); }
    return [...m.entries()].sort((a, b) => (a[0] === "69d80bb06c5ad07a795df54e" ? -1 : b[0] === "69d80bb06c5ad07a795df54e" ? 1 : a[1].name.localeCompare(b[1].name)));
  }, [filteredKeys]);

  const setCount = keys.filter((k) => k.presence !== "referenced_not_set").length;
  const appsWithKeys = new Set(keys.filter((k) => k.presence !== "referenced_not_set").map((k) => k.app_id)).size;
  const safeDelete = keys.filter((k) => k.delete_safe);
  const staged = keys.filter((k) => k.status === "unused" && !k.delete_safe && k.presence === "set");
  const notSet = keys.filter((k) => k.presence === "referenced_not_set");
  const askJustin = [...keys.filter((k) => k.status === "unknown"), ...links.filter((l) => l.status === "unknown" || l.status === "broken").map((l) => ({ id: l.id, link: true, ...l }))];
  const scanFlags = keys.filter((k) => k.scan_flag === "new" || k.scan_flag === "missing");
  const toggle = (setter) => (v) => setter((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const selApp = apps.find((a) => a.app_id === selectedApp) || null;

  return (
    <div className="agx grain-d min-h-[calc(100dvh-48px)]">
      <header className="relative z-10 border-b border-[var(--hair-d)] px-4 pb-4 pt-4 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2"><span className="inline-block h-[9px] w-[9px]" style={{ background: "linear-gradient(#ff3c00,#ff3c00) center/100% 1.5px no-repeat, linear-gradient(#ff3c00,#ff3c00) center/1.5px 100% no-repeat" }} />(Agents)</p>
            <h1 className="mt-1.5 text-[30px] font-semibold leading-[0.95] tracking-[-0.045em] text-white md:text-[40px]">Systems <span className="text-[#ff3c00]">/Brain</span></h1>
            <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-[var(--ink-m)]">Every key on every app you manage: what it does, who sends it, who checks it and what breaks without it. Names only, never values.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-f" disabled={rescan.isPending} onClick={() => rescan.mutate()}>
              {rescan.isPending ? <Spinner size={14} /> : <RefreshCw className="h-3.5 w-3.5" />}Re-scan
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Apps", apps.length, `${appsWithKeys} hold secrets`], ["Secrets", setCount, `${notSet.length} read but not set`], ["Connections", links.length, `${links.filter((l) => l.status === "active").length} active`], ["Leftovers", safeDelete.length, "safe to delete"]].map(([l, v, h]) => (
            <div key={l} className="glass rounded-xl px-3.5 py-3">
              <p className="eyebrow !text-[9.5px]">{l}</p>
              <p className="mt-1 text-[24px] font-semibold leading-none tracking-[-0.03em] text-white">{data.isLoading ? "…" : v}</p>
              <p className="mono mt-1 text-[10px] text-[var(--ink-s)]">{h}</p>
            </div>
          ))}
        </div>
        {rescan.isError ? <p className="mt-3 rounded-lg border border-[rgba(255,68,51,.4)] px-3 py-2 text-[12.5px] text-[#ff8a7f]">Re-scan failed: {String(rescan.error?.message || rescan.error)}</p> : null}
        {scan ? (
          <div className="glass mt-3 rounded-xl px-3.5 py-3 text-[12.5px] text-[var(--ink-m)]">
            <p className="flex flex-wrap items-center gap-2">
              {scan.new_count || scan.missing_count ? <AlertTriangle className="h-3.5 w-3.5 text-[#ffd27a]" /> : <CheckCircle2 className="h-3.5 w-3.5 text-[#9be7b0]" />}
              <span className="text-white">Last re-scan {relTime(scan.at)}</span>
              <span>· {scan.mode === "workspace" ? `${scan.apps_scanned} apps checked` : "Møthership's own keys only"} · {scan.new_count || 0} new · {scan.missing_count || 0} missing</span>
            </p>
            {scan.new_keys?.length ? <p className="mono mt-1.5 text-[11px] text-[#ffd27a]">New: {scan.new_keys.join(" · ")}</p> : null}
            {scan.missing_keys?.length ? <p className="mono mt-1 text-[11px] text-[#ff8a7f]">Missing: {scan.missing_keys.join(" · ")}</p> : null}
            {scan.new_apps?.length ? <p className="mono mt-1 text-[11px] text-[var(--ink-m)]">New apps: {scan.new_apps.join(" · ")}</p> : null}
            {scan.errors?.length ? <p className="mono mt-1 text-[11px] text-[var(--ink-s)]">Couldn't read: {scan.errors.slice(0, 4).join(" · ")}</p> : null}
          </div>
        ) : null}
        {!data.isLoading && d.token_configured === false ? (
          <p className="mt-2 text-[11.5px] text-[var(--ink-s)]">Re-scan checks Møthership's own keys. To re-scan every app, save a read-only Base44 personal access token in Møthership's secrets as <span className="mono text-[var(--ink-m)]">BASE44_READONLY_TOKEN</span>.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="seg" role="tablist" aria-label="Systems view">
            {TABS.map(([v, l, Icon]) => (
              <button key={v} type="button" role="tab" aria-selected={tab === v} className={tab === v ? "on" : ""} onClick={() => setTab(v)}><Icon className="h-3.5 w-3.5" />{l}</button>
            ))}
          </div>
          <label className="relative ml-auto min-w-0 flex-1 sm:w-72 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-s)]" />
            <input className="inp w-full !pl-8" placeholder="Search keys, apps, purposes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search keys and apps" />
            {q ? <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-s)] hover:text-white"><X className="h-3.5 w-3.5" /></button> : null}
          </label>
        </div>
      </header>

      <main className="relative z-10 px-4 py-5 md:px-6">
        {data.isLoading ? (
          <div className="flex items-center gap-3 py-16 text-[13px] text-[var(--ink-m)]"><Spinner size={18} />Loading the systems brain…</div>
        ) : data.isError ? (
          <p className="py-16 text-[13px] text-[#ff8a7f]">Couldn't load systems: {String(data.error?.message || data.error)}</p>
        ) : tab === "map" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {Object.entries(LINK_STATUS).map(([s, m]) => (
                  <button key={s} type="button" className={`chip !h-7 ${linkStatus.has(s) ? "on" : ""}`} onClick={() => toggle(setLinkStatus)(s)}>
                    {m.label}<span className="mono text-[10px] text-[var(--ink-s)]">{links.filter((l) => l.status === s).length}</span>
                  </button>
                ))}
                <button type="button" className={`chip !h-7 ${onlyConnected ? "on" : ""}`} onClick={() => setOnlyConnected((v) => !v)}>Only connected apps</button>
              </div>
              <SystemsMap apps={apps} links={links} keys={keys} selected={selectedApp} onSelect={setSelectedApp} statusFilter={linkStatus} onlyConnected={onlyConnected} query={q} height={640} />
            </div>
            <div className="space-y-4">
              {selApp ? (
                <AppPanel app={selApp} keys={keys.filter((k) => k.app_id === selApp.app_id)} links={links} onClose={() => setSelectedApp(null)} />
              ) : (
                <aside className="glass rounded-2xl p-4 text-[12.5px] leading-relaxed text-[var(--ink-m)]">
                  <p className="eyebrow !text-[9.5px]">How to read it</p>
                  <p className="mt-1.5">Møthership sits in the middle. Each client's website and command app sit side by side on the ring. Arrows point the way data flows; the label is the secret name that guards the link. Click an app for its keys, functions, workflows and connectors.</p>
                  <p className="mt-3 flex items-start gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff6a00]" /><span>Ask the Command bar: <span className="text-white">"what does WEBSITE_INTAKE_KEY do?"</span> or <span className="text-white">"what connects a client site to Møthership?"</span></span></p>
                </aside>
              )}
              <DecisionNote text={d.decision} />
            </div>
          </div>
        ) : tab === "keys" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <select className="inp !h-8 !text-[12.5px]" value={appFilter} onChange={(e) => setAppFilter(e.target.value)} aria-label="Filter by app">
                <option value="">All apps</option>
                {[...new Map(keys.map((k) => [k.app_id, k.app_name])).entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
              {Object.entries(STATUS).map(([s, m]) => (
                <button key={s} type="button" className={`chip !h-8 ${statusF.has(s) ? "on" : ""}`} onClick={() => toggle(setStatusF)(s)}>{m.label}<span className="mono text-[10px] text-[var(--ink-s)]">{keys.filter((k) => k.status === s).length}</span></button>
              ))}
              <button type="button" className={`chip !h-8 ${showNotSet ? "on" : ""}`} onClick={() => setShowNotSet((v) => !v)}>Show read-but-not-set</button>
              {scanFlags.length ? <Flag tone="warn">{scanFlags.length} flagged by re-scan</Flag> : null}
            </div>
            {byApp.length ? byApp.map(([id, g]) => (
              <section key={id} className="glass overflow-hidden rounded-2xl">
                <header className="flex items-center justify-between gap-3 border-b border-[var(--hair-d)] px-3 py-2.5">
                  <h2 className="text-[13.5px] font-semibold text-white">{g.name}</h2>
                  <span className="mono text-[10.5px] text-[var(--ink-s)]">{g.list.length} key{g.list.length === 1 ? "" : "s"}</span>
                </header>
                <ul>{g.list.sort((a, b) => a.name.localeCompare(b.name)).map((k) => <KeyRow key={k.id} k={k} open={openKey === k.id} onToggle={() => setOpenKey(openKey === k.id ? null : k.id)} />)}</ul>
              </section>
            )) : <p className="py-10 text-[13px] text-[var(--ink-s)]">No keys match.</p>}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Bucket icon={Trash2} title="Safe for Justin to delete" hint="Nothing reads these any more. Delete them in that app's Settings > Secrets." rows={safeDelete} />
            <Bucket icon={KeyRound} title="Staged: keep" hint="Set on purpose for something not wired yet." rows={staged} />
            <Bucket icon={AlertTriangle} title="Read by the code, not set" hint="The app's code reads these names but they are not set. Some are optional." rows={notSet} />
            <Bucket icon={HelpCircle} title="Unknown: ask Justin" hint="Keys and connections whose purpose or target can't be confirmed from the code." rows={askJustin} />
            <div className="lg:col-span-2"><DecisionNote text={d.decision} /></div>
          </div>
        )}
      </main>
    </div>
  );
}

function Bucket({ icon: Icon, title, hint, rows }) {
  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white"><Icon className="h-4 w-4 text-[#ff6a00]" />{title}<span className="mono text-[11px] font-normal text-[var(--ink-s)]">{rows.length}</span></h2>
      <p className="mt-1 text-[12px] text-[var(--ink-s)]">{hint}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-[var(--hair-d)] px-3 py-2">
            {r.link ? (
              <>
                <p className="text-[12.5px] text-white">{r.from_app} → {r.to_app}</p>
                <p className="text-[11.5px] text-[var(--ink-m)]">{r.mechanism}</p>
                {r.notes ? <p className="mt-0.5 text-[11.5px] text-[var(--ink-s)]">{r.notes}</p> : null}
              </>
            ) : (
              <>
                <p className="flex flex-wrap items-baseline gap-x-2"><span className="mono text-[12px] text-white">{r.name}</span><span className="text-[11.5px] text-[var(--ink-s)]">{r.app_name}</span></p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-m)]">{r.notes || r.purpose}</p>
              </>
            )}
          </li>
        ))}
        {!rows.length ? <li className="text-[12px] text-[var(--ink-s)]">None</li> : null}
      </ul>
    </section>
  );
}

function DecisionNote({ text }) {
  if (!text) return null;
  return (
    <aside className="rounded-2xl border border-[rgba(255,106,0,.35)] bg-[rgba(255,60,0,.06)] p-4">
      <p className="eyebrow flex items-center gap-2 !text-[9.5px] !text-[#ffb27a]"><Lightbulb className="h-3.5 w-3.5" />Decision · planned key design (not built yet)</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-d)]">{text.replace(/^Key design decision:\s*/i, "")}</p>
    </aside>
  );
}
