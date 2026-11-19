// Universe: the most productive map of the whole operation. One zoomable tree, top to bottom:
// Claude -> Møthership -> brands -> (HQ departments | industry groups) -> clients -> departments -> agents -> delivered.
// Collapsed by default; click to open a branch, scroll or pinch to zoom (more detail appears as you zoom in), drag to
// move. Every node opens a side panel with its health, foundation checks, gaps (each a to-do with the page that fixes
// it) and links to the existing pages. Real records only; Presentation mode swaps in the sample businesses.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Sparkles, Search, X, Plus, Minus, Maximize2, AlertTriangle, ChevronRight, Globe, LayoutDashboard, PlugZap, BarChart3, CreditCard,
  Bot, MessagesSquare, Hammer, MonitorSmartphone, Presentation, Send, Orbit, ArrowUpRight, ListPlus, Check, Layers, Activity, Brain,
  Building2, Users, PanelRightOpen,
} from "lucide-react";
import "../agents/agents.css";
import "./universe.css";
import { base44 } from "@/api/base44Client";
import { IS_DEMO } from "@/lib/qa";
import { IS_PRESENTING } from "@/lib/presentation";
import { useUniverseData } from "./useUniverseData";
import { buildUniverse, pathTo, searchIndex, searchUniverse, kindLabel, rel, TONE } from "./model";
import { layoutTree, subtreeBox, linkPath } from "./layout";

const K_MIN = 0.06;
const K_MAX = 1.6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const zoneOf = (k) => (k < 0.42 ? "far" : k < 0.8 ? "mid" : "near");
const WIRE_ICON = { site: Globe, cmd: LayoutDashboard, portal: PlugZap, data: BarChart3, billing: CreditCard };
const SURFACE_ICON = { chats: MessagesSquare, builds: Hammer, browser: MonitorSmartphone, decks: Presentation, posts: Send };
const WIRE_TONE = { on: TONE.ok, partial: TONE.warn, off: TONE.bad };
const AGENT_TONE = { live: TONE.live, paused: "#8d8680", planned: "rgba(255,255,255,.5)", broken: TONE.bad };
const STATE_WORD = { on: "Connected", partial: "Partly", off: "Missing" };

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
function useSize(ref) {
  const [s, setS] = useState({ w: 1200, h: 700 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const on = () => setS({ w: el.clientWidth || 1200, h: el.clientHeight || 700 });
    on();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(on) : null;
    ro?.observe(el);
    window.addEventListener("resize", on);
    return () => { ro?.disconnect(); window.removeEventListener("resize", on); };
  }, [ref]);
  return s;
}
const useReduced = () => {
  const [r, setR] = useState(() => typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false);
  useEffect(() => { const q = window.matchMedia?.("(prefers-reduced-motion: reduce)"); if (!q) return undefined; const on = () => setR(q.matches); q.addEventListener?.("change", on); return () => q.removeEventListener?.("change", on); }, []);
  return r;
};

