import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ExternalLink, RefreshCw, Satellite } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Panel from "@/features/tasks/ui-kit/Panel";
import CategoryChip from "@/features/tasks/ui-kit/CategoryChip";
import TimerButton from "@/features/tasks/components/TimerButton";
import OrbRail, { Orb } from "@/features/packages/components/OrbRail";
import DeliverablesGlance from "@/features/packages/components/DeliverablesGlance";
import usePackageData from "@/features/packages/usePackageData";
import { PACKAGES, SUBSCRIPTIONS, DELIVERY_PACKAGES, ORB_STATES, packageByKey, packagePath } from "@/features/packages/registry";
import { clientsOf, railFor, projectsOf } from "@/features/packages/engine";
import FlightWalkthrough from "@/features/flight/onboarding/FlightWalkthrough";
import OnboardClientButton from "@/features/flight/onboarding/OnboardClientButton";
import { dueLabel, dueTone, shortDate } from "@/features/tasks/lib/format";
import { btnGhost } from "@/features/tasks/lib/ui";
import { cn } from "@/lib/utils";

const KIND_LABEL = { blog: "Blog", gbp_post: "GBP post", site_edit: "Site edit", project_page: "Project page", new_page: "New page", citation: "Citation", press: "Press", mention: "Mention", backlink: "Backlink", schema: "Schema", search_console: "Search Console", bing: "Bing", analytics: "Analytics", report: "Report", presentation: "Presentation", deliverable: "Deliverable", design: "Design", automation_setup: "Automation", other: "Work" };

function Logo({ client, size = 36 }) {
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden border border-ink/[0.1] bg-white" style={{ width: size, height: size }}>
      {client.logo_url || client.logoUrl ? <img src={client.logo_url || client.logoUrl} alt="" className="h-full w-full object-contain p-1" /> : <span className="text-[13px] font-semibold text-[#ff3c00]">{(client.business || "?").charAt(0)}</span>}
    </div>
  );
}

function StatePill({ state }) {
  const s = ORB_STATES[state] || ORB_STATES.pending;
  return (
    <span className={cn("mono-label inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-[2px] text-[8.5px]", state === "done" ? "border-ink bg-ink text-white" : state === "working" || state === "attention" ? "border-[#ff3c00]/50 text-[#ff3c00]" : "border-hair text-ink/50")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", state === "done" ? "bg-white" : state === "working" || state === "attention" ? "bg-[#ff3c00]" : "bg-ink/30")} />
      {s.label}
    </span>
  );
}

/* ---------- package switcher (the eight pillars) ---------- */
function PackageTabs({ current }) {
  const group = SUBSCRIPTIONS.some((p) => p.key === current) ? SUBSCRIPTIONS : DELIVERY_PACKAGES;
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-hair px-5 md:px-8">
      <span className="mono-label mr-2 self-center text-[8.5px] text-ink/40">{group === SUBSCRIPTIONS ? "Subscriptions" : "Packages"}</span>
      {group.map((p) => {
        const active = p.key === current;
        return (
          <Link key={p.key} to={packagePath(p.key)} className={cn("relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-[12px] transition-colors", active ? "text-ink" : "text-ink/50 hover:text-ink")}>
            <p.icon className="h-3.5 w-3.5" style={{ color: active ? p.color : undefined }} />
            {p.label}
            {active ? <span className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: p.color }} /> : null}
          </Link>
        );
      })}
    </div>
  );
}

