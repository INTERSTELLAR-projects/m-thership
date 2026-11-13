// Møthership > Client usage: per client plan, fair-use caps, this month's Studio usage + estimated cost, admin
// overrides (custom caps / unlimited / plan), sending identity for SES, and each portal Studio's state
// (off = hidden, preview = locked preview (default), on = usable). Data: the `usage` function (overview, config).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings2, X, KeyRound, ExternalLink } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Panel, Tag, Stat, Btn } from "@/features/clients/ui";
import { UsageBar } from "./PortalUsageCard";
import { PLAN_CAPS, ADS_LABEL, STUDIO_KEYS, STUDIO_LABELS, STUDIO_STATES, fmtUsd, fmtNum } from "./plans";

const SHORT = { social: "Social", email: "Email", ads: "Ads", accounting: "Accounting", hiring: "Hiring", training: "Training", presentations: "Decks" };

const useOverview = () => useQuery({
  queryKey: ["client-usage", "overview"],
  staleTime: 30_000,
  queryFn: async () => (await base44.functions.invoke("usage", { action: "overview" })).data,
});
const useConfig = () => useQuery({
  queryKey: ["settings", "studios-config"],
  staleTime: 60_000,
  retry: false,
  queryFn: async () => (await base44.functions.invoke("usage", { action: "config" })).data,
});

function StateSwitch({ value, onChange, disabled }) {
  return (
    <div className="inline-flex border border-hair" role="radiogroup">
      {STUDIO_STATES.map((s) => (
        <button
          key={s.value} type="button" role="radio" aria-checked={value === s.value} disabled={disabled}
          onClick={() => value !== s.value && onChange(s.value)}
          className={`h-6 px-2 text-[10.5px] font-medium transition-colors disabled:opacity-50 ${value === s.value ? (s.value === "on" ? "bg-green-700 text-white" : s.value === "preview" ? "bg-ink text-white" : "bg-ink/20 text-ink") : "bg-paper text-ink/55 hover:text-ink"}`}
        >{s.label}</button>
      ))}
    </div>
  );
}

