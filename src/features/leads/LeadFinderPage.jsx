// Lead Finder: pick a state on the map, an industry and optionally a city or county, then search Google Business
// Profiles through the official Places API (New) (lead-finder function). Flags show who needs us most (no website,
// dated site, few reviews, few photos). Bulk-add as leads (deduped by place id / phone / domain); new leads wait in
// the "Approve to build" queue, and approved ones get their template preview built in the background.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, ExternalLink, Globe, KeyRound, Link2, Loader2, MapPin, Phone, Play, Plus, Search, SkipForward, Square, Star, Wrench } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { FLAG_LABEL, PLACES_PRICING, US_STATE_NAMES } from "@/lib/leadEngine";
import UsMap from "./UsMap";
import { engine, finder, useEngine, useFinder, useRefresh, money } from "./api";
import { Card, Pill, Loading, ErrorNote, Empty, btn, btnFlame, btnInk, input } from "./ui";

const FLAG_TONE = { no_website: "red", dated: "amber", few_reviews: "amber", few_photos: "muted" };

export default function LeadFinderPage({ embedded = false }) {
  const status = useFinder("status");
  const tpl = useEngine("templates");
  const [tab, setTab] = useState(() => (new URLSearchParams(window.location.search).get("tab") === "queue" ? "queue" : "search"));
  const queue = useEngine("queue", {}, { refetchInterval: tab === "queue" ? 15000 : false });
  const cfg = status.data || {};
  const qc = queue.data?.counts || {};
  return (
    <div className={embedded ? "" : "pb-20"}>
      {embedded ? null : (
        <PageHeader breadcrumb="Lead Engine / Lead Finder" title="Lead /Finder" rightText={cfg.usage ? `${cfg.usage.month_requests} searches this month · ≈${money(cfg.usage.month_est_usd)} at Google list price` : ""} />
      )}
      <div className={embedded ? "space-y-4" : "space-y-5 px-4 pt-6 md:px-8"}>
        <div role="tablist" className="flex gap-1 border-b border-hair">
          {[["search", "Find businesses"], ["queue", `Approve to build${qc.pending ? ` (${qc.pending})` : ""}`]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`relative h-10 px-3 text-[13px] font-medium ${tab === k ? "text-ink" : "text-ink/50 hover:text-ink"}`}>{l}{tab === k ? <span className="absolute inset-x-3 -bottom-px h-[2px] bg-[#ff3c00]" /> : null}</button>
          ))}
        </div>
        {tab === "search" ? <SearchTab cfg={cfg} loading={status.isLoading} templates={tpl.data?.templates || []} staff={cfg.staff} onAdded={() => { queue.refetch(); status.refetch(); }} /> : <QueueTab q={queue} admin={cfg.staff?.kind === "admin"} />}
      </div>
    </div>
  );
}

function SetupCard() {
  return (
    <Card kicker="Setup" title="Connect Google Places to search" testid="places-setup">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center flame-bg text-white"><KeyRound className="h-4 w-4" /></span>
        <div className="text-[13px] leading-relaxed text-ink/75">
          <p>Add <b className="font-mono text-[12px]">GOOGLE_PLACES_API_KEY</b> in Settings → Secrets. Create it in Google Cloud (justin@interstellar-strategies.com) with <b>Places API (New)</b> enabled and billing on, restricted to the Places API.</p>
          <p className="mt-1 text-ink/55">Until then, everything else works: paste a Google Business Profile link below to add a lead by hand.</p>
        </div>
      </div>
    </Card>
  );
}

