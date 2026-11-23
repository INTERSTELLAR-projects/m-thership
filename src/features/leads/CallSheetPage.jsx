// Lead Desk: the daily call sheet. Built for 100 dials a day: follow-ups due first (hottest leads, callbacks,
// retries, unopened portals), then fresh leads whose preview is Ready. Keyboard-fast: J/K or ↑/↓ to move,
// 1–9 for outcomes, C to call, W/S/P/O to open what we built. "Sent portal" opens the invite email; a person
// clicks Send. No dialer yet: tel: links and one-key logging (Aircall can plug in later).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ChevronDown, ExternalLink, Eye, Flame, Globe, LayoutDashboard, Loader2, MonitorSmartphone, Phone, PhoneCall, Settings2, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { CALL_SCRIPT, fillScript, FLAG_LABEL } from "@/lib/leadEngine";
import { engine, useEngine, useRefresh, ago, leadHref } from "./api";
import { Card, Pill, Loading, ErrorNote, Empty, btn, btnFlame, btnInk, input } from "./ui";
import WebsitePreview from "./WebsitePreview";
import CommandPreview from "./CommandPreview";
import PreviewFrame from "./PreviewFrame";
import LeadPortalView from "./LeadPortalView";
import InviteDialog from "./InviteDialog";

const HEAT_TONE = { hottest: "red", hot: "flame", booked: "green", warm: "amber", cold: "muted" };
const TASK_LABEL = { hot_call: "Hot: call now", callback: "Callback", retry_call: "Retry", portal_reminder: "Portal not opened", prep: "Meeting prep" };

export default function CallSheetPage({ embedded = false, me = null }) {
  const sheet = useEngine("sheet", {}, { refetchInterval: 60000 });
  const refresh = useRefresh();
  const [idx, setIdx] = useState(0);
  const [view, setView] = useState(null); // website | command | portal
  const [invite, setInvite] = useState(null);
  const [settings, setSettings] = useState(false);
  const rows = sheet.data?.rows || [];
  const row = rows[Math.min(idx, Math.max(0, rows.length - 1))] || null;
  const next = useCallback(() => setIdx((i) => Math.min(i + 1, Math.max(0, rows.length - 1))), [rows.length]);
  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  return (
    <div className={embedded ? "" : "pb-20"}>
      {embedded ? null : (
        <PageHeader breadcrumb="Lead Engine / Lead Desk" title="Call /sheet" rightText={`${rows.length} to call`}>
          <button type="button" onClick={() => setSettings(true)} className={btn}><Settings2 className="h-3.5 w-3.5" />Settings</button>
        </PageHeader>
      )}
      <div className={embedded ? "space-y-4" : "space-y-4 px-4 pt-5 md:px-8"}>
        <Counters data={sheet.data} />
        {sheet.isLoading ? <Loading /> : sheet.isError ? <ErrorNote error={sheet.error} /> : !rows.length ? (
          <Card><Empty icon={PhoneCall} title="Nothing to call yet" hint={`Find businesses in Lead Finder and approve them to build; ready previews land here. ${sheet.data?.queue?.building ? `${sheet.data.queue.building} building now.` : ""}${sheet.data?.queue?.pending ? ` ${sheet.data.queue.pending} waiting for approval.` : ""}`} action={<Link to="/leads/finder" className={btnFlame}>Open Lead Finder</Link>} /></Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
            <SheetList rows={rows} idx={idx} setIdx={setIdx} />
            {row ? <CallPanel key={row.client.id} row={row} outcomes={sheet.data.outcomes} onNext={next} onPrev={prev} onView={setView} onInvite={(c) => setInvite(c)} onLogged={() => { sheet.refetch(); refresh(); }} me={me} /> : null}
          </div>
        )}
      </div>
      {view && row ? <ViewModal kind={view} row={row} onClose={() => setView(null)} /> : null}
      <InviteDialog lead={invite} open={!!invite} onClose={() => setInvite(null)} onSent={() => { sheet.refetch(); }} />
      {settings ? <SettingsDrawer onClose={() => setSettings(false)} /> : null}
    </div>
  );
}

function Counters({ data }) {
  const c = data?.counters || {};
  const target = data?.target || 100;
  const pct = Math.min(100, Math.round(((c.dials || 0) / target) * 100));
  const items = [["Dials", c.dials], ["Connects", c.connects], ["Owners", c.owners], ["Portals sent", c.portals], ["Logins", c.logins], ["Meetings", c.meetings], ["Deals", c.deals]];
  return (
    <div className="border border-hair bg-paper/85 p-3" data-testid="call-counters">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-[200px] flex-1">
          <div className="flex items-baseline justify-between"><p className="mono-label text-[9.5px] text-ink/50">Today</p><p className="font-mono text-[12px] tabular-nums"><b className="text-[18px] text-ink">{c.dials || 0}</b> / {target} dials</p></div>
          <div className="mt-1.5 h-2 bg-ink/[0.08]"><div className="h-full flame-bg transition-[width] duration-500" style={{ width: `${pct}%` }} /></div>
        </div>
        {items.slice(1).map(([l, v]) => <div key={l} className="text-center"><p className="text-[20px] font-semibold leading-none tabular-nums">{v || 0}</p><p className="mono-label mt-1 text-[8.5px] text-ink/45">{l}</p></div>)}
      </div>
    </div>
  );
}