function SecretsStrip() {
  const q = useConfig();
  const s = q.data?.secrets || {};
  const ses = s.AWS_SES_ACCESS_KEY_ID && s.AWS_SES_SECRET_ACCESS_KEY && s.AWS_SES_REGION;
  const Pill = ({ ok, label }) => (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[11.5px] font-medium ${ok ? "bg-green-600/10 text-green-800" : "bg-amber-500/15 text-amber-800"}`}>
      <KeyRound className="h-3 w-3" />{label}: {q.isLoading ? "…" : ok ? "set" : "missing"}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill ok={ses} label="Amazon SES" />
      <Link to="/settings?tab=integrations" className="inline-flex items-center gap-1 text-[11.5px] text-ink/55 hover:text-[#ff3c00]">Setup <ExternalLink className="h-3 w-3" /></Link>
    </div>
  );
}

function EditDialog({ c, onClose, onSaved }) {
  const o = c.overrides || {};
  const [f, setF] = useState({
    plan: o.plan || "", ai_actions: o.ai_actions ?? "", marketing_emails: o.marketing_emails ?? "", ads_cadence: o.ads_cadence || "",
    unlimited: !!o.unlimited, note: o.note || "",
    ses_from_email: c.ses.from_email, ses_from_name: c.ses.from_name, ses_reply_to: c.ses.reply_to, ses_domain: c.ses.domain, ses_domain_verified: c.ses.verified,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const num = (v) => (v === "" || v == null ? null : Math.max(0, Math.floor(Number(v)) || 0));
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const usage_overrides = { plan: f.plan || null, ai_actions: num(f.ai_actions), marketing_emails: num(f.marketing_emails), ads_cadence: f.ads_cadence || null, unlimited: !!f.unlimited, note: f.note.slice(0, 300) };
      await base44.entities.CRMClient.update(c.id, {
        usage_overrides,
        ses_from_email: f.ses_from_email.trim().toLowerCase(), ses_from_name: f.ses_from_name.trim(), ses_reply_to: f.ses_reply_to.trim().toLowerCase(),
        ses_domain: f.ses_domain.trim().toLowerCase(), ses_domain_verified: !!f.ses_domain_verified,
      });
      onSaved();
    } catch (e) { setErr(e?.message || "Couldn't save"); } finally { setBusy(false); }
  };
  const inp = "w-full border border-hair bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-[#ff3c00]";
  const base = PLAN_CAPS[c.plan] || PLAN_CAPS.none;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-hair bg-canvas shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Fair use for ${c.business}`}>
        <div className="h-[3px] flame-bg" />
        <div className="flex items-center justify-between border-b border-hair px-5 py-3">
          <div><p className="mono-label text-[9.5px] text-ink/50">Fair use + sending</p><p className="text-[16px] font-semibold tracking-[-0.02em]">{c.business}</p></div>
          <button onClick={onClose} aria-label="Close" className="text-ink/50 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-5 py-4 text-[12.5px]">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block"><span className="mono-label text-[9px] text-ink/50">Plan (blank = from services / Stripe)</span>
              <select className={inp} value={f.plan} onChange={(e) => set("plan", e.target.value)}>
                <option value="">Auto: {base.label}</option>
                {Object.entries(PLAN_CAPS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
              </select>
            </label>
            <label className="block"><span className="mono-label text-[9px] text-ink/50">AI actions / mo</span><input className={inp} type="number" min="0" placeholder={String(base.ai_action)} value={f.ai_actions} onChange={(e) => set("ai_actions", e.target.value)} /></label>
            <label className="block"><span className="mono-label text-[9px] text-ink/50">Marketing emails / mo</span><input className={inp} type="number" min="0" placeholder={String(base.marketing_email)} value={f.marketing_emails} onChange={(e) => set("marketing_emails", e.target.value)} /></label>
            <label className="block"><span className="mono-label text-[9px] text-ink/50">Ads agent</span>
              <select className={inp} value={f.ads_cadence} onChange={(e) => set("ads_cadence", e.target.value)}>
                <option value="">Plan default ({ADS_LABEL[base.ads]})</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="none">Not included</option>
              </select>
            </label>
            <label className="flex items-end gap-2 pb-1.5"><input type="checkbox" checked={f.unlimited} onChange={(e) => set("unlimited", e.target.checked)} /> <span>Unlimited (no caps)</span></label>
            <label className="col-span-2 block"><span className="mono-label text-[9px] text-ink/50">Note</span><input className={inp} value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Why this client has a custom cap" /></label>
          </div>
          <div className="border-t border-hair pt-4">
            <p className="mono-label text-[9px] text-ink/50">Marketing email sender (Amazon SES)</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="block"><span className="text-[11px] text-ink/55">From address</span><input className={inp} value={f.ses_from_email} onChange={(e) => set("ses_from_email", e.target.value)} placeholder="news@theirdomain.com" /></label>
              <label className="block"><span className="text-[11px] text-ink/55">From name</span><input className={inp} value={f.ses_from_name} onChange={(e) => set("ses_from_name", e.target.value)} placeholder={c.business} /></label>
              <label className="block"><span className="text-[11px] text-ink/55">Reply-to</span><input className={inp} value={f.ses_reply_to} onChange={(e) => set("ses_reply_to", e.target.value)} placeholder="owner@theirdomain.com" /></label>
              <label className="block"><span className="text-[11px] text-ink/55">Sending domain</span><input className={inp} value={f.ses_domain} onChange={(e) => set("ses_domain", e.target.value)} placeholder="theirdomain.com" /></label>
              <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={f.ses_domain_verified} onChange={(e) => set("ses_domain_verified", e.target.checked)} /> Domain shows <b>Verified</b> in SES (DKIM)</label>
            </div>
          </div>
          {err && <p className="text-red-700">{err}</p>}
          <div className="flex justify-end gap-2"><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Btn></div>
        </div>
      </div>
    </div>
  );
}

function ClientRow({ c, onEdit, onState, saving }) {
  const u = c.usage || {};
  return (
    <li className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)]" data-usage-client={c.id}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link to={`/clients/${c.id}`} className="truncate text-[14px] font-semibold tracking-[-0.01em] hover:text-[#ff3c00]">{c.business}</Link>
          <Tag tone={c.plan === "none" ? "muted" : "ink"}>{c.plan_label}</Tag>
          {c.unlimited ? <Tag tone="flame">Unlimited</Tag> : c.custom ? <Tag tone="amber">Custom</Tag> : null}
        </div>
        <p className="mt-1 text-[11.5px] text-ink/50">Ads agent: {ADS_LABEL[c.caps.ads_cadence]} · Est. cost {fmtUsd(u.est_cost_usd)}{(u.admin_ai_action || u.admin_marketing_email) ? ` · yours: ${fmtNum(u.admin_ai_action)} AI, ${fmtNum(u.admin_marketing_email)} emails` : ""}</p>
        <p className="mt-0.5 text-[11.5px] text-ink/45">Sender: {c.ses.from_email ? <>{c.ses.from_email} {c.ses.verified ? <span className="text-green-700">· verified</span> : <span className="text-amber-700">· not verified</span>}</> : "not set"}</p>
        <button onClick={onEdit} className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-ink/60 hover:text-[#ff3c00]"><Settings2 className="h-3.5 w-3.5" /> Caps, overrides &amp; sender</button>
      </div>
      <div className="space-y-3">
        <UsageBar label="AI actions" used={u.ai_action || 0} cap={c.caps.ai_action} />
        <UsageBar label="Marketing emails" used={u.marketing_email || 0} cap={c.caps.marketing_email} />
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {STUDIO_KEYS.map((k) => (
          <div key={k} className="flex items-center justify-between gap-2">
            <span className="truncate text-[11.5px] text-ink/65" title={STUDIO_LABELS[k]}>{SHORT[k]}</span>
            <StateSwitch value={c.studios[k]} disabled={saving} onChange={(v) => onState(c, k, v)} />
          </div>
        ))}
      </div>
    </li>
  );
}

export default function ClientUsagePage() {
  const q = useOverview();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(null);
  const [filter, setFilter] = useState("all");
  const rows = useMemo(() => (q.data?.clients || []).filter((c) => filter === "all" || (filter === "on" ? Object.values(c.studios).includes("on") : c.plan === filter)), [q.data, filter]);
  const tot = useMemo(() => (q.data?.clients || []).reduce((a, c) => ({ ai: a.ai + (c.usage.ai_action || 0) + (c.usage.admin_ai_action || 0), em: a.em + (c.usage.marketing_email || 0) + (c.usage.admin_marketing_email || 0), cost: a.cost + (c.usage.est_cost_usd || 0), on: a.on + (Object.values(c.studios).includes("on") ? 1 : 0) }), { ai: 0, em: 0, cost: (q.data?.agency?.est_cost_usd || 0), on: 0 }), [q.data]);

  const setState = async (c, k, v) => {
    setSaving(c.id);
    const studios = { ...c.studios, [k]: v };
    qc.setQueryData(["client-usage", "overview"], (d) => d && ({ ...d, clients: d.clients.map((x) => (x.id === c.id ? { ...x, studios } : x)) }));
    try { await base44.entities.CRMClient.update(c.id, { studios }); } catch { qc.invalidateQueries({ queryKey: ["client-usage"] }); } finally { setSaving(null); }
  };

  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Command / Client usage" rightText={q.data?.month ? `Fair use · ${q.data.month}` : "Fair use"} title="Client usage"><SecretsStrip /></PageHeader>
      <div className="space-y-5 px-5 pt-6 md:px-8">
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-hair bg-card lg:grid-cols-4">
          <Stat value={fmtNum(tot.ai)} label="AI actions this month" />
          <Stat value={fmtNum(tot.em)} label="Marketing emails" />
          <Stat value={fmtUsd(tot.cost)} label="Est. cost (AI + SES)" accent hint={q.data?.agency?.est_cost_usd ? `incl. ${fmtUsd(q.data.agency.est_cost_usd)} agency-level` : ""} />
          <Stat value={tot.on} label="Clients with a Studio on" />
        </div>
        <p className="text-[12px] leading-relaxed text-ink/55">
          Caps per month: HyperCare+ 1,000 AI actions / 25,000 emails / ads daily · Website-only 500 / 10,000 / weekly · GravïtyCare 200 / 2,500 / no ads.
          You get an alert and a Command Briefing task at 80%; at 100% new drafts and sends pause until the 1st (nothing made is locked). Your own admin usage is recorded but never counts toward a client&apos;s cap.
          Studios: <b>Hidden</b> = not in their portal, <b>Preview</b> = visible + locked (default), <b>On</b> = usable.
        </p>
        <Panel
          label={`${rows.length} active clients`} title="Plans, usage and Studios"
          action={(
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-hair bg-paper px-2 py-1 text-[12px]" aria-label="Filter">
              <option value="all">All clients</option><option value="on">A Studio is on</option>
              {Object.entries(PLAN_CAPS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </select>
          )}
        >
          {q.isLoading ? <p className="flex items-center gap-2 px-4 py-8 text-[13px] text-ink/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading usage…</p>
            : q.isError ? <p className="px-4 py-6 text-[13px] text-red-700">Couldn&apos;t load usage: {String(q.error?.response?.data?.error || q.error?.message)}</p>
            : <ul className="divide-y divide-hair">{rows.map((c) => <ClientRow key={c.id} c={c} saving={saving === c.id} onEdit={() => setEdit(c)} onState={setState} />)}</ul>}
        </Panel>
      </div>
      {edit && <EditDialog c={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); qc.invalidateQueries({ queryKey: ["client-usage"] }); }} />}
    </div>
  );
}

