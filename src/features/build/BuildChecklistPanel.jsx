// The client's real build checklist (Build Engine step 4): two tracks from the niche template. Each item shows
// auto (Claude) or manual, the gate (taste / Justin's tap), the runner's one-line note and preview link, a tick box
// and "Send to Claude". Ticks are records only; publishing happens through Ready to publish.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Hand, Send, ExternalLink, Loader2, Check, Palette, Rocket, Globe } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useList } from "@/lib/useData";
import { instantiate, progress, templateFor, tick, domainOf } from "@/lib/buildTemplates";
import { sendChecklistItem, QUEUED_COPY } from "./engine";

export function useBuildChecklist(clientId) {
  const q = useList("BuildChecklist", { filter: { client_id: clientId }, limit: 1, sort: "-updated_date" });
  return { ...q, checklist: (q.data || [])[0] || null };
}

export default function BuildChecklistPanel({ client }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { checklist, isLoading } = useBuildChecklist(client.id);
  const tplQ = useList("BuildChecklistTemplate", { filter: { niche_key: client.niche_key || "other" }, limit: 1, sort: "-version" });
  const jobsQ = useList("ClaudeJob", { filter: { client_id: client.id, kind: "checklist_item" }, limit: 100, sort: "-created_date" });
  const [busy, setBusy] = useState("");
  const [sent, setSent] = useState({});
  const refresh = () => { qc.invalidateQueries({ queryKey: ["BuildChecklist"] }); qc.invalidateQueries({ queryKey: ["ClaudeJob"] }); };

  const start = async () => {
    setBusy("start");
    try {
      const tpl = (tplQ.data || [])[0] || templateFor(client.niche_key);
      await base44.entities.BuildChecklist.create({ ...instantiate(tpl, client), website_app_id: client.site_app_id || "", command_app_id: client.command_app_id || "", updated_by: user?.email || "" });
    } finally { setBusy(""); refresh(); }
  };
  const toggle = async (tr, it) => {
    setBusy(`${tr.key}:${it.key}`);
    try {
      const next = tick(checklist, tr.key, it.key, it.done ? { done: false, done_at: "", done_by: "" } : { done: true, done_at: new Date().toISOString(), done_by: user?.email || "justin" });
      await base44.entities.BuildChecklist.update(checklist.id, { tracks: next.tracks, updated_by: user?.email || "" });
    } finally { setBusy(""); refresh(); }
  };
  const toClaude = async (tr, it) => {
    setBusy(`c:${tr.key}:${it.key}`);
    try { await sendChecklistItem({ client, checklist, track: tr, item: it }); setSent((s) => ({ ...s, [`${tr.key}:${it.key}`]: true })); } finally { setBusy(""); refresh(); }
  };
  // Connect <domain>: Justin's tap says he has pointed the domain; the runner checks the custom-domains status every
  // run and only a verified domain makes the site live (ticks this item, launch animation, automations, Launched).
  const connectTapped = async (tr, it) => {
    setBusy(`d:${tr.key}:${it.key}`);
    try {
      const next = tick(checklist, tr.key, it.key, { requested_at: new Date().toISOString(), requested_by: user?.email || "justin", note: "Justin connected it; waiting for the domain to verify" });
      await base44.entities.BuildChecklist.update(checklist.id, { tracks: next.tracks, updated_by: user?.email || "" });
    } finally { setBusy(""); refresh(); }
  };
  const openJob = (tr, it) => (jobsQ.data || []).find((j) => j.context?.item_key === it.key && j.context?.track_key === tr.key && !["approved", "done", "cancelled", "failed"].includes(j.status));

  if (isLoading) return <div className="h-40 animate-pulse bg-ink/[0.04]" />;
  if (!checklist) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-[12.5px] text-ink/60" data-testid="build-checklist-empty">
        <span>No build checklist yet. It is made from the {client.niche_key ? client.niche_key.replace(/_/g, " ") : "other"} template when Claude starts the build, or start it now.</span>
        <button type="button" onClick={start} disabled={!!busy} className="inline-flex h-8 items-center gap-1.5 border border-hair px-3 hover:border-[#ff3c00] disabled:opacity-50">{busy === "start" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Start checklist</button>
      </div>
    );
  }
  const p = progress(checklist);
  return (
    <div data-testid="build-checklist-real">
      {client.website_live_at ? <p className="flex items-center gap-2 border-b border-hair bg-green-50 px-4 py-2 text-[12.5px] text-green-800" data-testid="build-launched"><Check className="h-3.5 w-3.5" /><b className="font-medium">Launched</b> on {client.website_domain || domainOf(client)} · {new Date(client.website_live_at).toLocaleDateString()}</p> : null}
      <div className="grid md:grid-cols-2">
        {checklist.tracks.map((tr, i) => {
          const appId = tr.key === "command" ? checklist.command_app_id : checklist.website_app_id;
          const preview = tr.key === "command" ? checklist.command_preview_url : checklist.website_preview_url;
          return (
            <div key={tr.key} className={i ? "border-t border-hair md:border-l md:border-t-0" : ""}>
              <div className="flex items-center justify-between gap-2 px-4 pt-3 text-[12.5px] font-medium">
                <span>{tr.label}</span>
                <span className="flex items-center gap-2 font-mono text-[10px] text-ink/45">
                  {preview ? <a href={preview} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-[#ff3c00]">preview<ExternalLink className="h-2.5 w-2.5" /></a> : appId ? <span>app {appId.slice(0, 6)}…</span> : <span>no app yet</span>}
                  {p.tracks[tr.key]?.done}/{p.tracks[tr.key]?.total}
                </span>
              </div>
              <div className="mx-4 mt-1.5 h-1 bg-ink/[0.08]"><div className="h-full bg-[#ff3c00]" style={{ width: `${p.tracks[tr.key]?.pct || 0}%` }} /></div>
              <ol className="px-4 pb-3 pt-1.5">
                {tr.items.map((it) => {
                  const k = `${tr.key}:${it.key}`;
                  const job = openJob(tr, it);
                  return (
                    <li key={it.key} className="group flex items-start gap-2 py-1 text-[12.5px]">
                      <button type="button" onClick={() => toggle(tr, it)} disabled={busy === k} aria-label={it.done ? `Untick ${it.label}` : `Tick ${it.label}`} className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center border ${it.done ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-ink/30"}`}>{it.done ? <Check className="h-3 w-3" /> : null}</button>
                      <span className="min-w-0 flex-1">
                        <span className={it.done ? "text-ink/55" : "text-ink/85"}>{it.label}</span>
                        <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[10px] text-ink/40">
                          {it.auto ? <Bot className="h-3 w-3" aria-label="Claude does it" /> : <Hand className="h-3 w-3" aria-label="Manual" />}
                          {it.gate === "taste" ? <span className="inline-flex items-center gap-0.5 text-[#c24100]"><Palette className="h-3 w-3" />taste</span> : null}
                          {it.gate === "publish" ? <span className="inline-flex items-center gap-0.5 text-[#c24100]"><Rocket className="h-3 w-3" />your tap</span> : null}
                          {it.gate === "dns" ? <span className="inline-flex items-center gap-0.5 text-[#c24100]"><Globe className="h-3 w-3" />your tap · DNS · goes live</span> : null}
                        </span>
                        {it.note || it.preview_url ? <span className="block text-[11px] text-ink/50">{it.note}{it.preview_url ? <> · <a href={it.preview_url} target="_blank" rel="noreferrer" className="hover:text-[#ff3c00]">preview</a></> : null}</span> : null}
                        {it.gate === "dns" && !it.done ? (
                          it.requested_at
                            ? <span className="block text-[11px] text-[#c24100]">Connected by you {new Date(it.requested_at).toLocaleDateString()}. Claude checks the domain every run (hourly, 7 AM–9 PM PT); the site goes live when it verifies.</span>
                            : <button type="button" onClick={() => connectTapped(tr, it)} disabled={busy === `d:${k}`} className="mt-1 inline-flex h-7 items-center gap-1 border border-[#ff3c00]/40 px-2 text-[11.5px] text-[#c24100] hover:bg-[#ff3c00]/[0.06]">{busy === `d:${k}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}I&apos;ve connected {domainOf(client) || "the domain"}</button>
                        ) : null}
                        {job || sent[k] ? <span className="block text-[11px] text-[#c24100]">{job?.status === "running" ? "Claude is on it" : QUEUED_COPY}</span> : null}
                      </span>
                      {!it.done && !job && !sent[k] && it.gate !== "publish" && it.gate !== "dns" ? (
                        <button type="button" onClick={() => toClaude(tr, it)} disabled={busy === `c:${k}`} className="shrink-0 opacity-60 transition-opacity hover:text-[#ff3c00] hover:opacity-100 group-hover:opacity-100" title="Send to Claude" aria-label={`Send ${it.label} to Claude`}>
                          {busy === `c:${k}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
      <p className="border-t border-hair px-4 py-2 text-[11.5px] text-ink/45">{p.done}/{p.total} done · <Bot className="inline h-3 w-3" /> Claude does it · <Hand className="inline h-3 w-3" /> manual · taste calls and publish taps stay yours. The portal shows the client-friendly items as they light up.</p>
    </div>
  );
}
