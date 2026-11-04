import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, LayoutList, Network, Search, Sparkles, X, BookOpen, Users, Orbit } from "lucide-react";
import "./agents.css";
import { useAgentsData, useRefreshAgents } from "./useAgentsData";
import { INTERSTELLAR_DEPTS, CLIENT_DEPTS } from "./defs";
import { buildOverview, buildDeptView, buildClientsOverview, countStatus } from "./layout";
import Constellation from "./Constellation";
import ListView from "./ListView";
import AgentPanel, { runsFor } from "./panels/AgentPanel";
import CeoPanel from "./panels/CeoPanel";
import BrainPanel from "./panels/BrainPanel";
import { DeptPanel, ClientPanel } from "./panels/DeptPanel";
import { KIND_SHORT, AUTONOMY, StatusDot, STATUS_META, relTime, Spinner } from "./ui";

const STATUSES = ["live", "paused", "planned", "broken"];
const KINDS = Object.keys(KIND_SHORT);
const AUTOS = Object.keys(AUTONOMY);

function useFillHeight() {
  const ref = useRef(null);
  const [h, setH] = useState(null);
  useLayoutEffect(() => {
    const measure = () => { if (ref.current) setH(Math.max(520, window.innerHeight - ref.current.getBoundingClientRect().top - (window.scrollY || 0))); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return [ref, h];
}

function Toggle({ value, options, onChange, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map(([v, l, Icon]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}{l}
        </button>
      ))}
    </div>
  );
}

function FilterGroup({ title, items, set, onToggle, render }) {
  return (
    <div>
      <p className="eyebrow mb-2 !text-[9.5px]">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => <button key={it} type="button" className={`chip !h-7 ${set.has(it) ? "on" : ""}`} onClick={() => onToggle(it)}>{render ? render(it) : it}</button>)}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { data, isLoading, error } = useAgentsData();
  const refresh = useRefreshAgents();
  const [params, setParams] = useSearchParams();
  const web = params.get("web") === "clients" ? "clients" : "interstellar";
  const clientId = params.get("client") || "";
  const deptKey = params.get("dept") || "";
  const view = params.get("view") === "list" ? "list" : "map";
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState(new Set());
  const [fKind, setFKind] = useState(new Set());
  const [fAuto, setFAuto] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [hover, setHover] = useState(null);
  const [fillRef, height] = useFillHeight();

  const setP = useCallback((patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (v === null || v === undefined || v === "") next.delete(k); else next.set(k, v); });
    setParams(next, { replace: false });
  }, [params, setParams]);

  // Selection lives in the URL too, so any agent / brain / CEO can be deep-linked.
  const sel = useMemo(() => {
    if (params.get("agent")) return { type: "agent", key: params.get("agent") };
    if (params.get("ceo")) return { type: "ceo" };
    if (params.get("brain")) return { type: "brain" };
    if (params.get("deptpanel")) return { type: "dept", key: params.get("deptpanel") };
    if (params.get("clientpanel")) return { type: "client", id: params.get("clientpanel") };
    return null;
  }, [params]);
  const select = useCallback((s) => setP({ agent: s?.type === "agent" ? s.key : null, ceo: s?.type === "ceo" ? "1" : null, brain: s?.type === "brain" ? "1" : null, deptpanel: s?.type === "dept" ? s.key : null, clientpanel: s?.type === "client" ? s.id : null }), [setP]);

  const d = data || { registry: [], learnings: [], notes: [], briefs: [], brains: [], clients: [], runs: [], prefs: null, agency: [] };
  const registry = useMemo(() => d.registry.map((a) => (a.run_count_30d == null && a.status === "live" ? { ...a, _runs30: runsFor(a, d.runs).length } : a)), [d.registry, d.runs]);
  const hq = useMemo(() => registry.filter((a) => a.scope === "interstellar"), [registry]);
  const instances = useMemo(() => registry.filter((a) => a.scope === "client"), [registry]);
  const commander = hq.find((a) => a.key === "commander");
  const hqBrain = d.brains.find((b) => b.scope === "interstellar");
  const clients = d.clients;
  const client = clients.find((c) => c.id === clientId) || null;
  const clientAgents = useMemo(() => (client ? instances.filter((a) => a.client_id === client.id) : []), [instances, client]);
  const clientBrain = client ? d.brains.find((b) => b.client_id === client.id) : null;
  const ceoName = d.prefs?.pageSettings?.ceo_name || "Commander";

  const depts = web === "clients" ? CLIENT_DEPTS : INTERSTELLAR_DEPTS;
  const scopeAgents = web === "clients" ? (client ? clientAgents : instances) : hq;
  const presentDepts = useMemo(() => depts.filter((x) => scopeAgents.some((a) => a.department === x.key)), [depts, scopeAgents]);
  const dept = presentDepts.find((x) => x.key === deptKey) || null;

  const query = q.trim().toLowerCase();
  const isMatch = useCallback((a) => {
    if (fStatus.size && !fStatus.has(a.status)) return false;
    if (fKind.size && !fKind.has(a.kind)) return false;
    if (fAuto.size && !fAuto.has(a.autonomy || "")) return false;
    if (query && !`${a.name} ${a.role} ${a.client_name || ""} ${a.key} ${a.branch || ""}`.toLowerCase().includes(query)) return false;
    return true;
  }, [fStatus, fKind, fAuto, query]);
  const filtering = !!(fStatus.size || fKind.size || fAuto.size || query);

  const graph = useMemo(() => {
    if (web === "interstellar") {
      const named = commander ? { ...commander, name: ceoName } : null;
      if (dept) return buildDeptView({ dept, agents: hq.filter((a) => a.department === dept.key).map((a) => (a.key === "commander" ? named : a)) });
      return buildOverview({ depts: INTERSTELLAR_DEPTS, agents: hq.filter((a) => a.key !== "commander"), ceo: named, brain: hqBrain, centerLabel: "Company Brain", centerSub: hqBrain ? `${Math.round(hqBrain.completeness || 0)}% COMPLETE · AGENCY KNOWLEDGE` : "AGENCY KNOWLEDGE" });
    }
    if (!client) return buildClientsOverview({ clients, instances, brains: d.brains });
    const ceo = clientAgents.find((a) => a.template_key === "client_ceo");
    const keeper = clientAgents.find((a) => a.template_key === "brain_keeper");
    if (dept) return buildDeptView({ dept, agents: clientAgents.filter((a) => a.department === dept.key) });
    return buildOverview({ depts: CLIENT_DEPTS, agents: clientAgents.filter((a) => a !== ceo && a !== keeper), ceo, keeper, brain: clientBrain, centerLabel: client.business, centerSub: `BUSINESS BRAIN · ${Math.round(clientBrain?.completeness || 0)}%` });
  }, [web, dept, hq, commander, ceoName, hqBrain, client, clients, instances, d.brains, clientAgents, clientBrain]);

  const viewKey = `${web}|${client?.id || ""}|${dept?.key || ""}`;
  const counts = countStatus((web === "clients" && !client ? instances.filter((a) => a.template_key) : scopeAgents));

  const selectedAgent = sel?.type === "agent" ? registry.find((a) => a.key === sel.key) : null;
  const selectedId = selectedAgent ? (web === "clients" && !client ? `c:${selectedAgent.client_id}` : `a:${selectedAgent.key}`) : sel?.type === "ceo" ? (web === "interstellar" ? "a:commander" : null) : sel?.type === "brain" ? "brain" : sel?.type === "dept" ? `d:${sel.key}` : sel?.type === "client" ? `c:${sel.id}` : null;

  const onNode = (n) => {
    if (!n) { select(null); return; }
    if (n.type === "brain") { select({ type: "brain" }); return; }
    if (n.type === "ceo") { select({ type: "ceo" }); return; }
    if (n.type === "dept") {
      if (!dept) setP({ dept: n.dept, agent: null, ceo: null, brain: null, clientpanel: null, deptpanel: n.dept });
      else select({ type: "dept", key: n.dept });
      return;
    }
    if (n.type === "client") { setP({ client: n.client.id, dept: null, clientpanel: n.client.id, agent: null, ceo: null, brain: null, deptpanel: null }); return; }
    if (n.type === "agent") {
      if (n.agent.template_key === "client_ceo") { select({ type: "ceo" }); return; }
      select({ type: "agent", key: n.agent.key });
    }
  };

  const stepDept = (dir) => {
    if (!presentDepts.length) return;
    const i = Math.max(0, presentDepts.findIndex((x) => x.key === dept?.key));
    const next = presentDepts[(i + dir + presentDepts.length) % presentDepts.length];
    setP({ dept: next.key, deptpanel: null, agent: null });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "Escape") select(null);
      if (dept && e.key === "ArrowRight") stepDept(1);
      if (dept && e.key === "ArrowLeft") stepDept(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleIn = (setter) => (v) => setter((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const listAgents = useMemo(() => scopeAgents.filter((a) => a.scope !== "template").filter(isMatch), [scopeAgents, isMatch]);

  // ---------- panel ----------
  let panel = null;
  if (sel?.type === "agent" && selectedAgent) {
    panel = <AgentPanel key={selectedAgent.key} agent={selectedAgent.key === "commander" ? { ...selectedAgent, name: ceoName } : selectedAgent} data={d} refresh={refresh} onClose={() => select(null)}
      onOpenCeo={() => { if (selectedAgent.client_id) setP({ web: "clients", client: selectedAgent.client_id, agent: null, ceo: "1" }); else select({ type: "ceo" }); }}
      onOpenBrain={() => { if (selectedAgent.client_id) setP({ web: "clients", client: selectedAgent.client_id, agent: null, brain: "1" }); else select({ type: "brain" }); }} />;
  } else if (sel?.type === "ceo") {
    panel = web === "clients" && client
      ? <CeoPanel key={`ceo:${client.id}`} scope="client" client={client} data={d} prefs={d.prefs} refresh={refresh} onClose={() => select(null)} />
      : <CeoPanel key="ceo:hq" scope="interstellar" data={d} prefs={d.prefs} refresh={refresh} onClose={() => select(null)} />;
  } else if (sel?.type === "brain") {
    panel = web === "clients" && client
      ? <BrainPanel key={`brain:${client.id}`} brain={clientBrain} client={client} scope="client" refresh={refresh} onClose={() => select(null)} />
      : <BrainPanel key="brain:hq" brain={hqBrain} scope="interstellar" agency={d.agency} refresh={refresh} onClose={() => select(null)} />;
  } else if (sel?.type === "dept") {
    const dd = depts.find((x) => x.key === sel.key);
    if (dd) panel = <DeptPanel dept={dd} agents={scopeAgents.filter((a) => a.department === dd.key)} onClose={() => select(null)} onPick={(a) => select({ type: "agent", key: a.key })} onOpenView={!dept ? () => setP({ dept: dd.key }) : null} />;
  } else if (sel?.type === "client") {
    const c = clients.find((x) => x.id === sel.id);
    if (c) panel = <ClientPanel client={c} agents={instances.filter((a) => a.client_id === c.id)} brain={d.brains.find((b) => b.client_id === c.id)} onClose={() => select(null)}
      onPick={(a) => setP({ client: c.id, agent: a.key, clientpanel: null })} onOpenWeb={() => setP({ client: c.id, dept: null, clientpanel: null })}
      onOpenBrain={() => setP({ client: c.id, dept: null, clientpanel: null, brain: "1" })} onOpenCeo={() => setP({ client: c.id, dept: null, clientpanel: null, ceo: "1" })} />;
  }

  const crumbs = [
    { label: web === "clients" ? "Clients" : "Interstellar", go: () => setP({ client: null, dept: null, agent: null, ceo: null, brain: null, deptpanel: null, clientpanel: null }) },
    ...(client ? [{ label: client.business, go: () => setP({ dept: null, agent: null, deptpanel: null }) }] : []),
    ...(dept ? [{ label: dept.label }] : []),
  ];

  return (
    <div ref={fillRef} className="agx grain-d flex flex-col overflow-hidden" style={{ height: height || "calc(100dvh - 48px)" }}>
      {/* Header */}
      <header className="relative z-20 border-b border-[var(--hair-d)] px-4 pb-3 pt-4 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2"><span className="inline-block h-[9px] w-[9px]" style={{ background: "linear-gradient(#ff3c00,#ff3c00) center/100% 1.5px no-repeat, linear-gradient(#ff3c00,#ff3c00) center/1.5px 100% no-repeat" }} />(Command)</p>
            <h1 className="mt-1.5 text-[30px] font-semibold leading-[0.95] tracking-[-0.045em] text-white md:text-[40px]">Agent <span className="text-[#ff3c00]">/Constellation</span></h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Toggle label="Which web" value={web} onChange={(v) => setParams(new URLSearchParams(v === "clients" ? { web: "clients", view } : { view }))} options={[["interstellar", "Interstellar", Orbit], ["clients", "Clients", Users]]} />
            <Toggle label="View" value={view} onChange={(v) => setP({ view: v === "list" ? "list" : null })} options={[["map", "Map", Network], ["list", "List", LayoutList]]} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px]">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i ? <span className="text-[var(--ink-s)]">/</span> : null}
                {c.go && i < crumbs.length - 1 ? <button type="button" onClick={c.go} className="text-[var(--ink-m)] hover:text-white">{c.label}</button> : <span className="text-white">{c.label}</span>}
              </span>
            ))}
            <span className="mono ml-2 hidden text-[10.5px] text-[var(--ink-s)] sm:inline">
              {counts.live} live · {counts.paused} paused · {counts.planned} planned{counts.broken ? ` · ${counts.broken} broken` : ""}
            </span>
          </nav>
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <label className="relative flex-1 sm:w-64 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-s)]" />
              <input className="inp w-full !pl-8" placeholder="Search agents" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search agents" />
              {q ? <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-s)] hover:text-white"><X className="h-3.5 w-3.5" /></button> : null}
            </label>
            <button type="button" className={`btn-d ${filtering && (fStatus.size || fKind.size || fAuto.size) ? "!border-[rgba(255,106,0,.7)]" : ""}`} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              <Filter className="h-3.5 w-3.5" />Filters{fStatus.size + fKind.size + fAuto.size ? ` · ${fStatus.size + fKind.size + fAuto.size}` : ""}
            </button>
            <button type="button" className="btn-f hidden sm:inline-flex" onClick={() => (web === "clients" && client ? select({ type: "ceo" }) : setP({ web: null, client: null, dept: null, ceo: "1", agent: null, brain: null }))}>
              <Sparkles className="h-4 w-4" />{web === "clients" && client ? "Client CEO" : ceoName}
            </button>
          </div>
        </div>
        {showFilters ? (
          <div className="glass absolute left-4 right-4 top-full z-40 mt-2 grid gap-4 rounded-xl p-4 md:left-auto md:right-6 md:w-[520px]">
            <FilterGroup title="Status" items={STATUSES} set={fStatus} onToggle={toggleIn(setFStatus)} render={(s) => <><StatusDot status={s} size={7} />{STATUS_META[s].label}</>} />
            <FilterGroup title="Kind" items={KINDS} set={fKind} onToggle={toggleIn(setFKind)} render={(k) => KIND_SHORT[k]} />
            <FilterGroup title="Autonomy" items={AUTOS} set={fAuto} onToggle={toggleIn(setFAuto)} render={(k) => AUTONOMY[k]} />
            <div className="flex justify-between">
              <button type="button" className="text-[12px] text-[var(--ink-s)] hover:text-white" onClick={() => { setFStatus(new Set()); setFKind(new Set()); setFAuto(new Set()); }}>Clear filters</button>
              <button type="button" className="btn-d !h-8" onClick={() => setShowFilters(false)}>Done</button>
            </div>
          </div>
        ) : null}
      </header>

      {/* Stage */}
      <div className="relative min-h-0 flex-1">
        {isLoading ? (
          <div className="absolute inset-0 grid place-items-center"><div className="flex items-center gap-3 text-[13px] text-[var(--ink-m)]"><Spinner size={18} />Mapping the constellation…</div></div>
        ) : error ? (
          <div className="absolute inset-0 grid place-items-center text-[13px] text-[#ff8a7f]">Couldn't load agents: {String(error.message || error)}</div>
        ) : view === "list" ? (
          <ListView agents={listAgents} depts={web === "clients" ? CLIENT_DEPTS : INTERSTELLAR_DEPTS} onPick={(a) => select({ type: "agent", key: a.key })} selectedKey={selectedAgent?.key} showClient={web === "clients" && !client} />
        ) : (
          <>
            <Constellation graph={graph} viewKey={viewKey} selectedId={selectedId} onSelect={onNode} isMatch={filtering ? isMatch : null} query={query} labelsAlways={!!dept}
              padRight={panel ? (sel?.type === "ceo" || sel?.type === "brain" ? 540 : 460) : 0}
              onHover={(n, x, y) => setHover(n ? { n, x, y } : null)} />
            {dept ? (
              <>
                <button type="button" aria-label="Previous department" onClick={() => stepDept(-1)} className="glass absolute left-3 top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-[var(--ink-m)] transition hover:text-white md:left-5"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" aria-label="Next department" onClick={() => stepDept(1)} className={`glass absolute top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-[var(--ink-m)] transition hover:text-white ${panel ? (sel?.type === "ceo" || sel?.type === "brain" ? "right-3 md:right-[544px]" : "right-3 md:right-[464px]") : "right-3 md:right-5"}`}><ChevronRight className="h-5 w-5" /></button>
              </>
            ) : null}
            {/* Legend */}
            <div className="glass pointer-events-none absolute bottom-[68px] left-3 z-20 hidden rounded-xl px-3.5 py-3 sm:block md:left-5">
              <p className="eyebrow mb-2 !text-[9px]">Legend</p>
              <ul className="space-y-1.5 text-[11.5px] text-[var(--ink-m)]">
                <li className="flex items-center gap-2"><StatusDot status="live" />Live <span className="text-[var(--ink-s)]">· ring = ran in 24h</span></li>
                <li className="flex items-center gap-2"><StatusDot status="paused" />Paused</li>
                <li className="flex items-center gap-2"><StatusDot status="planned" />Planned (still needed)</li>
                <li className="flex items-center gap-2"><StatusDot status="broken" />Broken</li>
                <li className="pt-0.5 text-[10.5px] text-[var(--ink-s)]">Bigger = more runs in 30 days</li>
              </ul>
            </div>
            {/* Hover tooltip */}
            {hover && hover.n.type !== "sat" ? (
              <div className="glass pointer-events-none fixed z-50 max-w-[260px] rounded-lg px-3 py-2" style={{ left: hover.x + 14, top: hover.y + 14 }}>
                {hover.n.agent ? (
                  <>
                    <p className="flex items-center gap-2 text-[12.5px] font-medium text-white"><StatusDot status={hover.n.agent.status} size={7} />{hover.n.agent.key === "commander" ? ceoName : hover.n.agent.name}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--ink-m)]">{KIND_SHORT[hover.n.agent.kind] || ""}{hover.n.agent.schedule ? ` · ${hover.n.agent.schedule}` : ""}</p>
                    <p className="mono mt-0.5 text-[10.5px] text-[var(--ink-s)]">{hover.n.agent.status === "planned" ? `planned${hover.n.agent.build_order ? ` · build #${hover.n.agent.build_order}` : ""}` : `last run ${relTime(hover.n.agent.last_run_at)}`}</p>
                  </>
                ) : (
                  <p className="text-[12.5px] font-medium text-white">{hover.n.type === "brain" ? "Open the brain" : hover.n.type === "dept" ? `${hover.n.label} · open tree` : hover.n.type === "client" ? `${hover.n.label} · open constellation` : hover.n.label}</p>
                )}
              </div>
            ) : null}
          </>
        )}

        {/* Department switcher */}
        {!isLoading && !(web === "clients" && !client) ? (
          <div className={`absolute bottom-3 left-3 z-20 md:left-5 ${panel ? (sel?.type === "ceo" || sel?.type === "brain" ? "right-3 md:right-[544px]" : "right-3 md:right-[464px]") : "right-16 md:right-20"}`}>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              <button type="button" className={`chip shrink-0 ${!dept ? "on" : ""}`} onClick={() => setP({ dept: null, deptpanel: null })}>Overview</button>
              {presentDepts.map((x) => {
                const c = countStatus(scopeAgents.filter((a) => a.department === x.key));
                return (
                  <button key={x.key} type="button" className={`chip shrink-0 ${dept?.key === x.key ? "on" : ""}`} onClick={() => setP({ dept: x.key, deptpanel: null, agent: null })}>
                    {x.label}<span className="mono text-[10px] text-[#ff8a3d]">{c.live}</span><span className="mono text-[10px] text-[var(--ink-s)]">/{c.planned}</span>
                  </button>
                );
              })}
              {web === "clients" && client ? <button type="button" className="chip shrink-0" onClick={() => select({ type: "brain" })}><BookOpen className="h-3 w-3" />Brain</button> : null}
            </div>
          </div>
        ) : null}

        {panel}
      </div>
    </div>
  );
}
