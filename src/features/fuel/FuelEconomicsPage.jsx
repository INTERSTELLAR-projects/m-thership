// Møthership > Fuel economics (admin). Per client this month: AI actions (weighted) and emails, estimated cost from
// real token counts (Sonnet / Haiku rates) + SES, margin against what the client is billed, Refuel revenue, who is
// near their caps; an agency total; Base44 integration-credit burn; and every fuel number in one settings form,
// labelled with its approval (approved Nov 4, 2026). Data: the `fuel` function (economics, get_config, save_config, grant,
// mock_checkout_completed). Mock credits are tagged test and never count as revenue.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Fuel, Loader2, Save, Settings2, FlaskConical, Gift } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Panel, Tag, Stat } from "@/features/clients/ui";
import { base44 } from "@/api/base44Client";
import { fuelCall } from "./useFuel";

const usd = (n, d = 2) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const num = (n) => (n == null ? "∞" : Number(n).toLocaleString("en-US"));
const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
const mtok = (n) => `${((Number(n) || 0) / 1e6).toFixed(2)}M`;

function PendingBadge() {
  return <span className="inline-flex items-center gap-1.5 bg-[#ff3c00]/10 px-2 py-1 text-[11px] font-medium text-[#c24100]"><Check className="h-3 w-3" /> Approved Nov 4, 2026</span>;
}

function Meter({ value }) {
  const p = Math.min(100, Math.round((Number(value) || 0) * 100));
  return <div className="h-1.5 w-full min-w-[60px] bg-ink/[0.08]"><div className={`h-full ${p >= 100 ? "bg-red-600" : p >= 80 ? "bg-[#ff6a00]" : "bg-ink"}`} style={{ width: `${p}%` }} /></div>;
}