function SearchTab({ cfg, loading, templates, staff, onAdded }) {
  const refresh = useRefresh();
  const [state, setState] = useState("");
  const allowed = staff?.kind === "sales" && !(staff.multi_industry_ready && !(staff.allowed_industries || []).length) ? new Set(staff.allowed_industries || []) : null;
  const list = templates.filter((t) => !allowed || allowed.has(t.industry_key));
  const [ind, setInd] = useState("");
  const industry = ind || list[0]?.industry_key || "";
  const [place, setPlace] = useState("");
  const [res, setRes] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [checks, setChecks] = useState({});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [approve, setApprove] = useState(false);

  const search = async (more = false) => {
    if (!state) { setErr("Pick a state on the map first."); return; }
    setBusy(more ? "more" : "search"); setErr(""); setMsg("");
    try {
      const r = await finder("search", { state, industry_key: industry, place, page_token: more ? res?.next_page_token : undefined, page: more ? (res?.page || 1) + 1 : 1 });
      setRes(more ? { ...r, results: [...(res?.results || []), ...r.results] } : r);
      if (!more) { setSel(new Set()); setChecks({}); }
    } catch (e) { setErr(e.message); }
    setBusy("");
  };
  const checkSites = async () => {
    const urls = (res?.results || []).filter((p) => p.website && !checks[p.website]).map((p) => p.website);
    if (!urls.length) return;
    setBusy("check"); setErr("");
    try {
      for (let i = 0; i < urls.length; i += 10) {
        const r = await finder("check_sites", { urls: urls.slice(i, i + 10) });
        setChecks((c) => ({ ...c, ...(r.checks || {}) }));
      }
    } catch (e) { setErr(e.message); }
    setBusy("");
  };
  const add = async () => {
    const places = (res?.results || []).filter((p) => sel.has(p.place_id)).map((p) => ({ ...p, site_check: checks[p.website] && !checks[p.website].error ? checks[p.website] : null }));
    if (!places.length) return;
    setBusy("add"); setErr(""); setMsg("");
    try {
      const r = await finder("add_leads", { places, industry_key: industry, state, approve });
      setMsg(`${r.created.length} added${approve ? " and queued to build" : " to Approve to build"}${r.skipped.length ? ` · ${r.skipped.length} already in the CRM` : ""}.`);
      const added = new Set((r.created || []).map((x) => x.business));
      setRes((x) => ({ ...x, results: x.results.map((p) => (added.has(p.name) ? { ...p, existing: { business: p.name, status: "Lead" } } : p)) }));
      setSel(new Set()); refresh(); onAdded();
    } catch (e) { setErr(e.message); }
    setBusy("");
  };
  const results = res?.results || [];
  const flagsOf = (p) => [...(p.flags || []), ...(checks[p.website]?.dated ? ["dated"] : [])];
  const selectable = results.filter((p) => !p.existing);
  const allOn = selectable.length && selectable.every((p) => sel.has(p.place_id));

  return (
    <div className="space-y-4">
      {!loading && !cfg.configured ? <SetupCard /> : null}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card kicker="Step 1" title={state ? US_STATE_NAMES[state] : "Pick a state"} pad={false}>
          <div className="p-3"><UsMap value={state} onPick={(s) => { setState(s); setRes(null); }} /></div>
        </Card>
        <div className="space-y-4">
          <Card kicker="Step 2" title="What and where">
            <div className="space-y-2.5">
              <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Industry</span>
                <select value={industry} onChange={(e) => setInd(e.target.value)} className={`${input} mt-1`}>{list.map((t) => <option key={t.industry_key} value={t.industry_key}>{t.name}</option>)}</select></label>
              <label className="block"><span className="mono-label text-[9.5px] text-ink/50">City or county (optional)</span>
                <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={state ? `Anywhere in ${US_STATE_NAMES[state]}` : "e.g. Clackamas County"} className={`${input} mt-1`} onKeyDown={(e) => { if (e.key === "Enter") search(); }} /></label>
              <button type="button" onClick={() => search()} disabled={!cfg.configured || !!busy || !state || !industry} className={`${btnFlame} w-full justify-center`}>{busy === "search" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}Search Google Business Profiles</button>
              <p className="text-[11.5px] leading-relaxed text-ink/50">≈ ${PLACES_PRICING.per_request_usd.toFixed(3)} per search page of up to 20 businesses ({PLACES_PRICING.sku}, Google list price; first {PLACES_PRICING.free_per_month.toLocaleString()} a month free; checked {PLACES_PRICING.checked}). Billed by Google to your Cloud account.</p>
            </div>
          </Card>
          <ManualAdd templates={list} state={state} onAdded={() => { refresh(); onAdded(); }} />
        </div>
      </div>
      {err ? <ErrorNote error={err} /> : null}
      {msg ? <p role="status" className="border border-green-200 bg-green-50 px-3 py-2 text-[12.5px] text-green-800">{msg}</p> : null}
      {res ? (
        <Card kicker={`Results from Google · ${res.query}`} title={`${results.length} businesses`} pad={false} testid="finder-results"
          right={<div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={checkSites} disabled={!!busy || !results.some((p) => p.website)} className={btn}>{busy === "check" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}Check sites</button>
            <label className="flex items-center gap-1.5 text-[12px] text-ink/65"><input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} className="accent-[#ff3c00]" />Approve to build now</label>
            <button type="button" onClick={add} disabled={!!busy || !sel.size} className={btnFlame}>{busy === "add" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Add {sel.size || ""} as leads</button>
          </div>}>
          {!results.length ? <Empty icon={MapPin} title="Nothing found" hint="Try a different city or county, or the whole state." /> : (
            <>
              <div className="flex items-center gap-2 border-b border-hair px-4 py-2 text-[12px] text-ink/60">
                <button type="button" onClick={() => setSel(allOn ? new Set() : new Set(selectable.map((p) => p.place_id)))} className="inline-flex items-center gap-1.5 hover:text-ink">{allOn ? <CheckSquare className="h-4 w-4 text-[#ff3c00]" /> : <Square className="h-4 w-4" />}Select all new</button>
                <span className="ml-auto">{results.filter((p) => !p.website).length} with no website · {results.filter((p) => p.existing).length} already in the CRM</span>
              </div>
              <ul className="divide-y divide-hair">{results.map((p) => {
                const on = sel.has(p.place_id);
                const ck = checks[p.website];
                return (
                  <li key={p.place_id} className={`grid gap-3 px-4 py-3 md:grid-cols-[24px_1.4fr_1fr_auto] ${p.existing ? "opacity-60" : ""}`}>
                    <button type="button" disabled={!!p.existing} onClick={() => setSel((s) => { const n = new Set(s); n.has(p.place_id) ? n.delete(p.place_id) : n.add(p.place_id); return n; })} aria-label={`Select ${p.name}`} className="mt-0.5 self-start">{on ? <CheckSquare className="h-4 w-4 text-[#ff3c00]" /> : <Square className="h-4 w-4 text-ink/40" />}</button>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold tracking-[-0.01em]">{p.name}{p.existing ? <Pill tone="ink">In CRM</Pill> : null}</p>
                      <p className="text-[12px] text-ink/55">{p.category || "Business"} · {p.address}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">{flagsOf(p).map((f) => <Pill key={f} tone={FLAG_TONE[f]}>{FLAG_LABEL[f] || f}</Pill>)}{ck?.reasons?.filter((r) => r !== "table_layout").map((r) => <Pill key={r} tone="muted">{FLAG_LABEL[r] || r}</Pill>)}{ck?.error ? <Pill tone="muted" title={ck.error}>site unreachable</Pill> : null}</div>
                    </div>
                    <div className="space-y-1 text-[12.5px]">
                      <p className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-[#ff6a00]" />{p.rating != null ? `${p.rating} · ${p.review_count} reviews` : "No rating yet"}{p.photo_count != null ? <span className="text-ink/45"> · {p.photo_count >= 10 ? "10+" : p.photo_count} photos</span> : null}</p>
                      {p.phone ? <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 hover:text-[#ff3c00]"><Phone className="h-3.5 w-3.5" />{p.phone}</a> : <p className="text-ink/45">No phone listed</p>}
                      {p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 hover:text-[#ff3c00]"><Globe className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span></a> : <p className="flex items-center gap-1.5 font-medium text-red-700"><Globe className="h-3.5 w-3.5" />No website</p>}
                    </div>
                    <a href={p.maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 self-start text-[12px] text-ink/60 hover:text-[#ff3c00]">Google Maps<ExternalLink className="h-3 w-3" /></a>
                  </li>
                );
              })}</ul>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hair px-4 py-2.5 text-[11px] text-ink/45">
                <span>Business data © Google. Stored as a 30-day cache (refreshed on view); place IDs kept.</span>
                {res.next_page_token ? <button type="button" onClick={() => search(true)} disabled={!!busy} className={btn}>{busy === "more" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Load 20 more (≈ ${PLACES_PRICING.per_request_usd.toFixed(3)})</button> : null}
              </div>
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function ManualAdd({ templates, state, onAdded }) {
  const [f, setF] = useState({ gbp_url: "", business: "", phone: "", website: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [ind, setInd] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setNote("");
    try { const r = await finder("add_manual", { ...f, state, industry_key: ind }); setNote(`Added ${r.created[0].business} to Approve to build.`); setF({ gbp_url: "", business: "", phone: "", website: "", city: "" }); onAdded(); } catch (e2) { setNote(e2.message); }
    setBusy(false);
  };
  return (
    <Card kicker="Or" title="Paste a Google Business Profile link">
      <form onSubmit={submit} className="space-y-2">
        <div className="relative"><Link2 className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-ink/35" /><input value={f.gbp_url} onChange={set("gbp_url")} placeholder="https://maps.app.goo.gl/…" aria-label="Google Business Profile link" className={`${input} pl-8`} /></div>
        <div className="grid grid-cols-2 gap-2">
          <input value={f.business} onChange={set("business")} placeholder="Business name" aria-label="Business name" className={input} />
          <input value={f.phone} onChange={set("phone")} placeholder="Phone" aria-label="Phone" className={input} />
          <input value={f.website} onChange={set("website")} placeholder="Website (if any)" aria-label="Website" className={input} />
          <input value={f.city} onChange={set("city")} placeholder="City" aria-label="City" className={input} />
        </div>
        <div className="flex gap-2">
          <select value={ind} onChange={(e) => setInd(e.target.value)} aria-label="Industry" className={`${input} flex-1`}><option value="">Industry: detect</option>{templates.map((t) => <option key={t.industry_key} value={t.industry_key}>{t.name}</option>)}</select>
          <button type="submit" disabled={busy || !f.gbp_url} className={btnInk}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Add</button>
        </div>
        {note ? <p className="text-[12px] text-ink/65" role="status">{note}</p> : null}
      </form>
    </Card>
  );
}

const Q_TONE = { pending: "amber", queued: "muted", building: "flame", ready: "green", failed: "red", skipped: "muted" };
function QueueTab({ q, admin }) {
  const refresh = useRefresh();
  const [filter, setFilter] = useState("pending");
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const items = q.data?.items || [];
  const shown = useMemo(() => items.filter((i) => filter === "all" || i.queue?.status === filter), [items, filter]);
  const decide = async (decision, ids = [...sel]) => {
    if (!ids.length) return;
    setBusy(decision); setMsg("");
    try { const r = await engine("queue_decide", { ids, decision }); setMsg(`${r.updated} ${decision === "approve" ? "approved: they build in the background" : "skipped"}.`); setSel(new Set()); q.refetch(); refresh(); } catch (e) { setMsg(e.message); }
    setBusy("");
  };
  const runNow = async () => { setBusy("run"); setMsg(""); try { const r = await engine("queue_run"); setMsg(r.reason || `${r.ran} worked this run · ${r.built_today}/${r.daily_cap} built today.`); q.refetch(); } catch (e) { setMsg(e.message); } setBusy(""); };
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const counts = q.data?.counts || {};
  return (
    <Card kicker={`Daily cap ${q.data?.daily_cap ?? 25} · ${q.data?.built_today ?? 0} built today · template-rendered, no app per lead`} title="Approve to build" pad={false} testid="build-queue"
      right={<div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => decide("approve")} disabled={!sel.size || !!busy} className={btnFlame}>{busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}Approve {sel.size || ""}</button>
        <button type="button" onClick={() => decide("skip")} disabled={!sel.size || !!busy} className={btn}><SkipForward className="h-3.5 w-3.5" />Skip</button>
        {admin ? <button type="button" onClick={runNow} disabled={!!busy} className={btnInk}>{busy === "run" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}Run queue now</button> : null}
      </div>}>
      <div className="flex flex-wrap gap-1.5 border-b border-hair px-4 py-2.5">
        {["pending", "queued", "building", "ready", "failed", "skipped", "all"].map((k) => <button key={k} type="button" onClick={() => { setFilter(k); setSel(new Set()); }} className={`px-2.5 py-1 text-[12px] ${filter === k ? "bg-ink text-white" : "border border-hair bg-card hover:border-ink/40"}`}>{k} <span className="font-mono text-[10px] opacity-60">{k === "all" ? items.length : counts[k] || 0}</span></button>)}
      </div>
      {msg ? <p className="border-b border-hair px-4 py-2 text-[12.5px] text-ink/70" role="status">{msg}</p> : null}
      {!shown.length ? <Empty title={filter === "pending" ? "Nothing waiting for approval" : `Nothing ${filter}`} hint="Add businesses from the search tab; they land here to approve before anything is built." /> : (
        <ul className="divide-y divide-hair">{shown.map((i) => {
          const on = sel.has(i.id);
          return (
            <li key={i.id} className="grid items-center gap-3 px-4 py-2.5 md:grid-cols-[24px_1.5fr_1fr_1.2fr_auto]">
              <button type="button" onClick={() => setSel((s) => { const n = new Set(s); n.has(i.id) ? n.delete(i.id) : n.add(i.id); return n; })} aria-label={`Select ${i.business}`}>{on ? <CheckSquare className="h-4 w-4 text-[#ff3c00]" /> : <Square className="h-4 w-4 text-ink/40" />}</button>
              <div className="min-w-0"><Link to={`/clients/${i.id}`} className="truncate text-[13.5px] font-medium hover:text-[#ff3c00]">{i.business}</Link><p className="text-[11.5px] text-ink/50">{[i.city, i.state].filter(Boolean).join(", ")}{i.assigned_rep_name ? ` · ${i.assigned_rep_name}` : ""}</p></div>
              <div className="flex flex-wrap gap-1">{(i.lead_flags || []).map((f) => <Pill key={f} tone={FLAG_TONE[f]}>{FLAG_LABEL[f] || f}</Pill>)}</div>
              <p className="text-[12px] text-ink/60">{i.queue?.reason || (i.rating != null ? `${i.rating}★ · ${i.reviews} reviews` : "")}</p>
              <Pill tone={Q_TONE[i.queue?.status]}>{i.queue?.status}{i.queue?.attempts ? ` · try ${i.queue.attempts}` : ""}</Pill>
            </li>
          );
        })}</ul>
      )}
    </Card>
  );
}
