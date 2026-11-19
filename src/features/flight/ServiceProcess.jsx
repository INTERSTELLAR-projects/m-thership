// Service Process (was "Onboarding"): one clear process per thing we sell, every step in order with its owner,
// whether it runs automatically or by hand, and where it happens in Møthership. Clients currently in a process show
// at their position (from OnboardingFlight.current_step, new-client prep, lead builds, engines and add-ons).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Bot, Hand } from "lucide-react";
import { useList } from "@/lib/useData";

const S = (title, owner, mode, where, to) => ({ title, owner, mode, where, to });
export const PROCESSES = [
  { key: "mission_alpha", label: "Mission ALPHA", sales: ["mission_alpha"], steps: [
    S("Lead added + scraped", "Claude", "auto", "Command › Add lead", "/"),
    S("Brief + new-client prep", "Claude", "auto", "Client › Build", "/crm"),
    S("Call + custom quote", "Justin", "manual", "Calls", "/calls"),
    S("Invoice + deal value", "Justin (money gate)", "manual", "Pipeline › lead card", "/pipeline"),
    S("Flight plan: contacts, brand, access, goals", "Claude + client", "auto", "Service Process › flight", "/flight-plan"),
    S("Website + Command System build", "Claude", "auto", "Claude", "/claude"),
    S("Taste review", "Justin (taste)", "manual", "Command › Needs you", "/"),
    S("Launch grid: listings, citations, GBP", "Claude", "auto", "Client › Build › Launch grid", "/crm"),
    S("Publish + DNS", "Justin (hard gate)", "manual", "Road to Dec 31", "/launch"),
    S("HyperCare+ engine starts", "Claude", "auto", "Packages › HyperCare+", "/packages/orbit-seo"),
  ] },
  { key: "website", label: "Website", sales: ["custom_website", "mission_bravo"], steps: [
    S("Lead + scrape", "Claude", "auto", "Command › Add lead", "/"),
    S("Brief from the Brain", "Claude", "auto", "Client › Brain", "/crm"),
    S("Design pass", "Justin (taste)", "manual", "Client › Build", "/crm"),
    S("Content, SEO structure, schema, speed", "Claude", "auto", "Claude", "/claude"),
    S("Forms, booking, tracking", "Claude", "auto", "Client › Systems", "/crm"),
    S("Publish + DNS", "Justin (hard gate)", "manual", "Road to Dec 31", "/launch"),
    S("Search Console + sitemap", "Claude", "auto", "Marketing › Search", "/performance"),
  ] },
  { key: "command_system", label: "Command System", sales: ["command_system", "ops_command", "mission_bravo"], steps: [
    S("Process call", "Justin + client", "manual", "Calls", "/calls"),
    S("Process map + data model", "Claude", "auto", "Client › Brain", "/crm"),
    S("Core screens + automations", "Claude", "auto", "Claude", "/claude"),
    S("Look and feel", "Justin (taste)", "manual", "Command › Needs you", "/"),
    S("Test with sample data", "Claude", "auto", "Client › Systems", "/crm"),
    S("Publish + crew invites", "Justin (hard gate)", "manual", "Road to Dec 31", "/launch"),
    S("Training + hand-off", "Claude + Justin", "manual", "Training", "/training"),
  ] },
  { key: "hypercare", label: "HyperCare+", sales: ["orbit_local", "orbit_national", "orbit_global", "orbit_multi"], steps: [
    S("Stripe subscription live", "Justin (money gate)", "manual", "Money › Financial › Stripe", "/financial?tab=stripe"),
    S("Engine start: four lights green", "Claude", "auto", "Packages › HyperCare+", "/packages/orbit-seo"),
    S("Monthly Topic Calendar", "Claude", "auto", "Claude", "/claude"),
    S("Blogs + GBP posts", "Claude", "auto", "Client › Build › Growth feed", "/crm"),
    S("Citations + map pack", "Claude", "auto", "Marketing › Backlinks", "/backlinks"),
    S("Monthly report to portal", "Claude", "auto", "Client › Work log", "/crm"),
  ] },
  { key: "gravitycare", label: "GravïtyCare", sales: ["starship_care"], steps: [
    S("Stripe subscription live", "Justin (money gate)", "manual", "Money › Financial › Stripe", "/financial?tab=stripe"),
    S("Site care: uptime, security, backups", "Claude", "auto", "Marketing › Site security", "/security"),
    S("Edits from requests", "Claude", "auto", "Clients › Requests", "/requests"),
    S("Monthly care note to portal", "Claude", "auto", "Client › Work log", "/crm"),
  ] },
  { key: "addons", label: "Add-ons", sales: ["brand_arsenal", "launch_grid", "transmission"], steps: [
    S("Bought in the Upgrade Store or quoted", "Client / Justin", "manual", "Sales › Upgrade Store", "/upgrades"),
    S("Activated + queued", "Claude", "auto", "Claude", "/claude"),
    S("Delivered + logged", "Claude", "auto", "Client › Files", "/crm"),
  ] },
];

