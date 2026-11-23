// One lead, end to end (admins and reps): research → template preview → edit / light variation → Ready →
// presentation pack → portal invite → engagement → deal. Previews are template-rendered from the lead's data:
// no app is created per lead; a real app is built only after a deal is signed.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Bot, CheckCircle2, ExternalLink, Eye, Hammer, Loader2, Mail, Phone, RefreshCw, Sparkles, X, ArrowUp, ArrowDown } from "lucide-react";
import { FLAG_LABEL, SEO_LIMITS, seoOk } from "@/lib/leadEngine";
import { engine, useEngine, useRefresh, ago, mins, shortDate, money } from "./api";
import { Card, Pill, Loading, ErrorNote, Stat, btn, btnFlame, btnInk, input, area, STATUS_TONE } from "./ui";
import WebsitePreview from "./WebsitePreview";
import CommandPreview from "./CommandPreview";
import PreviewFrame from "./PreviewFrame";
import LeadPortalView from "./LeadPortalView";
import InviteDialog from "./InviteDialog";
import PresentationPack from "./PresentationPack";
import DealPanel from "./DealPanel";

const HEAT_TONE = { hottest: "red", hot: "flame", booked: "green", warm: "amber", cold: "muted" };

export default function LeadWorkspacePage() {
  const { id } = useParams();
  return <LeadWorkspace id={id} />;
}

