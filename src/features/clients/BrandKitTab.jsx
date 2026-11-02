import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Check, Copy, Eye, EyeOff, Loader2, MessageSquareWarning, Palette, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { useClientRecords } from "@/features/clients/hooks";
import { timeAgo } from "@/lib/useData";
import { cn } from "@/lib/utils";
import { useJobs, useRefreshJobs, approveJob, requestChanges, chatPrompt, JOB_STATUS } from "@/features/claude/jobs";
import { KIT_SECTIONS, brandKitBrief, gatherBrandInputs, isBrandKitJob, kitFromJob, queueBrandKit } from "@/features/claude/brandKit";

const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const text = (v) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

function Section({ title, children }) {
  return (
    <section className="border-t border-hair pt-4">
      <p className="label-cross mb-3">({title})</p>
      {children}
    </section>
  );
}

function Pairs({ obj, skip = [] }) {
  if (!obj || typeof obj !== "object") return null;
  const rows = Object.entries(obj).filter(([k, v]) => !skip.includes(k) && (text(v) || (Array.isArray(v) && v.length && v.every((x) => typeof x === "string"))));
  if (!rows.length) return null;
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[160px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="mono-label pt-0.5 text-[9.5px] text-ink/45">{k.replace(/_/g, " ")}</dt>
          <dd className="text-[13px] leading-relaxed text-ink/80">{Array.isArray(v) ? v.join(" · ") : text(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Bullets({ items, tone = "" }) {
  const list = asList(items).map((x) => (typeof x === "string" ? x : x?.text || x?.label || "")).filter(Boolean);
  if (!list.length) return null;
  return (
    <ul className="space-y-1.5">
      {list.map((x, i) => (
        <li key={i} className={cn("flex gap-2 text-[13px] leading-relaxed text-ink/80", tone)}>
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
          {x}
        </li>
      ))}
    </ul>
  );
}

function Swatches({ palette }) {
  const colors = asList(palette).filter((c) => c && /^#?[0-9a-f]{3,8}$/i.test(String(c.hex || "").trim()));
  if (!colors.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {colors.map((c, i) => {
        const hex = String(c.hex).startsWith("#") ? c.hex : `#${c.hex}`;
        return (
          <div key={i} className="overflow-hidden rounded-md border border-hair">
            <div className="flex h-20 items-end p-2" style={{ background: hex, color: c.on_color_text || "#fff" }}>
              <span className="text-[12px] font-semibold">Aa</span>
            </div>
            <div className="space-y-0.5 p-2.5">
              <p className="text-[12.5px] font-semibold">{c.name || hex}</p>
              <p className="font-mono text-[11px] text-ink/60">{hex.toUpperCase()}{c.rgb ? ` · ${c.rgb}` : ""}</p>
              {c.role && <p className="mono-label text-[8.5px] text-[#ff3c00]">{c.role}</p>}
              {c.usage && <p className="text-[11.5px] leading-snug text-ink/60">{c.usage}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TypeSpec({ typography }) {
  if (!typography || typeof typography !== "object") return null;
  const faces = ["headings", "body", "accent"].map((k) => [k, typography[k]]).filter(([, v]) => v && (v.family || text(v)));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {faces.map(([k, v]) => (
          <div key={k} className="rounded-md border border-hair p-3">
            <p className="mono-label text-[8.5px] text-ink/45">{k}</p>
            <p className="mt-1 text-[18px] font-semibold tracking-[-0.02em]">{v.family || text(v)}</p>
            <p className="mt-1 text-[11.5px] text-ink/55">{[v.weights, v.source, v.fallback && `fallback ${v.fallback}`, v.use].filter(Boolean).join(" · ")}</p>
          </div>
        ))}
      </div>
      {asList(typography.scale).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="mono-label text-[8.5px] text-ink/45">
              <tr><th className="py-1.5 pr-3">Level</th><th className="pr-3">Size</th><th className="pr-3">Weight</th><th className="pr-3">Line height</th><th>Tracking</th></tr>
            </thead>
            <tbody>
              {typography.scale.map((s, i) => (
                <tr key={i} className="border-t border-hair">
                  <td className="py-1.5 pr-3 font-medium">{s.level}</td><td className="pr-3">{s.size}</td><td className="pr-3">{s.weight}</td><td className="pr-3">{s.line_height}</td><td>{s.tracking}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {typography.notes && <p className="text-[12.5px] text-ink/65">{typography.notes}</p>}
    </div>
  );
}

// Renders a structured kit; falls back to the markdown body when Claude only sent markdown.
export function KitView({ kit, body }) {
  const k = kit && typeof kit === "object" ? kit : {};
  const has = Object.keys(k).length > 0;
  if (!has) {
    return body ? (
      <div className="prose prose-sm max-w-none text-ink/80 [&_table]:text-[12px]"><ReactMarkdown>{body}</ReactMarkdown></div>
    ) : (
      <p className="text-[13px] text-ink/50">Nothing came back yet.</p>
    );
  }
  const voice = k.voice || {};
  const tag = k.taglines || {};
  const logo = k.logo || {};
  return (
    <div className="space-y-5">
      {k.overview && <Section title={KIT_SECTIONS[0][1]}><Pairs obj={k.overview} /></Section>}
      {k.logo && (
        <Section title="Logo usage">
          <div className="flex flex-wrap items-start gap-5">
            {logo.primary_url && (
              <div className="grid h-28 w-44 place-items-center rounded-md border border-hair bg-white p-3">
                <img src={logo.primary_url} alt="Primary logo" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-3">
              <Pairs obj={logo} skip={["primary_url", "variations", "misuse"]} />
              {asList(logo.variations).length > 0 && (
                <ul className="space-y-1">
                  {logo.variations.map((v, i) => (
                    <li key={i} className="text-[12.5px] text-ink/75"><span className="font-medium text-ink">{v.name}</span>{v.use ? ` — ${v.use}` : ""}{v.url ? <a href={v.url} target="_blank" rel="noreferrer" className="ml-1 text-[#ff3c00]">file</a> : null}</li>
                  ))}
                </ul>
              )}
              {asList(logo.misuse).length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-red-600">misuse</p><Bullets items={logo.misuse} /></div>}
            </div>
          </div>
        </Section>
      )}
      {k.palette && <Section title="Color palette"><Swatches palette={k.palette} /></Section>}
      {k.typography && <Section title="Typography"><TypeSpec typography={k.typography} /></Section>}
      {k.voice && (
        <Section title="Voice & tone">
          <div className="space-y-3">
            <Pairs obj={voice} skip={["we_say", "we_never_say", "sample", "by_channel"]} />
            <div className="grid gap-4 sm:grid-cols-2">
              {asList(voice.we_say).length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-green-700">we say</p><Bullets items={voice.we_say} /></div>}
              {asList(voice.we_never_say).length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-red-600">we never say</p><Bullets items={voice.we_never_say} /></div>}
            </div>
            {voice.sample && <blockquote className="border-l-2 border-[#ff3c00] pl-3 text-[13px] italic text-ink/75">{voice.sample}</blockquote>}
            {asList(voice.by_channel).map((c, i) => <p key={i} className="text-[12.5px] text-ink/70"><span className="font-medium text-ink">{c.channel}:</span> {c.guidance}</p>)}
          </div>
        </Section>
      )}
      {k.taglines && (
        <Section title="Taglines & messaging">
          {tag.primary && <p className="text-[22px] font-semibold tracking-[-0.03em]">&ldquo;{tag.primary}&rdquo;</p>}
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {asList(tag.alternates).length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-ink/45">alternates</p><Bullets items={tag.alternates} /></div>}
            {asList(tag.value_props).length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-ink/45">value props</p><Bullets items={tag.value_props} /></div>}
            {asList(tag.key_messages).length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-ink/45">key messages</p><Bullets items={tag.key_messages} /></div>}
          </div>
          {tag.elevator_pitch && <p className="mt-3 text-[13px] text-ink/75">{tag.elevator_pitch}</p>}
        </Section>
      )}
      {k.imagery && (
        <Section title="Imagery & iconography">
          <Pairs obj={k.imagery} skip={["subjects", "avoid"]} />
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {asList(k.imagery.subjects).length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-ink/45">show</p><Bullets items={k.imagery.subjects} /></div>}
            {asList(k.imagery.avoid).length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-ink/45">avoid</p><Bullets items={k.imagery.avoid} /></div>}
          </div>
        </Section>
      )}
      {asList(k.applications).length > 0 && (
        <Section title="Applications">
          <div className="space-y-1.5">{k.applications.map((a, i) => <p key={i} className="text-[12.5px] text-ink/75"><span className="font-medium text-ink">{a.touchpoint}:</span> {a.guidance}</p>)}</div>
        </Section>
      )}
      {(asList(k.dos).length > 0 || asList(k.donts).length > 0) && (
        <Section title="Do / Don't">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-green-200 bg-green-50/50 p-3"><p className="mono-label mb-2 text-[8.5px] text-green-700">do</p><Bullets items={k.dos} /></div>
            <div className="rounded-md border border-red-200 bg-red-50/50 p-3"><p className="mono-label mb-2 text-[8.5px] text-red-600">don&apos;t</p><Bullets items={k.donts} /></div>
          </div>
        </Section>
      )}
    </div>
  );
}

function GenerateDialog({ client, open, onClose, onQueued, revising }) {
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const inputs = useQuery({ queryKey: ["BrandKitInputs", client.id], queryFn: () => gatherBrandInputs(client), enabled: open });
  const brief = inputs.data ? brandKitBrief(client, { ...inputs.data, extra: extra.trim() }) : "";

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await queueBrandKit(client, extra.trim());
      setExtra("");
      onQueued();
      onClose();
    } catch (e) {
      setError(e?.message || "Could not queue it");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(chatPrompt({ id: "(not queued yet)", instructions: brief }));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const d = inputs.data;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send to Claude → Generate brand kit</DialogTitle>
          <DialogDescription>Claude builds the kit from this client&apos;s profile and form answers, then sends it back here for your OK. Nothing is saved to the profile or shown to the client until you approve.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {inputs.isLoading ? (
            <p className="flex items-center gap-2 text-[12.5px] text-ink/55"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gathering the profile, intake and form answers…</p>
          ) : d ? (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {[
                ["Intake", d.intake ? "on file" : "none"],
                ["Form submissions", String(d.requests.filter((r) => (r.answers || []).length || r.details).length)],
                ["Dossier", d.dossier ? "on file" : "none"],
                ["Brand files", String(d.files.filter((f) => f.category === "brand_kit").length)],
                ["Current kit", d.current ? `v${d.current.version || 1}` : "none"],
              ].map(([k, v]) => (
                <span key={k} className="rounded-sm border border-hair px-1.5 py-0.5 text-ink/65"><span className="text-ink/40">{k}:</span> {v}</span>
              ))}
            </div>
          ) : null}
          <label className="block">
            <span className="mono-label text-[9.5px] text-ink/50">{revising ? "What should change from the current kit?" : "Direction for Claude (optional)"}</span>
            <textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={3}
              placeholder="e.g. Keep the existing logo. Earthy, premium, calm. Avoid red."
              className="mt-1.5 w-full rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]"
            />
          </label>
          {brief && (
            <details>
              <summary className="mono-label cursor-pointer text-[9.5px] text-ink/50 hover:text-[#ff3c00]">Show full brief</summary>
              <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-sm bg-ink/[0.04] p-3 text-[11px] text-ink/70">{brief}</pre>
            </details>
          )}
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button type="button" onClick={copy} disabled={!brief} className="inline-flex items-center gap-1.5 text-[12px] text-ink/60 hover:text-ink disabled:opacity-40">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy prompt for a live chat"}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={busy || inputs.isLoading}
              className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Authorize Claude
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewCard({ job, onDone }) {
  const [notes, setNotes] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const kit = kitFromJob(job);

  const act = async (key, fn) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e?.message || "That didn't go through");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="rounded-md border-2 border-[#ff3c00]/60 bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <span className={cn("mono-label rounded-sm px-1.5 py-0.5 text-[8.5px]", JOB_STATUS.needs_approval.tone)}>Needs your OK</span>
          <h3 className="mt-2 text-[15px] font-semibold tracking-[-0.02em]">{job.title}</h3>
          {job.result_summary && <p className="mt-1 max-w-2xl text-[12.5px] text-ink/60">{job.result_summary}</p>}
        </div>
        <Link to={`/claude?job=${job.id}`} className="mono-label text-[9px] text-ink/45 hover:text-[#ff3c00]">open in queue</Link>
      </header>
      <div className="max-h-[70vh] overflow-y-auto p-4">
        <KitView kit={kit} body={job.result_body} />
        {job.needs_from_justin && (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="mono-label mb-1 text-[8.5px] text-amber-800">needs from you</p>
            <p className="whitespace-pre-wrap text-[12.5px] text-amber-900">{job.needs_from_justin}</p>
          </div>
        )}
      </div>
      <footer className="space-y-2 border-t border-hair px-4 py-3">
        {asking && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            autoFocus
            placeholder="What should Claude change? (colors, fonts, tone, taglines…)"
            className="w-full rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]"
          />
        )}
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {asking ? (
            <>
              <button type="button" onClick={() => setAsking(false)} className="px-2 text-[12px] text-ink/55 hover:text-ink">Cancel</button>
              <button
                type="button"
                disabled={!notes.trim() || !!busy}
                onClick={() => act("changes", () => requestChanges(job, notes.trim()))}
                className="inline-flex items-center gap-1.5 rounded-sm border border-amber-400 bg-amber-50 px-3.5 py-2 text-[12.5px] font-medium text-amber-900 disabled:opacity-50"
              >
                {busy === "changes" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareWarning className="h-3.5 w-3.5" />}
                Send back to Claude
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setAsking(true)} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3.5 py-2 text-[12.5px] text-ink/75 hover:border-ink/40">
                <MessageSquareWarning className="h-3.5 w-3.5" /> Request changes
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => act("approve", () => approveJob(job))}
                className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[12.5px] font-medium text-white disabled:opacity-60"
              >
                {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Approve &amp; save to profile
              </button>
            </>
          )}
        </div>
      </footer>
    </section>
  );
}

export default function BrandKitTab({ client }) {
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => base44.auth.me(), staleTime: 300_000 });
  const { data: jobs = [] } = useJobs(400);
  const refreshJobs = useRefreshJobs();
  const kits = useClientRecords("BrandKit", client.id, { sort: "-version" });
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  if (me.isLoading) return <p className="text-[13px] text-ink/50">Loading…</p>;
  if (me.data?.role !== "admin") return <p className="text-[13px] text-ink/50">Brand kits are managed by your Interstellar team.</p>;

  const brandJobs = jobs.filter((j) => j.client_id === client.id && isBrandKitJob(j));
  const review = brandJobs.filter((j) => j.status === "needs_approval");
  const working = brandJobs.filter((j) => ["queued", "running", "changes_requested", "failed"].includes(j.status));
  const current = kits.rows.find((k) => k.status === "approved");
  const history = kits.rows.filter((k) => k !== current);
  const refresh = () => { refreshJobs(); kits.refresh(); };

  const togglePortal = async () => {
    if (!current) return;
    setToggling(true);
    try { await kits.update(current.id, { portal_visible: !current.portal_visible }); } finally { setToggling(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-cross mb-2">(Brand kit)</p>
          <p className="max-w-2xl text-[13px] text-ink/60">
            Logo usage, palette, typography, voice, taglines and imagery for {client.business}. Claude drafts it from the profile and their form answers; you approve it before it&apos;s saved here or shown to the client.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={working.some((j) => j.status !== "failed")}
          title={working.length ? "A brand kit job is already in the queue" : ""}
          className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Send to Claude → {current ? "Revise brand kit" : "Generate brand kit"}
        </button>
      </div>

      {working.length > 0 && (
        <div className="rounded-md border border-hair bg-card">
          {working.map((j) => {
            const s = JOB_STATUS[j.status] || JOB_STATUS.queued;
            return (
              <Link key={j.id} to={`/claude?job=${j.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink/[0.03]">
                <span className={cn("mono-label shrink-0 rounded-sm px-1.5 py-0.5 text-[8.5px]", s.tone)}>{s.label}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{j.title}</span>
                <span className="font-mono text-[10.5px] text-ink/40">{timeAgo(j.requested_at || j.created_date)}</span>
              </Link>
            );
          })}
        </div>
      )}

      {review.map((j) => <ReviewCard key={j.id} job={j} onDone={refresh} />)}

      {current ? (
        <section className="rounded-md border border-hair bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Palette className="h-4 w-4 text-[#ff3c00]" strokeWidth={1.75} />
              <div>
                <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Approved brand kit · v{current.version || 1}</h3>
                <p className="text-[11.5px] text-ink/50">Approved {timeAgo(current.approved_at || current.created_date)}{current.approved_by ? ` by ${current.approved_by}` : ""}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={togglePortal}
              disabled={toggling}
              className={cn("inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[12px]", current.portal_visible ? "border-green-300 bg-green-50 text-green-800" : "border-hair text-ink/60")}
              title="Whether the client can see this kit in their portal"
            >
              {current.portal_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {current.portal_visible ? "Visible in portal" : "Hidden from portal"}
            </button>
          </header>
          <div className="p-4">
            {current.summary && <p className="mb-4 text-[13px] text-ink/70">{current.summary}</p>}
            <KitView kit={current.kit} body={current.body_md} />
          </div>
        </section>
      ) : review.length === 0 && working.length === 0 ? (
        <div className="rounded-md border border-dashed border-hair px-6 py-12 text-center">
          <Palette className="mx-auto h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <p className="mt-3 text-[13px] text-ink/55">No brand kit yet. Send it to Claude to draft one from {client.business}&apos;s profile and form answers.</p>
        </div>
      ) : null}

      {history.length > 0 && (
        <details className="rounded-md border border-hair bg-card px-4 py-3">
          <summary className="mono-label cursor-pointer text-[9.5px] text-ink/50">Earlier versions ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((k) => (
              <li key={k.id} className="text-[12.5px] text-ink/65">v{k.version || 1} · {k.status} · {timeAgo(k.approved_at || k.created_date)}{k.summary ? ` — ${k.summary}` : ""}</li>
            ))}
          </ul>
        </details>
      )}

      <GenerateDialog client={client} open={open} revising={!!current} onClose={() => setOpen(false)} onQueued={refresh} />
    </div>
  );
}