function SheetList({ rows, idx, setIdx }) {
  const now = Date.now();
  return (
    <nav aria-label="Call sheet" className="max-h-[calc(100vh-220px)] overflow-y-auto border border-hair bg-paper/85 xl:sticky xl:top-4">
      <ul>{rows.map((r, i) => {
        const c = r.client;
        const due = r.task && Date.parse(r.task.due_at) <= now;
        const on = i === idx;
        return (
          <li key={c.id}>
            <button type="button" onClick={() => setIdx(i)} aria-current={on ? "true" : undefined} className={`block w-full border-b border-hair px-3 py-2.5 text-left ${on ? "bg-ink text-white" : "hover:bg-ink/[0.04]"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] font-semibold">{c.business}</span>
                <span className={`shrink-0 font-mono text-[10px] ${on ? "text-white/60" : "text-ink/40"}`}>{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {r.heat !== "cold" ? <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[9.5px] uppercase ${r.heat === "hottest" ? "bg-red-600 text-white" : r.heat === "hot" ? "bg-[#ff3c00] text-white" : on ? "bg-white/15" : "bg-ink/[0.07] text-ink/70"}`}>{r.heat === "hottest" || r.heat === "hot" ? <Flame className="h-2.5 w-2.5" /> : null}{r.heat}</span> : null}
                {r.task ? <span className={`font-mono text-[9.5px] uppercase ${due ? (on ? "text-[#ffaa00]" : "text-[#c24100]") : on ? "text-white/50" : "text-ink/45"}`}>{TASK_LABEL[r.task.kind] || r.task.kind}{due ? "" : ` · ${new Date(r.task.due_at).toLocaleString("en-US", { weekday: "short", hour: "numeric" })}`}</span> : <span className={`font-mono text-[9.5px] uppercase ${on ? "text-white/50" : "text-ink/45"}`}>{c.desk_last_call_at ? `last ${ago(c.desk_last_call_at)}` : "fresh"}</span>}
                <span className={`text-[11px] ${on ? "text-white/60" : "text-ink/50"}`}>{[c.city, c.state].filter(Boolean).join(", ")}</span>
              </div>
            </button>
          </li>
        );
      })}</ul>
    </nav>
  );
}

