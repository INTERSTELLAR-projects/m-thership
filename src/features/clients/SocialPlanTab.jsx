import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ArrowRight, Check, Copy, Eye, EyeOff, Loader2, Megaphone, MessageSquareWarning, ShieldCheck, Sparkles, Trash2, X, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useClientRecords } from "@/features/clients/hooks";
import { timeAgo } from "@/lib/useData";
import { cn } from "@/lib/utils";
import { useJobs, useRefreshJobs, approveJob, requestChanges, cancelJob, chatPrompt, JOB_STATUS } from "@/features/claude/jobs";
import {
  SOCIAL_COMPLIANCE, fmtMinutes, formatLabel, gatherSocialPlanInputs, inputChips, isSocialPlanJob, normalizeSocialPlan, platformLabel,
  queueSocialPlan, quickDraftSocialPlan, socialPlanBrief, socialPlanFromJob, socialSearchMarkdown, weeklyBudget,
} from "@/features/claude/socialPlan";
import { socialPlanDeckBrief } from "@/features/presentations/lib/deckFromDocs";
import DeckFromDocButton from "@/features/presentations/DeckFromDocButton";
import DictationBox from "@/features/voice/DictationBox";

const PRIORITY_TONE = { high: "bg-[#ff3c00] text-white", medium: "bg-[#ff6a00]/15 text-[#c24100]", low: "bg-ink/[0.07] text-ink/60" };
const STEP_LABEL = { capture: "Capture", edit: "Edit", caption: "Caption", schedule: "Schedule", engage: "Engage" };
const HEX_RE = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i;

