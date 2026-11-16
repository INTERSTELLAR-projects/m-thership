// One brand's dashboard (/brands/:slug), themed with that brand's colors. Interstellar (the root) shows its direct
// clients plus the roll-up of every brand. Every number comes from real records; nothing on record = an empty state.
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Brain, ExternalLink, Globe, LayoutTemplate, Orbit, Plus, Sparkles, Target, Users } from "lucide-react";
import "@/features/agents/agents.css";
import "./brands.css";
import { Spinner, relTime } from "@/features/agents/ui";
import { clientRows, money } from "@/components/financial/finance/metrics";
import { buildHouse, clientsOfBrand, clientBrainStats, featureStats, rollupClients, rootOf, themeVars, brandTheme, STATUS_LABEL } from "./graph";
import { useHouseData } from "./useHouseData";
import { templateAppUrl } from "./BrandsPage";
import AddBrandDialog from "./AddBrandDialog";

const pctText = (v) => (v == null ? "—" : `${v}%`);
const OPEN_STAGES = (c) => c.pipeline_stage !== "won" && c.pipeline_stage !== "lost";

function Panel({ title, icon: Icon, right, children, className = "" }) {
  return (
    <section className={`hb-panel ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.01em] text-white">{Icon ? <Icon className="h-4 w-4 hb-accent" /> : null}{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
const Empty = ({ children }) => <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-[12.5px] leading-snug text-[var(--ink-s)]">{children}</p>;
function Stat({ label, value, hint }) {
  return (
    <div className="hb-panel !py-3.5">
      <p className="mono text-[9.5px] uppercase tracking-[.14em] text-[var(--ink-s)]">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em] text-white">{value}</p>
      {hint ? <p className="mt-1.5 truncate text-[11px] text-[var(--ink-s)]">{hint}</p> : null}
    </div>
  );
}
function Meter({ label, value, sub }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[12px]"><span className="text-[var(--ink-d)]">{label}</span><span className="mono text-white">{pctText(value)}</span></div>
      <div className="hb-bar mt-1.5"><span style={{ width: `${value || 0}%` }} /></div>
      {sub ? <p className="mt-1 text-[11px] text-[var(--ink-s)]">{sub}</p> : null}
    </div>
  );
}
function Logo({ brand, size = 54 }) {
  const [bad, setBad] = useState(false);
  const src = brand.logo_url;
  return <span className="hb-logo shrink-0" style={{ width: size, height: size }}>{src && !bad ? <img src={src} alt="" onError={() => setBad(true)} /> : <span className="text-[22px] font-semibold text-white">{String(brand.name || "?")[0]}</span>}</span>;
}
function ClientLogo({ c }) {
  const [bad, setBad] = useState(false);
  if (c.logo_url && !bad) return <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/90 p-1"><img src={c.logo_url} alt="" className="h-full w-full object-contain" loading="lazy" onError={() => setBad(true)} /></span>;
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-[13px] font-semibold text-white">{String(c.business || "?")[0]}</span>;
}

function RankList({ title, rows, unit, empty }) {
  const max = rows.length ? rows[0].value : 0;
  return (
    <div className="min-w-0">
      <p className="mono mb-2 text-[9.5px] uppercase tracking-[.14em] text-[var(--ink-s)]">{title}</p>
      {rows.length ? (
        <ol className="space-y-2">
          {rows.slice(0, 6).map((r) => (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-2 text-[12px]"><span className="truncate text-[var(--ink-d)]">{r.name}</span><span className="mono shrink-0 text-white">{r.value}{unit ? ` ${unit}` : ""}</span></div>
              <div className="hb-bar mt-1"><span style={{ width: `${max ? Math.max(6, (100 * r.value) / max) : 0}%` }} /></div>
            </li>
          ))}
        </ol>
      ) : <p className="text-[12px] text-[var(--ink-s)]">{empty}</p>}
    </div>
  );
}

function FeaturePanel({ stats, features, isRoot }) {
  const [showAll, setShowAll] = useState(false);
  const tpl = features.filter((f) => f.in_template !== false);
  return (
    <Panel title="Feature intelligence" icon={Sparkles} right={<span className="mono text-[10px] text-[var(--ink-s)]">{stats.templateFeatures} template features · {stats.clientsReporting} {stats.clientsReporting === 1 ? "client" : "clients"} reporting</span>}>
      {!stats.hasData ? (
        <Empty>No client app has reported its features yet. Once client apps send feature reports (same sync key, see docs/client-brain-sync.md), this shows which features clients add, remove, request and use most{isRoot ? " across every brand" : ""}, so the template gets better.</Empty>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <RankList title="Most added" rows={stats.added} empty="Nothing added yet" />
          <RankList title="Most removed" rows={stats.removed} empty="Nothing removed yet" />
          <RankList title="Most requested" rows={stats.requested} empty="No requests yet" />
          <RankList title="Most used" rows={stats.used} unit="uses" empty="No usage reported yet" />
        </div>
      )}
      {tpl.length ? (
        <div className="mt-4 border-t border-white/10 pt-3">
          <button type="button" className="text-[12px] text-[var(--ink-m)] hover:text-white" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>{showAll ? "Hide" : "Show"} the {tpl.length} features in the template</button>
          {showAll ? (
            <ul className="mt-2.5 grid gap-x-4 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {tpl.map((f) => <li key={f.id || f.key} className="min-w-0 text-[12px]"><span className="text-white/90">{f.name}</span> <span className="mono text-[10px] text-[var(--ink-s)]">· {f.category}</span></li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

export default function BrandDashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useHouseData();
  const [adding, setAdding] = useState(false);
  const house = useMemo(() => (data ? buildHouse(data) : null), [data]);

  if (isLoading || !house) {
    return <div className="agx hb-dash grid place-items-center" style={themeVars(null)}>{error ? <p className="text-[13px] text-[#ff8a7f]">Couldn&apos;t load this brand: {String(error.message || error)}</p> : <div className="flex items-center gap-3 text-[13px] text-[var(--ink-m)]"><Spinner size={18} />Loading the brand…</div>}</div>;
  }
  const brands = data.brands || [];
  const brand = brands.find((b) => b.slug === slug) || null;
  if (!brand) {
    return (
      <div className="agx hb-dash grid place-items-center px-6 text-center" style={themeVars(null)}>
        <div><p className="text-[15px] text-white">No brand at /brands/{slug}.</p><Link to="/brands" className="hb-btn mt-4">Back to the House of Brands</Link></div>
      </div>
    );
  }
  const root = rootOf(brands);
  const isRoot = !!root && brand.id === root.id;
  const theme = brandTheme(brand);
  const node = isRoot ? house.rootNode : house.nodes[`brand:${brand.id}`];
  const mine = clientsOfBrand(data.clients, brands, brand);
  const active = mine.filter((c) => (c.status || "Active") === "Active");
  const leads = mine.filter((c) => c.status === "Lead");
  const openLeads = leads.filter(OPEN_STAGES);
  const pipelineValue = openLeads.reduce((t, c) => t + (Number(c.lead_value) || 0), 0);
  const mrr = clientRows(active).reduce((t, r) => t + (r.mrr || 0), 0);
  const dossierBy = Object.fromEntries((data.dossiers || []).map((x) => [x.client_id, x]));
  const roll = rollupClients(active, dossierBy);
  const stats = featureStats(data.features, data.clientFeatures, isRoot ? null : brand.id);
  const features = (data.features || []).filter((f) => isRoot || f.brand_id === brand.id);
  const tplUrl = templateAppUrl(brand.template_app_id);
  const kidBrands = house.brands.map((b) => house.nodes[`brand:${b.id}`]).filter(Boolean);

  return (
    <div className="agx hb-dash pb-24" style={themeVars(brand)} data-testid="brand-dashboard">
      <div className="mx-auto max-w-[1280px] px-4 pt-5 md:px-8">
        <Link to="/brands" className="mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[.14em] text-[var(--ink-s)] hover:text-white"><ArrowLeft className="h-3 w-3" />House of Brands</Link>

        {/* Header */}
        <header className="mt-4 flex flex-wrap items-end justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <Logo brand={brand} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="hb-pill">{isRoot ? "Mother brand" : STATUS_LABEL[brand.status] || brand.status}</span><span className="text-[12px] text-[var(--ink-m)]">{brand.niche}</span></div>
              <h1 className="mt-1.5 text-[30px] font-semibold leading-[0.95] tracking-[-0.045em] text-white md:text-[42px]">{brand.name}</h1>
              {brand.tagline ? <p className="mt-1.5 text-[13.5px] hb-accent">{brand.tagline}</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {tplUrl ? <a className="hb-btn" href={tplUrl} target="_blank" rel="noreferrer" data-testid="template-app-link"><LayoutTemplate className="h-3.5 w-3.5" />Template app<ExternalLink className="h-3 w-3 opacity-70" /></a> : null}
            {brand.website_url ? <a className="hb-btn" href={brand.website_url} target="_blank" rel="noreferrer"><Globe className="h-3.5 w-3.5" />Website<ExternalLink className="h-3 w-3 opacity-70" /></a> : null}
            <Link className="hb-btn" to="/brands"><Orbit className="h-3.5 w-3.5" />Constellation</Link>
            {isRoot ? <button type="button" className="hb-btn" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />Add brand</button> : null}
          </div>
        </header>

        {/* Real numbers only */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={isRoot ? "Direct clients" : "Clients"} value={active.length || "0"} hint={active.length ? `${roll.reporting} with an app brain reporting` : "No clients yet"} />
          <Stat label="Open leads" value={openLeads.length || "0"} hint={openLeads.length ? `${leads.length} ${leads.length === 1 ? "lead" : "leads"} on record` : "No leads yet"} />
          <Stat label="Pipeline value" value={pipelineValue > 0 ? money(pipelineValue) : "—"} hint={pipelineValue > 0 ? "Sum of open lead values" : "No lead values on record"} />
          <Stat label="Monthly recurring" value={mrr > 0 ? money(mrr) : "—"} hint={mrr > 0 ? "From active clients' service lines" : "No billing on record yet"} />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* Clients */}
          <Panel title={isRoot ? "Interstellar direct clients" : `${brand.name} clients`} icon={Users} right={<Link to="/crm" className="text-[12px] text-[var(--ink-m)] hover:text-white">All clients</Link>}>
            {active.length ? (
              <div className="-mx-2 max-h-[460px] overflow-y-auto">
                {active.slice().sort((a, b) => String(a.business).localeCompare(String(b.business))).map((c) => {
                  const br = clientBrainStats(dossierBy[c.id]);
                  return (
                    <Link key={c.id} to={`/clients/${c.id}`} className="hb-row">
                      <ClientLogo c={c} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] text-white">{c.business}</span><span className="block truncate text-[11px] text-[var(--ink-s)]">{c.industry || c.domain || ""}</span></span>
                      <span className="mono shrink-0 text-right text-[10.5px] text-[var(--ink-m)]">{br ? <>brain <span className="text-white">{pctText(br.score)}</span></> : "no brain yet"}</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Empty>No clients yet. To add one, open a client and set its Brand to {brand.name} in Edit client{isRoot ? " (empty = Interstellar direct)" : ""}.</Empty>
            )}
            {leads.length ? <p className="mt-3 text-[11.5px] text-[var(--ink-s)]">{leads.length} {leads.length === 1 ? "lead" : "leads"} tagged to this brand · <Link to="/pipeline" className="hover:text-white">Pipeline</Link></p> : null}
          </Panel>

          {/* Brain */}
          <Panel title={isRoot ? "Møthership brain roll-up" : "Brand brain"} icon={Brain} right={isRoot ? <Link to="/brain" className="text-[12px] text-[var(--ink-m)] hover:text-white">Open Brain</Link> : null}>
            {isRoot ? (
              <div className="space-y-4">
                <Meter label="Interstellar's own brain" value={node.brain.completeness} sub={`${node.brain.factsActive} active facts${node.brain.completeness == null ? " · completeness not scored yet" : ""}`} />
                <Meter label="Brand brains" value={node.brandsBrain.score} sub={node.brandsBrain.reporting ? `${node.brandsBrain.reporting} of ${kidBrands.length} brands reporting · ${node.brandsBrain.answered}/${node.brandsBrain.total} answered` : `No brand app is reporting yet (${kidBrands.length} ${kidBrands.length === 1 ? "brand" : "brands"})`} />
                <Meter label="Client brains, every brand" value={node.rollup.score} sub={node.rollup.reporting ? `${node.rollup.reporting} of ${node.rollup.clients} active clients reporting · ${node.rollup.answered}/${node.rollup.total} answered` : "No client app is reporting yet"} />
                <Meter label="Interstellar direct client brains" value={roll.score} sub={roll.reporting ? `${roll.reporting} of ${roll.clients} direct clients reporting` : "None reporting yet"} />
              </div>
            ) : (
              <div className="space-y-4">
                <Meter label={`${brand.name}'s own brain`} value={node.own.score} sub={node.own.reporting ? `${node.own.answered}/${node.own.total} answered · ${node.own.factsActive} active facts${node.own.syncedAt ? ` · synced ${relTime(node.own.syncedAt)}` : ""}` : "Not reporting yet. It fills in when the template app pushes its brain (COMMAND_SYSTEM_SYNC_KEY)."} />
                <Meter label="Its clients' brains" value={roll.score} sub={roll.reporting ? `${roll.reporting} of ${roll.clients} clients reporting · avg ${pctText(roll.avgScore)}` : roll.clients ? "No client app reporting yet" : "No clients yet"} />
                <div>
                  <p className="mono mb-2 text-[9.5px] uppercase tracking-[.14em] text-[var(--ink-s)]">Latest brand facts</p>
                  {node.own.latest.length ? (
                    <ul className="space-y-2">
                      {node.own.latest.map((f) => <li key={f.id} className="text-[12.5px] leading-snug"><span className="text-[var(--ink-s)]">{f.question ? `${f.question} → ` : ""}</span><span className="text-white/90">{f.statement}</span></li>)}
                    </ul>
                  ) : <Empty>No brand facts yet. Coach business facts from the template app land here; athlete records never do.</Empty>}
                </div>
              </div>
            )}
          </Panel>
        </div>

        {isRoot ? (
          <Panel title="Brands in the house" icon={Orbit} className="mt-5" right={<button type="button" className="text-[12px] text-[var(--ink-m)] hover:text-white" onClick={() => setAdding(true)}>Add brand</button>}>
            {kidBrands.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {kidBrands.map((n) => (
                  <Link key={n.id} to={`/brands/${n.slug}`} className="hb-row !items-start border border-white/10" style={themeVars(n.brand)}>
                    <Logo brand={n.brand} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-white">{n.label} <span className="mono ml-1 text-[9.5px] uppercase tracking-[.1em]" style={{ color: n.color }}>{STATUS_LABEL[n.status]}</span></span>
                      <span className="block truncate text-[11.5px] text-[var(--ink-m)]">{n.sub}</span>
                      <span className="mono mt-0.5 block text-[10px] text-[var(--ink-s)]">{n.metrics.clients ? `${n.metrics.clients} clients` : "No clients yet"} · brain {n.own.reporting ? pctText(n.own.score) : "not reporting"}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : <Empty>No niche brands yet.</Empty>}
          </Panel>
        ) : null}

        <div className="mt-5">
          <FeaturePanel stats={stats} features={features} isRoot={isRoot} />
        </div>

        <Panel title={isRoot ? "Offer" : "Launch & offer"} icon={Target} className="mt-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div>
              {brand.offer_summary ? <p className="text-[13.5px] leading-relaxed text-[var(--ink-d)]">{brand.offer_summary}</p> : <Empty>No offer summary yet.</Empty>}
              {brand.notes ? <p className="mt-3 text-[12px] leading-relaxed text-[var(--ink-s)]">{brand.notes}</p> : null}
            </div>
            <dl className="space-y-2.5 text-[12.5px]">
              <div><dt className="mono text-[9.5px] uppercase tracking-[.14em] text-[var(--ink-s)]">Status</dt><dd className="mt-0.5 text-white">{isRoot ? "Mother brand" : STATUS_LABEL[brand.status] || brand.status}</dd></div>
              <div><dt className="mono text-[9.5px] uppercase tracking-[.14em] text-[var(--ink-s)]">Niche</dt><dd className="mt-0.5 text-white">{brand.niche || "—"}</dd></div>
              <div><dt className="mono text-[9.5px] uppercase tracking-[.14em] text-[var(--ink-s)]">Template app</dt><dd className="mt-0.5 text-white">{tplUrl ? <a href={tplUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">Open <ExternalLink className="h-3 w-3" /></a> : "None"}</dd></div>
              <div><dt className="mono text-[9.5px] uppercase tracking-[.14em] text-[var(--ink-s)]">Colors</dt><dd className="mt-1 flex gap-1.5">{[theme.primary, theme.accent, theme.background].map((c) => <span key={c} title={c} className="h-5 w-5 rounded-md border border-white/20" style={{ background: c }} />)}</dd></div>
            </dl>
          </div>
        </Panel>
      </div>
      <AddBrandDialog open={adding} brands={brands} onClose={() => setAdding(false)} onCreated={(b) => b?.slug && navigate(`/brands/${b.slug}`)} />
    </div>
  );
}