// ---------------------------------------------------------------- small parts
function Ring({ value, size = 44, color = "#ff6a00", label }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const v = value == null ? 0 : clamp(value, 0, 100);
  const tone = value == null ? "rgba(255,255,255,.25)" : v >= 75 ? TONE.ok : v >= 50 ? TONE.warn : TONE.bad;
  return (
    <span className="u-ring" style={{ width: size, height: size }} title={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="3.5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color === "tone" ? tone : tone} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <b>{value == null ? "—" : value}</b>
    </span>
  );
}
const Dot = ({ tone, pulse }) => <i className={`u-dot ${pulse ? "pulse" : ""}`} style={{ background: TONE[tone] || tone, boxShadow: `0 0 8px ${TONE[tone] || tone}` }} />;
function GapBadge({ gaps }) {
  const bad = gaps.filter((g) => g.sev === "bad").length;
  const warn = gaps.filter((g) => g.sev === "warn").length;
  if (!bad && !warn) return <span className="u-badge ok"><Check className="h-3 w-3" />No gaps</span>;
  return <span className={`u-badge ${bad ? "bad" : "warn"}`}><AlertTriangle className="h-3 w-3" />{bad + warn} gap{bad + warn === 1 ? "" : "s"}</span>;
}
function Kicker({ children, color }) {
  return <p className="u-kick"><span style={{ color: color || "#ff6a00" }}>+</span> {children}</p>;
}

// ---------------------------------------------------------------- node cards
function NodeCard({ n, p, sel, dim, isOpen, onSelect, onToggle, onAgent, selAgent, zone, live }) {
  const style = { left: p.x, top: p.y, width: p.w, height: p.h, "--c": n.color || "#ff6a00" };
  const toggle = n.children.length ? (
    <button type="button" className="u-tog" onClick={(e) => { e.stopPropagation(); onToggle(n.id); }} aria-expanded={isOpen} aria-label={`${isOpen ? "Close" : "Open"} ${n.label}`}>
      {isOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{toggleLabel(n, isOpen)}
    </button>
  ) : null;
  const common = {
    className: `u-node u-${n.type} tone-${n.status} ${sel ? "sel" : ""} ${dim ? "dim" : ""} ${n.test ? "test" : ""}`,
    style, "data-id": n.id, role: "button", tabIndex: 0, "aria-label": n.label,
    onClick: () => onSelect(n.id), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(n.id); } },
  };
  if (n.type === "claude") {
    return (
      <div {...common}>
        <div className="u-claude-top">
          <div className={`u-core ${live ? "live" : ""}`} aria-hidden="true"><span /><span /><span /></div>
          <div className="min-w-0 flex-1">
            <Kicker>Engine · top of everything</Kicker>
            <h3 className="u-title !text-[34px]">Claude</h3>
            <p className="u-sub">{n.sub}</p>
          </div>
          <div className="u-stats u-mid">
            <span><b>{n.metrics.runs24}</b>runs 24h</span>
            <span><b>{n.metrics.jobs}</b>in queue</span>
          </div>
        </div>
        <div className="u-surfaces">
          {n.surfaces.map((sf) => { const I = SURFACE_ICON[sf.k] || Sparkles; return (
            <Link key={sf.k} to={sf.to} className="u-surface" onClick={(e) => e.stopPropagation()}>
              <span className="u-surface-h"><I className="h-3.5 w-3.5" />{sf.label}</span>
              <span className="u-surface-v"><b>{sf.value}</b> {sf.unit}</span>
              <span className="u-surface-s u-mid">{sf.sub}</span>
            </Link>
          ); })}
        </div>
      </div>
    );
  }
  if (n.type === "hub") {
    const t = n.totals || {};
    return (
      <div {...common}>
        <Kicker>Hub · every brand runs through it</Kicker>
        <div className="flex items-center gap-3">
          <h3 className="u-title flex-1 !text-[28px]">Møthership</h3>
          <Ring value={n.health} size={48} label="Average client foundation" />
        </div>
        <div className="u-stats mt-2">
          <span><b>{t.brands}</b>brands</span><span><b>{t.clients}</b>clients</span><span><b>{t.live}</b>agents live</span>
          <span className={t.bad ? "bad" : t.gaps ? "warn" : ""}><b>{t.gaps}</b>gaps</span>
        </div>
        {toggle}
      </div>
    );
  }
  if (n.type === "brand") {
    return (
      <div {...common}>
        <span className="u-bar" />
        <Kicker color={n.color}>{n.root ? "Brand · home base" : "Brand"} · {n.bstatus}</Kicker>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="u-title">{n.label}</h3>
            <p className="u-sub truncate">{n.sub || "No niche set"}</p>
          </div>
          <Ring value={n.health} size={46} label="Average client foundation" />
        </div>
        <div className="u-stats mt-2 u-mid">
          <span><b>{n.clients}</b>clients</span><span><b>{n.agents || 0}</b>agents</span>
          <span><b>{n.own && n.own.score != null ? `${n.own.score}%` : "—"}</b>brand brain</span>
        </div>
        <div className="mt-2 u-mid"><GapBadge gaps={n.issues} /></div>
        {toggle}
      </div>
    );
  }
  if (n.type === "addbrand") {
    return (
      <Link to="/brands" className={`u-node u-addbrand ${dim ? "dim" : ""}`} style={style} data-id={n.id}>
        <Plus className="h-5 w-5" />
        <span className="u-title !text-[15px]">Add a brand</span>
        <span className="u-sub u-mid text-center">{n.sub}</span>
      </Link>
    );
  }
  if (n.type === "hq") {
    return (
      <div {...common}>
        <span className="u-bar" />
        <Kicker color={n.color}>HQ · the agency itself</Kicker>
        <h3 className="u-title">{n.label}</h3>
        <p className="u-sub">{n.children.length} departments · {n.live}/{n.agentCount} agents live</p>
        <div className="mt-2 u-mid"><GapBadge gaps={n.issues} /></div>
        {toggle}
      </div>
    );
  }
  if (n.type === "group") {
    const bad = n.issues.filter((g) => g.sev === "bad").length;
    return (
      <div {...common}>
        <Kicker color={n.color}>{n.test ? "Test · not real" : "Group"}</Kicker>
        <div className="flex items-start gap-2">
          <h3 className="u-title flex-1">{n.label}</h3>
          <Ring value={n.health} size={40} label="Average foundation" />
        </div>
        <p className="u-sub u-mid">{n.count} clients{bad ? ` · ${bad} broken` : ""}</p>
        {toggle}
      </div>
    );
  }
  if (n.type === "client") {
    return (
      <div {...common}>
        <span className="u-bar" />
        <Kicker color={n.color}>{n.test ? "Test client" : "Client"}{n.activity ? " · active now" : ""}</Kicker>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="u-title u-clamp">{n.label}</h3>
            <p className="u-sub truncate u-mid">{n.sub}</p>
          </div>
          <Ring value={n.foundation} size={42} label="Foundation" />
        </div>
        <div className="u-wires u-mid" aria-label="Connections">
          {n.wires.map((w) => { const I = WIRE_ICON[w.k]; return <span key={w.k} className={`u-wire ${w.state}`} title={`${w.label}: ${w.sub}`}><I className="h-3 w-3" /></span>; })}
          <span className="ml-auto"><GapBadge gaps={n.gaps} /></span>
        </div>
        {toggle}
      </div>
    );
  }
  if (n.type === "dept") {
    return (
      <div {...common}>
        <div className="flex items-center gap-2">
          <span className="u-code">{n.code}</span>
          <h3 className="u-title flex-1 !text-[14px] truncate">{n.label}</h3>
          <Dot tone={n.status} pulse={n.activity > 0} />
        </div>
        <p className="u-sub u-near truncate">{n.blurb}</p>
        <div className="u-agents">
          {n.agents.length ? n.agents.map((a) => (
            <button key={a.key} type="button" className={`u-agent ${selAgent === a.key ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); onAgent(n.id, a.key); }}>
              <i className={`u-adot ${a.status}`} style={{ background: AGENT_TONE[a.status] || AGENT_TONE.planned }} />
              <span className="min-w-0 flex-1">
                <span className="u-aname">{a.name}</span>
                <span className={`u-anow tone-${a.now.tone}`}>{zone === "far" ? "" : a.now.text}</span>
              </span>
            </button>
          )) : <p className="u-empty">No agents in this department yet.</p>}
        </div>
      </div>
    );
  }
  if (n.type === "out") {
    return (
      <div {...common}>
        <div className="flex items-center gap-2">
          <span className="u-code ok">OUT</span>
          <h3 className="u-title flex-1 !text-[14px]">Delivered to the client</h3>
        </div>
        <div className="u-agents">
          {n.items.length ? n.items.map((w) => (
            <div key={w.id} className="u-agent static">
              <i className="u-adot" style={{ background: TONE.ok }} />
              <span className="min-w-0 flex-1"><span className="u-aname">{w.title}</span><span className="u-anow">{w.kind} · {w.by} · {rel(w.at)}</span></span>
            </div>
          )) : <p className="u-empty">Nothing logged as delivered yet. Live work shows here the moment it is logged.</p>}
        </div>
      </div>
    );
  }
  return null;
}
function toggleLabel(n, open) {
  if (open) return "Close";
  if (n.type === "brand") return n.clients ? `${n.clients} client${n.clients === 1 ? "" : "s"}` : "Open";
  if (n.type === "group") return `${n.count} clients`;
  if (n.type === "client") return `${n.agentsCount} agents`;
  if (n.type === "hq") return `${n.children.length} departments`;
  if (n.type === "hub") return `${n.children.length - 1} brands`;
  return "Open";
}

// ---------------------------------------------------------------- side panel
function GapRow({ g, onFocus, onTask, done }) {
  return (
    <div className="u-gap">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onFocus(g)}>
        <span className="flex items-center gap-2"><Dot tone={g.sev} /><span className="u-gap-l">{g.label}</span></span>
        {g.clientName ? <span className="u-gap-s">{g.clientName}</span> : null}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {onTask ? <button type="button" className="u-mini" disabled={done} onClick={() => onTask(g)} title="Add to tasks">{done ? <Check className="h-3 w-3" /> : <ListPlus className="h-3 w-3" />}</button> : null}
        <Link to={g.to} className="u-mini u-fix">{g.fix}<ArrowUpRight className="h-3 w-3" /></Link>
      </div>
    </div>
  );
}
function Section({ title, children, right }) {
  return (
    <section className="u-sec">
      <div className="mb-2 flex items-center justify-between gap-2"><p className="u-kick !mb-0"><span>+</span> {title}</p>{right}</div>
      {children}
    </section>
  );
}
function GapList({ gaps, onFocus, onTask, tasked, limit = 40 }) {
  const [all, setAll] = useState(false);
  if (!gaps.length) return <p className="u-note">Nothing missing or broken here.</p>;
  const list = all ? gaps : gaps.slice(0, limit);
  return (
    <div className="space-y-1.5">
      {list.map((g) => <GapRow key={g.id} g={g} onFocus={onFocus} onTask={onTask} done={tasked.has(g.id)} />)}
      {gaps.length > list.length ? <button type="button" className="u-link" onClick={() => setAll(true)}>Show all {gaps.length}</button> : null}
    </div>
  );
}

function Panel({ uni, sel, selAgent, onFocus, onClose, onTask, tasked, mobile }) {
  const n = sel ? uni.nodes[sel] : null;
  const focusGap = (g) => onFocus(g.clientId ? `client:${g.clientId}` : g.brandId ? `brand:${g.brandId}` : "hq");
  const agent = n && n.type === "dept" && selAgent ? n.agents.find((a) => a.key === selAgent) : null;
  let body;
  if (!n) {
    const t = uni.totals;
    body = (
      <>
        <Kicker>Mission status</Kicker>
        <h2 className="u-ph">The whole operation</h2>
        <div className="u-kpis">
          {[["Brands", t.brands], ["Clients", t.clients], ["Agents live", `${t.live}/${t.agents}`], ["Runs 24h", t.runs24], ["Urgent", t.bad], ["Gaps", t.gaps]].map(([l, v]) => <div key={l}><b className={l === "Urgent" && t.bad ? "text-[#ff8a7f]" : ""}>{v}</b><span>{l}</span></div>)}
        </div>
        <Section title={`What's broken or missing · ${uni.gaps.length}`}>
          <GapList gaps={uni.gaps} onFocus={focusGap} onTask={onTask} tasked={tasked} limit={25} />
        </Section>
        <Section title="How to read it">
          <ul className="u-help">
            <li><b>Top to bottom</b> is how work flows: Claude, Møthership, a brand, a client, its departments, the agents, then what was delivered.</li>
            <li><b>Click</b> a card to open its branch. <b>Scroll or pinch</b> to zoom: more detail appears as you get closer.</li>
            <li><b>Rings</b> are foundation: Brain, connections, agents and profile together. Red marks something broken.</li>
          </ul>
        </Section>
      </>
    );
  } else if (agent) {
    body = (
      <>
        <Kicker>Agent · {n.label}</Kicker>
        <h2 className="u-ph">{agent.name}</h2>
        <p className="u-pt"><Dot tone={agent.status === "broken" ? "bad" : agent.status === "live" ? "live" : "idle"} /> {agent.status} · {kindLabel(agent.kind)}</p>
        <Section title="Right now"><p className={`u-now tone-${agent.now.tone}`}>{agent.now.text}</p></Section>
        {agent.role ? <Section title="Job"><p className="u-note">{agent.role.replace(/base44/gi, "app")}</p></Section> : null}
        <Section title="Facts">
          <dl className="u-dl">
            <dt>Schedule</dt><dd>{agent.schedule || "On demand"}</dd>
            <dt>Last run</dt><dd>{agent.last_run_at ? `${rel(agent.last_run_at)} · ${agent.last_status || "ok"}` : "No runs logged"}</dd>
            <dt>Runs 30d</dt><dd>{agent.run_count_30d ?? "—"}</dd>
            <dt>Autonomy</dt><dd>{agent.autonomy || "assisted"}</dd>
          </dl>
        </Section>
        <div className="u-links">
          <Link to={agent.scope === "client" ? `/agents?v=classic&web=clients&client=${agent.client_id}&agent=${encodeURIComponent(agent.key)}` : `/agents?v=classic&agent=${encodeURIComponent(agent.key)}`} className="btn-d"><Bot className="h-3.5 w-3.5" />Open on the Agents page</Link>
          {agent.client_id ? <Link to={`/clients/${agent.client_id}?tab=agents`} className="btn-d">Client agents</Link> : null}
        </div>
      </>
    );
  } else if (n.type === "client") {
    body = (
      <>
        <Kicker color={n.color}>{n.test ? "Test client" : "Client"} · {(uni.nodes[pathTo(uni.nodes, n.id).find((x) => x.startsWith("brand:"))] || {}).label}</Kicker>
        <h2 className="u-ph">{n.label}</h2>
        <p className="u-pt">{n.sub}{n.plan ? ` · ${n.plan}` : ""}</p>
        <div className="u-kpis">
          <div><b>{n.foundation}</b><span>Foundation</span></div>
          <div><b>{n.brainPct == null ? "—" : `${n.brainPct}%`}</b><span>Brain</span></div>
          <div><b>{n.profile ? `${n.profile.pct}%` : "—"}</b><span>Profile</span></div>
          <div><b>{n.agents.filter((a) => a.status === "live").length}/{n.agents.length}</b><span>Agents live</span></div>
        </div>
        <Section title="Connections">
          <div className="space-y-1">
            {n.wires.map((w) => { const I = WIRE_ICON[w.k]; return (
              <div key={w.k} className="u-wrow"><I className="h-3.5 w-3.5" style={{ color: WIRE_TONE[w.state] }} /><span className="flex-1">{w.label}<em>{w.sub}</em></span><span className={`u-state ${w.state}`}>{STATE_WORD[w.state]}</span></div>
            ); })}
          </div>
        </Section>
        <Section title={`Gaps · ${n.gaps.length}`}><GapList gaps={n.gaps} onFocus={focusGap} onTask={onTask} tasked={tasked} /></Section>
        {n.profile && n.profile.top.length ? <Section title="Profile items missing"><p className="u-note">{n.profile.top.join(" · ")}{n.profile.missing > n.profile.top.length ? ` · +${n.profile.missing - n.profile.top.length} more` : ""}</p></Section> : null}
        {n.jobs.length ? <Section title="In flight now">{n.jobs.map((j) => <p key={j.id} className="u-note"><Dot tone="live" pulse /> {j.title}</p>)}</Section> : null}
        <div className="u-links">
          <Link to={`/clients/${n.clientId}`} className="btn-d"><ArrowUpRight className="h-3.5 w-3.5" />Open client</Link>
          <Link to={`/clients/${n.clientId}?tab=agents`} className="btn-d"><Bot className="h-3.5 w-3.5" />Client agents</Link>
          <Link to={`/clients/${n.clientId}?tab=dossier`} className="btn-d"><Brain className="h-3.5 w-3.5" />Brain</Link>
        </div>
      </>
    );
  } else if (n.type === "brand") {
    body = (
      <>
        <Kicker color={n.color}>{n.root ? "Brand · home base" : "Brand"} · {n.bstatus}</Kicker>
        <h2 className="u-ph">{n.label}</h2>
        <p className="u-pt">{n.sub}{n.tagline ? ` · ${n.tagline}` : ""}</p>
        <div className="u-kpis">
          <div><b>{n.clients}</b><span>Clients</span></div>
          <div><b>{n.health ?? "—"}</b><span>Avg foundation</span></div>
          <div><b>{n.own && n.own.score != null ? `${n.own.score}%` : "—"}</b><span>Brand brain</span></div>
          <div><b>{n.issues.length}</b><span>Gaps</span></div>
        </div>
        {!n.clients ? <Section title="Empty for now"><p className="u-note">No clients on this brand yet. When one is added with this brand selected it appears here with its own departments and agents, through the same pipeline.</p></Section> : null}
        <Section title="Brand gaps"><GapList gaps={n.gaps} onFocus={focusGap} onTask={onTask} tasked={tasked} /></Section>
        <Section title={`Client gaps · ${n.issues.filter((g) => !n.gaps.some((x) => x.id === g.id)).length}`}><GapList gaps={n.issues.filter((g) => !n.gaps.some((x) => x.id === g.id))} onFocus={focusGap} onTask={onTask} tasked={tasked} limit={12} /></Section>
        <div className="u-links">
          <Link to={n.root ? "/brands" : `/brands/${n.slug}`} className="btn-d"><ArrowUpRight className="h-3.5 w-3.5" />Brand dashboard</Link>
          <Link to="/crm" className="btn-d"><Users className="h-3.5 w-3.5" />Clients</Link>
        </div>
      </>
    );
  } else if (n.type === "dept") {
    const owner = n.hq ? uni.nodes.hq : uni.nodes[`client:${n.clientId}`];
    body = (
      <>
        <Kicker>Department · {owner ? owner.label : ""}</Kicker>
        <h2 className="u-ph">{n.label}</h2>
        <p className="u-pt">{n.blurb}</p>
        <Section title={`Agents · ${n.agents.length}`}>
          {n.agents.length ? n.agents.map((a) => (
            <div key={a.key} className="u-wrow"><i className="u-adot" style={{ background: AGENT_TONE[a.status] }} /><span className="flex-1">{a.name}<em className={`tone-${a.now.tone}`}>{a.now.text}</em></span><span className="u-state">{kindLabel(a.kind)}</span></div>
          )) : <p className="u-note">No agents here yet. Deploy the standard set from the Agents page.</p>}
        </Section>
        <div className="u-links"><Link to={n.hq ? `/agents?deptpanel=${n.dept}` : `/clients/${n.clientId}?tab=agents`} className="btn-d"><Bot className="h-3.5 w-3.5" />Open on the Agents page</Link></div>
      </>
    );
  } else if (n.type === "claude") {
    body = (
      <>
        <Kicker>Engine</Kicker>
        <h2 className="u-ph">Claude</h2>
        <p className="u-pt">Everything below runs on it: the chats and agents, the app builds, computer and browser agents, presentations and posts.</p>
        <Section title="Surfaces">
          {n.surfaces.map((sf) => { const I = SURFACE_ICON[sf.k]; return <Link key={sf.k} to={sf.to} className="u-wrow hover:bg-white/5"><I className="h-3.5 w-3.5 text-[#ffb27a]" /><span className="flex-1">{sf.label}<em>{sf.sub}</em></span><b className="mono text-white">{sf.value}</b></Link>; })}
        </Section>
        <div className="u-links"><Link to="/claude" className="btn-d"><Sparkles className="h-3.5 w-3.5" />Claude queue</Link><Link to="/agents" className="btn-d"><Orbit className="h-3.5 w-3.5" />Agents</Link></div>
      </>
    );
  } else {
    body = (
      <>
        <Kicker color={n.color}>{n.type === "hub" ? "Hub" : n.type === "hq" ? "HQ" : n.type === "group" ? "Group" : "Delivered"}</Kicker>
        <h2 className="u-ph">{n.type === "out" ? "Delivered to the client" : n.label}</h2>
        {n.sub ? <p className="u-pt">{n.sub}</p> : null}
        {n.type === "group" ? <div className="u-kpis"><div><b>{n.count}</b><span>Clients</span></div><div><b>{n.health ?? "—"}</b><span>Avg foundation</span></div><div><b>{n.issues.length}</b><span>Gaps</span></div></div> : null}
        <Section title={`Gaps · ${n.issues.length}`}><GapList gaps={n.issues} onFocus={focusGap} onTask={onTask} tasked={tasked} limit={20} /></Section>
      </>
    );
  }
  return (
    <aside className={`u-panel ${mobile ? "sheet" : ""}`} aria-label="Details">
      <button type="button" className="u-x" aria-label="Close details" onClick={onClose}><X className="h-4 w-4" /></button>
      <div className="u-panel-in">{body}</div>
    </aside>
  );
}

// ---------------------------------------------------------------- minimap
function Minimap({ lay, nodes, view, size, onJump }) {
  const W = Math.max(1, lay.W);
  const H = Math.max(1, lay.H);
  const mw = 168;
  const mh = clamp((mw * H) / W, 50, 120);
  const sx = mw / W;
  const sy = mh / H;
  const vx = (-view.x / view.k) * sx;
  const vy = (-view.y / view.k) * sy;
  const click = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    onJump(((e.clientX - r.left) / mw) * W, ((e.clientY - r.top) / mh) * H);
  };
  return (
    <button type="button" className="u-mini-map" style={{ width: mw, height: mh }} onClick={click} aria-label="Minimap: click to move there">
      <svg width={mw} height={mh}>
        {Object.entries(lay.pos).map(([id, p]) => <rect key={id} x={p.x * sx} y={p.y * sy} width={Math.max(1.5, p.w * sx)} height={Math.max(1.5, p.h * sy)} rx="1" fill={TONE[nodes[id]?.status] || "#666"} opacity={nodes[id]?.status === "ok" ? 0.35 : 0.6} />)}
        <rect x={vx} y={vy} width={(size.w / view.k) * sx} height={(size.h / view.k) * sy} fill="rgba(255,106,0,.08)" stroke="#ff6a00" strokeWidth="1.2" />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------- page
export default function UniversePage() {
  const [fillRef, height] = useFillHeight();
  const q = useUniverseData();
  const uni = useMemo(() => (q.data ? buildUniverse(q.data) : null), [q.data]);
  if (q.isLoading || !uni) {
    return (
      <div ref={fillRef} className="agx u-page grid place-items-center" style={{ height: height || "calc(100dvh - 48px)" }}>
        {q.error ? <p className="text-sm text-[var(--ink-m)]">The Universe could not load. Refresh to try again.</p> : <p className="u-kick"><span>+</span> Mapping the universe…</p>}
      </div>
    );
  }
  return <Universe uni={uni} fillRef={fillRef} height={height} at={q.data.at} />;
}

function Universe({ uni, fillRef, height, at }) {
  const { nodes } = uni;
  const [params, setParams] = useSearchParams();
  const vpRef = useRef(null);
  const size = useSize(vpRef);
  const reduced = useReduced();
  const mobile = size.w < 760;
  const [open, setOpen] = useState(() => new Set(["claude", "hub"]));
  const [sel, setSel] = useState(null);
  const [selAgent, setSelAgent] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 0.8 });
  const [anim, setAnim] = useState(false);
  const [fly, setFly] = useState({ id: "claude", whole: true });
  const [query, setQuery] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const [panel, setPanel] = useState(() => typeof window === "undefined" || window.innerWidth >= 760);
  const [flowOpen, setFlowOpen] = useState(true);
  const [tasked, setTasked] = useState(() => new Set());
  const lay = useMemo(() => layoutTree(nodes, "claude", open, { maxCols: mobile ? 2 : 6 }), [nodes, open, mobile]);
  const index = useMemo(() => searchIndex(nodes), [nodes]);
  const results = useMemo(() => searchUniverse(index, query), [index, query]);
  const zone = zoneOf(view.k);

  // Fly to a node (or its open subtree) once the layout includes it.
  const flyTo = useCallback((box, maxK = 1) => {
    if (!box) return;
    const padX = mobile ? 24 : 60;
    const rightPad = !mobile && panel ? 380 : 0;
    const topPad = flowOpen ? (mobile ? 58 : 70) : 20;
    const bottomPad = mobile ? (panel ? Math.round(size.h * 0.44) + 84 : 96) : 110;
    const avail = size.h - topPad - bottomPad;
    const k = clamp(Math.min((size.w - rightPad - padX * 2) / box.w, avail / box.h, maxK), K_MIN, K_MAX);
    const x = (size.w - rightPad) / 2 - (box.x + box.w / 2) * k;
    const y = box.h * k < avail ? topPad + avail / 2 - (box.y + box.h / 2) * k : topPad + 10 - box.y * k;
    setAnim(!reduced);
    setView({ x, y, k });
  }, [size, mobile, panel, flowOpen, reduced]);
  useEffect(() => {
    if (!fly) return;
    const box = fly.whole ? { x: 0, y: 0, w: lay.W, h: lay.H } : fly.self ? lay.pos[fly.id] : subtreeBox(nodes, lay, fly.id);
    if (box) flyTo(box, fly.maxK || (fly.whole ? 1 : 1.05));
    setFly(null);
  }, [fly, lay, nodes, flyTo]);
  useEffect(() => { if (!anim) return undefined; const t = setTimeout(() => setAnim(false), 560); return () => clearTimeout(t); }, [anim, view]);

  // Open a node's path, select it and bring it into view. ?focus=client:<id> deep-links straight in.
  const focus = useCallback((id, { openSelf = false, agent = null } = {}) => {
    if (!nodes[id]) return;
    const path = pathTo(nodes, id);
    setOpen((o) => { const n = new Set(o); path.slice(0, -1).forEach((x) => n.add(x)); if (openSelf) n.add(id); return n; });
    setSel(id);
    setSelAgent(agent);
    setPanel(true);
    setFly({ id: openSelf ? id : nodes[id].parent || id, maxK: 1.05 });
  }, [nodes]);
  const focusParam = params.get("focus");
  const focused = useRef(null);
  useEffect(() => {
    if (focusParam && nodes[focusParam] && focused.current !== focusParam) { focused.current = focusParam; focus(focusParam, { openSelf: true }); }
  }, [focusParam, nodes, focus]);

  const onSelect = (id) => {
    const n = nodes[id];
    setSel(id);
    setSelAgent(null);
    setPanel(true);
    if (n.children.length && !open.has(id)) { setOpen((o) => new Set(o).add(id)); setFly({ id }); }
    if (params.get("focus")) { params.delete("focus"); setParams(params, { replace: true }); }
  };
  const onToggle = (id) => {
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) { const drop = [id]; while (drop.length) { const k = drop.pop(); n.delete(k); nodes[k].children.forEach((c) => drop.push(c)); } setFly({ id, self: true, maxK: 1 }); }
      else { n.add(id); setFly({ id }); }
      return n;
    });
  };
  const onAgent = (deptId, key) => { setSel(deptId); setSelAgent(key); setPanel(true); if (viewRef.current.k < 0.8) setFly({ id: deptId, self: true, maxK: 1 }); };
  const expandBrands = () => {
    const brandIds = nodes.hub.children.filter((k) => nodes[k].type === "brand");
    setOpen((o) => { const n = new Set(o); brandIds.forEach((b) => n.add(b)); n.add("hq"); return n; });
    setFly({ whole: true });
  };
  const collapseAll = () => { setOpen(new Set(["claude", "hub"])); setSel(null); setSelAgent(null); setFly({ whole: true }); };
  const onTask = async (g) => {
    try {
      await base44.entities.Task.create({ title: `${g.clientName ? `${g.clientName}: ` : ""}${g.fix} (${g.label})`, client_id: g.clientId || null, client_name: g.clientName || null, status: "todo", priority: g.sev === "bad" ? 1 : 2, notes: `Found by the Universe gap finder. Fix it here: ${g.to}`, source: "manual" });
      setTasked((t) => new Set(t).add(g.id));
    } catch { /* leave the button so it can be tried again */ }
  };

  // Pan, zoom and pinch.
  const pts = useRef(new Map());
  const drag = useRef(null);
  const suppress = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const zoomAt = useCallback((cx, cy, f) => {
    setAnim(false);
    setView((v) => { const k = clamp(v.k * f, K_MIN, K_MAX); return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k }; });
  }, []);
  useEffect(() => {
    const el = vpRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.shiftKey) { setAnim(false); setView((v) => ({ ...v, x: v.x - e.deltaY, y: v.y - e.deltaX })); return; }
      const dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);
  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest && e.target.closest("input,textarea,select,.u-panel,.u-ui")) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = viewRef.current;
    if (pts.current.size === 1) drag.current = { sx: e.clientX, sy: e.clientY, x: v.x, y: v.y, moved: false, id: e.pointerId };
    else if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      drag.current = { pinch: true, d: Math.hypot(a.x - b.x, a.y - b.y), k: v.k, x: v.x, y: v.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, moved: true };
    }
  };
  const onPointerMove = (e) => {
    if (!pts.current.has(e.pointerId) || !drag.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    const r = vpRef.current.getBoundingClientRect();
    if (d.pinch && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      const k = clamp((d.k * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, d.d), K_MIN, K_MAX);
      const cx = d.cx - r.left;
      const cy = d.cy - r.top;
      setAnim(false);
      setView({ k, x: cx - ((cx - d.x) * k) / d.k + ((a.x + b.x) / 2 - d.cx), y: cy - ((cy - d.y) * k) / d.k + ((a.y + b.y) / 2 - d.cy) });
      return;
    }
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 5) { d.moved = true; try { vpRef.current.setPointerCapture(e.pointerId); } catch { /* fine */ } }
    if (d.moved) { setAnim(false); setView((v) => ({ ...v, x: d.x + dx, y: d.y + dy })); }
  };
  const onPointerUp = (e) => {
    pts.current.delete(e.pointerId);
    if (drag.current && drag.current.moved) { suppress.current = true; setTimeout(() => { suppress.current = false; }, 0); }
    if (!pts.current.size) drag.current = null;
    else if (drag.current?.pinch) { const [a] = [...pts.current.values()]; const v = viewRef.current; drag.current = { sx: a.x, sy: a.y, x: v.x, y: v.y, moved: true }; }
  };
  const onClickCapture = (e) => { if (suppress.current) { e.stopPropagation(); e.preventDefault(); } };

  useEffect(() => {
    const on = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "Escape") { setSel(null); setSelAgent(null); }
      if (e.key === "f") setFly({ whole: true });
      if (e.key === "+" || e.key === "=") zoomAt(size.w / 2, size.h / 2, 1.25);
      if (e.key === "-") zoomAt(size.w / 2, size.h / 2, 0.8);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [size, zoomAt]);

  const lit = useMemo(() => (sel ? new Set(pathTo(nodes, sel)) : null), [sel, nodes]);
  const crumbs = sel ? pathTo(nodes, sel) : [];
  const grid = 56 * view.k;
  const t = uni.totals;

  return (
    <div ref={fillRef} className="agx u-page flex flex-col overflow-hidden" style={{ height: height || "calc(100dvh - 48px)" }} data-testid="universe">
      <header className="u-head">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
          <h1 className="u-h1">Universe <span>/the whole operation</span></h1>
          {IS_DEMO ? <span className="u-sample" data-testid="universe-sample">Sample businesses · not real data</span> : null}
          <p className="u-summary hidden lg:flex"><span className="live-dot" />{t.brands} brand{t.brands === 1 ? "" : "s"} · {t.clients} client{t.clients === 1 ? "" : "s"} · {t.live} of {t.agents} agents live · {t.runs24} runs in 24h · <b className={t.bad ? "text-[#ff8a7f]" : ""}>{t.gaps} gaps</b> · updated {rel(new Date(at).toISOString())}</p>
        </div>
        <div className="u-tools u-ui">
          <label className="relative min-w-0 flex-1 basis-[55%] sm:w-64 sm:flex-none sm:basis-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-s)]" />
            <input className="inp w-full !pl-8" placeholder="Find a brand, client or agent" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the universe" data-testid="universe-search" />
            {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-s)] hover:text-white"><X className="h-3.5 w-3.5" /></button> : null}
            {results.length ? (
              <div className="u-results" role="listbox">
                {results.map((r) => (
                  <button key={r.id} type="button" role="option" aria-selected={false} onClick={() => { setQuery(""); focus(r.node, { openSelf: r.type !== "agent", agent: r.agentKey || null }); }}>
                    <span className="u-r-l">{r.label}</span><span className="u-r-s">{r.sub}</span>
                  </button>
                ))}
              </div>
            ) : query ? <div className="u-results"><p className="px-3 py-2 text-[12px] text-[var(--ink-s)]">Nothing matches “{query}”.</p></div> : null}
          </label>
          <button type="button" className={`btn-d ${gapsOnly ? "on" : ""}`} aria-pressed={gapsOnly} onClick={() => setGapsOnly((v) => { if (!v) { setSel(null); setSelAgent(null); setPanel(true); } return !v; })} data-testid="universe-gaps"><AlertTriangle className="h-3.5 w-3.5" />Gaps{t.gaps ? ` · ${t.gaps}` : ""}</button>
          <button type="button" className="btn-d !hidden sm:!inline-flex" onClick={expandBrands}><Layers className="h-3.5 w-3.5" />Open all brands</button>
          <button type="button" className="btn-d !hidden sm:!inline-flex" onClick={collapseAll}>Collapse</button>
          {!panel ? <button type="button" className="btn-d" onClick={() => setPanel(true)} aria-label="Show details"><PanelRightOpen className="h-3.5 w-3.5" /><span className="hidden sm:inline">Details</span></button> : null}
        </div>
      </header>
      <nav className="u-crumbs u-ui" aria-label="Breadcrumb" data-testid="universe-breadcrumb">
        <button type="button" onClick={() => { setSel(null); setSelAgent(null); setFly({ whole: true }); }}>Universe</button>
        {crumbs.map((id) => <span key={id} className="flex items-center gap-1"><ChevronRight className="h-3 w-3 opacity-40" /><button type="button" onClick={() => focus(id, { openSelf: true })} className={id === sel ? "on" : ""}>{nodes[id].type === "out" ? "Delivered" : nodes[id].label}</button></span>)}
        {selAgent && sel && nodes[sel]?.agents ? <span className="flex items-center gap-1"><ChevronRight className="h-3 w-3 opacity-40" /><span className="on">{(nodes[sel].agents.find((a) => a.key === selAgent) || {}).name}</span></span> : null}
        <span className="u-hint hidden md:inline">Scroll to zoom · drag to move · click to open</span>
      </nav>

      <div className="relative min-h-0 flex-1">
        <div
          ref={vpRef} className="u-vp grain-d" data-z={zone} data-gaps={gapsOnly ? "1" : "0"}
          style={{ backgroundSize: `${grid}px ${grid}px, ${grid}px ${grid}px, ${grid * 4}px ${grid * 4}px, ${grid * 4}px ${grid * 4}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClickCapture={onClickCapture}
        >
          <div className={`u-world ${anim ? "anim" : ""}`} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: lay.W, height: lay.H }}>
            <svg className="u-links-svg" width={lay.W + 40} height={lay.H + 40} aria-hidden="true">
              {lay.links.map((l) => {
                const a = lay.pos[l.from];
                const b = l.shelf ? lay.shelfBy[l.to] : lay.pos[l.to];
                if (!a || !b) return null;
                const child = l.shelf ? null : nodes[l.to];
                const tone = child ? child.status : "ok";
                const act = l.shelf ? lay.shelfBy[l.to] && nodes[l.from].activity : child ? child.activity : 0;
                const on = lit && lit.has(l.from) && (l.shelf ? lit.size > 0 && [...lit].some((x) => lay.pos[x]?.shelf === l.to) : lit.has(l.to));
                const d = linkPath(a, b);
                const broken = gapsOnly && tone === "bad";
                return (
                  <g key={l.id} className={`u-l ${on ? "on" : ""} ${broken ? "broken" : ""}`}>
                    <path d={d} className="u-l-base" style={{ stroke: tone === "bad" ? "rgba(255,68,51,.45)" : undefined }} />
                    {act > 0 && !reduced ? <path d={d} className="u-l-flow" style={{ animationDuration: `${clamp(6 - act * 0.6, 1.4, 6)}s` }} /> : null}
                  </g>
                );
              })}
            </svg>
            {lay.shelves.map((sh) => (
              <div key={sh.id} className="u-shelf" style={{ left: sh.x, top: sh.y, width: sh.w, height: sh.h }}>
                <p className="u-kick"><span>+</span> {sh.of === "group" ? `${sh.count} groups · click one to open it` : sh.of === "client" ? `${sh.count} clients · click one to open it` : `${sh.count} lanes · departments, their agents and what was delivered`}</p>
              </div>
            ))}
            {Object.entries(lay.pos).map(([id, p]) => {
              const n = nodes[id];
              const dim = gapsOnly && !["claude", "hub", "brand"].includes(n.type) && !n.issues.some((g) => g.sev === "bad");
              return <NodeCard key={id} n={n} p={p} sel={sel === id} dim={dim} isOpen={open.has(id)} onSelect={onSelect} onToggle={onToggle} onAgent={onAgent} selAgent={sel === id ? selAgent : null} zone={zone} live={!reduced && t.runs24 + t.jobs > 0} />;
            })}
          </div>
        </div>

        <div className={`u-zoom u-ui ${IS_PRESENTING ? "presenting" : ""}`} role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom out" onClick={() => zoomAt(size.w / 2, size.h / 2, 0.8)}><Minus className="h-4 w-4" /></button>
          <span className="mono">{Math.round(view.k * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.25)}><Plus className="h-4 w-4" /></button>
          <button type="button" aria-label="Fit everything" onClick={() => setFly({ whole: true })}><Maximize2 className="h-4 w-4" /></button>
        </div>
        {!mobile ? <div className={`u-ui absolute left-4 z-20 ${uni.flows.length ? "top-[66px]" : "top-3"}`}><Minimap lay={lay} nodes={nodes} view={view} size={size} onJump={(wx, wy) => { setAnim(!reduced); setView((v) => ({ ...v, x: size.w / 2 - wx * v.k, y: size.h / 2 - wy * v.k })); }} /></div> : null}

        {uni.flows.length ? (
          <div className={`u-flow u-ui ${flowOpen ? "" : "shut"} ${panel ? "panel" : ""}`} data-testid="universe-flow">
            <button type="button" className="u-flow-h" onClick={() => setFlowOpen((v) => !v)} aria-expanded={flowOpen}><Activity className="h-3.5 w-3.5" />Live flow<span className="hidden sm:inline"> · Claude → agent → department → client</span></button>
            {flowOpen ? (
              <div className="u-flow-list">
                {uni.flows.map((f) => (
                  <button key={f.id} type="button" className={`u-flow-i ${f.live ? "live" : ""}`} onClick={() => focus(`client:${f.clientId}`, { openSelf: true })}>
                    <span className="u-step c">{f.by}</span><ChevronRight className="h-3 w-3 opacity-40" />
                    {f.agent ? <><span className="u-step">{f.agent}</span><ChevronRight className="h-3 w-3 opacity-40" /></> : null}
                    <span className="u-step">{f.deptLabel}</span><ChevronRight className="h-3 w-3 opacity-40" />
                    <span className="u-step b"><Building2 className="h-3 w-3" />{f.client}</span>
                    <span className="u-flow-t">{f.live ? (f.state === "needs_approval" ? "waiting for OK" : "in progress") : rel(f.at)} · {f.title}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {panel ? <Panel uni={uni} sel={sel} selAgent={selAgent} onFocus={(id) => focus(id, { openSelf: true })} onClose={() => { if (sel) { setSel(null); setSelAgent(null); if (mobile) setPanel(false); } else setPanel(false); }} onTask={onTask} tasked={tasked} mobile={mobile} /> : null}
      </div>
    </div>
  );
}