/* ---------- client view: Ørbit ---------- */
function OrbitClientView({ client, rail, data, onPatch }) {
  const [sel, setSel] = useState(null);
  const latestIntel = data.intel.slice(0, 5);
  const sched = rail.automations.filter((a) => ["blog", "gbp_post"].includes(a.kind));
  const sub = rail.subscription || {};
  return (
    <div className="space-y-5">
      <div className="grid overflow-hidden rounded-md border border-hair bg-card sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Subscription", sub.price ? "$" + sub.price.toLocaleString("en-US") + "/mo" : "—"],
          ["Plan", sub.plan || "—"],
          ["Footprint", sub.footprint || "not set"],
          ["Primary location", sub.primaryLocation || "not set"],
          ["Service area", sub.serviceLocations || "not set"],
          ["Domain", sub.domain || "—"]
        ].map(([k, v]) => (
          <div key={k} className="border-r border-hair px-4 py-3 last:border-r-0">
            <p className="mono-label text-[8.5px] text-ink/45">{k}</p>
            <p className={cn("mt-1 truncate text-[13px] font-medium", /not set/.test(String(v)) ? "text-[#ff3c00]" : "text-ink")} title={String(v)}>{v}</p>
          </div>
        ))}
      </div>
      <Panel kicker="Pipeline" title={"What the system is doing for " + client.business} bodyClassName="p-5">
        <OrbRail orbs={rail.orbs} size="lg" activeKey={sel && sel.key} onSelect={setSel} />
        {sel ? (
          <div className="mt-5 rounded-md border border-hair bg-canvas/60 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold">{sel.full}</p>
              <StatePill state={sel.state} />
            </div>
            <p className="mt-1 text-[12px] text-ink/65">{sel.hint}</p>
            <p className="mt-2 font-mono text-[11px] text-ink/80">{sel.detail}</p>
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel kicker="This month" title="Shipped">
          <div className="grid grid-cols-3 gap-2">
            {[["Blogs", rail.counts.blogs], ["GBP posts", rail.counts.gbp], ["Fixes", rail.counts.fixes]].map(([k, v]) => (
              <div key={k} className="rounded-md border border-hair bg-canvas/60 px-3 py-2.5">
                <p className="text-[22px] font-semibold leading-none tracking-[-0.04em]">{v}</p>
                <p className="mono-label mt-1.5 text-[8.5px] text-ink/45">{k}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel kicker="Cadence" title="What's running, and why">
          {sched.length ? (
            <ul className="space-y-2">
              {sched.map((a) => (
                <li key={a.id} className="rounded-md border border-hair bg-canvas/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-medium">{a.name}</p>
                    <StatePill state={a.status === "active" ? "done" : a.status === "error" ? "attention" : a.status === "paused" ? "attention" : "pending"} />
                  </div>
                  <p className="mt-0.5 font-mono text-[10.5px] text-ink/60">{a.schedule || "no schedule set"}</p>
                  {a.notes ? <p className="mt-1 text-[11px] text-ink/55">{a.notes}</p> : null}
                </li>
              ))}
            </ul>
          ) : rail.profile && (rail.profile.blogFrequency || rail.profile.gbpFrequency) ? (
            <ul className="space-y-2">
              {[["Blogs", rail.profile.blogFrequency, rail.profile.blogDays], ["GBP posts", rail.profile.gbpFrequency, rail.profile.gbpDays]].filter(([, f]) => f).map(([k, f, d]) => (
                <li key={k} className="rounded-md border border-hair bg-canvas/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-medium">{k}</p>
                    <span className="font-mono text-[11px] text-ink">{f}</span>
                  </div>
                  {Array.isArray(d) && d.length ? <p className="mt-0.5 font-mono text-[10.5px] text-ink/60">{d.map((x) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x] || x).join(" · ")}</p> : null}
                </li>
              ))}
              <li className="text-[10.5px] text-ink/45">Set on the client's HyperCare+ profile (Strategy editor). The automations run on this cadence once they go live.</li>
            </ul>
          ) : (
            <p className="text-[12px] text-ink/50">No cadence set yet. Set blog and GBP frequency on the client's HyperCare+ profile (Strategy editor) — that is what the automations will run on.</p>
          )}
        </Panel>

        <Panel kicker="Intel" title="Last changes read">
          {latestIntel.length ? (
            <ul className="space-y-1.5">
              {latestIntel.map((i) => (
                <li key={i.id} className="flex items-start gap-2 text-[11.5px]">
                  <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", i.impact === "high" ? "bg-[#ff3c00]" : i.impact === "medium" ? "bg-ink" : "bg-ink/30")} />
                  <span className="min-w-0 flex-1">
                    <span className="text-ink">{i.title}</span>
                    <span className="ml-1.5 mono-label text-[8.5px] text-ink/40">{i.brief_date} · {i.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-ink/50">No Search Intel briefs in the system yet.</p>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel kicker="Feed" title="Everything shipped" bodyClassName="p-0">
          {rail.worklog.length ? (
            <ul className="max-h-[420px] divide-y divide-hair overflow-y-auto">
              {rail.worklog.slice(0, 60).map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="mono-label w-[88px] shrink-0 text-[8.5px] text-ink/45">{KIND_LABEL[w.kind] || w.kind}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{w.title}</span>
                  <span className={cn("mono-label text-[8.5px]", w.status === "live" ? "text-ink" : w.status === "failed" ? "text-[#ff3c00]" : "text-ink/45")}>{w.status}{w.verified_live ? " ✓" : ""}</span>
                  <span className="font-mono text-[10px] text-ink/45">{shortDate(w.date)}</span>
                  {w.url ? (
                    <a href={w.url} target="_blank" rel="noreferrer" className="text-ink/40 hover:text-[#ff3c00]">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-[12px] text-ink/50">Nothing logged for this client in the last 120 days.</p>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel kicker="Search Console · Analytics" title="Behaviour">
            <div className="grid grid-cols-2 gap-2">
              {[["Search Console", rail.orbs.find((o) => o.key === "gsc")], ["Google Analytics", rail.orbs.find((o) => o.key === "analytics")]].map(([k, o]) => (
                <div key={k} className="rounded-md border border-dashed border-hair px-3 py-3">
                  <p className="text-[12px] font-medium">{k}</p>
                  <div className="mt-1.5"><StatePill state={o.state} /></div>
                  <p className="mt-1.5 text-[10.5px] text-ink/50">{o.state === "off" ? "Connects in Phase 2 with your Google account; the property's clicks, impressions, coverage and errors land here." : o.detail}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel kicker="Steps" title={rail.openTasks.length + " HyperCare+ steps open"} bodyClassName="p-0">
            {rail.openTasks.length ? (
              <ul className="max-h-[260px] divide-y divide-hair overflow-y-auto">
                {rail.openTasks.slice(0, 30).map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">{t.title}</span>
                    <CategoryChip value={t.category} />
                    <span className={cn("text-[10.5px]", dueTone(t.due_date, t.status))}>{dueLabel(t.due_date, t.status)}</span>
                    <TimerButton task={t} compact onChange={(p) => onPatch(t, p)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-5 text-[12px] text-ink/50">No open HyperCare+ SOP steps.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ---------- client view: delivery packages ---------- */
function DeliveryClientView({ client, rail, pkg, onPatch }) {
  const [sel, setSel] = useState(null);
  const list = sel ? [...(rail.byPhase[sel.full] || [])].sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999")) : [];
  return (
    <div className="space-y-5">
      <Panel kicker="Delivery" title={pkg.label + " · " + rail.progress + "% fulfilled"} bodyClassName="p-5">
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-sm bg-ink/[0.06]">
          <div className="h-full rounded-sm transition-all duration-700" style={{ width: rail.progress + "%", background: pkg.color }} />
        </div>
        <OrbRail orbs={rail.orbs} size="lg" activeKey={sel && sel.key} onSelect={setSel} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel kicker="Projects" title={rail.projects.length + " on this package"}>
          {rail.projects.length ? (
            <ul className="space-y-1.5">
              {rail.projects.map((p) => (
                <li key={p.id}>
                  <Link to={"/projects/" + p.id} className="flex items-center justify-between gap-2 rounded-md border border-hair bg-canvas/60 px-3 py-2 text-[12.5px] hover:border-ink/40">
                    <span className="min-w-0 truncate">{p.title}</span>
                    <span className="mono-label shrink-0 text-[8.5px] text-ink/50">{p.status} · {p.progress || 0}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-ink/50">No project running this SOP for {client.business} yet. Start the service from the client's cockpit and the rail lights up.</p>
          )}
        </Panel>

        <Panel kicker={sel ? sel.full : "Steps"} title={sel ? list.length + " steps in this phase" : "Pick a stage"} className="lg:col-span-2" bodyClassName="p-0">
          {sel ? (
            list.length ? (
              <ul className="max-h-[360px] divide-y divide-hair overflow-y-auto">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", t.status === "done" ? "bg-ink" : t.status === "blocked" || t.status === "doing" ? "bg-[#ff3c00]" : "bg-ink/25")} />
                    <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", t.status === "done" && "text-ink/45 line-through")}>{t.title}</span>
                    <CategoryChip value={t.category} />
                    <span className={cn("text-[10.5px]", dueTone(t.due_date, t.status))}>{dueLabel(t.due_date, t.status)}</span>
                    <TimerButton task={t} compact onChange={(p) => onPatch(t, p)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-5 text-[12px] text-ink/50">No steps in this phase yet.</p>
            )
          ) : (
            <p className="px-5 py-5 text-[12px] text-ink/50">Click an orb to see the steps behind it — each one can be clocked right here.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------- the page ---------- */
export default function PackagePage() {
  const { key, clientId } = useParams();
  const navigate = useNavigate();
  const pkg = packageByKey(key) || PACKAGES[0];
  const { data, loading, updatedAt, reload } = usePackageData();
  const [patches, setPatches] = useState({});

  // optimistic timer patches merge over the live data until the next reload
  const liveData = useMemo(() => ({ ...data, tasks: data.tasks.map((t) => (patches[t.id] ? { ...t, ...patches[t.id] } : t)) }), [data, patches]);
  useEffect(() => setPatches({}), [updatedAt]);
  const onPatch = (task, patch) => setPatches((p) => ({ ...p, [task.id]: { ...(p[task.id] || {}), ...patch } }));

  const rows = useMemo(() => clientsOf(pkg, liveData).map((c) => ({ client: c, rail: railFor(pkg, c, liveData) })), [pkg, liveData]);
  const selected = rows.find((r) => r.client.id === clientId) || null;
  const startedProjects = useMemo(() => (selected ? projectsOf(pkg, liveData).filter((p) => p.client_id === selected.client.id) : []), [pkg, liveData, selected]);
  const flightOf = (cid) => (liveData.flights || []).find((f) => f.client_id === cid && f.package_key === pkg.key && f.status !== "archived");
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [clientId]);
  const counts = { done: rows.filter((r) => r.rail.overall === "done").length, working: rows.filter((r) => r.rail.overall === "working").length, attention: rows.filter((r) => r.rail.overall === "attention").length, off: rows.filter((r) => r.rail.overall === "off").length };

  return (
    <div className="min-h-screen pb-24">
      <PageHeader
        breadcrumb={(pkg.kind === "recurring" ? "Subscriptions / " : "Packages / ") + pkg.label}
        title={pkg.label}
        rightText={updatedAt ? "live · updated " + updatedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "loading"}
      >
        {pkg.arch ? (
          <span className="mono-label hidden items-center gap-2 rounded-sm border border-hair bg-card px-2.5 py-1.5 text-[9.5px] text-ink/70 md:inline-flex">
            <Satellite className="h-3 w-3" style={{ color: pkg.color }} />
            Built on {pkg.arch} <span className="text-[#ff3c00]">{pkg.version}</span>
          </span>
        ) : null}
        <button type="button" onClick={reload} className={btnGhost}>
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </PageHeader>
      <PackageTabs current={pkg.key} />

      <div className="space-y-6 px-5 py-6 md:px-8">
        <DeliverablesGlance current={pkg.key} />
        {selected ? (
          /* ---------- client view takes the page; switcher keeps the others one click away ---------- */
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => navigate(packagePath(pkg.key))} className="mono-label inline-flex items-center gap-2 text-[10px] text-ink/50 transition-colors hover:text-ink">
                <ArrowLeft className="h-3.5 w-3.5" />
                All {pkg.label} clients · {rows.length}
              </button>
              <div className="flex items-center gap-2">
                <Link to={"/clients/" + selected.client.id} className={btnGhost}>
                  Cockpit <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                {pkg.key === "orbit-seo" ? (
                  <Link to="/orbit-seo/manage" className={btnGhost}>
                    Strategy editor <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {rows.map(({ client, rail }) => {
                const active = client.id === selected.client.id;
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => navigate(packagePath(pkg.key) + "/" + client.id)}
                    className={cn("flex shrink-0 items-center gap-2 rounded-sm border px-2 py-1.5 text-[11.5px] transition-colors", active ? "border-ink bg-ink text-white" : "border-hair bg-card text-ink/70 hover:border-ink/40 hover:text-ink")}
                    title={client.business}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", rail.overall === "attention" || rail.overall === "working" ? "bg-[#ff3c00]" : rail.overall === "done" ? (active ? "bg-white" : "bg-ink") : "bg-ink/25")} />
                    <span className="max-w-[140px] truncate">{client.business}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Logo client={selected.client} size={44} />
              <div>
                <p className="label-cross text-[10.5px] text-ink/60">({pkg.label} · client view)</p>
                <div className="mt-0.5 flex items-center gap-3">
                  <h2 className="text-[22px] font-semibold tracking-[-0.03em]">{selected.client.business}</h2>
                  <StatePill state={selected.rail.overall} />
                </div>
              </div>
            </div>

            <FlightWalkthrough key={pkg.key + selected.client.id} pkg={pkg} client={selected.client} startedProjects={startedProjects} onChanged={reload} />

            {pkg.key === "orbit-seo" ? (
              <OrbitClientView client={selected.client} rail={selected.rail} data={liveData} onPatch={onPatch} />
            ) : (
              <DeliveryClientView client={selected.client} rail={selected.rail} pkg={pkg} onPatch={onPatch} />
            )}
          </div>
        ) : (
          /* ---------- all-in-one ---------- */
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="w-full">
                <OnboardClientButton pkg={pkg} clients={liveData.clients} flights={liveData.flights} onCreated={reload} />
              </div>
              <p className="max-w-2xl text-[13px] leading-relaxed text-ink/60">{pkg.tagline} {pkg.kind === "recurring" ? "Every subscriber, every stage of this cycle, updating as the system works. Click a client to open them." : "Every client on the package and how far through the SOP they are. Fulfilled means every step is done. Click a client to open them."}</p>
              <div className="grid grid-cols-4 gap-2">
                {[["Fulfilled", counts.done, "#1a1a1a"], ["In flight", counts.working, "#ff3c00"], ["Needs you", counts.attention, "#ff3c00"], ["Not started", counts.off, "#8a8580"]].map(([k, v, c]) => (
                  <div key={k} className="min-w-[88px] rounded-md border border-hair bg-card px-3 py-2">
                    <p className="text-[20px] font-semibold leading-none tracking-[-0.04em]" style={{ color: v ? c : "rgba(26,26,26,.3)" }}>{v}</p>
                    <p className="mono-label mt-1 text-[8.5px] text-ink/45">{k}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-hair bg-card">
              <div className="flex items-center justify-between border-b border-hair px-4 py-2.5">
                <p className="label-cross text-[10.5px] text-ink/60">(All clients · {rows.length})</p>
                <div className="hidden items-center gap-3 md:flex">
                  {[["done", "Done"], ["working", "In flight"], ["attention", "Needs you"], ["pending", "Queued"], ["off", "Not set up"]].map(([k, label]) => (
                    <span key={k} className="flex items-center gap-1.5 text-[9.5px] text-ink/50">
                      <Orb orb={{ key: k, state: k, label: "" }} size="sm" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              {loading && !rows.length ? (
                <p className="px-5 py-10 text-center text-[12.5px] text-ink/45">Reading the field...</p>
              ) : rows.length ? (
                <div className="divide-y divide-hair">
                  {rows.map(({ client, rail }) => (
                    <Link
                      key={client.id}
                      to={packagePath(pkg.key) + "/" + client.id}
                      className="group grid w-full grid-cols-[minmax(0,230px)_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-ink/[0.03]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Logo client={client} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">{client.business}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <StatePill state={rail.overall} />
                            {pkg.kind === "delivery" && rail.total ? <span className="font-mono text-[10px] text-ink/45">{rail.done}/{rail.total}</span> : null}
                            {(() => {
                              const f = flightOf(client.id);
                              if (!f || f.status === "launched") return null;
                              return <span className="mono-label rounded-sm border border-[#ff3c00]/40 px-1 py-[1px] text-[8px] text-[#ff3c00]" title="Flight plan in progress">{f.status === "kicked_off" ? "launching" : "onboarding"}</span>;
                            })()}
                            {pkg.kind === "recurring" ? (
                              <span className="font-mono text-[10px] text-ink/45">
                                {(() => { const l = (client.services || []).find((s) => pkg.price_match.test(String(s.name || ""))); return l && Number(l.price) ? "$" + Number(l.price).toLocaleString("en-US") + "/mo" : "included"; })()}
                                {rail.subscription && rail.subscription.footprint ? " · " + rail.subscription.footprint : ""}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 overflow-x-auto">
                        <OrbRail orbs={rail.orbs} size="sm" />
                      </div>
                      <span className="flex h-8 w-8 items-center justify-center border border-hair text-ink/40 transition-all group-hover:border-[#ff3c00] group-hover:bg-[#ff3c00] group-hover:text-white">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-10 text-center text-[12.5px] text-ink/45">No clients on {pkg.label} yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