function CallPanel({ row, outcomes, onNext, onPrev, onView, onInvite, onLogged, me }) {
  const c = row.client;
  const phone = (c.phones || [])[0] || c.gbp_cache?.phone || "";
  const site = (c.websites || [])[0] || c.gbp_cache?.website || "";
  const rating = c.gbp_cache?.rating ?? c.scrape_summary?.gbp?.rating;
  const reviews = c.gbp_cache?.review_count ?? c.scrape_summary?.gbp?.reviews;
  const owner = c.contact || c.scrape_summary?.owner || "";
  const [note, setNote] = useState("");
  const [cb, setCb] = useState("");
  const [askCb, setAskCb] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [script, setScript] = useState(false);
  const [done, setDone] = useState("");

  const log = useCallback(async (key) => {
    if (busy) return;
    if (key === "callback" && !cb) { setAskCb(true); return; }
    setBusy(key); setErr("");
    try {
      await engine("desk_log", { client_id: c.id, outcome: key, note, callback_at: key === "callback" ? new Date(cb).toISOString() : undefined });
      setDone(outcomes.find((o) => o.key === key)?.label || key);
      if (key === "sent_portal" || key === "staff_portal") onInvite(c);
      onLogged();
      if (!["sent_portal", "staff_portal"].includes(key)) setTimeout(onNext, 350);
    } catch (e) { setErr(e.message); }
    setBusy("");
  }, [busy, c, cb, note, onInvite, onLogged, onNext, outcomes]);

  useEffect(() => {
    const k = (e) => {
      if (e.target.closest("input,textarea,select,[contenteditable],[role=dialog]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const o = outcomes.find((x) => x.hotkey === e.key);
      if (o) { e.preventDefault(); log(o.key); return; }
      const map = { j: onNext, ArrowDown: onNext, k: onPrev, ArrowUp: onPrev, w: () => onView("website"), s: () => onView("command"), p: () => onView("portal"), o: () => site && window.open(site, "_blank", "noopener"), c: () => phone && (window.location.href = `tel:${phone.replace(/[^\d+]/g, "")}`) };
      if (map[e.key]) { e.preventDefault(); map[e.key](); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [log, onNext, onPrev, onView, outcomes, phone, site]);

  const v = { business: c.business, city: c.city || "your area", contact: owner || "the owner", caller: me?.name || "your name" };
  return (
    <section className="min-w-0 space-y-3" data-testid="call-panel">
      <div className="border border-hair bg-paper/90 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mono-label text-[9.5px] text-ink/45">{[c.city, c.state].filter(Boolean).join(", ") || "Location not found"}{rating != null ? ` · ${rating}★ · ${reviews ?? 0} reviews` : ""}</p>
            <h2 className="mt-1 text-[28px] font-semibold leading-[1] tracking-[-0.04em]">{c.business}</h2>
            <p className="mt-1 text-[13px] text-ink/60">{owner ? <>Owner/manager: <b className="font-medium text-ink">{owner}</b></> : "Owner not found: ask who runs it"}</p>
            {row.task ? <p className="mt-2 inline-flex items-center gap-1.5 bg-[#ff3c00]/[0.08] px-2 py-1 text-[12px] text-[#8a2e00]"><CalendarClock className="h-3.5 w-3.5" />{row.task.reason}</p> : null}
          </div>
          {phone ? <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex h-12 items-center gap-2 bg-[#ff3c00] px-5 text-[16px] font-semibold text-white hover:bg-ink" title="Call (C)"><Phone className="h-4 w-4" />{phone}</a> : <Pill tone="red">No phone</Pill>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <a href={site || undefined} target="_blank" rel="noreferrer" aria-disabled={!site} className={`${btn} justify-center ${site ? "" : "pointer-events-none opacity-40"}`} title="Current website (O)"><Globe className="h-3.5 w-3.5" />{site ? "Current website" : "No website"}</a>
          <button type="button" onClick={() => onView("website")} className={`${btn} justify-center`} title="W"><MonitorSmartphone className="h-3.5 w-3.5" />Website we built</button>
          <button type="button" onClick={() => onView("command")} className={`${btn} justify-center`} title="S"><LayoutDashboard className="h-3.5 w-3.5" />Command System</button>
          <button type="button" onClick={() => onView("portal")} className={`${btn} justify-center`} title="P"><Eye className="h-3.5 w-3.5" />Their portal</button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3" data-testid="prep-card">
        {[["Broken now", row.prep?.broken], ["What we built", row.prep?.built], ["The hook", row.prep?.hook]].map(([k, t]) => <div key={k} className="border border-hair bg-card p-3"><p className="mono-label text-[9px] text-[#ff3c00]">{k}</p><p className="mt-1 text-[12.5px] leading-relaxed">{t}</p></div>)}
      </div>

      {(row.work || []).length ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink/60" data-testid="prep-work"><span className="mono-label text-[9px] text-[#ff3c00]">Show them</span>{row.work.map((w) => <a key={w.slug} href={w.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-[#ff3c00]">{w.name}<span className="text-ink/40"> · {w.industry}</span><ExternalLink className="h-3 w-3" /></a>)}</p>
      ) : null}

      <div className="border border-hair bg-ink p-4 text-white">
        <div className="flex items-center justify-between gap-2"><p className="mono-label text-[9.5px] text-white/50">Say this (whoever answers)</p><button type="button" onClick={() => setScript((x) => !x)} className="inline-flex items-center gap-1 text-[11.5px] text-white/60 hover:text-white">Full script & objections<ChevronDown className={`h-3.5 w-3.5 transition-transform ${script ? "rotate-180" : ""}`} /></button></div>
        <p className="mt-2 text-[14.5px] leading-relaxed">{fillScript(CALL_SCRIPT.opener, v)}</p>
        {script ? (
          <div className="mt-3 space-y-3 border-t border-white/10 pt-3 text-[13px] text-white/80">
            <ul className="space-y-1.5">{CALL_SCRIPT.pitch.map((x) => <li key={x}>{fillScript(x, v)}</li>)}</ul>
            <ul className="space-y-2">{CALL_SCRIPT.objections.map((o) => <li key={o.q}><b className="font-medium text-white">“{o.q}”</b> {o.a}</li>)}</ul>
          </div>
        ) : null}
      </div>

      <div className="border border-hair bg-paper/90 p-3">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          {outcomes.map((o) => (
            <button key={o.key} type="button" onClick={() => log(o.key)} disabled={!!busy}
              className={`flex h-12 items-center gap-2 border px-2.5 text-left text-[12.5px] font-medium transition-colors disabled:opacity-50 ${o.portal ? "border-[#ff3c00] bg-[#ff3c00] text-white hover:bg-ink hover:border-ink" : o.key === "booked" ? "border-green-700 bg-green-700 text-white hover:bg-ink" : o.key === "dnc" ? "border-red-300 text-red-700 hover:bg-red-50" : "border-hair bg-card hover:border-ink/40"}`}>
              <kbd className={`grid h-5 w-5 shrink-0 place-items-center font-mono text-[10.5px] ${o.portal || o.key === "booked" ? "bg-white/20" : "bg-ink/[0.07]"}`}>{o.hotkey}</kbd>
              <span className="leading-tight">{busy === o.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : o.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (who you spoke to, owner's name, best time)" className={input} aria-label="Call note" />
          {askCb ? <input type="datetime-local" value={cb} onChange={(e) => setCb(e.target.value)} className={`${input} sm:w-[230px]`} aria-label="Callback time" autoFocus /> : null}
          {askCb && cb ? <button type="button" onClick={() => log("callback")} className={btnInk}>Set callback</button> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink/50">
          <span>{done ? <b className="font-medium text-green-800">Logged: {done}</b> : "J/K or ↑/↓ move · 1–9 outcome · C call · W/S/P/O open"}</span>
          <span className="flex items-center gap-3"><Link to={leadHref(c.id)} className="inline-flex items-center gap-1 hover:text-[#ff3c00]">Open lead<ExternalLink className="h-3 w-3" /></Link><span title="Dialer integration is not connected yet" className="inline-flex items-center gap-1 border border-dashed border-hair px-2 py-0.5">Aircall: connect later</span></span>
        </div>
        {err ? <p role="alert" className="mt-2 text-[12px] text-red-700">{err}</p> : null}
      </div>
      <div className="flex flex-wrap gap-1">{(c.lead_flags || []).map((f) => <Pill key={f} tone="amber">{FLAG_LABEL[f] || f}</Pill>)}</div>
    </section>
  );
}

function ViewModal({ kind, row, onClose }) {
  const q = useEngine("lead", { client_id: row.client.id });
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const p = q.data?.preview;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas" role="dialog" aria-modal="true" aria-label="Preview">
      <button type="button" onClick={onClose} className="fixed right-3 top-3 z-[60] inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-[12.5px] text-white hover:bg-[#ff3c00]"><X className="h-3.5 w-3.5" />Close (Esc)</button>
      {q.isLoading ? <Loading /> : q.isError ? <div className="p-6"><ErrorNote error={q.error} /></div> : kind === "portal" ? (
        <LeadPortalView d={q.data.portal} preview previewNote={`Their portal, exactly as ${row.client.business} sees it after logging in.`} onBook={() => {}} />
      ) : (
        <div className="mx-auto max-w-[1280px] px-4 pb-10 pt-14 md:px-8">
          <p className="mono-label mb-3 text-[10px] text-ink/50">{kind === "website" ? "Website we built" : "Command System we built"} · {row.client.business}</p>
          {kind === "website" ? <PreviewFrame><WebsitePreview config={p?.website_config} /></PreviewFrame> : <CommandPreview config={p?.command_config} />}
        </div>
      )}
    </div>
  );
}

function SettingsDrawer({ onClose }) {
  const q = useEngine("settings");
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (q.data?.settings) setF(q.data.settings); }, [q.data]);
  const save = async () => { try { await engine("settings", { save: true, ...f }); setMsg("Saved."); q.refetch(); } catch (e) { setMsg(e.message); } };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" role="dialog" aria-modal="true" aria-label="Lead Desk settings">
      <div className="h-full w-full max-w-md overflow-y-auto border-l border-hair bg-canvas p-5">
        <div className="flex items-center justify-between"><p className="text-[16px] font-semibold">Lead Desk settings</p><button type="button" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button></div>
        {q.isError ? <ErrorNote error={q.error}>Settings are admin-only.</ErrorNote> : !f ? <Loading /> : (
          <div className="mt-4 space-y-3">
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Mailing address (required in the invite email by law)</span><input value={f.postal_address} onChange={(e) => setF({ ...f, postal_address: e.target.value })} placeholder="Street or PO box, city, state ZIP" className={`${input} mt-1`} /></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Questions go to</span><input value={f.reply_email} onChange={(e) => setF({ ...f, reply_email: e.target.value })} className={`${input} mt-1`} /></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Previews built per day (build queue cap)</span><select value={f.daily_cap} onChange={(e) => setF({ ...f, daily_cap: Number(e.target.value) })} className={`${input} mt-1`}>{[25, 50, 100].map((n) => <option key={n} value={n}>{n} a day</option>)}</select></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Retry attempts after no answer / voicemail</span><input type="number" min="1" max="10" value={f.voicemail_attempts} onChange={(e) => setF({ ...f, voicemail_attempts: e.target.value })} className={`${input} mt-1`} /></label>
            <button type="button" onClick={save} className={btnFlame}>Save</button>
            {msg ? <p className="text-[12.5px] text-ink/65">{msg}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}
