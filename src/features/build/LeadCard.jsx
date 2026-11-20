// Lead card: scrape the lead, see a clean summary (never invented: missing facts say "not found"), its Brain % and
// niche, then "Send to build", which queues a lead_build ClaudeJob with all the context. The job waits until the
// queue runner's next run (hourly, 7 AM–9 PM PT), and the card says so.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Hammer, Clock, ExternalLink } from "lucide-react";
import { useList } from "@/lib/useData";
import { NICHES, SOURCES, scrapeLead, sendToBuild, QUEUED_COPY } from "./engine";

const nf = <span className="text-ink/35">not found</span>;
const Row = ({ k, children }) => (
  <div className="grid grid-cols-[110px_1fr] gap-3 py-1.5 text-[12.5px]"><span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">{k}</span><span className="min-w-0 text-ink/80">{children}</span></div>
);

export default function LeadCard({ client }) {
  const qc = useQueryClient();
  const brainQ = useList("BusinessBrain", { filter: { client_id: client.id }, limit: 1, sort: "-updated_date" });
  const jobsQ = useList("ClaudeJob", { filter: { client_id: client.id, kind: "lead_build" }, limit: 5, sort: "-created_date" });
  const brain = (brainQ.data || [])[0];
  const job = (jobsQ.data || [])[0];
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const s = client.scrape_summary || null;
  const pct = brain?.completeness ?? s?.completeness ?? 0;

  const refresh = () => { qc.invalidateQueries({ queryKey: ["CRMClient"] }); qc.invalidateQueries({ queryKey: ["BusinessBrain"] }); qc.invalidateQueries({ queryKey: ["ClaudeJob"] }); };
  const scrape = async () => {
    setBusy("scrape"); setErr("");
    try { const r = await scrapeLead(client.id); if (r.error) setErr(r.error); } catch (e) { setErr(e?.response?.data?.error || e?.message || "Scrape failed"); }
    setBusy(""); refresh();
  };
  const build = async () => {
    setBusy("build"); setErr("");
    try { await sendToBuild(client, brain); } catch (e) { setErr(e?.message || "Could not queue the build"); }
    setBusy(""); refresh();
  };

  return (
    <section className="border border-hair bg-paper/80" data-testid="lead-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <p className="label-cross text-[10.5px]">(Lead card)</p>
          <h3 className="mt-0.5 text-[16px] font-semibold tracking-[-0.02em]">{s?.name || client.business}</h3>
          <p className="text-[12px] text-ink/55">{client.one_liner || s?.one_liner || "No one-liner yet"} · {SOURCES.find((x) => x.value === client.lead_source)?.label || client.lead_source || "Source not set"} · {NICHES[client.niche_key] || "Niche not detected"}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-28" title="Brain completeness">
            <div className="flex items-baseline justify-between text-[11px] text-ink/50"><span>Brain</span><span className="font-mono tabular-nums text-ink">{pct}%</span></div>
            <div className="mt-1 h-1.5 bg-ink/[0.08]"><div className="h-full bg-[#ff3c00]" style={{ width: `${pct}%` }} /></div>
          </div>
          <button type="button" onClick={scrape} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 border border-hair px-3 text-[12.5px] hover:border-[#ff3c00] disabled:opacity-50">
            {busy === "scrape" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{busy === "scrape" ? "Scraping…" : s ? "Scrape again" : "Scrape"}
          </button>
          {job ? null : (
            <button type="button" onClick={build} disabled={!!busy || !s} title={s ? "Queue the build for Claude" : "Scrape first"} className="inline-flex h-9 items-center gap-1.5 bg-[#ff3c00] px-3 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-50">
              {busy === "build" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hammer className="h-3.5 w-3.5" />}Send to build
            </button>
          )}
        </div>
      </header>
      {job ? (
        <p className="flex items-start gap-2 border-b border-hair bg-[#ff6a00]/[0.07] px-4 py-2.5 text-[12.5px] text-ink/75" data-testid="lead-build-queued">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c24100]" />
          <span><b className="font-medium text-ink">{job.status === "queued" ? "Queued for build." : "Build"}</b> {job.status === "queued" ? QUEUED_COPY : job.status === "running" ? "Claude is building it now." : `Status: ${String(job.status).replace(/_/g, " ")}.`} <Link to={`/claude?job=${job.id}`} className="text-[#ff3c00] hover:underline">See the job</Link></span>
        </p>
      ) : null}
      {err ? <p className="px-4 pt-2 text-[12px] text-red-700" role="alert">{err}</p> : null}
      {client.scrape_status === "running" && busy !== "scrape" ? <p className="px-4 pt-2 text-[12px] text-ink/55">A scrape is running…</p> : null}
      {s ? (
        <div className="grid gap-x-6 px-4 py-3 md:grid-cols-2">
          <div className="divide-y divide-hair/60">
            <Row k="Industry">{s.industry || nf}</Row>
            <Row k="Model">{s.business_model || nf}</Row>
            <Row k="Market">{s.market || nf}</Row>
            <Row k="Services">{s.services?.length ? s.services.join(" · ") : nf}</Row>
            <Row k="Google">{s.gbp?.rating != null ? `${s.gbp.rating}★ from ${s.gbp.reviews ?? "?"} reviews` : nf}{s.gbp?.address ? ` · ${s.gbp.address}` : ""}</Row>
          </div>
          <div className="divide-y divide-hair/60">
            <Row k="Brand">{s.colors?.length ? <span className="inline-flex items-center gap-1">{s.colors.map((c) => <i key={c} title={c} className="inline-block h-3.5 w-3.5 border border-hair" style={{ background: /^#|rgb/.test(c) ? c : undefined }} />)}<span className="ml-1">{s.colors.join(", ")}</span></span> : nf}{s.tone ? ` · ${s.tone}` : ""}</Row>
            <Row k="Socials">{s.socials?.length ? s.socials.map((x) => <a key={x.url} href={x.url} target="_blank" rel="noreferrer" className="mr-2 inline-flex items-center gap-0.5 hover:text-[#ff3c00]">{x.platform || "link"}<ExternalLink className="h-2.5 w-2.5" /></a>) : nf}</Row>
            <Row k="Competitors">{s.competitors?.length ? s.competitors.map((x) => x.name).join(", ") : nf}</Row>
            <Row k="Not found">{s.not_found?.length ? <span className="text-ink/55">{s.not_found.join(", ")}</span> : "Nothing missing"}</Row>
            <Row k="Sources">{s.sources?.length ? `${s.sources.length} page${s.sources.length === 1 ? "" : "s"} · saved to the Brain` : nf}</Row>
          </div>
        </div>
      ) : (
        <p className="px-4 py-4 text-[12.5px] text-ink/55">Not scraped yet. Scrape researches the website, Google profile, socials, market, brand cues, competitors and business model, then fills the Brain with sources. Anything it can't find stays blank and is marked not found.</p>
      )}
      {(client.lead_references || []).length ? (
        <p className="border-t border-hair px-4 py-2 text-[11.5px] text-ink/55">References: {(client.lead_references || []).map((r) => <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="mr-2 hover:text-[#ff3c00]">{r.name || r.url}</a>)}</p>
      ) : null}
    </section>
  );
}