// Usage card on each client profile (Overview tab).
export function ClientUsageCard({ client }) {
  const q = useQuery({
    queryKey: ["client-usage", "summary", client?.id],
    enabled: !!client?.id,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => (await base44.functions.invoke("usage", { action: "summary", client_id: client.id })).data,
  });
  const d = q.data;
  return (
    <Panel label="Fair use" title="Studios usage this month" action={<Link to="/client-usage" className="text-[12px] text-ink/55 hover:text-[#ff3c00]">Client usage →</Link>} className="mt-5">
      {!d ? <p className="px-4 py-5 text-[12.5px] text-ink/50">{q.isError ? "Couldn't load usage." : "Loading…"}</p> : (
        <div className="grid gap-5 p-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <p className="text-[12.5px]"><Tag tone="ink">{d.plan_label}</Tag> {d.unlimited ? <Tag tone="flame">Unlimited</Tag> : d.custom ? <Tag tone="amber">Custom caps</Tag> : null} <span className="ml-1 text-ink/50">Ads agent: {ADS_LABEL[d.caps.ads_cadence]} · est. {fmtUsd(d.est_cost_usd)}</span></p>
            <UsageBar label="AI actions" used={d.usage.ai_action} cap={d.caps.ai_action} />
            <UsageBar label="Marketing emails" used={d.usage.marketing_email} cap={d.caps.marketing_email} />
          </div>
          <div className="flex flex-wrap content-start gap-1.5">
            {STUDIO_KEYS.map((k) => <Tag key={k} tone={d.studios?.[k] === "on" ? "green" : d.studios?.[k] === "off" ? "muted" : "ink"}>{STUDIO_LABELS[k]}: {STUDIO_STATES.find((s) => s.value === d.studios?.[k])?.label}</Tag>)}
          </div>
        </div>
      )}
    </Panel>
  );
}
