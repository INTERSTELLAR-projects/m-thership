// Templates: the industry template library every lead preview is built from (website structure + Command System
// modules), with the real Interstellar builds behind each one. Admins edit (every save is logged in Refinements
// with author and date and bumps the version); sales reps read and send suggestions.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpenCheck, ChevronDown, ChevronUp, ExternalLink, Eye, Layers, Loader2, MessageSquarePlus, Save, Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { FOUNDATION, TYPE_PAIRS, SEO_LIMITS, buildPreview, seoOk } from "@/lib/leadEngine";
import { engine, useEngine, useRefresh } from "./api";
import { Card, Pill, Loading, ErrorNote, Empty, btn, btnFlame, input, area, STATUS_TONE } from "./ui";
import WebsitePreview from "./WebsitePreview";
import CommandPreview from "./CommandPreview";
import PreviewFrame from "./PreviewFrame";

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const SAMPLE_CLIENT = { id: "sample", business: "Sample Business Co", city: "Your City", state: "", phones: ["(555) 010-0100"], scrape_summary: null };

function Len({ value, range }) {
  const n = String(value || "").replace(/\{business\}/g, "Sample Business Co").replace(/\{city\}/g, "Your City").length;
  const ok = n >= range[0] && n <= range[1];
  return <span className={`font-mono text-[10px] ${ok ? "text-green-700" : "text-[#c24100]"}`}>{n} / {range[0]}–{range[1]}</span>;
}