function Section({ title, children, aside }) {
  return (
    <section className="border-t border-hair pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="label-cross">({title})</p>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Bullets({ items, empty = null }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return empty;
  return (
    <ul className="space-y-1.5">
      {list.map((x, i) => (
        <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink/80">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

const Label = ({ children, tone = "text-ink/45" }) => <p className={cn("mono-label mb-1 text-[8.5px]", tone)}>{children}</p>;
const Chip = ({ children, className = "" }) => <span className={cn("rounded-sm border border-hair bg-card px-1.5 py-0.5 text-[11px] text-ink/70", className)}>{children}</span>;
const Est = () => <span className="mono-label ml-1 rounded-sm bg-amber-100 px-1 py-[1px] text-[8px] text-amber-800">est.</span>;
const Val = ({ v }) => (v && !/^unknown$/i.test(v) ? <span>{v}</span> : <span className="text-ink/35">unknown</span>);

function PlatformCard({ p }) {
  return (
    <article className="flex flex-col rounded-md border border-hair bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-hair px-4 py-3">
        <h4 className="text-[15px] font-semibold tracking-[-0.02em]">{p.name || platformLabel(p.id)}</h4>
        <span className={cn("mono-label rounded-sm px-1.5 py-0.5 text-[8.5px]", PRIORITY_TONE[p.priority])}>{p.priority}</span>
      </header>
      <div className="flex-1 space-y-3 px-4 py-3">
        {p.role && <p className="text-[12.5px] leading-relaxed text-ink/80">{p.role}</p>}
        {p.cadence && <div><Label tone="text-[#ff3c00]">cadence</Label><p className="text-[12.5px] font-medium text-ink">{p.cadence}</p></div>}
        {p.best_formats.length > 0 && <div><Label>best formats</Label><div className="flex flex-wrap gap-1">{p.best_formats.map((f) => <Chip key={f}>{formatLabel(f)}</Chip>)}</div></div>}
        {p.posting_guidance && (
          <div className="rounded-sm border border-dashed border-hair bg-ink/[0.02] px-2.5 py-2">
            <Label>when to post · starting point to test, not data</Label>
            <p className="text-[12px] text-ink/70">{p.posting_guidance}</p>
          </div>
        )}
        {p.setup.length > 0 && <div><Label>set up</Label><Bullets items={p.setup} /></div>}
      </div>
    </article>
  );
}

function CalendarGrid({ calendar }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {calendar.map((w) => (
        <div key={w.week} className="flex flex-col rounded-md border border-hair bg-card">
          <div className="h-1 rounded-t-md bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00]" style={{ opacity: 0.45 + w.week * 0.13 }} />
          <div className="border-b border-hair px-3 py-2">
            <p className="text-[13px] font-semibold tracking-[-0.02em]">Week {w.week}</p>
            {w.theme && <p className="text-[11.5px] text-ink/55">{w.theme}</p>}
          </div>
          <ul className="flex-1 divide-y divide-hair">
            {w.posts.map((x, i) => (
              <li key={i} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10.5px] font-semibold text-[#ff3c00]">{x.day || "—"}</span>
                  <span className="mono-label text-[8px] text-ink/55">{platformLabel(x.platform)}</span>
                  <span className="mono-label text-[8px] text-ink/35">· {formatLabel(x.format)}</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-ink/85">{x.idea}</p>
                {x.hook && <p className="mt-0.5 text-[11px] italic text-ink/50">&ldquo;{x.hook}&rdquo;</p>}
                {x.pillar && <p className="mono-label mt-0.5 text-[7.5px] text-ink/35">{x.pillar}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Workflow({ workflow, plan }) {
  const steps = workflow.steps || [];
  const b = weeklyBudget(plan);
  return (
    <div className="space-y-3">
      <div className="relative grid gap-3 md:grid-cols-5">
        <div className="absolute left-0 right-0 top-[9px] hidden h-[2px] bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00] md:block" />
        {steps.map((s, i) => (
          <div key={i} className="relative">
            <div className="flex items-center gap-2">
              <span className="relative z-10 grid h-5 w-5 place-items-center rounded-full border-2 border-[#ff3c00] bg-card font-mono text-[9px] text-[#ff3c00]">{i + 1}</span>
              <span className="text-[13px] font-semibold tracking-[-0.02em]">{s.title || STEP_LABEL[s.id] || s.id}</span>
            </div>
            <div className="mt-2 rounded-sm border border-hair bg-card px-2.5 py-2">
              <p className="mono-label text-[8px] text-ink/45">{s.who || "—"}{s.minutes_per_week ? ` · ~${fmtMinutes(s.minutes_per_week)}/wk` : ""}</p>
              <div className="mt-1"><Bullets items={s.how} /></div>
              {s.tools.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{s.tools.map((x) => <Chip key={x} className="text-[10.5px]">{x}</Chip>)}</div>}
            </div>
          </div>
        ))}
      </div>
      {(b.client != null || b.interstellar != null || b.steps != null) && (
        <div className="flex flex-wrap items-center gap-4 rounded-sm border border-hair bg-ink/[0.02] px-3 py-2 text-[12px]">
          <span className="mono-label text-[8.5px] text-ink/45">weekly time budget · estimate</span>
          {b.client != null && <span>You: <b className="tabular-nums">{fmtMinutes(b.client)}</b></span>}
          {b.interstellar != null && <span>Interstellar: <b className="tabular-nums">{fmtMinutes(b.interstellar)}</b></span>}
          {b.client == null && b.interstellar == null && b.steps != null && <span>All steps: <b className="tabular-nums">{fmtMinutes(b.steps)}</b></span>}
          {b.notes && <span className="text-ink/55">{b.notes}</span>}
        </div>
      )}
    </div>
  );
}

function ColorRow({ colors }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c, i) => {
        const m = c.match(HEX_RE);
        return (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-sm border border-hair bg-card px-1.5 py-1 text-[11.5px] text-ink/75">
            {m && <span className="h-4 w-4 rounded-sm border border-ink/10" style={{ background: m[0] }} />}
            {c}
          </span>
        );
      })}
    </div>
  );
}

// Read-only social plan view (client profile, review card, portal).
export function SocialPlanView({ plan, body }) {
  const p = normalizeSocialPlan(plan);
  if (!p) {
    return body ? <div className="prose prose-sm max-w-none text-ink/80"><ReactMarkdown>{body}</ReactMarkdown></div> : <p className="text-[13px] text-ink/50">Nothing came back yet.</p>;
  }
  const g = p.goals_audience;
  const ed = p.editing;
  const cap = p.captions;
  const eng = p.engagement;
  const con = p.consistency;
  const r = p.roles;
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-md border border-hair">
        <div className="h-1 bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00]" />
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <div><Label>business goals</Label><Bullets items={g.business_goals} empty={<p className="text-[12.5px] text-ink/35">unknown</p>} /></div>
          <div><Label tone="text-[#ff3c00]">what social does for it</Label><Bullets items={g.social_goals} /></div>
          <div>
            <Label>audience</Label>
            <p className="text-[12.5px] leading-relaxed text-ink/80">{g.audience || <span className="text-ink/35">unknown</span>}</p>
            {g.where_they_scroll.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{g.where_they_scroll.map((x) => <Chip key={x}>{x}</Chip>)}</div>}
          </div>
        </div>
        {(g.voice_summary || g.what_they_care_about.length > 0) && (
          <div className="grid gap-4 border-t border-hair px-4 py-3 md:grid-cols-2">
            {g.what_they_care_about.length > 0 && <div><Label>what they care about</Label><Bullets items={g.what_they_care_about} /></div>}
            {g.voice_summary && <div><Label>voice on social</Label><p className="text-[12.5px] leading-relaxed text-ink/80">{g.voice_summary}</p></div>}
          </div>
        )}
        {g.unknowns.length > 0 && (
          <div className="border-t border-amber-200 bg-amber-50/60 px-4 py-2.5">
            <p className="mono-label mb-1 text-[8.5px] text-amber-800">still unknown — we need these to measure and plan</p>
            <div className="flex flex-wrap gap-1.5">{g.unknowns.map((u, i) => <span key={i} className="rounded-sm border border-amber-200 bg-white px-1.5 py-0.5 text-[11.5px] text-amber-900">{u}</span>)}</div>
          </div>
        )}
      </div>

      {p.platforms.length > 0 && (
        <Section title="Platform strategy">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{p.platforms.map((x) => <PlatformCard key={x.id} p={x} />)}</div>
          {p.skipped_platforms.length > 0 && (
            <p className="mt-3 text-[12px] text-ink/55"><span className="mono-label mr-2 text-[8.5px] text-ink/40">not now</span>{p.skipped_platforms.map((s) => `${platformLabel(s.id)}${s.why ? ` (${s.why})` : ""}`).join(" · ")}</p>
          )}
        </Section>
      )}

      {p.pillars.length > 0 && (
        <Section title="Content pillars">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {p.pillars.map((x) => (
              <span key={x.name} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-3 py-1 text-[12px] font-medium text-white">
                {x.name}{x.share && <span className="font-mono text-[10.5px] opacity-80">{x.share}</span>}
              </span>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {p.pillars.map((x) => (
              <div key={x.name} className="rounded-md border border-hair bg-card px-3.5 py-3">
                <p className="text-[13.5px] font-semibold tracking-[-0.02em]">{x.name}</p>
                {x.description && <p className="mt-1 text-[12px] text-ink/65">{x.description}</p>}
                {x.example_posts.length > 0 && <div className="mt-2"><Label>post ideas</Label><Bullets items={x.example_posts} /></div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {p.formats.length > 0 && (
        <Section title="Formats playbook">
          <div className="grid gap-2 md:grid-cols-2">
            {p.formats.map((f, i) => (
              <div key={i} className="rounded-sm border border-hair bg-card px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-semibold">{f.name || formatLabel(f.id)}</p>
                  {f.frequency && <span className="mono-label text-[8px] text-ink/45">{f.frequency}</span>}
                </div>
                {f.use_for && <p className="mt-0.5 text-[12px] text-ink/65">{f.use_for}</p>}
                {f.how.length > 0 && <div className="mt-1.5"><Bullets items={f.how} /></div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {p.calendar.length > 0 && <Section title="4-week starter calendar"><CalendarGrid calendar={p.calendar} /></Section>}

      {p.workflow.steps.length > 0 && <Section title="Creation workflow · capture → edit → caption → schedule → engage"><Workflow workflow={p.workflow} plan={p} /></Section>}

      {(ed.colors.length > 0 || ed.fonts.length > 0 || ed.photo_style || ed.dos.length > 0) && (
        <Section title="Editing guidelines" aside={<span className="mono-label text-[8.5px] text-ink/45">{ed.based_on_brand_kit ? "from the approved brand kit" : "general — no approved brand kit yet"}</span>}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {ed.colors.length > 0 && <div><Label>colors</Label><ColorRow colors={ed.colors} /></div>}
              {ed.fonts.length > 0 && <div><Label>fonts</Label><div className="flex flex-wrap gap-1">{ed.fonts.map((x) => <Chip key={x}>{x}</Chip>)}</div></div>}
              {ed.voice.length > 0 && <div><Label>voice</Label><Bullets items={ed.voice} /></div>}
              {ed.templates.length > 0 && <div><Label>templates to build once</Label><Bullets items={ed.templates} /></div>}
            </div>
            <div className="space-y-3">
              {ed.photo_style && <div><Label>photo style</Label><p className="text-[12.5px] text-ink/75">{ed.photo_style}</p></div>}
              {ed.video_style && <div><Label>video style</Label><p className="text-[12.5px] text-ink/75">{ed.video_style}</p></div>}
              <div className="grid gap-3 sm:grid-cols-2">
                {ed.dos.length > 0 && <div><Label tone="text-green-700">do</Label><Bullets items={ed.dos} /></div>}
                {ed.donts.length > 0 && <div><Label tone="text-red-700">don&apos;t</Label><Bullets items={ed.donts} /></div>}
              </div>
            </div>
          </div>
        </Section>
      )}

      {(cap.structure || cap.rules.length > 0 || cap.hashtag_sets.length > 0) && (
        <Section title="Captions & hashtags">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {cap.structure && <p className="text-[13px] font-medium text-ink">{cap.structure}</p>}
              <Bullets items={cap.rules} />
              {cap.cta_examples.length > 0 && <div><Label>call-to-action examples</Label><Bullets items={cap.cta_examples} /></div>}
            </div>
            <div className="space-y-3">
              <Bullets items={cap.hashtag_rules} />
              {cap.hashtag_sets.map((h, i) => (
                <div key={i}><Label>{h.name || "hashtag set"}</Label><p className="font-mono text-[11.5px] leading-relaxed text-[#c24100]">{h.tags.join(" ")}</p></div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {(eng.daily.length > 0 || eng.weekly.length > 0 || eng.response_rules.length > 0 || con.batching_day || con.content_bank.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Engagement routine" aside={eng.response_time ? <span className="mono-label text-[8.5px] text-ink/45">reply within {eng.response_time}</span> : null}>
            <div className="space-y-3">
              {eng.daily.length > 0 && <div><Label>daily</Label><Bullets items={eng.daily} /></div>}
              {eng.weekly.length > 0 && <div><Label>weekly</Label><Bullets items={eng.weekly} /></div>}
              {eng.response_rules.length > 0 && <div><Label>comments, DMs & reviews</Label><Bullets items={eng.response_rules} /></div>}
            </div>
          </Section>
          <Section title="Consistency system" aside={con.batching_day ? <span className="mono-label text-[8.5px] text-[#ff3c00]">batch on {con.batching_day}</span> : null}>
            <div className="space-y-3">
              <Bullets items={con.batching_plan} />
              {con.templates.length > 0 && <div><Label>templates</Label><Bullets items={con.templates} /></div>}
              {con.content_bank.length > 0 && <div><Label>content bank (fallback ideas)</Label><div className="flex flex-wrap gap-1">{con.content_bank.map((x, i) => <Chip key={i}>{x}</Chip>)}</div></div>}
            </div>
          </Section>
        </div>
      )}

      {p.repurposing.length > 0 && (
        <Section title="Repurposing">
          <ul className="space-y-2">
            {p.repurposing.map((x, i) => (
              <li key={i} className="rounded-sm border border-hair bg-card px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                  <span className="font-semibold">{x.from}</span>
                  {x.to.map((y) => <span key={y} className="inline-flex items-center gap-1.5"><ArrowRight className="h-3 w-3 text-[#ff3c00]" />{y}</span>)}
                </div>
                {x.how && <p className="mt-0.5 text-[11.5px] text-ink/55">{x.how}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {p.kpis.length > 0 && (
        <Section title="KPIs to track">
          <div className="overflow-x-auto rounded-md border border-hair bg-card">
            <table className="w-full text-left text-[12px]">
              <thead className="mono-label text-[8px] text-ink/45"><tr><th className="px-3 py-2">KPI</th><th className="pr-3">Platform</th><th className="pr-3">Now</th><th className="pr-3">Target</th><th className="pr-3">How to track</th></tr></thead>
              <tbody>
                {p.kpis.map((k, i) => (
                  <tr key={i} className="border-t border-hair">
                    <td className="px-3 py-1.5 font-medium" title={k.source}>{k.name}</td>
                    <td className="pr-3 text-ink/60">{k.platform ? platformLabel(k.platform) : "—"}</td>
                    <td className="pr-3 tabular-nums"><Val v={k.current} /></td>
                    <td className="pr-3 tabular-nums"><Val v={k.target} />{k.is_estimate && <Est />}</td>
                    <td className="pr-3 text-ink/55">{k.how_to_track || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {(r.interstellar.length > 0 || r.client.length > 0) && (
        <Section title="Who does what">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-[#ff6a00]/40 bg-[#ff6a00]/[0.04] px-3 py-2.5"><Label tone="text-[#c24100]">interstellar</Label><Bullets items={r.interstellar} /></div>
            <div className="rounded-md border border-hair bg-card px-3 py-2.5"><Label tone="text-green-700">you</Label><Bullets items={r.client} /></div>
            {r.together.length > 0 && <div className="rounded-md border border-hair bg-card px-3 py-2.5"><Label>together</Label><Bullets items={r.together} /></div>}
          </div>
        </Section>
      )}

      {socialSearchMarkdown(p, { heading: "###" }) && (
        <Section title="Search optimization (social SEO)">
          <div className="prose prose-sm max-w-none text-ink/80"><ReactMarkdown>{socialSearchMarkdown(p, { heading: "###" })}</ReactMarkdown></div>
        </Section>
      )}

      <Section title="Rules we always follow">
        <ul className="grid gap-2 md:grid-cols-2">
          {[...SOCIAL_COMPLIANCE, ...p.compliance].map((x, i) => (
            <li key={i} className="flex gap-2 rounded-sm border border-hair bg-card px-3 py-2 text-[12px] text-ink/75"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-700" />{x}</li>
          ))}
        </ul>
      </Section>

      {p.next_steps.length > 0 && (
        <Section title="Next steps">
          <ol className="space-y-1.5">{p.next_steps.map((s, i) => <li key={i} className="flex gap-2.5 text-[12.5px] text-ink/80"><span className="font-mono text-[11px] text-[#ff3c00]">{String(i + 1).padStart(2, "0")}</span>{s}</li>)}</ol>
        </Section>
      )}
    </div>
  );
}

function Composer({ client, revising, onClose, onDone }) {
  const [extra, setExtra] = useState("");
  const [web, setWeb] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const inputs = useQuery({ queryKey: ["SocialPlanInputs", client.id], queryFn: () => gatherSocialPlanInputs(client) });
  const brief = inputs.data ? socialPlanBrief(client, inputs.data, extra.trim()) : "";

  const run = async (key, fn) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      setExtra("");
      onDone();
      onClose();
    } catch (e) {
      setError(e?.message || "That didn't go through");
    } finally {
      setBusy("");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(chatPrompt({ id: "(not queued yet)", instructions: brief }));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="rounded-md border border-[#ff3c00]/50 bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Send to Claude → {revising ? "Revise" : "Generate"} social plan</h3>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink/60">Built from {client.business}&apos;s CRM profile, Constellations dossier, intake and onboarding answers, approved brand kit, playbook and content plan, plus your direction. Nothing is saved or shown to the client until you approve it.</p>
        </div>
        <button type="button" onClick={onClose} disabled={!!busy} className="text-ink/40 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
      </header>
      <div className="space-y-3 p-4">
        {inputs.isLoading ? (
          <p className="flex items-center gap-2 text-[12.5px] text-ink/55"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gathering the profile, answers, brand kit and plans…</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {inputChips(inputs.data).map(([k, v]) => <span key={k} className="rounded-sm border border-hair px-1.5 py-0.5 text-ink/65"><span className="text-ink/40">{k}:</span> {v}</span>)}
          </div>
        )}
        <DictationBox
          label={revising ? "What should change from the current social plan?" : "Direction for Claude — type or dictate"}
          value={extra}
          onChange={setExtra}
          rows={5}
          placeholder="e.g. Owner films on his phone at every job. Skip TikTok and X. Focus on Facebook and Nextdoor for homeowners, Instagram Reels for before/afters. He has about an hour a week."
        />
        {brief && (
          <details>
            <summary className="mono-label cursor-pointer text-[9.5px] text-ink/50 hover:text-[#ff3c00]">Show full brief</summary>
            <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-sm bg-ink/[0.04] p-3 text-[11px] text-ink/70">{brief}</pre>
          </details>
        )}
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={copy} disabled={!brief} className="inline-flex items-center gap-1.5 text-[12px] text-ink/60 hover:text-ink disabled:opacity-40">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy prompt for a live chat"}
            </button>
            <label className="inline-flex items-center gap-1.5 text-[12px] text-ink/60" title="Quick draft only: let the in-app model read the web (slower)">
              <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} className="accent-[#ff3c00]" /> Web research in quick draft
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy || inputs.isLoading} onClick={() => run("quick", () => quickDraftSocialPlan(client, extra.trim(), { web }))} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3.5 py-2 text-[12.5px] text-ink/80 hover:border-ink/40 disabled:opacity-50">
              {busy === "quick" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}{busy === "quick" ? "Drafting…" : "Quick draft (in-app)"}
            </button>
            <button type="button" disabled={!!busy || inputs.isLoading} onClick={() => run("claude", () => queueSocialPlan(client, extra.trim()))} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60">
              {busy === "claude" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Send to Claude → Generate social plan
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ job, onDone }) {
  const [notes, setNotes] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const plan = socialPlanFromJob(job);
  const quick = !!job.context?.quick_draft;

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
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("mono-label rounded-sm px-1.5 py-0.5 text-[8.5px]", JOB_STATUS.needs_approval.tone)}>Needs your OK</span>
            <span className="mono-label rounded-sm bg-ink/[0.06] px-1.5 py-0.5 text-[8.5px] text-ink/60">{quick ? "Quick draft · in-app" : "Claude Queue"}</span>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold tracking-[-0.02em]">{plan?.headline || job.title}</h3>
          {job.result_summary && <p className="mt-1 max-w-2xl text-[12.5px] text-ink/60">{job.result_summary}</p>}
          {job.extra && <p className="mt-1 max-w-2xl text-[11.5px] text-ink/45"><span className="mono-label mr-1 text-[8px]">your direction</span>{job.extra}</p>}
        </div>
        <Link to={`/claude?job=${job.id}`} className="mono-label text-[9px] text-ink/45 hover:text-[#ff3c00]">open in queue</Link>
      </header>
      <div className="max-h-[75vh] overflow-y-auto p-4">
        <SocialPlanView plan={plan} body={job.result_body} />
        {job.needs_from_justin && (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="mono-label mb-1 text-[8.5px] text-amber-800">needs from you</p>
            <p className="whitespace-pre-wrap text-[12.5px] text-amber-900">{job.needs_from_justin}</p>
          </div>
        )}
      </div>
      <footer className="space-y-2 border-t border-hair px-4 py-3">
        {asking && <DictationBox label="What should Claude change?" value={notes} onChange={setNotes} rows={3} placeholder="Platforms, cadence, pillars, time budget, tone…" />}
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {asking ? (
            <>
              <button type="button" onClick={() => setAsking(false)} className="px-2 text-[12px] text-ink/55 hover:text-ink">Cancel</button>
              <button type="button" disabled={!notes.trim() || !!busy} onClick={() => act("changes", () => requestChanges(job, notes.trim()))} className="inline-flex items-center gap-1.5 rounded-sm border border-amber-400 bg-amber-50 px-3.5 py-2 text-[12.5px] font-medium text-amber-900 disabled:opacity-50">
                {busy === "changes" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareWarning className="h-3.5 w-3.5" />} Send back to Claude
              </button>
            </>
          ) : (
            <>
              {quick && (
                <button type="button" disabled={!!busy} onClick={() => act("discard", () => cancelJob(job))} className="mr-auto inline-flex items-center gap-1.5 px-2 text-[12px] text-ink/50 hover:text-red-600">
                  {busy === "discard" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Discard draft
                </button>
              )}
              <button type="button" onClick={() => setAsking(true)} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3.5 py-2 text-[12.5px] text-ink/75 hover:border-ink/40">
                <MessageSquareWarning className="h-3.5 w-3.5" /> Request changes
              </button>
              <button type="button" disabled={!!busy || !plan} onClick={() => act("approve", () => approveJob(job))} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[12.5px] font-medium text-white disabled:opacity-60" title={plan ? "Saves a new version on the profile (hidden from the portal)" : "No structured plan in result_data yet"}>
                {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve &amp; save to profile
              </button>
            </>
          )}
        </div>
      </footer>
    </section>
  );
}

export default function SocialPlanTab({ client }) {
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => base44.auth.me(), staleTime: 300_000 });
  const { data: jobs = [] } = useJobs(400);
  const refreshJobs = useRefreshJobs();
  const plans = useClientRecords("SocialPlan", client.id, { sort: "-version" });
  const [composing, setComposing] = useState(false);
  const [toggling, setToggling] = useState(false);

  if (me.isLoading) return <p className="text-[13px] text-ink/50">Loading…</p>;
  if (me.data?.role !== "admin") return <p className="text-[13px] text-ink/50">Social plans are managed by your Interstellar team.</p>;

  const spJobs = jobs.filter((j) => j.client_id === client.id && isSocialPlanJob(j));
  const review = spJobs.filter((j) => j.status === "needs_approval");
  const working = spJobs.filter((j) => ["queued", "running", "changes_requested", "failed"].includes(j.status));
  const current = plans.rows.find((k) => k.status === "approved");
  const history = plans.rows.filter((k) => k !== current);
  const refresh = () => { refreshJobs(); plans.refresh(); };
  const inFlight = working.some((j) => j.status !== "failed");

  const togglePortal = async () => {
    if (!current) return;
    setToggling(true);
    try { await plans.update(current.id, { portal_visible: !current.portal_visible }); } finally { setToggling(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-cross mb-2">(Social plan)</p>
          <p className="max-w-2xl text-[13px] text-ink/60">
            {client.business}&apos;s social media plan: which platforms and why, what to post, a 4-week starter calendar, how content gets made every week and who does what. Dictate your direction, Claude drafts it from their profile, brand kit, playbook and content plan, and you approve it before it&apos;s saved or shown to the client.
          </p>
        </div>
        {!composing && (
          <button type="button" onClick={() => setComposing(true)} disabled={inFlight} title={inFlight ? "A social plan job is already in the queue" : ""} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" /> Send to Claude → {current ? "Revise social plan" : "Generate social plan"}
          </button>
        )}
      </div>

      {composing && <Composer client={client} revising={!!current} onClose={() => setComposing(false)} onDone={refresh} />}

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
              <Megaphone className="h-4 w-4 text-[#ff3c00]" strokeWidth={1.75} />
              <div>
                <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Approved social plan · v{current.version || 1}</h3>
                <p className="text-[11.5px] text-ink/50">Approved {timeAgo(current.approved_at || current.created_date)}{current.approved_by ? ` by ${current.approved_by}` : ""}{current.generated_by === "quick_draft" ? " · quick draft" : ""}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DeckFromDocButton
                client={client}
                source="social_plan"
                lastDeckId={current.presentation_id}
                makeBrief={() => socialPlanDeckBrief(client, current)}
                onCreated={(id) => plans.update(current.id, { presentation_id: id })}
              />
              <button type="button" onClick={togglePortal} disabled={toggling} className={cn("inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[12px]", current.portal_visible ? "border-green-300 bg-green-50 text-green-800" : "border-hair text-ink/60")} title="Show in client portal">
                {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : current.portal_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}{current.portal_visible ? "Shown in client portal" : "Show in client portal"}
              </button>
            </div>
          </header>
          <div className="p-4">
            {current.plan?.headline && <p className="mb-1 text-[20px] font-semibold tracking-[-0.03em]">{current.plan.headline}</p>}
            {current.summary && <p className="mb-5 max-w-3xl text-[13px] text-ink/70">{current.summary}</p>}
            <SocialPlanView plan={current.plan && Object.keys(current.plan).length ? current.plan : null} body={current.body_md} />
          </div>
        </section>
      ) : review.length === 0 && working.length === 0 && !composing ? (
        <div className="rounded-md border border-dashed border-hair px-6 py-12 text-center">
          <Megaphone className="mx-auto h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <p className="mt-3 text-[13px] text-ink/55">No social plan yet. Dictate your direction and send it to Claude (or run a quick draft) to build one for {client.business}.</p>
        </div>
      ) : null}

      {history.length > 0 && (
        <details className="rounded-md border border-hair bg-card px-4 py-3">
          <summary className="mono-label cursor-pointer text-[9.5px] text-ink/50">Earlier versions ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((k) => <li key={k.id} className="text-[12.5px] text-ink/65">v{k.version || 1} · {k.status} · {timeAgo(k.approved_at || k.created_date)}{k.summary ? ` — ${k.summary}` : ""}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
