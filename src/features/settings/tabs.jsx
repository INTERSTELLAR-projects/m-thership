import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, Eye, KeyRound, Loader2, Mail, ShieldCheck, Users, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Panel, EmptyState } from "@/components/financial/finance/ui";
import { useList } from "@/lib/useData";
import { LOGO_URL } from "@/lib/nav";

const BRAND = [["#ff3c00", "Deep"], ["#ff6a00", "Mid"], ["#ffaa00", "Light"]];

function Pill({ ok, yes = "Set", no = "Missing", neutral }) {
  if (neutral) return <span className="mono-label inline-flex rounded bg-ink/[0.07] px-1.5 py-0.5 text-[9px] text-ink/60">{neutral}</span>;
  return ok
    ? <span className="mono-label inline-flex items-center gap-1 rounded bg-[#ff3c00]/10 px-1.5 py-0.5 text-[9px] text-[#c23000]"><Check className="h-2.5 w-2.5" />{yes}</span>
    : <span className="mono-label inline-flex items-center gap-1 rounded bg-ink/[0.07] px-1.5 py-0.5 text-[9px] text-ink/55"><X className="h-2.5 w-2.5" />{no}</span>;
}

/* ---------------- General ---------------- */
export function GeneralTab() {
  const where = [
    ["Prestige referral offer", "Rewards, tiers and the referral link base", "/prestige"],
    ["Plan to Execute & marketing items", "Financial goal tab (re-runs on every client change)", "/financial"],
    ["Request forms", "Standard + per-client forms and public links", "/documents"],
    ["SOP playbooks", "Task templates used when a service starts", "/tasks/sops"],
    ["Dropdown lists", "Lead sources, industries, categories, request types", "/settings?tab=lists"],
    ["Automations", "Everything that runs on its own", "/settings?tab=automations"],
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Agency & brand" subtitle="Read from the code and brand rules the app already uses.">
        <div className="flex items-center gap-4">
          <img src={LOGO_URL} alt="Interstellar Strategies mark" className="h-14 w-14 rounded-md border border-hair bg-paper object-contain p-1.5" />
          <div>
            <p className="text-[18px] font-semibold tracking-[-0.03em]">Interstellar Strategies</p>
            <p className="text-[12.5px] text-ink/55">Møthership · agency OS</p>
          </div>
        </div>
        <div className="mt-5">
          <p className="mono-label mb-2 text-[9px] text-ink/45">Brand gradient (client emails, buttons, bars)</p>
          <div className="h-3 rounded-full" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />
          <div className="mt-2 grid grid-cols-3 gap-2">
            {BRAND.map(([hex, name]) => (
              <div key={hex} className="flex items-center gap-2 rounded-md border border-hair bg-paper px-2 py-1.5">
                <span className="h-5 w-5 rounded" style={{ background: hex }} />
                <span className="text-[11.5px]"><b className="font-semibold">{name}</b> <span className="font-mono text-ink/50">{hex}</span></span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-ink/50">Divider and buttons run #ff3c00 → #ff6a00. Never gold or yellow.</p>
        </div>
      </Panel>
      <Panel title="Where settings live" subtitle="Settings that belong to a feature are edited on that feature's page.">
        <ul className="divide-y divide-hair">
          {where.map(([t, s, to]) => (
            <li key={t}>
              <Link to={to} className="group flex items-center justify-between gap-3 py-2.5">
                <span><span className="block text-[13px] font-medium">{t}</span><span className="block text-[11.5px] text-ink/50">{s}</span></span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink/30 group-hover:text-[#ff3c00]" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-md bg-ink/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-ink/55">
          The old Settings screens (app identity, page visibility, form toggles, comms, statuses &amp; tags, security, advanced, and the &quot;Connect&quot; buttons) were never read by any part of the app, so they were removed. No data was deleted.
        </p>
      </Panel>
    </div>
  );
}

/* ---------------- Team & access ---------------- */
export function TeamTab() {
  const users = useQuery({ queryKey: ["User", "settings"], queryFn: async () => (await base44.entities.User.list("-created_date", 200)) || [] });
  const clients = useList("CRMClient", { sort: "business", limit: 500 });
  const [email, setEmail] = useState("");
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const portalOwner = (u) => (clients.data || []).find((c) => (c.portal_emails || []).map((e) => String(e).toLowerCase()).includes(String(u.email || "").toLowerCase()));
  const all = users.data || [];
  const admins = all.filter((u) => u.role === "admin");
  const portal = all.filter((u) => u.role !== "admin");

  const invite = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { setMsg("Enter a valid email."); return; }
    if (!arm) { setArm(true); setMsg("Admins see every client and all finances. Click again to send the invite."); return; }
    setBusy(true);
    try { await base44.users.inviteUser(e, "admin"); setMsg(`Admin invite sent to ${e}.`); setEmail(""); users.refetch(); } catch (err) { setMsg(`Invite failed: ${err?.message || err}`); } finally { setBusy(false); setArm(false); }
  };

  const UserRow = ({ u }) => {
    const owner = u.role === "admin" ? null : portalOwner(u);
    return (
      <li className="flex items-center gap-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: u.role === "admin" ? "linear-gradient(135deg,#ff3c00,#ff6a00)" : "#57534e" }}>{(u.full_name || u.email || "?").charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{u.full_name || "—"}</span>
          <span className="block truncate text-[11.5px] text-ink/50">{u.email}</span>
        </span>
        {owner ? <Link to={`/clients/${owner.id}`} className="hidden truncate text-[11.5px] text-[#d83300] hover:underline sm:block">{owner.business}</Link> : u.role !== "admin" ? <span className="hidden text-[11.5px] text-ink/40 sm:block">No client linked</span> : null}
        <Pill neutral={u.role === "admin" ? "Admin" : "Portal"} />
      </li>
    );
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Panel title="People with access" subtitle={`${admins.length} admin · ${portal.length} client portal login${portal.length === 1 ? "" : "s"}`}>
        {users.isLoading ? <div className="h-24 animate-pulse rounded-md bg-ink/[0.04]" /> : !all.length ? <EmptyState icon={Users} title="No users found" compact /> : (
          <>
            <p className="mono-label mb-1 text-[9px] text-ink/45">Admins (full access)</p>
            <ul className="mb-4 divide-y divide-hair">{admins.map((u) => <UserRow key={u.id} u={u} />)}</ul>
            <p className="mono-label mb-1 text-[9px] text-ink/45">Client portal logins (see only their own portal)</p>
            {portal.length ? <ul className="divide-y divide-hair">{portal.map((u) => <UserRow key={u.id} u={u} />)}</ul> : <p className="text-[12px] text-ink/45">None yet.</p>}
          </>
        )}
      </Panel>
      <div className="space-y-5">
        <Panel title="Invite a teammate" subtitle="Admins get the whole Møthership. Clients are invited from their client page (Invite to portal).">
          <div className="flex gap-2">
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setArm(false); setMsg(""); }} placeholder="name@interstellar-strategies.com" className="h-9 w-full rounded-md border border-hair bg-paper px-3 text-[13px] outline-none focus:border-[#ff3c00]" />
            <button type="button" onClick={invite} disabled={busy} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium text-white disabled:opacity-50" style={{ background: arm ? "#b91c1c" : "linear-gradient(90deg,#ff3c00,#ff6a00)" }}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}{arm ? "Confirm admin invite" : "Invite admin"}
            </button>
          </div>
          {msg && <p className="mt-2 text-[12px] text-ink/60">{msg}</p>}
        </Panel>
        <Panel title="How access works">
          <ul className="space-y-2 text-[12.5px] leading-relaxed text-ink/70">
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff3c00]" />Every table is admin-only. Non-admins never read data directly.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff3c00]" />A portal login sees one client: the one whose &quot;Portal login emails&quot; include it, through the portal function.</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff3c00]" />Roles and removals are managed in the Base44 dashboard (Users).</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Portal ---------------- */
export function PortalTab() {
  const qc = useQueryClient();
  const clients = useList("CRMClient", { sort: "business", limit: 500 });
  const [saving, setSaving] = useState(null);
  const list = (clients.data || []).filter((c) => c.status !== "Inactive");
  const toggle = async (c) => {
    setSaving(c.id);
    try { await base44.entities.CRMClient.update(c.id, { portal_enabled: !c.portal_enabled }); await qc.invalidateQueries({ queryKey: ["CRMClient"] }); } finally { setSaving(null); }
  };
  const on = list.filter((c) => c.portal_enabled).length;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel title="Client portals" subtitle={`${on} of ${list.length} clients have their portal on. Turning it off blocks their logins; nothing is deleted.`}>
        {clients.isLoading ? <div className="h-24 animate-pulse rounded-md bg-ink/[0.04]" /> : (
          <ul className="divide-y divide-hair">
            {list.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <Link to={`/clients/${c.id}`} className="block truncate text-[13px] font-medium hover:text-[#ff3c00]">{c.business}</Link>
                  <span className="block truncate text-[11.5px] text-ink/50">{(c.portal_emails || []).length ? c.portal_emails.join(", ") : "No portal login emails yet"}</span>
                </span>
                <Link to={`/portal/${c.id}`} className="inline-flex items-center gap-1 text-[11.5px] text-ink/55 hover:text-[#ff3c00]"><Eye className="h-3.5 w-3.5" />Preview</Link>
                <button type="button" onClick={() => toggle(c)} disabled={saving === c.id} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${c.portal_enabled ? "bg-[#ff3c00]" : "bg-ink/20"}`} aria-label={`Portal ${c.portal_enabled ? "on" : "off"} for ${c.business}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${c.portal_enabled ? "left-[18px]" : "left-0.5"}`} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="What every portal shows" subtitle="Portal content follows each record's &quot;show in portal&quot; flag.">
        <ul className="space-y-2 text-[12.5px] text-ink/70">
          <li>Work log and automations marked portal-visible</li>
          <li>Requests: the standard request types plus that client&apos;s custom forms. Rename, reorder or hide types in <Link to="/settings?tab=lists" className="text-[#d83300] hover:underline">Lists &amp; fields</Link>.</li>
          <li>Goals &amp; gaps, brand kit and Prestige rewards</li>
        </ul>
        <p className="mt-3 rounded-md bg-ink/[0.03] px-3 py-2 text-[11.5px] text-ink/55">The portal sends no email or push notifications. Clients see updates when they log in.</p>
      </Panel>
    </div>
  );
}

/* ---------------- Integrations & secrets ---------------- */
const INTEGRATIONS = [
  { group: "Payments", name: "Stripe API", secret: "STRIPE_SECRET_KEY", uses: "Financial revenue, subscriptions, product list, billing sync" },
  { group: "Payments", name: "Stripe webhook", secret: "STRIPE_WEBHOOK_SECRET", uses: "Live billing sync when subscriptions or invoices change" },
  { group: "Inbound", name: "Lead intake", secret: "LEAD_INTAKE_KEY", uses: "Website + Interstellar Booking funnel leads into the Pipeline" },
  { group: "Inbound", name: "External run reporting", secret: "MOTHERSHIP_INGEST_KEY", uses: "Outside automations report runs to Live Ops (log-activity)" },
  { group: "Google", name: "Google Places", secret: "GOOGLE_PLACES_API_KEY", uses: "Stärboard reviews feed on client sites" },
  { group: "Google", name: "PageSpeed Insights", secret: "PAGESPEED_API_KEY", uses: "Site audits (optional: raises Google's quota)", optional: true },
  { group: "AI", name: "OpenAI", secret: "OPENAI_API_KEY", uses: "Voice Core transcription + speech (optional: falls back to the browser)", optional: true },
  { group: "Client Studios", name: "Amazon SES access key", secret: "AWS_SES_ACCESS_KEY_ID", uses: "Client marketing email (email-bulk). Without all three SES secrets client sends are disabled." },
  { group: "Client Studios", name: "Amazon SES secret key", secret: "AWS_SES_SECRET_ACCESS_KEY", uses: "Signs SES requests (SigV4). Never leaves the server." },
  { group: "Client Studios", name: "Amazon SES region", secret: "AWS_SES_REGION", uses: "e.g. us-west-2: the region your SES identities are verified in" },
];

function StudiosSetup() {
  const q = useQuery({
    queryKey: ["settings", "studios-config"],
    staleTime: 60_000,
    retry: false,
    queryFn: async () => (await base44.functions.invoke("usage", { action: "config" })).data,
  });
  const d = q.data || {};
  return (
    <Panel title="Client Studios setup" subtitle="Free for clients under fair-use caps. Client AI runs on the built-in AI (no extra key or account needed). Bulk email runs on our own Amazon SES account.">
      <ol className="list-decimal space-y-2 pl-4 text-[12.5px] leading-relaxed text-ink/70">
        <li><b>Amazon SES:</b> in AWS, open SES in one region, request production access, and create an IAM user with only <span className="font-mono">ses:SendEmail</span>. Add <span className="font-mono">AWS_SES_ACCESS_KEY_ID</span>, <span className="font-mono">AWS_SES_SECRET_ACCESS_KEY</span> and <span className="font-mono">AWS_SES_REGION</span>.</li>
        <li><b>Per client:</b> verify the client&apos;s domain in SES (DKIM records on their DNS), then in Client usage set their sending address and tick &quot;Domain verified&quot;.</li>
        <li><b>Bounces &amp; complaints:</b> create an SNS topic, subscribe this HTTPS URL, and point each SES identity&apos;s bounce + complaint notifications at the topic:
          <span className="mt-1 block break-all rounded-md bg-ink/[0.04] px-2 py-1.5 font-mono text-[10.5px] text-ink/70">{q.isLoading ? "Loading…" : d.ses_feedback_webhook || "Unavailable (needs EMAIL_UNSUB_SECRET or MFA_ENCRYPTION_KEY)"}</span>
        </li>
      </ol>
    </Panel>
  );
}

export function IntegrationsTab() {
  const q = useQuery({
    queryKey: ["settings", "secrets-status"],
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      const r = await base44.functions.invoke("automation-catalog", { action: "secrets" });
      return r?.data || {};
    },
  });
  const status = q.data?.secrets || {};
  const groups = [...new Set(INTEGRATIONS.map((i) => i.group))];
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel title="Secrets & integrations" subtitle="Checks only whether each secret exists on the server. Values are never read into the page, shown or logged.">
        {q.isError && <p className="mb-3 rounded-md bg-red-600/[0.06] px-3 py-2 text-[12px] text-red-700">Couldn&apos;t check secrets: {String(q.error?.message || q.error)}</p>}
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g}>
              <p className="mono-label mb-1 text-[9px] text-ink/45">{g}</p>
              <ul className="divide-y divide-hair rounded-md border border-hair">
                {INTEGRATIONS.filter((i) => i.group === g).map((i) => (
                  <li key={i.secret} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <KeyRound className="h-3.5 w-3.5 shrink-0 text-ink/30" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{i.name}{i.optional ? <span className="ml-1.5 text-[11px] font-normal text-ink/40">optional</span> : null}</span>
                      <span className="block text-[11.5px] text-ink/50">{i.uses}</span>
                    </span>
                    <span className="font-mono text-[10.5px] text-ink/40">{i.secret}</span>
                    {q.isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-ink/30" /> : q.isError ? <Pill neutral="Unknown" /> : <Pill ok={status[i.secret]} no={i.optional ? "Not set" : "Missing"} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {q.data?.checked_at && <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/35">Checked {new Date(q.data.checked_at).toLocaleString("en-US")}</p>}
      </Panel>
      <div className="space-y-5">
        <Panel title="Built in">
          <ul className="divide-y divide-hair text-[12.5px]">
            <li className="flex items-center justify-between gap-3 py-2"><span>Base44 AI (InvokeLLM, image generation)<span className="block text-[11.5px] text-ink/50">Plan to Execute, decks, voice commands, advisor</span></span><Pill ok yes="On" /></li>
            <li className="flex items-center justify-between gap-3 py-2"><span>Google Calendar connector<span className="block text-[11.5px] text-ink/50">Declared in the app; connect or reconnect in Base44 &gt; Connectors</span></span><Pill neutral="Base44" /></li>
          </ul>
        </Panel>
        <StudiosSetup />
        <Panel title="Change a secret">
          <p className="text-[12.5px] leading-relaxed text-ink/65">Add or rotate secrets in the Base44 dashboard: this app &gt; Settings &gt; Secrets (or ask Claude to set one). The status here updates on the next check.</p>
        </Panel>
      </div>
    </div>
  );
}
