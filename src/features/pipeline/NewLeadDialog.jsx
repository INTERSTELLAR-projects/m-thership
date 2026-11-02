import React, { useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { inputClass, textareaClass, labelClass, btnGhost, btnSmallFlame } from "@/features/tasks/lib/ui";
import { cn } from "@/lib/utils";
import { INTEREST_OPTIONS, REVENUE_OPTIONS, TEAM_OPTIONS, TIMELINE_OPTIONS, STAGES, noteDate } from "./pipeline";
import { useLeadSources } from "./useLeadSources";
import { useOptionList } from "@/hooks/useOptionList";

const EMPTY = {
  full_name: "", email: "", phone: "", business: "", website: "", industry: "",
  annual_revenue: "", team_size: "", interest: "", timeline: "", biggest_problem: "",
  source: "referral", funnel: "", referrer: "", member_id: "", create_referral: true,
  stage: "new", value: "", next_step: "", next_step_at: "",
};
const SOCIAL = /instagram|facebook|fb\.com|tiktok|linkedin|youtube|x\.com|twitter/i;
const domainOf = (w) => String(w).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
const selectCls = inputClass + " pr-2";

function L({ label, children, className }) {
  return (
    <label className={cn("block", className)}>
      <span className={labelClass}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Pick({ value, onChange, options, placeholder = "Pick one" }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// Manual lead entry for referrals, cold approach, ads, etc. Asks everything the website booking form asks.
export default function NewLeadDialog({ open, onOpenChange, onCreated, defaultSource = "referral" }) {
  const [v, setV] = useState({ ...EMPTY, source: defaultSource });
  const { visible: SOURCES, all: ALL_SOURCES } = useLeadSources();
  const industries = useOptionList("client_industries").labels;
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));

  useEffect(() => {
    if (!open) return;
    setV({ ...EMPTY, source: defaultSource });
    setErr("");
    base44.entities.PrestigeMember.list("name", 500).then((rows) => setMembers((Array.isArray(rows) ? rows : []).filter((m) => m.active !== false))).catch(() => setMembers([]));
  }, [open, defaultSource]);

  const pickMember = (id) => {
    const m = members.find((x) => x.id === id);
    setV((s) => ({ ...s, member_id: id, referrer: m ? m.name : s.referrer }));
  };

  const save = async (e) => {
    e.preventDefault();
    const email = v.email.trim().toLowerCase();
    const business = v.business.trim() || v.full_name.trim();
    if (!business) return setErr("Add a business or contact name.");
    if (!email && !v.phone.trim()) return setErr("Add an email or a phone number so you can reach them.");
    if (email && !/\S+@\S+\.\S+/.test(email)) return setErr("That email doesn't look right.");
    setBusy(true);
    setErr("");
    try {
      if (email) {
        const all = await base44.entities.CRMClient.list("-created_date", 1000).catch(() => []);
        const dupe = (Array.isArray(all) ? all : []).find((c) => (c.emails || []).some((x) => String(x).toLowerCase() === email));
        if (dupe) {
          setBusy(false);
          return setErr(`${email} is already on file as ${dupe.business} (${dupe.status || "Active"}).`);
        }
      }
      const site = v.website.trim();
      const isSocial = site && SOCIAL.test(site);
      const member = members.find((m) => m.id === v.member_id);
      const details = {
        annual_revenue: v.annual_revenue, team_size: v.team_size, timeline: v.timeline,
        biggest_problem: v.biggest_problem.trim(), business_type: v.industry.trim(),
        ...(isSocial ? { social: site } : {}),
      };
      Object.keys(details).forEach((k) => !details[k] && delete details[k]);
      const srcLabel = (ALL_SOURCES.find((s) => s.key === v.source) || {}).label || v.source;
      const note = [
        `Lead added by hand. Source: ${srcLabel}${v.funnel ? ` · funnel "${v.funnel}"` : ""}${v.referrer ? ` · referred by ${v.referrer}${member ? " (Prestige member)" : ""}` : ""}`,
        v.industry && `Industry: ${v.industry}`,
        v.annual_revenue && `Annual revenue: ${v.annual_revenue}`,
        v.team_size && `Team size: ${v.team_size}`,
        v.interest && `Most interested in: ${v.interest}`,
        v.timeline && `Wants it done: ${v.timeline}`,
        v.biggest_problem.trim() && `Biggest problem: ${v.biggest_problem.trim()}`,
      ].filter(Boolean).join("\n");
      const data = {
        business, contact: v.full_name.trim(), status: "Lead",
        emails: email ? [email] : [], phones: v.phone.trim() ? [v.phone.trim()] : [],
        websites: site ? [site] : [], domain: site && !isSocial ? domainOf(site) : "",
        industry: v.industry.trim(),
        pipeline_stage: v.stage || "new", stage_changed_at: new Date().toISOString(),
        lead_source: v.source,
        lead_details: details,
        notes: [{ id: Date.now(), text: note, date: noteDate() }],
        services: [], services_managed: [], documents: [], completedTasks: [], blogSchedule: [],
      };
      if (v.funnel.trim()) data.lead_funnel = v.funnel.trim();
      if (v.referrer.trim()) data.lead_referrer = v.referrer.trim();
      if (member) data.lead_referrer_member_id = member.id;
      if (v.interest) data.lead_interest = v.interest;
      if (Number(v.value) > 0) data.lead_value = Number(v.value);
      if (v.next_step.trim()) data.next_step = v.next_step.trim();
      if (v.next_step_at) data.next_step_at = v.next_step_at;
      const created = await base44.entities.CRMClient.create(data);
      if (member && v.source === "referral" && v.create_referral) {
        await base44.entities.PrestigeReferral.create({
          memberId: member.id, memberName: member.name, referredClientName: business,
          package: v.interest || "", lineItems: [], amount: 0, date: new Date().toLocaleDateString("en-CA"),
          status: "Pending", notes: `Logged from the Pipeline. ${v.full_name.trim()}${email ? " · " + email : ""}${v.phone.trim() ? " · " + v.phone.trim() : ""}`,
        }).catch(() => null);
      }
      onCreated && onCreated(created);
      onOpenChange(false);
    } catch (e2) {
      setErr(e2.message || "Could not save the lead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-md border border-hair bg-canvas text-ink sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-[#ff3c00]" /> New lead</DialogTitle>
          <DialogDescription>Referral, cold approach, ads or anything that didn't come through the website. Same questions the booking form asks.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <section>
            <p className="mono-label mb-2 text-[9.5px] text-[#ff3c00]">1 · Who</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <L label="Full name"><input autoFocus value={v.full_name} onChange={(e) => set("full_name")(e.target.value)} className={inputClass} /></L>
              <L label="Email"><input type="email" value={v.email} onChange={(e) => set("email")(e.target.value)} className={inputClass} /></L>
              <L label="Phone"><input value={v.phone} onChange={(e) => set("phone")(e.target.value)} className={inputClass} /></L>
            </div>
          </section>

          <section>
            <p className="mono-label mb-2 text-[9.5px] text-[#ff3c00]">2 · Their business</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <L label="Business name"><input value={v.business} onChange={(e) => set("business")(e.target.value)} className={inputClass} /></L>
              <L label="Website or social link"><input value={v.website} onChange={(e) => set("website")(e.target.value)} placeholder="https://… or instagram.com/…" className={inputClass} /></L>
              <L label="Industry / trade"><input list="lead-industry-options" value={v.industry} onChange={(e) => set("industry")(e.target.value)} placeholder="Hardscape, barbershop, coaching…" className={inputClass} /><datalist id="lead-industry-options">{industries.map((i) => <option key={i} value={i} />)}</datalist></L>
              <L label="Annual revenue"><Pick value={v.annual_revenue} onChange={set("annual_revenue")} options={REVENUE_OPTIONS} /></L>
              <L label="Team size"><Pick value={v.team_size} onChange={set("team_size")} options={TEAM_OPTIONS} /></L>
              <L label="Most interested in"><Pick value={v.interest} onChange={set("interest")} options={INTEREST_OPTIONS} /></L>
              <L label="Timeline"><Pick value={v.timeline} onChange={set("timeline")} options={TIMELINE_OPTIONS} /></L>
              <L label="Biggest problem" className="sm:col-span-2"><textarea value={v.biggest_problem} onChange={(e) => set("biggest_problem")(e.target.value)} className={textareaClass} /></L>
            </div>
          </section>

          <section>
            <p className="mono-label mb-2 text-[9.5px] text-[#ff3c00]">3 · Where they came from</p>
            <div className="flex flex-wrap gap-1.5">
              {SOURCES.map((s) => (
                <button key={s.key} type="button" onClick={() => set("source")(s.key)} className={cn("rounded-sm border px-2.5 py-1.5 text-[12px]", v.source === s.key ? "border-ink bg-ink text-white" : "border-hair bg-card hover:border-ink/40")}>{s.label}</button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {v.source === "funnel" ? <L label="Funnel name"><input value={v.funnel} onChange={(e) => set("funnel")(e.target.value)} className={inputClass} /></L> : null}
              {v.source === "referral" ? (
                <>
                  <L label="Prestige member (optional)">
                    <select value={v.member_id} onChange={(e) => pickMember(e.target.value)} className={selectCls}>
                      <option value="">Not a Prestige member</option>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.prestige ? ` · ${m.prestige}` : ""}</option>)}
                    </select>
                  </L>
                  <L label="Referred by"><input value={v.referrer} onChange={(e) => set("referrer")(e.target.value)} placeholder="Who sent them" className={inputClass} /></L>
                  {v.member_id ? (
                    <label className="flex items-center gap-2 text-[12px] sm:col-span-2">
                      <input type="checkbox" checked={v.create_referral} onChange={(e) => set("create_referral")(e.target.checked)} className="h-4 w-4 accent-[#ff3c00]" />
                      Log it on their Prestige referrals as &ldquo;Lead sent&rdquo;
                    </label>
                  ) : null}
                </>
              ) : (
                <L label="Referred by / notes on source (optional)"><input value={v.referrer} onChange={(e) => set("referrer")(e.target.value)} className={inputClass} /></L>
              )}
            </div>
          </section>

          <section>
            <p className="mono-label mb-2 text-[9.5px] text-[#ff3c00]">4 · Pipeline</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <L label="Stage">
                <select value={v.stage} onChange={(e) => set("stage")(e.target.value)} className={selectCls}>
                  {STAGES.filter((s) => !["won", "lost"].includes(s.key)).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </L>
              <L label="Estimated value ($, optional)"><input inputMode="decimal" value={v.value} onChange={(e) => set("value")(e.target.value.replace(/[^\d.]/g, ""))} className={inputClass} /></L>
              <L label="Next step"><input value={v.next_step} onChange={(e) => set("next_step")(e.target.value)} placeholder="Call to book the strategy call" className={inputClass} /></L>
              <L label="Due"><input type="date" value={v.next_step_at} onChange={(e) => set("next_step_at")(e.target.value)} className={inputClass} /></L>
            </div>
          </section>

          {err ? <p className="text-[12px] text-red-700">{err}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className={btnGhost}>Cancel</button>
            <button type="submit" disabled={busy} className={btnSmallFlame}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Add lead</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
