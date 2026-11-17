import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Globe, LayoutDashboard, Loader2 } from "lucide-react";
import { useList, timeAgo } from "@/lib/useData";
import { Empty, Panel, Tag } from "@/features/clients/ui";
import { appBrainFacts, clientAppIds, syncStatus, CLIENT_APP_SOURCE } from "@/features/clients/systems";

// Systems / digital footprint: one card per app or website this client runs (ClientAppProfile, from the
// agent inventory). Brain status is computed from BrainFacts actually received from the client's apps.

const KIND = { command: "Command app", website: "Website", onboarding: "Onboarding app", other: "App" };
const PUBLISH = {
  published: ["Published", "green"],
  published_with_unpublished_changes: ["Published · unpublished changes", "amber"],
  not_published: ["Not published", "red"],
  unknown: ["Publish state unknown", "muted"],
};
const SYNC = { yes: ["Sync ✓", "green"], partial: ["Sync partial", "amber"], no: ["No sync", "muted"] };
const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

function Routes({ routes }) {
  const [open, setOpen] = useState(false);
  const rows = list(routes);
  if (!rows.length) return null;
  return (
    <div className="border-t border-hair">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[12px] text-ink/60 hover:text-[#ff3c00]" aria-expanded={open}>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Routes <span className="mono-label text-[9.5px] text-ink/40">{rows.length}</span>
      </button>
      {open && (
        <ul className="divide-y divide-hair border-t border-hair">
          {rows.map((r, i) => (
            <li key={`${r.path || i}`} className="flex gap-3 px-4 py-1.5 text-[12px]">
              <code className="mono w-48 shrink-0 truncate text-ink/80">{r.path || "?"}</code>
              <span className="min-w-0 flex-1 text-ink/55">{r.description || ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileCard({ p, brainFacts }) {
  const Icon = p.kind === "website" ? Globe : LayoutDashboard;
  const [pubLabel, pubTone] = PUBLISH[p.publish_state] || PUBLISH.unknown;
  const [syncLabel, syncTone] = SYNC[p.has_sync] || SYNC.no;
  const received = brainFacts.filter((f) => f.source_app_id === p.app_id).length;
  const gaps = list(p.gaps);
  return (
    <section className="rounded-md border border-hair bg-card" data-testid="app-profile">
      <header className="flex flex-wrap items-start gap-3 border-b border-hair px-4 py-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#ff3c00]" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="mono-label text-[9.5px] text-ink/50">{KIND[p.kind] || "App"}{p.combined ? " · command + site" : ""}{p.framework ? ` · ${p.framework}` : ""}</p>
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.02em]">{p.app_name || p.app_id}</h3>
        </div>
        <div className="flex flex-wrap gap-1">
          <Tag tone={pubTone}>{pubLabel}</Tag>
          <Tag tone={received ? "green" : p.has_brain ? "amber" : "muted"}>{received ? `Brain ✓ ${received} facts` : p.has_brain ? "Brain built · no facts yet" : "No brain"}</Tag>
          <Tag tone={syncTone}>{syncLabel}</Tag>
        </div>
      </header>
      <div className="space-y-2.5 px-4 py-3 text-[13px]">
        {p.purpose && <p className="leading-relaxed text-ink/80">{p.purpose}</p>}
        <dl className="grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-[120px_1fr]">
          <dt className="text-ink/45">Domain</dt>
          <dd className="flex flex-wrap items-center gap-1.5">
            {p.domain ? <a href={`https://${p.domain}`} target="_blank" rel="noreferrer" className="hover:text-[#ff3c00]">{p.domain}</a> : <span className="text-ink/45">none</span>}
            {p.domain && <Tag tone={p.domain_attached ? "green" : "amber"}>{p.domain_attached ? "attached" : "not attached"}</Tag>}
          </dd>
          {p.published_url && (<><dt className="text-ink/45">Published URL</dt><dd><a href={p.published_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[#ff3c00]">{p.published_url.replace(/^https?:\/\//, "")}<ExternalLink className="h-3 w-3" /></a></dd></>)}
          {p.sync_notes && (<><dt className="text-ink/45">Sync</dt><dd className="text-ink/70">{p.sync_notes}</dd></>)}
          {p.latest_checkpoint && (<><dt className="text-ink/45">Last checkpoint</dt><dd className="text-ink/70">{p.latest_checkpoint}</dd></>)}
          <dt className="text-ink/45">App id</dt><dd><code className="mono text-[11px] text-ink/60">{p.app_id}</code></dd>
        </dl>
        {gaps.length > 0 && (
          <div>
            <p className="mono-label mb-1 text-[9.5px] text-ink/50">Gaps</p>
            <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-ink/70">{gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
          </div>
        )}
      </div>
      <Routes routes={p.routes} />
    </section>
  );
}

export default function SystemsTab({ client }) {
  const profilesQ = useList("ClientAppProfile", { filter: { client_id: client.id }, sort: "kind", limit: 50 });
  const factsQ = useList("BrainFact", { filter: { client_id: client.id, source: CLIENT_APP_SOURCE }, sort: "-created_date", limit: 500 });
  if (profilesQ.isLoading) return <div className="flex items-center gap-2 py-10 text-[13px] text-ink/50"><Loader2 className="h-4 w-4 animate-spin" />Loading systems…</div>;
  const profiles = profilesQ.data || [];
  const brainFacts = appBrainFacts(client, factsQ.data || []);
  const brainConnected = brainFacts.length > 0;
  const sync = syncStatus(profiles);
  const ids = clientAppIds(client);
  const latest = brainFacts[0] && brainFacts[0].created_date;
  const inventoried = profiles.map((p) => p.inventoried_at).filter(Boolean).sort().pop();
  return (
    <div className="space-y-4">
      <p className="label-cross mb-3">Systems · digital footprint</p>
      <Panel label="Connection" title={brainConnected ? "Brain connected" : "Brain not connected yet"}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-[12.5px]">
          <span className="text-ink/60">Connected:</span>
          <Tag tone={brainConnected ? "green" : "muted"}>brain {brainConnected ? "✓" : "✗"}</Tag>
          <Tag tone={sync === "yes" ? "green" : sync === "partial" ? "amber" : "muted"}>sync {sync === "yes" ? "✓" : sync === "partial" ? "partial" : "✗"}</Tag>
          <span className="text-ink/50">
            {brainConnected ? `${brainFacts.length} brain facts received from the client's app${latest ? `, latest ${timeAgo(latest)}` : ""}.` : "True once BrainFacts arrive from this client's own app. Nothing has been pushed yet."}
          </span>
          <span className="w-full text-[11.5px] text-ink/45">{ids.length ? `Registered app ids: ${ids.join(", ")}` : "No app registered on this client."}{inventoried ? ` · inventoried ${String(inventoried).slice(0, 10)}` : ""}</span>
        </div>
      </Panel>
      {profiles.length === 0
        ? <Panel><Empty>No app or website profile for this client yet.</Empty></Panel>
        : <div className="grid gap-4 xl:grid-cols-2">{profiles.map((p) => <ProfileCard key={p.id} p={p} brainFacts={brainFacts} />)}</div>}
    </div>
  );
}
