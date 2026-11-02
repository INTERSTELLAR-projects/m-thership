import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, Loader2, Mail, MessageSquare, Phone, Plane, Trophy, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { inputClass, textareaClass, labelClass, btnGhost, btnSmallFlame, btnDanger } from "@/features/tasks/lib/ui";
import { cn } from "@/lib/utils";
import { PACKAGES, packageByKey, packagePath } from "@/features/packages/registry";
import { createFlight } from "@/features/flight/onboarding/store";
import { SALES_FOR_PACKAGE, saleByKey, defaultPrice, needsCare } from "@/features/flight/onboarding/catalog";
import {
  STAGES, STAGE_LABEL, SOURCE_BY_KEY, LOST_REASONS, stageOf, sourceOf, interestOf, detailsOf, bookedCallOf,
  daysInStage, suggestedSale, noteDate, money,
} from "./pipeline";

const wide = "max-h-[92vh] overflow-y-auto rounded-md border border-hair bg-canvas text-ink sm:max-w-2xl";
const narrow = "max-h-[92vh] overflow-y-auto rounded-md border border-hair bg-canvas text-ink sm:max-w-lg";
const digits = (p) => String(p || "").replace(/[^\d+]/g, "");

export function ContactLinks({ c, size = "sm" }) {
  const phone = (c.phones || [])[0];
  const email = (c.emails || [])[0];
  const cls = size === "sm"
    ? "inline-flex h-7 w-7 items-center justify-center rounded-sm border border-hair bg-card text-ink/60 hover:border-ink/40 hover:text-[#ff3c00]"
    : "inline-flex h-8 items-center gap-1.5 rounded-sm border border-hair bg-card px-2.5 text-[12px] text-ink/70 hover:border-ink/40 hover:text-[#ff3c00]";
  const stop = (e) => e.stopPropagation();
  return (
    <div className="flex items-center gap-1">
      {phone ? <a href={"tel:" + digits(phone)} onClick={stop} className={cls} title={"Call " + phone}><Phone className="h-3.5 w-3.5" />{size === "sm" ? null : "Call"}</a> : null}
      {phone ? <a href={"sms:" + digits(phone)} onClick={stop} className={cls} title={"Text " + phone}><MessageSquare className="h-3.5 w-3.5" />{size === "sm" ? null : "Text"}</a> : null}
      {email ? <a href={"mailto:" + email} onClick={stop} className={cls} title={"Email " + email}><Mail className="h-3.5 w-3.5" />{size === "sm" ? null : "Email"}</a> : null}
    </div>
  );
}

export function SourceBadge({ c }) {
  const s = SOURCE_BY_KEY[sourceOf(c)] || SOURCE_BY_KEY.other;
  return <span className={cn("mono-label inline-flex items-center rounded-sm px-1.5 py-0.5 text-[8.5px]", s.tone)}>{s.label}{c.lead_funnel ? " · " + c.lead_funnel : ""}</span>;
}