function Economics({ month }) {
  const q = useQuery({ queryKey: ["fuel", "economics", month], queryFn: () => fuelCall("economics", { month }), staleTime: 30_000 });
  const d = q.data;
  if (q.isLoading) return <p className="flex items-center gap-2 py-10 text-[13px] text-ink/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading fuel economics…</p>;
  if (q.isError || !d) return <p className="py-10 text-[13px] text-red-700">{q.error?.response?.data?.error || "Couldn't load fuel economics."}</p>;
  const t = d.totals || {};
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 overflow-hidden rounded-md border border-hair bg-card md:grid-cols-3 xl:grid-cols-6" data-agency-totals>
        <Stat value={usd(t.plan_revenue, 0)} label="Plan revenue / mo" hint={`${t.clients} active clients`} />
        <Stat value={usd(t.refuel_revenue, 0)} label="Refuel revenue" hint="this month, real charges only" />
        <Stat value={usd(t.cost)} label="Est. AI + email cost" hint={`${mtok(t.in_tokens)} in · ${mtok(t.out_tokens)} out tokens`} />
        <Stat value={usd(t.margin, 0)} label="Est. margin" accent hint={t.plan_revenue + t.refuel_revenue ? `${pct(t.margin / (t.plan_revenue + t.refuel_revenue))} of revenue` : ""} />
        <Stat value={num(t.ai_units)} label="AI actions (clients)" hint={`${num(t.emails)} emails`} />
        <Stat value={`${t.near_caps}`} label="Near / at caps" hint={`${t.out_of_fuel} out of fuel`} />
      </section>

      {d.near_caps?.length > 0 && (
        <Panel label="Watch list" title="Clients near their caps">
          <ul className="divide-y divide-hair" data-near-caps>
            {d.near_caps.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="font-medium">{c.business}</span>
                {c.out_of_fuel ? <Tag tone="red">Out of fuel</Tag> : <Tag tone="amber">80%+</Tag>}
                <span className="ml-auto text-ink/55 tabular-nums">AI {pct(c.pct.ai_action)} · Email {pct(c.pct.marketing_email)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel label={`${d.month}${d.truncated ? " · first 5,000 ledger rows" : ""}`} title="Per client">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[12.5px]" data-economics-table>
            <thead>
              <tr className="border-b border-hair text-left font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/45">
                <th className="px-4 py-2 font-normal">Client</th><th className="font-normal">Plan</th>
                <th className="font-normal">AI actions</th><th className="font-normal">Emails</th>
                <th className="font-normal">Calls H / S</th><th className="text-right font-normal">Est. cost</th>
                <th className="text-right font-normal">Billed / mo</th><th className="text-right font-normal">Refuel</th>
                <th className="pr-4 text-right font-normal">Margin</th>
              </tr>
            </thead>
            <tbody>
              {d.clients.map((c) => (
                <tr key={c.id} className="border-b border-hair last:border-0">
                  <td className="px-4 py-2.5"><p className="font-medium">{c.business}</p>{(c.wallet.ai_action > 0 || c.wallet.marketing_email > 0) && <p className="text-[10.5px] text-ink/50">Wallet: {num(c.wallet.ai_action)} AI · {num(c.wallet.marketing_email)} emails</p>}</td>
                  <td><span className="block">{c.plan_label}</span><span className="text-[10.5px] text-ink/50">{c.tier_label || (c.studios_unlocked ? "" : "Studios locked · Nøva only")}</span></td>
                  <td className="pr-3"><span className="tabular-nums">{num(c.usage.ai_units)} / {num(c.caps.ai_action)}</span><Meter value={c.pct.ai_action} /></td>
                  <td className="pr-3"><span className="tabular-nums">{num(c.usage.emails)} / {num(c.caps.marketing_email)}</span><Meter value={c.pct.marketing_email} /></td>
                  <td className="tabular-nums text-ink/60">{num(c.usage.haiku_calls)} / {num(c.usage.sonnet_calls)}{c.usage.nova_messages ? <span className="block text-[10.5px]">{c.usage.nova_messages} Nøva</span> : null}</td>
                  <td className="text-right tabular-nums">{usd(c.est_cost.total)}<span className="block text-[10.5px] text-ink/45">AI {usd(c.est_cost.ai)} · SES {usd(c.est_cost.email)}</span></td>
                  <td className="text-right tabular-nums">{usd(c.plan_revenue, 0)}{c.plan_revenue === 0 && <span className="block text-[10px] text-ink/45">package / off-Stripe</span>}</td>
                  <td className="text-right tabular-nums">{c.refuel_revenue ? usd(c.refuel_revenue, 0) : "–"}</td>
                  <td className={`pr-4 text-right font-semibold tabular-nums ${c.margin < 0 ? "text-red-700" : ""}`}>{usd(c.margin, 0)}<span className="block text-[10.5px] font-normal text-ink/45">{c.margin_pct == null ? "" : pct(c.margin_pct)}</span></td>
                </tr>
              ))}
              <tr className="bg-ink/[0.03]">
                <td className="px-4 py-2.5 font-medium">Interstellar (admin AI)</td><td className="text-ink/50">Agency</td>
                <td className="tabular-nums">{num(d.agency.ai_units)}</td><td>–</td><td className="tabular-nums text-ink/60">{num(d.agency.ai_calls)} calls</td>
                <td className="text-right tabular-nums">{usd(d.agency.ai_cost)}</td><td /><td /><td className="pr-4 text-right tabular-nums text-ink/60">-{usd(d.agency.ai_cost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-hair px-4 py-2.5 text-[11px] text-ink/50">
          Cost from the real token counts the ai-gateway logs on every call: Sonnet {usd(d.costs.sonnet_in_per_m)} / {usd(d.costs.sonnet_out_per_m)} per million tokens in / out, Haiku {usd(d.costs.haiku_in_per_m)} / {usd(d.costs.haiku_out_per_m)}, SES {usd(d.costs.ses_per_1000)} per 1,000 emails. Nøva runs on Base44 agent credits (not in $ cost; see below). Billed = the client&apos;s active Stripe lines.
        </p>
      </Panel>

      {d.base44_credits && (
        <Panel label="Base44 integration credits (fixed monthly pool, no rollover)" title="Estimated burn">
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <div>
              <p className="text-[12.5px] font-medium">Fixed: scheduled jobs ≈ {num(d.base44_credits.fixed_monthly)} credits / month</p>
              <ul className="mt-2 divide-y divide-hair border border-hair bg-white text-[12px]">
                {d.base44_credits.fixed_jobs.map((j) => (
                  <li key={j.name} className="flex items-center gap-2 px-3 py-1.5"><span className="flex-1">{j.name}</span><span className="tabular-nums text-ink/55">{num(j.runs)} runs</span><span className="w-20 text-right tabular-nums">{num(Math.round(j.workflow_credits + j.function_credits))}</span></li>
                ))}
              </ul>
            </div>
            <div className="text-[12.5px] leading-relaxed">
              <p className="font-medium">Per client (Nøva messages, daily briefing card, ads analysis, 1:1 email)</p>
              <p className="mt-1 text-ink/65">Light ≈ {d.base44_credits.per_client_monthly_estimate.light} · typical ≈ {d.base44_credits.per_client_monthly_estimate.typical} · heavy ≈ {d.base44_credits.per_client_monthly_estimate.heavy} credits / month.</p>
              <p className="mt-2 text-ink/65">This month: {num(d.base44_credits.nova_messages_this_month)} Nøva messages ≈ {num(d.base44_credits.nova_credits_this_month)} credits.</p>
              <p className="mt-2 text-[11px] text-ink/45">Rates: {d.base44_credits.source}. SES email and Stripe use no credits.</p>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

const FIELDS = [
  ["Studios", [["studios_require_hypercare", "Studios need HyperCare+", "bool"], ["nova_only_ai_actions", "Nøva-only AI actions (GravïtyCare / Website-only)"]]],
  ["HyperCare+ caps", [["tiers.local.ai_action", "Local · AI actions"], ["tiers.local.marketing_email", "Local · emails"], ["extra_location.ai_action", "Each extra location · AI"], ["extra_location.marketing_email", "Each extra location · emails"], ["tiers.national.ai_action", "National · AI actions"], ["tiers.national.marketing_email", "National · emails"], ["tiers.global.ai_action", "Global · AI actions"], ["tiers.global.marketing_email", "Global · emails"], ["alert_at", "Alert at (share of cap)"], ["overshoot_buffer_pct", "Overshoot buffer (share of cap)"]]],
  ["Refuel packs", [["packs.0.price_usd", "Refuel · price $"], ["packs.0.ai_actions", "Refuel · AI actions"], ["packs.0.emails", "Refuel · emails"], ["packs.1.price_usd", "Big Refuel · price $"], ["packs.1.ai_actions", "Big Refuel · AI actions"], ["packs.1.emails", "Big Refuel · emails"], ["credit_validity_months", "Credits last (months)"], ["auto_refuel.live_charging", "Auto-refuel may charge cards", "bool"], ["auto_refuel.max_monthly_ceiling_usd", "Auto-refuel max ceiling $ / mo"]]],
  ["AI action weights", [["weights.haiku", "Haiku call"], ["weights.sonnet", "Sonnet call"], ["weights.agent_large", "Agent / brain run, large context"], ["weights.large_context_tokens", "Large context from (input tokens)"], ["weights.nova", "Nøva message"]]],
  ["Media credits (SMPL Social, not built)", [["media_credits.enabled", "Media credits enabled", "bool"], ["media_credits.starter.hypercare", "Starter · HyperCare+"], ["media_credits.weights.image", "Credits per image"], ["media_credits.weights.video_second", "Credits per video second"]]],
  ["Cost assumptions", [["costs.sonnet_in_per_m", "Sonnet $ / M in"], ["costs.sonnet_out_per_m", "Sonnet $ / M out"], ["costs.haiku_in_per_m", "Haiku $ / M in"], ["costs.haiku_out_per_m", "Haiku $ / M out"], ["costs.ses_per_1000", "SES $ / 1,000"]]],
  ["Resume after a pause", [["resume.spacing_minutes", "Minutes between resumed posts"], ["resume.window_start", "Posting window start", "text"], ["resume.window_end", "Posting window end", "text"]]],
];
const getP = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const setP = (o, p, v) => { const c = structuredClone(o); const ks = p.split("."); let x = c; ks.slice(0, -1).forEach((k) => { x = x[k] ??= {}; }); x[ks[ks.length - 1]] = v; return c; };

function Settings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["fuel", "config"], queryFn: () => fuelCall("get_config"), staleTime: 60_000 });
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const cfg = draft || q.data?.config;
  if (!cfg) return <p className="py-6 text-[13px] text-ink/50">Loading settings…</p>;
  const save = async () => {
    setBusy(true); setMsg("");
    try { await fuelCall("save_config", { config: cfg }); setDraft(null); setMsg("Saved."); qc.invalidateQueries({ queryKey: ["fuel"] }); }
    catch (e) { setMsg(e?.response?.data?.error || "Couldn't save."); } finally { setBusy(false); }
  };
  return (
    <Panel label="Every number in one place" title={<span className="flex flex-wrap items-center gap-2">Fuel settings <PendingBadge /></span>}>
      <div className="grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-3" data-fuel-settings>
        {FIELDS.map(([group, fields]) => (
          <fieldset key={group} className="border border-hair bg-white p-3">
            <legend className="mono-label px-1 text-[9.5px] text-ink/50">{group}</legend>
            <div className="space-y-2">
              {fields.map(([path, label, type]) => {
                const v = getP(cfg, path);
                return (
                  <label key={path} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="text-ink/70">{label}</span>
                    {type === "bool" ? (
                      <input type="checkbox" checked={!!v} onChange={(e) => setDraft(setP(cfg, path, e.target.checked))} className="h-4 w-4 accent-[#ff3c00]" />
                    ) : (
                      <input type={type === "text" ? "text" : "number"} step="any" value={v ?? ""} onChange={(e) => setDraft(setP(cfg, path, type === "text" ? e.target.value : e.target.value === "" ? null : Number(e.target.value)))} className="h-8 w-24 border border-hair bg-paper px-2 text-right tabular-nums" />
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-hair px-4 py-3">
        <button type="button" onClick={save} disabled={busy || !draft} className="flame-bg flex h-9 items-center gap-2 px-4 text-[13px] font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings</button>
        {draft && <button type="button" onClick={() => setDraft(null)} className="text-[12.5px] text-ink/55 hover:text-ink">Discard changes</button>}
        {msg && <span className="text-[12.5px] text-ink/60">{msg}</span>}
        <span className="ml-auto text-[11px] text-ink/45">Auto-refuel stays opt-in per client and never charges while &quot;may charge cards&quot; is off.</span>
      </div>
    </Panel>
  );
}

function Tools() {
  const q = useQuery({ queryKey: ["client-usage", "overview"], queryFn: async () => (await base44.functions.invoke("usage", { action: "overview" })).data, staleTime: 60_000 });
  const clients = useMemo(() => (q.data?.clients || []).map((c) => ({ id: c.id, business: c.business })), [q.data]);
  const [cid, setCid] = useState("");
  const [pack, setPack] = useState("refuel");
  const [out, setOut] = useState("");
  const qc = useQueryClient();
  const run = async (action) => {
    if (!cid) { setOut("Pick a client first."); return; }
    setOut("Working…");
    try { const r = await fuelCall(action, { client_id: cid, pack }); setOut(JSON.stringify(r)); qc.invalidateQueries({ queryKey: ["fuel"] }); }
    catch (e) { setOut(e?.response?.data?.error || "Failed."); }
  };
  return (
    <Panel label="Credits" title="Grant or test">
      <div className="flex flex-wrap items-center gap-2 p-4 text-[12.5px]">
        <select value={cid} onChange={(e) => setCid(e.target.value)} className="h-9 border border-hair bg-paper px-2"><option value="">Client…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}</select>
        <select value={pack} onChange={(e) => setPack(e.target.value)} className="h-9 border border-hair bg-paper px-2"><option value="refuel">Refuel</option><option value="big_refuel">Big Refuel</option></select>
        <button type="button" onClick={() => run("grant")} className="flex h-9 items-center gap-1.5 bg-ink px-3 font-semibold text-white"><Gift className="h-3.5 w-3.5" /> Grant credits (free)</button>
        <button type="button" onClick={() => run("mock_checkout_completed")} className="flex h-9 items-center gap-1.5 border border-hair bg-white px-3 font-medium"><FlaskConical className="h-3.5 w-3.5" /> Test: mocked checkout.session.completed</button>
      </div>
      {out && <pre className="mx-4 mb-4 overflow-x-auto whitespace-pre-wrap border border-hair bg-paper p-2 text-[11px]">{out}</pre>}
      <p className="border-t border-hair px-4 py-2.5 text-[11px] text-ink/45">The test button runs the real webhook crediting code on a fake payload (no Stripe call, no charge). Test credits are tagged and never count as revenue.</p>
    </Panel>
  );
}

export default function FuelEconomicsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [tab, setTab] = useState("economics");
  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Command / Fuel economics" rightText="Studios · HyperCare+">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 border border-hair bg-card px-2 text-[12.5px]" aria-label="Month" />
      </PageHeader>
      <div className="space-y-5 px-5 pt-5 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {[["economics", "Economics", Fuel], ["settings", "Settings", Settings2]].map(([k, l, I]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`flex h-9 items-center gap-1.5 px-3 text-[13px] font-medium ${tab === k ? "bg-ink text-white" : "border border-hair bg-card text-ink/65 hover:text-ink"}`}><I className="h-3.5 w-3.5" />{l}</button>
          ))}
          <span className="ml-auto"><PendingBadge /></span>
        </div>
        {tab === "economics" ? <Economics month={month} /> : <div className="space-y-5"><Settings /><Tools /></div>}
      </div>
    </div>
  );
}