export default function TemplatesPage({ embedded = false }) {
  const q = useEngine("templates");
  const refresh = useRefresh();
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const list = q.data?.templates || [];
  const canEdit = !!q.data?.can_edit;
  const t = list.find((x) => x.industry_key === sel) || list[0] || null;
  const groups = useMemo(() => list.reduce((a, x) => { (a[x.category || "Other"] ||= []).push(x); return a; }, {}), [list]);

  const seed = async () => {
    setBusy("seed"); setErr("");
    try { await engine("templates_seed"); refresh(); await q.refetch(); } catch (e) { setErr(e.message); }
    setBusy("");
  };

  return (
    <div className={embedded ? "" : "pb-20"}>
      {embedded ? null : (
        <PageHeader breadcrumb="Lead Engine / Templates" title="Industry /Templates" rightText={list.length ? `${list.length} industries` : ""}>
          {canEdit && q.data && !q.data.seeded ? <button type="button" onClick={seed} disabled={!!busy} className={btnFlame}>{busy === "seed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Seed the library</button> : null}
        </PageHeader>
      )}
      <div className={embedded ? "space-y-4" : "space-y-5 px-4 pt-6 md:px-8"}>
        <FoundationCard admin={canEdit} />
        {err ? <ErrorNote error={err} /> : null}
        {q.isLoading ? <Loading /> : q.isError ? <ErrorNote error={q.error} /> : !list.length ? <Empty icon={Layers} title="No templates yet" hint="Seed the library to load the 22 starting industries." /> : (
          <>
            {!q.data.seeded ? <p className="border border-[#ff6a00]/40 bg-[#ff6a00]/[0.07] px-3 py-2 text-[12.5px] text-ink/75">Showing the built-in starting library. {canEdit ? "Seed it to save the templates so you and the team can refine them." : "Justin seeds it so edits and suggestions save."}</p> : null}
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
              <nav aria-label="Industries" className="h-fit border border-hair bg-paper/85 lg:sticky lg:top-4">
                {Object.entries(groups).map(([g, items]) => (
                  <div key={g} className="border-b border-hair last:border-b-0">
                    <p className="mono-label px-3 pb-1 pt-3 text-[9px] text-ink/45">{g}</p>
                    <ul className="pb-2">{items.map((x) => (
                      <li key={x.industry_key}><button type="button" onClick={() => setSel(x.industry_key)} aria-current={t?.industry_key === x.industry_key ? "true" : undefined}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] ${t?.industry_key === x.industry_key ? "bg-ink text-white" : "hover:bg-ink/[0.04]"}`}>
                        <span className="truncate">{x.name}</span>
                        <span className="flex shrink-0 items-center gap-1">{(x.reference_builds || []).length ? <span title="Has real builds" className={`h-1.5 w-1.5 rounded-full ${t?.industry_key === x.industry_key ? "bg-[#ffaa00]" : "bg-[#ff3c00]"}`} /> : null}<span className={`font-mono text-[9.5px] uppercase ${t?.industry_key === x.industry_key ? "text-white/60" : "text-ink/40"}`}>{x.status}</span></span>
                      </button></li>
                    ))}</ul>
                  </div>
                ))}
              </nav>
              {t ? <TemplateDetail key={`${t.industry_key}:${t.version}`} t={t} canEdit={canEdit && !!t.id} seeded={!!q.data.seeded} onSaved={() => { refresh(); q.refetch(); }} /> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FoundationCard({ admin }) {
  const [open, setOpen] = useState(false);
  return (
    <Card kicker="Runs on" title={FOUNDATION.title} right={<div className="flex items-center gap-2">{admin ? <Link to={FOUNDATION.link} className="inline-flex items-center gap-1 text-[12px] text-[#ff3c00] hover:underline"><BookOpenCheck className="h-3.5 w-3.5" />{FOUNDATION.prompt_title}</Link> : null}<button type="button" onClick={() => setOpen((v) => !v)} className="text-[12px] text-ink/55 hover:text-ink">{open ? "Hide" : "Rules"}</button></div>}>
      <p className="text-[12.5px] text-ink/65">Every template and every preview is built on the same foundation as Interstellar client builds, plus the build standard in the Agency Brain. Templates are starting structures, not finished sites: the lead's own photos, words and brand lead.</p>
      {open ? <ol className="mt-3 grid gap-1.5 md:grid-cols-2">{FOUNDATION.rules.map((r, i) => <li key={r} className="flex gap-2 text-[12.5px]"><span className="font-mono text-[10.5px] text-[#ff3c00]">{String(i + 1).padStart(2, "0")}</span>{r}</li>)}</ol> : null}
    </Card>
  );
}

function TemplateDetail({ t, canEdit, seeded, onSaved }) {
  const [tab, setTab] = useState("website");
  const [d, setD] = useState(() => draftOf(t));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);
  useEffect(() => { setD(draftOf(t)); }, [t]);
  const dirty = JSON.stringify(d) !== JSON.stringify(draftOf(t));
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const tmpl = useMemo(() => fromDraft(t, d), [t, d]);
  const sample = useMemo(() => (show ? buildPreview({ client: SAMPLE_CLIENT, template: tmpl }) : null), [show, tmpl]);

  const save = async () => {
    setBusy("save"); setErr(""); setMsg("");
    try {
      await engine("template_save", { id: t.id, patch: { name: tmpl.name, status: tmpl.status, places_query: tmpl.places_query, match_keywords: tmpl.match_keywords, website_template: tmpl.website_template, command_template: tmpl.command_template }, note });
      setNote(""); setMsg("Saved. Logged in Refinements."); onSaved();
    } catch (e) { setErr(e.message); }
    setBusy("");
  };
  const suggest = async () => {
    setBusy("suggest"); setErr(""); setMsg("");
    try { await engine("template_suggest", { id: t.id, note }); setNote(""); setMsg("Suggestion sent. It shows in Refinements for Justin."); onSaved(); } catch (e) { setErr(e.message); }
    setBusy("");
  };

  const wt = d;
  return (
    <section className="min-w-0 space-y-4" data-testid="template-detail">
      <div className="border border-hair bg-paper/85 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mono-label text-[9.5px] text-ink/45">{t.category} · v{t.version || 1} · {t.industry_key}</p>
            {canEdit ? <input value={d.name} onChange={(e) => set("name", e.target.value)} aria-label="Template name" className="mt-1 w-full bg-transparent text-[26px] font-semibold tracking-[-0.04em] outline-none focus:text-[#ff3c00]" /> : <h2 className="mt-1 text-[26px] font-semibold tracking-[-0.04em]">{t.name}</h2>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? <select value={d.status} onChange={(e) => set("status", e.target.value)} aria-label="Status" className="h-9 border border-hair bg-card px-2 text-[12.5px]"><option value="draft">Draft</option><option value="refining">Refining</option><option value="ready">Ready</option></select> : <Pill tone={STATUS_TONE[t.status]}>{t.status}</Pill>}
            <button type="button" onClick={() => setShow((v) => !v)} className={btn}><Eye className="h-3.5 w-3.5" />{show ? "Hide preview" : "Preview with a sample business"}</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
          <span className="text-ink/50">Lead Finder searches:</span>
          {canEdit ? <input value={d.places_query} onChange={(e) => set("places_query", e.target.value)} aria-label="Lead Finder search" className="h-7 border border-hair bg-card px-2 text-[12px]" /> : <b className="font-medium">{t.places_query}</b>}
          <span className="ml-2 text-ink/50">Matches:</span>
          {canEdit ? <input value={d.match_keywords} onChange={(e) => set("match_keywords", e.target.value)} aria-label="Match keywords" className="h-7 min-w-[220px] flex-1 border border-hair bg-card px-2 text-[12px]" /> : <span>{(t.match_keywords || []).join(", ")}</span>}
        </div>
      </div>

      {show && sample ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <PreviewFrame height={620} label="Website (sample business)"><WebsitePreview config={sample.website_config} /></PreviewFrame>
          <div><p className="mono-label mb-3 text-[9.5px] text-ink/50">Command System (sample data)</p><CommandPreview config={sample.command_config} /></div>
        </div>
      ) : null}

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-hair">
        {[["website", "Website"], ["command", "Command System"], ["refs", `Real builds (${(t.reference_builds || []).length})`], ["notes", `Refinements (${(t.refinement_notes || []).length})`]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`relative h-10 px-3 text-[13px] font-medium ${tab === k ? "text-ink" : "text-ink/50 hover:text-ink"}`}>{l}{tab === k ? <span className="absolute inset-x-3 -bottom-px h-[2px] bg-[#ff3c00]" /> : null}</button>
        ))}
      </div>

      {tab === "website" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Sections, in order" kicker="One section at a time">
            <ul className="divide-y divide-hair">{wt.sections.map((s, i) => (
              <li key={s.key} className="flex items-start gap-2 py-2">
                {canEdit ? <input type="checkbox" checked={s.enabled !== false} onChange={(e) => set("sections", wt.sections.map((x, k) => (k === i ? { ...x, enabled: e.target.checked } : x)))} aria-label={`Show ${s.label}`} className="mt-1 accent-[#ff3c00]" /> : <span className="mt-1.5 h-2 w-2 rounded-full bg-[#ff3c00]" />}
                <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{s.label} <span className="font-mono text-[10px] text-ink/40">{s.type}</span></p><p className="text-[12px] text-ink/55">{s.purpose}</p></div>
                {canEdit ? <span className="flex flex-col"><button type="button" aria-label="Move up" disabled={i === 0} onClick={() => set("sections", move(wt.sections, i, -1))} className="text-ink/40 hover:text-ink disabled:opacity-20"><ChevronUp className="h-4 w-4" /></button><button type="button" aria-label="Move down" disabled={i === wt.sections.length - 1} onClick={() => set("sections", move(wt.sections, i, 1))} className="text-ink/40 hover:text-ink disabled:opacity-20"><ChevronDown className="h-4 w-4" /></button></span> : null}
              </li>
            ))}</ul>
          </Card>
          <div className="space-y-4">
            <Card title="Hero patterns" kicker="{business} {city} {service} fill in">
              {canEdit ? <textarea rows={3} value={wt.hero} onChange={(e) => set("hero", e.target.value)} className={area} aria-label="Hero patterns" /> : <ul className="space-y-1 text-[13px]">{lines(wt.hero).map((h) => <li key={h}>“{h}”</li>)}</ul>}
            </Card>
            <Card title="Starting services" kicker="Used only when the scrape finds none (marked as suggestions)">
              {canEdit ? <textarea rows={4} value={wt.services} onChange={(e) => set("services", e.target.value)} className={area} aria-label="Services" /> : <p className="text-[13px]">{lines(wt.services).join(" · ")}</p>}
            </Card>
            <Card title="Look" kicker="Suggestions; the lead's real brand colors win">
              <div className="flex flex-wrap items-center gap-3">
                {["primary", "accent", "ink", "bg"].map((k) => (
                  <label key={k} className="flex items-center gap-1.5 text-[12px]"><input type="color" disabled={!canEdit} value={wt.palette[k] || "#000000"} onChange={(e) => set("palette", { ...wt.palette, [k]: e.target.value })} className="h-8 w-8 cursor-pointer border border-hair bg-transparent p-0" aria-label={`${k} color`} />{k}</label>
                ))}
                <select disabled={!canEdit} value={wt.type} onChange={(e) => set("type", e.target.value)} aria-label="Type pair" className="h-9 border border-hair bg-card px-2 text-[12.5px]">{Object.entries(TYPE_PAIRS).map(([k, p]) => <option key={k} value={k}>{p.display} + {p.body}</option>)}</select>
              </div>
              <p className="mt-2 text-[12px] text-ink/55">Schema: <b className="font-medium">{t.website_template?.schema_type}</b> · Pages: {(t.website_template?.required_pages || []).join(", ")}</p>
              <p className="mt-1 text-[12px] text-ink/55">Photos: {t.website_template?.photo_direction}</p>
            </Card>
          </div>
          <Card title="Search titles and descriptions" kicker={`Titles ${SEO_LIMITS.title.join("–")} chars · descriptions ${SEO_LIMITS.description.join("–")} (checked with a sample name)`} className="xl:col-span-2">
            <div className="space-y-3">{wt.seo.map((p, i) => (
              <div key={p.page} className="grid gap-2 md:grid-cols-[90px_1fr]">
                <p className="pt-2 text-[12.5px] font-medium">{p.page}</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">{canEdit ? <input value={p.title} onChange={(e) => set("seo", wt.seo.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} className={input} aria-label={`${p.page} title`} /> : <p className="flex-1 text-[13px]">{p.title}</p>}<Len value={p.title} range={SEO_LIMITS.title} /></div>
                  <div className="flex items-start gap-2">{canEdit ? <textarea rows={2} value={p.description} onChange={(e) => set("seo", wt.seo.map((x, k) => (k === i ? { ...x, description: e.target.value } : x)))} className={area} aria-label={`${p.page} description`} /> : <p className="flex-1 text-[12.5px] text-ink/70">{p.description}</p>}<Len value={p.description} range={SEO_LIMITS.description} /></div>
                </div>
              </div>
            ))}</div>
            <p className="mt-3 text-[11.5px] text-ink/50">When a preview is built, the real name and city fill these and the builder trims or extends to stay in range.</p>
          </Card>
          <Card title="FAQ" kicker="Question | answer, one per line. No claims about the business." className="xl:col-span-2">
            {canEdit ? <textarea rows={4} value={wt.faq} onChange={(e) => set("faq", e.target.value)} className={area} aria-label="FAQ" /> : <ul className="space-y-2">{lines(wt.faq).map((l) => { const [qq, a] = l.split("|"); return <li key={l} className="text-[13px]"><b className="font-medium">{qq}</b><br /><span className="text-ink/60">{a}</span></li>; })}</ul>}
          </Card>
        </div>
      ) : null}

      {tab === "command" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Modules" kicker="Sidebar of the Command System">
            {canEdit ? <textarea rows={7} value={wt.modules} onChange={(e) => set("modules", e.target.value)} className={area} aria-label="Modules (key: label)" /> : <ul className="space-y-1 text-[13px]">{(t.command_template?.modules || []).map((m) => <li key={m.key}>{m.label} <span className="font-mono text-[10px] text-ink/40">{m.key}</span></li>)}</ul>}
            {canEdit ? <p className="mt-1 text-[11px] text-ink/45">One per line as key: label. Keys with a built view: dashboard, pipeline, schedule, customers, invoices, reviews, pricing.</p> : null}
          </Card>
          <Card title="Pipeline stages">
            {canEdit ? <textarea rows={6} value={wt.pipeline} onChange={(e) => set("pipeline", e.target.value)} className={area} aria-label="Pipeline stages" /> : <p className="text-[13px]">{(t.command_template?.pipeline || []).join(" → ")}</p>}
          </Card>
          <Card title="Records (entities)"><ul className="space-y-1 text-[12.5px]">{(t.command_template?.entities || []).map((e) => <li key={e.name}><b className="font-medium">{e.name}</b> <span className="text-ink/55">{e.fields}</span></li>)}</ul></Card>
          <Card title="KPIs and sample data" kicker="Sample data is fictional and always labeled">
            <ul className="space-y-1 text-[12.5px]">{(t.command_template?.kpis || []).map((k) => <li key={k.key}>{k.label} <span className="font-mono text-[10px] text-ink/40">{k.format}</span></li>)}</ul>
            <p className="mt-2 text-[12px] text-ink/55">Nouns: {t.command_template?.sample?.job_noun} · {t.command_template?.sample?.customer_noun}. Sample price range ${(t.command_template?.sample?.price_range || []).join("–$")} (demo only).</p>
          </Card>
        </div>
      ) : null}

      {tab === "refs" ? (
        <Card title="Real Interstellar builds in this industry" kicker="Admin view; never shown to a lead">
          {(t.reference_builds || []).length ? <ul className="divide-y divide-hair">{t.reference_builds.map((r) => (
            <li key={r.key || r.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0"><p className="text-[13.5px] font-medium">{r.name}</p><p className="text-[12px] text-ink/55">{r.note}</p></div>
              <div className="flex items-center gap-3 text-[12px]">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#ff3c00] hover:underline">Site<ExternalLink className="h-3 w-3" /></a> : null}{r.client_id ? <Link to={`/clients/${r.client_id}`} className="text-ink/60 hover:text-ink">Client page</Link> : null}{r.command_app_id ? <span className="font-mono text-[10px] text-ink/40">system {r.command_app_id.slice(-6)}</span> : null}</div>
            </li>
          ))}</ul> : <p className="text-[12.5px] text-ink/55">No Interstellar build in this industry yet. The first one becomes the reference.</p>}
        </Card>
      ) : null}

      {tab === "notes" ? (
        <Card title="Refinements" kicker="Every edit and suggestion, newest first">
          <ul className="space-y-2">{[...(t.refinement_notes || [])].reverse().map((n, i) => (
            <li key={i} className="border border-hair bg-card px-3 py-2">
              <p className="flex flex-wrap items-center gap-2 text-[11px] text-ink/50"><Pill tone={n.kind === "suggestion" ? "amber" : n.kind === "seed" ? "muted" : "flame"}>{n.kind}</Pill>{n.author} · {new Date(n.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{n.fields?.length ? ` · ${n.fields.join(", ")}` : ""}</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px]">{n.note}</p>
            </li>
          ))}</ul>
        </Card>
      ) : null}

      <div className="sticky bottom-3 z-10 border border-hair bg-paper/95 p-3 shadow-[0_18px_40px_-28px_rgba(26,26,26,.5)] backdrop-blur">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={canEdit ? "What changed and why (saved with your name)" : "Suggest a refinement: what worked on a call, what to change"} className={input} aria-label="Refinement note" />
          {canEdit ? (
            <button type="button" onClick={save} disabled={!!busy || (!dirty && !note.trim())} className={`${btnFlame} shrink-0`}>{busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save v{(t.version || 1) + (dirty ? 1 : 0)}</button>
          ) : (
            <button type="button" onClick={suggest} disabled={!!busy || note.trim().length < 5 || !seeded} className={`${btnFlame} shrink-0`}>{busy === "suggest" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}Suggest</button>
          )}
        </div>
        {msg ? <p className="mt-1.5 text-[12px] text-green-800" role="status">{msg}</p> : null}
        {err ? <p className="mt-1.5 text-[12px] text-red-700" role="alert">{err}</p> : null}
      </div>
    </section>
  );
}

const move = (arr, i, dir) => { const a = [...arr]; const j = i + dir; [a[i], a[j]] = [a[j], a[i]]; return a; };

function draftOf(t) {
  const w = t.website_template || {}, c = t.command_template || {};
  return {
    name: t.name || "", status: t.status || "draft", places_query: t.places_query || "", match_keywords: (t.match_keywords || []).join(", "),
    sections: (w.sections || []).map((s) => ({ ...s })), hero: (w.hero_patterns || []).join("\n"), services: (w.services || []).join("\n"),
    faq: (w.faq || []).map((f) => `${f.q} | ${f.a}`).join("\n"), palette: { ...(w.palette || {}) }, type: w.type?.pair || "archivo",
    seo: (w.seo?.pages || []).map((p) => ({ ...p })),
    modules: (c.modules || []).map((m) => `${m.key}: ${m.label}`).join("\n"), pipeline: (c.pipeline || []).join("\n"),
  };
}
function fromDraft(t, d) {
  const w = t.website_template || {}, c = t.command_template || {};
  const pair = TYPE_PAIRS[d.type] || TYPE_PAIRS.archivo;
  return {
    ...t, name: d.name.trim() || t.name, status: d.status, places_query: d.places_query.trim(), match_keywords: d.match_keywords.split(",").map((x) => x.trim()).filter(Boolean),
    website_template: { ...w, sections: d.sections, hero_patterns: lines(d.hero), services: lines(d.services), faq: lines(d.faq).map((l) => { const [q, ...a] = l.split("|"); return { q: q.trim(), a: a.join("|").trim() }; }).filter((f) => f.q), palette: d.palette, type: { pair: d.type, display: pair.display, body: pair.body, note: pair.note }, seo: { ...(w.seo || {}), pages: d.seo } },
    command_template: { ...c, modules: lines(d.modules).map((l) => { const [k, ...rest] = l.split(":"); return { key: k.trim().toLowerCase().replace(/\s+/g, "_"), label: (rest.join(":").trim() || k.trim()) }; }), pipeline: lines(d.pipeline), sample: { ...(c.sample || {}), services: lines(d.services) } },
  };
}
export { seoOk };
