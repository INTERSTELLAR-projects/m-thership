// House of Brands numbers: per brand, its clients/users, live MRR (Stripe) + committed, active builds, open leads,
// health (average client health score) and app links. Real records only; blank when nothing is known.
import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { useList } from "@/lib/useData";
import { mrrOf } from "@/features/clients/clientSignals";
import { rootOf, childBrands, brandTheme } from "./graph";
import { setBrandFilter, useBrandFilter } from "./brandFilter";

const money = (n) => `$${Math.round(n || 0).toLocaleString()}`;
const BUILD_KINDS = ["lead_build", "build_website", "build_app"];

export function brandRows({ brands = [], clients = [], jobs = [], dossiers = [], profiles = [] }) {
  const root = rootOf(brands);
  const list = [...(root ? [root] : []), ...childBrands(brands, root)];
  const health = new Map(dossiers.map((d) => [d.client_id, Number(d.health_score)]));
  return list.map((b) => {
    const isRoot = root && b.id === root.id;
    const mine = clients.filter((c) => (isRoot ? !c.brand_id || c.brand_id === root.id : c.brand_id === b.id));
    const ids = new Set(mine.map((c) => c.id));
    const active = mine.filter((c) => c.status === "Active");
    const m = active.reduce((t, c) => { const x = mrrOf(c); return { stripe: t.stripe + x.stripe, committed: t.committed + x.committed }; }, { stripe: 0, committed: 0 });
    const hs = active.map((c) => health.get(c.id)).filter((n) => Number.isFinite(n));
    const builds = jobs.filter((j) => ids.has(j.client_id) && BUILD_KINDS.includes(j.kind) && !["approved", "done", "cancelled", "failed"].includes(j.status)).length;
    const apps = profiles.filter((p) => ids.has(p.client_id) && p.app_id).length + (b.brand_app_ids || []).length;
    return {
      brand: b, isRoot, clients: active.length, leads: mine.filter((c) => c.status === "Lead").length, stripe: m.stripe, committed: m.committed,
      builds, health: hs.length ? Math.round(hs.reduce((t, n) => t + n, 0) / hs.length) : null, apps, website: b.website_url || "",
    };
  });
}

export default function BrandNumbers() {
  const brands = useList("Brand", { sort: "sort_order", limit: 200 });
  const clients = useList("CRMClient", { sort: "business", limit: 1000 });
  const jobs = useList("ClaudeJob", { limit: 600, sort: "-created_date" });
  const dossiers = useList("ClientDossier", { limit: 300, sort: "-updated_date" });
  const profiles = useList("ClientAppProfile", { limit: 300 });
  const [filter] = useBrandFilter();
  const rows = useMemo(() => brandRows({ brands: brands.data || [], clients: clients.data || [], jobs: jobs.data || [], dossiers: dossiers.data || [], profiles: profiles.data || [] }), [brands.data, clients.data, jobs.data, dossiers.data, profiles.data]);

  return (
    <div className="overflow-x-auto px-4 py-4 md:px-6" data-testid="brand-numbers">
      <table className="w-full min-w-[760px] text-left text-[12.5px] text-[var(--ink-d,#ddd)]">
        <thead className="mono text-[9.5px] uppercase tracking-[.12em] text-[var(--ink-s,#999)]">
          <tr><th className="py-2 pr-3">Brand</th><th className="pr-3">Clients</th><th className="pr-3">MRR (Stripe)</th><th className="pr-3">Committed</th><th className="pr-3">Builds</th><th className="pr-3">Open leads</th><th className="pr-3">Health</th><th className="pr-3">Apps</th><th>Filter</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = brandTheme(r.brand).primary;
            const on = filter === r.brand.id;
            return (
              <tr key={r.brand.id} className="border-t border-white/10">
                <td className="py-2.5 pr-3"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} /><a href={`/brands/${r.brand.slug}`} className="font-medium text-white hover:text-[#ff6a00]">{r.brand.name}</a>{r.isRoot ? <span className="text-[10.5px] text-white/40">direct</span> : null}</span></td>
                <td className="pr-3">{r.clients}</td>
                <td className="pr-3">{money(r.stripe)}</td>
                <td className="pr-3 text-white/60">{r.committed ? money(r.committed) : "—"}</td>
                <td className="pr-3">{r.builds}</td>
                <td className="pr-3">{r.leads}</td>
                <td className="pr-3">{r.health == null ? <span className="text-white/40">not enough info</span> : `${r.health}/100`}</td>
                <td className="pr-3">{r.website ? <a href={r.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[#ff6a00]">{r.apps} <ExternalLink className="h-3 w-3" /></a> : r.apps}</td>
                <td><button type="button" onClick={() => setBrandFilter(on ? "all" : r.brand.id)} className={`rounded-full border px-2.5 py-0.5 text-[11px] ${on ? "border-[#ff6a00] text-[#ff6a00]" : "border-white/20 text-white/70 hover:border-white/50"}`}>{on ? "Filtering" : "Filter"}</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-white/45">MRR counts live Stripe subscriptions only. Committed is monthly work agreed but not in Stripe yet. Health is the average client health score; blank when no client has one.</p>
    </div>
  );
}