const FLIGHT_STEP_INDEX = { client: 4, deal: 3, business: 4, brand: 4, access: 4, strategy: 4, kickoff: 5, launch: 8 };

export default function ServiceProcess() {
  const flights = useList("OnboardingFlight", { limit: 300, sort: "-updated_date" });
  const clients = useList("CRMClient", { limit: 500, sort: "business" });
  const jobs = useList("ClaudeJob", { filter: { kind: { $in: ["lead_build", "build_website", "build_app"] } }, limit: 200 });
  const engines = useList("EngineStart", { limit: 300 });
  const [open, setOpen] = useState("mission_alpha");
  const byId = useMemo(() => new Map((clients.data || []).map((c) => [c.id, c])), [clients.data]);

  // Clients at each step of each process.
  const positions = useMemo(() => {
    const out = Object.fromEntries(PROCESSES.map((p) => [p.key, new Map()]));
    const put = (proc, idx, c, why) => { if (!c) return; const m = out[proc]; if (!m.has(idx)) m.set(idx, []); if (!m.get(idx).some((x) => x.c.id === c.id)) m.get(idx).push({ c, why }); };
    (flights.data || []).filter((f) => f.status !== "done" && f.status !== "cancelled").forEach((f) => {
      const proc = PROCESSES.find((p) => p.sales.includes(f.sale_package)) || PROCESSES[0];
      const idx = Math.min(proc.steps.length - 1, FLIGHT_STEP_INDEX[f.current_step] ?? 4);
      put(proc.key, idx, byId.get(f.client_id), `Flight: ${f.current_step || "started"}`);
    });
    (jobs.data || []).filter((j) => !["approved", "done", "cancelled"].includes(j.status)).forEach((j) => put("mission_alpha", 5, byId.get(j.client_id), `Build ${String(j.status).replace(/_/g, " ")}`));
    (clients.data || []).filter((c) => c.status === "Lead").forEach((c) => put("mission_alpha", c.scrape_summary ? 1 : 0, c, c.scrape_summary ? "Scraped" : "Lead"));
    (engines.data || []).filter((e) => e.status === "running" || e.status === "queued").forEach((e) => put("hypercare", 3, byId.get(e.client_id), "Engine running"));
    (clients.data || []).filter((c) => c.status === "Active" && (c.services || []).some((s) => /gravity|gravïty/i.test(s.name || "") && s.stripe)).forEach((c) => put("gravitycare", 2, c, "On care"));
    return out;
  }, [flights.data, jobs.data, clients.data, engines.data, byId]);

  return (
    <section className="space-y-3" data-testid="service-process">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="What we sell">
        {PROCESSES.map((p) => {
          const n = [...positions[p.key].values()].reduce((t, l) => t + l.length, 0);
          return <button key={p.key} type="button" role="tab" aria-selected={open === p.key} onClick={() => setOpen(p.key)} className={`h-9 px-3 text-[12.5px] ${open === p.key ? "bg-ink text-white" : "border border-hair bg-paper hover:border-ink/40"}`}>{p.label}{n ? <span className="ml-1.5 font-mono text-[10.5px] opacity-70">{n}</span> : null}</button>;
        })}
      </div>
      {PROCESSES.filter((p) => p.key === open).map((p) => (
        <ol key={p.key} className="divide-y divide-hair border border-hair bg-paper/80">
          {p.steps.map((st, i) => {
            const here = positions[p.key].get(i) || [];
            return (
              <li key={st.title} className="grid gap-2 px-4 py-2.5 md:grid-cols-[28px_1fr_170px_90px_200px] md:items-center">
                <span className="font-mono text-[11px] text-ink/40">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium">{st.title}</p>
                  {here.length ? <p className="mt-1 flex flex-wrap gap-1">{here.map(({ c, why }) => <Link key={c.id} to={`/clients/${c.id}`} title={why} className="rounded-full bg-[#ff3c00]/[0.08] px-2 py-0.5 text-[11px] text-[#c24100] hover:bg-[#ff3c00]/[0.15]">{c.business}</Link>)}</p> : null}
                </div>
                <span className="text-[12px] text-ink/65">{st.owner}</span>
                <span className="inline-flex items-center gap-1 text-[11.5px] text-ink/60">{st.mode === "auto" ? <Bot className="h-3.5 w-3.5 text-[#ff3c00]" /> : <Hand className="h-3.5 w-3.5" />}{st.mode === "auto" ? "Auto" : "Manual"}</span>
                <Link to={st.to} className="inline-flex items-center gap-0.5 truncate text-[12px] text-ink/55 hover:text-[#ff3c00]">{st.where}<ArrowUpRight className="h-3 w-3 shrink-0" /></Link>
              </li>
            );
          })}
        </ol>
      ))}
    </section>
  );
}