export function LeadWorkspace({ id, compact = false }) {
  const q = useEngine("lead", { client_id: id }, { enabled: !!id });
  const refresh = useRefresh();
  const [tab, setTab] = useState("website");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [invite, setInvite] = useState(false);
  const [portal, setPortal] = useState(false);
  const d = q.data;
  const reload = () => { q.refetch(); refresh(); };
  const act = async (key, action, args = {}, done) => {
    setBusy(key); setErr(""); setMsg("");
    try { const r = await engine(action, { client_id: id, ...args }); if (done) setMsg(typeof done === "function" ? done(r) : done); reload(); return r; } catch (e) { setErr(e.message); }
    finally { setBusy(""); }
    return null;
  };
  if (q.isLoading) return <Loading />;
  if (q.isError) return <div className="p-6"><ErrorNote error={q.error} /></div>;
  const c = d.client, p = d.preview;
  const e = p?.engagement || {};
  const s = c.scrape_summary || null;
  const phone = (c.phones || [])[0] || c.gbp_cache?.phone || "";
  const site = (c.websites || [])[0] || c.gbp_cache?.website || "";

  return (
    <div className={compact ? "" : "pb-20"}>
      {!compact ? (
        <div className="border-b border-hair px-4 pb-5 pt-6 md:px-8">
          <Link to="/leads/desk" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45 hover:text-[#ff3c00]"><ArrowLeft className="h-3 w-3" />Call sheet</Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="ms-kicker">{d.template?.name || c.industry || "Lead"}<span className="text-ink/30">·</span><span className="text-ink/45">{[c.city, c.state].filter(Boolean).join(", ") || c.location || "Location not found"}</span></p>
              <h1 className="mt-2 text-[32px] font-semibold leading-[0.98] tracking-[-0.045em] md:text-[44px]">{c.business}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Pill tone={HEAT_TONE[d.heat]}>{d.heat}</Pill>
                {p ? <Pill tone={STATUS_TONE[p.status]}>preview {p.status} · v{p.version}</Pill> : <Pill>no preview</Pill>}
                {(c.lead_flags || []).map((f) => <Pill key={f} tone="amber">{FLAG_LABEL[f] || f}</Pill>)}
                {c.do_not_contact ? <Pill tone="red">do not contact</Pill> : null}
                {c.assigned_rep_name ? <Pill tone="ink">{c.assigned_rep_name}</Pill> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {phone && !c.do_not_contact ? <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={btnInk}><Phone className="h-3.5 w-3.5" />{phone}</a> : null}
              {site ? <a href={site} target="_blank" rel="noreferrer" className={btn}>Current site<ExternalLink className="h-3 w-3" /></a> : <Pill tone="red">No website</Pill>}
              {c.gbp_url ? <a href={c.gbp_url} target="_blank" rel="noreferrer" className={btn}>Google<ExternalLink className="h-3 w-3" /></a> : null}
            </div>
          </div>
          <span className="pointer-events-none mt-5 block h-[2px] w-40 flame-bg" />
        </div>
      ) : null}

      <div className={compact ? "space-y-4" : "space-y-4 px-4 pt-5 md:px-8"}>
        <div className="flex flex-wrap items-center gap-2 border border-hair bg-paper/85 p-3" data-testid="lead-actions">
          <p className="mr-auto text-[12.5px] text-ink/70"><b className="font-medium text-ink">Next:</b> {d.next?.label} <span className="text-ink/50">· {d.next?.why}</span></p>
          <button type="button" onClick={() => act("agent", "agent_run", {}, (r) => (r.results?.[0]?.steps?.length ? `Agent: ${r.results[0].steps.join("; ")}.` : "Agent: nothing to do; next step is yours."))} disabled={!!busy} className={btn} title="Research, draft the preview, prep the pack, suggest the next step. Never sends anything.">{busy === "agent" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}Run lead agent</button>
          <button type="button" onClick={() => act("scrape", "scrape", {}, "Research saved to the Brain.")} disabled={!!busy} className={btn}>{busy === "scrape" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{s ? "Research again" : "Research"}</button>
          <button type="button" onClick={() => act("build", "build_preview", {}, (r) => `Preview v${r.preview?.version} built${r.missing?.length ? ` · stand-ins for: ${r.missing.join(", ")}` : ""}.`)} disabled={!!busy} className={btn}>{busy === "build" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hammer className="h-3.5 w-3.5" />}{p ? "Rebuild preview" : "Build preview"}</button>
          {p && p.status === "draft" ? <button type="button" onClick={() => act("ready", "preview_status", { status: "ready" }, "Marked Ready to show.")} disabled={!!busy} className={btnFlame}><CheckCircle2 className="h-3.5 w-3.5" />Ready to show</button> : null}
          {p ? <button type="button" onClick={() => setPortal(true)} className={btn}><Eye className="h-3.5 w-3.5" />Their portal</button> : null}
          {p && p.status !== "draft" && !c.do_not_contact ? <button type="button" onClick={() => setInvite(true)} className={btnFlame}><Mail className="h-3.5 w-3.5" />Send portal access</button> : null}
        </div>
        {err ? <ErrorNote error={err} /> : null}
        {msg ? <p role="status" className="border border-green-200 bg-green-50 px-3 py-2 text-[12.5px] text-green-800">{msg}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="First login" value={e.first_login_at ? ago(e.first_login_at) : "—"} hint={p?.sent_at ? `Invite sent ${shortDate(p.sent_at)}` : "Not invited yet"} />
          <Stat label="Sessions" value={e.sessions || 0} hint={e.last_seen_at ? `Last seen ${ago(e.last_seen_at)}` : "No visits yet"} />
          <Stat label="Time on website" value={mins(e.seconds?.website)} hint={`${e.views?.website || 0} views`} />
          <Stat label="Time in system" value={mins(e.seconds?.command)} hint={`${e.views?.command || 0} views`} />
          <Stat label="Walkthrough" value={e.walkthrough_booked_at ? "Booked" : c.desk_outcome === "booked" ? "Booked" : "—"} hint={c.lead_incentive?.status ? `$${c.lead_incentive.amount || 30} ${c.lead_incentive.status}${c.lead_incentive.method ? ` · ${c.lead_incentive.method}` : ""}` : "$30 not owed yet"} accent={e.walkthrough_booked_at ? "#15803d" : undefined} />
        </div>

        <div role="tablist" className="flex flex-wrap gap-1 border-b border-hair">
          {[["website", "Website"], ["command", "Command System"], ["edit", "Edit & vary"], ["pack", "Presentation"], ["deal", "Deal"], ["activity", "Activity"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`relative h-10 px-3 text-[13px] font-medium ${tab === k ? "text-ink" : "text-ink/50 hover:text-ink"}`}>{l}{tab === k ? <span className="absolute inset-x-3 -bottom-px h-[2px] bg-[#ff3c00]" /> : null}</button>
          ))}
        </div>

        {!p && ["website", "command", "edit", "pack"].includes(tab) ? (
          <Card><p className="text-[13px] text-ink/65">No preview yet. {s ? "Research is in: click Build preview." : "Research the lead, then Build preview (or run the lead agent to do both)."} It renders instantly from the {d.template?.name || "industry"} template with their name, city, services and colors.</p></Card>
        ) : null}
        {p && tab === "website" ? <PreviewFrame height={720} label={`Website · ${p.website_config?.seo?.title || ""}`}><WebsitePreview config={p.website_config} /></PreviewFrame> : null}
        {p && tab === "command" ? <CommandPreview config={p.command_config} /> : null}
        {p && tab === "edit" ? <EditPanel p={p} onSave={(overrides, note) => act("save", "preview_patch", { overrides, note }, "Saved. Rebuilds keep these edits.")} busy={busy === "save"} templates={d.templates} onRetemplate={(k) => act("build", "build_preview", { industry_key: k }, "Rebuilt from the new template.")} /> : null}
        {tab === "pack" ? <PresentationPack pack={p?.presentation} onGenerate={() => act("pack", "presentation", {}, "Presentation pack ready.")} busy={busy === "pack"} disabled={!p} /> : null}
        {tab === "deal" ? <DealPanel client={c} /> : null}
        {tab === "activity" ? <Activity d={d} onAssign={(rep_id) => act("assign", "assign", { rep_id }, "Assigned.")} onTier={(tier) => act("tier", "set_tier", { tier }, `Portal tier set to ${tier}. Nothing deleted.`)} onDnc={(on) => act("dnc", "dnc_set", { on }, on ? "Marked do-not-contact." : "Do-not-contact removed.")} /> : null}
      </div>

      <InviteDialog lead={c} open={invite} onClose={() => setInvite(false)} onSent={reload} />
      {portal && d.portal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas" role="dialog" aria-modal="true" aria-label="Their portal">
          <button type="button" onClick={() => setPortal(false)} className="fixed right-3 top-12 z-[60] inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-[12.5px] text-white hover:bg-[#ff3c00]"><X className="h-3.5 w-3.5" />Close</button>
          <LeadPortalView d={d.portal} preview previewNote={`Their portal, exactly as ${c.business} will see it after logging in.`} onBook={() => {}} />
        </div>
      ) : null}
    </div>
  );
}

function EditPanel({ p, onSave, busy, templates, onRetemplate }) {
  const base = p.website_base || p.website_config || {};
  const o0 = p.website_overrides || {};
  const [hero, setHero] = useState({ headline: "", sub: "", kicker: "", cta_primary: "", ...(o0.hero || {}) });
  const [secs, setSecs] = useState(o0.sections || {});
  const [order, setOrder] = useState(() => (o0.order?.length ? o0.order : (base.sections || []).map((x) => x.key)));
  const [accent, setAccent] = useState(o0.theme?.primary || "");
  const [heroImg, setHeroImg] = useState(o0.hero_image ?? null);
  const [seo, setSeo] = useState({ title: "", description: "", ...(o0.seo || {}) });
  const [note, setNote] = useState("");
  const [tk, setTk] = useState(p.industry_key);
  useEffect(() => { setOrder((o) => (o.length ? o : (base.sections || []).map((x) => x.key))); }, [base.sections]);
  const byKey = useMemo(() => Object.fromEntries((base.sections || []).map((x) => [x.key, x])), [base.sections]);
  const mv = (i, d) => setOrder((o) => { const a = [...o]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const curTitle = seo.title || base.seo?.title || "", curDesc = seo.description || base.seo?.description || "";
  const ok = seoOk(curTitle, curDesc);
  const save = () => onSave({ hero: Object.fromEntries(Object.entries(hero).filter(([, v]) => String(v || "").trim())), sections: secs, order, ...(accent ? { theme: { primary: accent } } : { theme: {} }), ...(heroImg !== null ? { hero_image: heroImg } : {}), seo: Object.fromEntries(Object.entries(seo).filter(([, v]) => String(v || "").trim())) }, note);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Hero" kicker="Leave blank to keep the template's words">
        <div className="space-y-2">
          {[["kicker", "Kicker", base.hero?.kicker], ["headline", "Headline", base.hero?.headline], ["sub", "Subhead", base.hero?.sub], ["cta_primary", "Main button", base.hero?.cta_primary]].map(([k, l, ph]) => (
            <label key={k} className="block"><span className="mono-label text-[9.5px] text-ink/50">{l}</span><input value={hero[k] || ""} onChange={(e) => setHero((h) => ({ ...h, [k]: e.target.value }))} placeholder={ph} className={`${input} mt-1`} /></label>
          ))}
        </div>
      </Card>
      <Card title="Light variation" kicker="Same structure, their look">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[12.5px]"><input type="color" value={accent || base.theme?.primary || "#ff3c00"} onChange={(e) => setAccent(e.target.value)} className="h-9 w-9 cursor-pointer border border-hair bg-transparent p-0" aria-label="Accent color" />Accent color (match their logo)</label>
            {accent ? <button type="button" onClick={() => setAccent("")} className="text-[12px] text-ink/55 hover:text-ink">Reset</button> : null}
          </div>
          <div>
            <p className="mono-label text-[9.5px] text-ink/50">Hero photo (their own site photos only)</p>
            {(base.images || []).length ? <div className="mt-2 grid grid-cols-4 gap-2">{base.images.map((u) => <button key={u} type="button" onClick={() => setHeroImg(u)} className={`aspect-square overflow-hidden border-2 ${((heroImg ?? base.hero?.image) === u) ? "border-[#ff3c00]" : "border-transparent"}`}><img src={u} alt="" className="h-full w-full object-cover" /></button>)}<button type="button" onClick={() => setHeroImg("")} className={`aspect-square border-2 text-[11px] text-ink/55 ${heroImg === "" ? "border-[#ff3c00]" : "border-hair"}`}>Placeholder</button></div> : <p className="mt-1 text-[12.5px] text-ink/55">No photos found on their site, so a tasteful placeholder leads. Never Google photos.</p>}
          </div>
          <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Template</span>
            <div className="mt-1 flex gap-2"><select value={tk} onChange={(e) => setTk(e.target.value)} className={`${input} flex-1`}>{(templates || []).map((t) => <option key={t.industry_key} value={t.industry_key}>{t.name}</option>)}</select><button type="button" disabled={tk === p.industry_key} onClick={() => onRetemplate(tk)} className={btn}><RefreshCw className="h-3.5 w-3.5" />Rebuild</button></div></label>
        </div>
      </Card>
      <Card title="Sections" kicker="Order, show or hide, edit words">
        <ul className="divide-y divide-hair">{order.filter((k) => byKey[k]).map((k, i) => {
          const sx = byKey[k], ov = secs[k] || {};
          const on = typeof ov.enabled === "boolean" ? ov.enabled : sx.enabled !== false;
          return (
            <li key={k} className="py-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={on} onChange={(e) => setSecs((x) => ({ ...x, [k]: { ...(x[k] || {}), enabled: e.target.checked } }))} className="accent-[#ff3c00]" aria-label={`Show ${sx.label}`} />
                <span className="flex-1 text-[13px] font-medium">{sx.label}</span>
                <button type="button" onClick={() => mv(i, -1)} aria-label="Move up" className="text-ink/40 hover:text-ink"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => mv(i, 1)} aria-label="Move down" className="text-ink/40 hover:text-ink"><ArrowDown className="h-3.5 w-3.5" /></button>
              </div>
              {sx.title !== undefined ? <input value={ov.title || ""} onChange={(e) => setSecs((x) => ({ ...x, [k]: { ...(x[k] || {}), title: e.target.value } }))} placeholder={sx.title} className="mt-1.5 h-8 w-full border border-hair bg-paper px-2 text-[12.5px] outline-none focus:border-[#ff3c00]" aria-label={`${sx.label} title`} /> : null}
              {["about", "area"].includes(sx.type) ? <textarea rows={2} value={ov.body || ""} onChange={(e) => setSecs((x) => ({ ...x, [k]: { ...(x[k] || {}), body: e.target.value } }))} placeholder={sx.body || "Short paragraph (only real facts)"} className="mt-1.5 w-full border border-hair bg-paper px-2 py-1.5 text-[12.5px] outline-none focus:border-[#ff3c00]" aria-label={`${sx.label} text`} /> : null}
            </li>
          );
        })}</ul>
      </Card>
      <Card title="Search title & description" kicker={`${SEO_LIMITS.title.join("–")} / ${SEO_LIMITS.description.join("–")} characters`}>
        <input value={seo.title} onChange={(e) => setSeo((x) => ({ ...x, title: e.target.value }))} placeholder={base.seo?.title} className={input} aria-label="Search title" />
        <p className={`mt-1 font-mono text-[10.5px] ${ok.title_ok ? "text-green-700" : "text-[#c24100]"}`}>{ok.title_len} characters</p>
        <textarea rows={3} value={seo.description} onChange={(e) => setSeo((x) => ({ ...x, description: e.target.value }))} placeholder={base.seo?.description} className={`${area} mt-2`} aria-label="Search description" />
        <p className={`mt-1 font-mono text-[10.5px] ${ok.description_ok ? "text-green-700" : "text-[#c24100]"}`}>{ok.desc_len} characters</p>
      </Card>
      <div className="flex flex-col gap-2 border border-hair bg-paper/95 p-3 md:flex-row xl:col-span-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you changed (logged)" className={input} aria-label="Edit note" />
        <button type="button" onClick={save} disabled={busy} className={`${btnFlame} shrink-0`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Save edits</button>
      </div>
    </div>
  );
}

function Activity({ d, onAssign, onTier, onDnc }) {
  const c = d.client, p = d.preview;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Follow-ups" kicker="From calls and portal engagement">
        {(d.tasks || []).length ? <ul className="divide-y divide-hair">{d.tasks.map((t) => <li key={t.id} className="flex items-start justify-between gap-3 py-2 text-[12.5px]"><div><p className="font-medium">{t.kind.replace(/_/g, " ")}</p><p className="text-ink/55">{t.reason}</p></div><div className="text-right"><Pill tone={t.status === "open" ? "flame" : "muted"}>{t.status}</Pill><p className="mt-1 font-mono text-[10.5px] text-ink/45">{new Date(t.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p></div></li>)}</ul> : <p className="text-[12.5px] text-ink/55">No follow-ups yet.</p>}
      </Card>
      <Card title="Calls and notes">
        {(d.calls || []).length ? <ul className="max-h-80 divide-y divide-hair overflow-y-auto">{d.calls.map((x) => <li key={x.id} className="py-2 text-[12.5px]"><p className="flex justify-between gap-2"><b className="font-medium">{x.outcome.replace(/_/g, " ")}</b><span className="font-mono text-[10.5px] text-ink/45">{ago(x.at)}</span></p>{x.note ? <p className="text-ink/60">{x.note}</p> : null}<p className="text-[11px] text-ink/40">{x.caller}</p></li>)}</ul> : <p className="text-[12.5px] text-ink/55">No calls yet.</p>}
      </Card>
      <Card title="Build log">
        {(p?.build_log || []).length ? <ul className="max-h-64 space-y-1.5 overflow-y-auto">{[...p.build_log].reverse().map((l, i) => <li key={i} className="text-[12px]"><span className="font-mono text-[10.5px] text-ink/45">{shortDate(l.at)}</span> · <b className="font-medium">{l.action}</b> v{l.version} · {l.by}{l.note ? <span className="text-ink/55"> · {l.note}</span> : null}</li>)}</ul> : <p className="text-[12.5px] text-ink/55">Nothing built yet.</p>}
      </Card>
      <Card title="Lead settings">
        <div className="space-y-3 text-[12.5px]">
          {d.admin ? <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Assigned rep</span><select value={c.assigned_rep_id || ""} onChange={(e) => onAssign(e.target.value)} className={`${input} mt-1`}><option value="">Unassigned (Justin)</option>{(d.reps || []).map((r) => <option key={r.id} value={r.id}>{r.name}{r.status !== "active" ? ` (${r.status})` : ""}</option>)}</select></label> : null}
          {d.admin ? <div className="flex flex-wrap items-center gap-2"><span className="text-ink/60">Portal tier:</span><Pill tone="ink">{c.portal_tier || "none"}</Pill><button type="button" onClick={() => onTier("client")} className={btn}>Make client tier</button><button type="button" onClick={() => onTier("lead")} className={btn}>Lead tier</button></div> : null}
          <div className="flex flex-wrap items-center gap-2"><span className="text-ink/60">Do not contact:</span>{c.do_not_contact ? <><Pill tone="red">on</Pill>{d.admin ? <button type="button" onClick={() => onDnc(false)} className={btn}>Remove</button> : null}</> : <button type="button" onClick={() => onDnc(true)} className={btn}>Mark do-not-contact</button>}</div>
          {c.scrape_summary?.owner ? <p>Owner/manager (public): <b className="font-medium">{c.scrape_summary.owner}</b></p> : null}
          {c.scrape_summary?.email ? <p>Public email: <b className="font-medium">{c.scrape_summary.email}</b></p> : null}
          {c.gbp_cache?.fetched_at ? <p className="text-ink/50">Google data cached {ago(c.gbp_cache.fetched_at)} (refreshes after 30 days)</p> : null}
          {p?.missing?.length ? <p className="text-ink/55">Template stand-ins used for: {p.missing.join(", ")}</p> : null}
          {c.lead_incentive?.amount ? <p className="text-ink/55">Incentive: {money(c.lead_incentive.amount)} {c.lead_incentive.status}</p> : null}
        </div>
      </Card>
    </div>
  );
}