/* ---------- Mark lost ---------- */
export function LostDialog({ lead, onClose, onSave }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setReason(""); setDetail(""); }, [lead]);
  if (!lead) return null;
  const save = async () => {
    setBusy(true);
    try {
      await onSave(lead, [reason, detail.trim()].filter(Boolean).join(": "));
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={Boolean(lead)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={narrow}>
        <DialogHeader>
          <DialogTitle>Mark {lead.business} as lost</DialogTitle>
          <DialogDescription>Why it didn&apos;t move forward. Feeds the close rate and keeps the reason on their record.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {LOST_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={cn("rounded-sm border px-2.5 py-1.5 text-[12px]", reason === r ? "border-ink bg-ink text-white" : "border-hair bg-card hover:border-ink/40")}>{r}</button>
          ))}
        </div>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Details (optional)" className={textareaClass} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="button" disabled={!reason || busy} onClick={save} className={btnDanger}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Mark lost</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Mark won → package flight plan ---------- */
export function WonDialog({ lead, onClose, onWon }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { setBusy(""); setErr(""); }, [lead]);
  if (!lead) return null;
  const suggestion = suggestedSale(lead);

  const pick = async (pkg) => {
    setBusy(pkg.key);
    setErr("");
    try {
      await onWon(lead, pkg);
      const existing = await base44.entities.OnboardingFlight.filter({ client_id: lead.id, package_key: pkg.key }, "-created_date", 5).catch(() => []);
      const open = (Array.isArray(existing) ? existing : []).find((f) => f.status !== "archived");
      if (!open) {
        const flight = await createFlight(lead, pkg);
        // Start the deal on what they were interested in (e.g. Mission ALPHA on the Custom Website page).
        if (suggestion && suggestion.pkgKey === pkg.key && suggestion.sale !== flight.sale_package && (SALES_FOR_PACKAGE[pkg.key] || []).includes(suggestion.sale)) {
          const s = saleByKey(suggestion.sale);
          const patch = { sale_package: suggestion.sale, price: Number(lead.lead_value) || defaultPrice(suggestion.sale), include_onboarding: Boolean(s && s.onboarding) };
          if (s && s.needsCare && !flight.care_plan) Object.assign(patch, { care_plan: "orbit_local", care_value: 750 });
          await base44.entities.OnboardingFlight.update(flight.id, patch).catch(() => null);
        } else if (Number(lead.lead_value) > 0) {
          await base44.entities.OnboardingFlight.update(flight.id, { price: Number(lead.lead_value) }).catch(() => null);
        }
        void needsCare;
      }
      onClose();
      navigate(packagePath(pkg.key) + "/" + lead.id);
    } catch (e) {
      setErr(e.message || "Could not start the flight plan");
      setBusy("");
    }
  };

  const ordered = suggestion ? [packageByKey(suggestion.pkgKey), ...PACKAGES.filter((p) => p.key !== suggestion.pkgKey)].filter(Boolean) : PACKAGES;
  return (
    <Dialog open={Boolean(lead)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={narrow}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-[#ff3c00]" /> {lead.business} said yes</DialogTitle>
          <DialogDescription>Pick what they bought. This opens the package flight plan, which collects everything once and kicks off the work; kickoff makes them an Active client.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-hair rounded-md border border-hair bg-card">
          {ordered.map((p) => {
            const Icon = p.icon;
            const sug = suggestion && suggestion.pkgKey === p.key;
            return (
              <li key={p.key}>
                <button type="button" disabled={Boolean(busy)} onClick={() => pick(p)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[12.5px] hover:bg-ink/[0.03] disabled:opacity-50">
                  <Icon className="h-4 w-4 shrink-0" style={{ color: p.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{p.label}</span>
                    {sug ? <span className="ml-2 mono-label text-[8.5px] text-[#ff3c00]">matches interest: {interestOf(lead)}{suggestion.sale !== (SALES_FOR_PACKAGE[p.key] || [])[0] ? ` → ${(saleByKey(suggestion.sale) || {}).label || suggestion.sale}` : ""}</span> : null}
                    <span className="block truncate text-[11px] text-ink/50">{p.tagline}</span>
                  </span>
                  {busy === p.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plane className="h-3.5 w-3.5 text-ink/35" />}
                </button>
              </li>
            );
          })}
        </ul>
        {err ? <p className="text-[12px] text-red-700">{err}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Lead detail: notes, next step, value, stage ---------- */
export function LeadDialog({ lead, onClose, onPatch, onMove, onWon, onLost }) {
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!lead) return;
    setNote("");
    setNextStep(lead.next_step || "");
    setNextAt(lead.next_step_at ? String(lead.next_step_at).slice(0, 10) : "");
    setValue(lead.lead_value ? String(lead.lead_value) : "");
  }, [lead]);
  if (!lead) return null;
  const stage = stageOf(lead);
  const d = detailsOf(lead);
  const call = bookedCallOf(lead);
  const notes = [...(lead.notes || [])].reverse().slice(0, 12);
  const dirty = nextStep !== (lead.next_step || "") || nextAt !== (lead.next_step_at ? String(lead.next_step_at).slice(0, 10) : "") || (Number(value) || 0) !== (Number(lead.lead_value) || 0);

  const saveFields = async () => {
    setBusy(true);
    try {
      await onPatch(lead, { next_step: nextStep.trim(), next_step_at: nextAt || null, lead_value: Number(value) > 0 ? Number(value) : null });
    } finally {
      setBusy(false);
    }
  };
  const logNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await onPatch(lead, { notes: [...(lead.notes || []), { id: Date.now(), text: note.trim(), date: noteDate() }] });
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  const facts = [
    ["Contact", lead.contact],
    ["Email", (lead.emails || []).join(", ")],
    ["Phone", (lead.phones || []).join(", ")],
    ["Website", (lead.websites || [])[0] || d.social],
    ["Industry", d.business_type],
    ["Interest", interestOf(lead)],
    ["Revenue", d.annual_revenue],
    ["Team", d.team_size],
    ["Timeline", d.timeline],
    ["Referred by", lead.lead_referrer],
    ["Booked call", call && call.label],
    ["Lost reason", stage === "lost" ? lead.lost_reason : ""],
    ["UTM", [d.utm_source, d.utm_medium, d.utm_campaign].filter(Boolean).join(" / ")],
  ].filter(([, val]) => val);

  return (
    <Dialog open={Boolean(lead)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={wide}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">{lead.business} <SourceBadge c={lead} /></DialogTitle>
          <DialogDescription>{STAGE_LABEL[stage]} for {daysInStage(lead)} day{daysInStage(lead) === 1 ? "" : "s"} · added {new Date(lead.created_date || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <ContactLinks c={lead} size="md" />
          <Link to={`/clients/${lead.id}`} className="inline-flex items-center gap-1 text-[12px] text-ink/60 hover:text-[#ff3c00]">Client page <ExternalLink className="h-3 w-3" /></Link>
        </div>

        <div>
          <p className={labelClass}>Stage</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {STAGES.map((s) => (
              <button key={s.key} type="button" onClick={() => onMove(lead, s.key)} className={cn("rounded-sm border px-2 py-1 text-[11.5px]", stage === s.key ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair bg-card hover:border-ink/40")}>{s.label}</button>
            ))}
          </div>
        </div>

        {facts.length ? (
          <dl className="grid gap-x-4 gap-y-1.5 rounded-md border border-hair bg-card p-3 sm:grid-cols-2">
            {facts.map(([k, val]) => (
              <div key={k} className="min-w-0">
                <dt className="mono-label text-[8.5px] text-ink/45">{k}</dt>
                <dd className="truncate text-[12.5px]" title={String(val)}>{val}</dd>
              </div>
            ))}
            {d.biggest_problem ? (
              <div className="sm:col-span-2">
                <dt className="mono-label text-[8.5px] text-ink/45">Biggest problem</dt>
                <dd className="whitespace-pre-wrap text-[12.5px]">{d.biggest_problem}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_150px_130px]">
          <label className="block"><span className={labelClass}>Next step</span><input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Follow up after the call" className={cn(inputClass, "mt-1")} /></label>
          <label className="block"><span className={labelClass}>Due</span><input type="date" value={nextAt} onChange={(e) => setNextAt(e.target.value)} className={cn(inputClass, "mt-1")} /></label>
          <label className="block"><span className={labelClass}>Value ($)</span><input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} placeholder={lead.lead_value ? money(lead.lead_value) : "—"} className={cn(inputClass, "mt-1")} /></label>
        </div>
        {dirty ? <div className="flex justify-end"><button type="button" disabled={busy} onClick={saveFields} className={btnSmallFlame}>Save next step &amp; value</button></div> : null}

        <div>
          <p className={labelClass}>Log a note</p>
          <div className="mt-1 flex gap-2">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called, left a voicemail…" className={cn(textareaClass, "min-h-[60px]")} />
            <button type="button" disabled={busy || !note.trim()} onClick={logNote} className={cn(btnGhost, "self-end")}>Log</button>
          </div>
          {notes.length ? (
            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {notes.map((n, i) => (
                <li key={n.id || i} className="rounded-md border border-hair bg-card px-3 py-2">
                  <p className="mono-label text-[8.5px] text-ink/45">{n.date}</p>
                  <p className="whitespace-pre-wrap text-[12px] text-ink/80">{n.text}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-hair pt-3">
          {stage !== "lost" ? <button type="button" onClick={() => onLost(lead)} className={btnDanger}><XCircle className="h-3.5 w-3.5" /> Mark lost</button> : null}
          <button type="button" onClick={() => onWon(lead)} className={btnSmallFlame}><Trophy className="h-3.5 w-3.5" /> {stage === "won" ? "Open onboarding" : "Mark won"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
