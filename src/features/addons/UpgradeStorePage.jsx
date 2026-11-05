// Møthership > Upgrade Store (admin). Create, price and publish add-ons; choose which clients see each one; grant or
// revoke by hand; issue client-app keys; and watch revenue and the funnel (views -> trials -> purchases).
// Data: the `addons` function (admin_overview, save, grant, revoke, reset_trial, issue_key, mock_* test actions).
// Going live and setting a price are Justin's calls (approval policy: money + pricing). Test purchases never charge.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, Eye, FlaskConical, KeyRound, Loader2, Pencil, Plus, Save, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Panel, Tag, Stat, Empty } from "@/features/clients/ui";
import { addonsCall, errText, usd } from "./api";

const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");
const STATUS_TONE = { draft: "amber", live: "green", retired: "muted" };
const STATE_TONE = { active: "green", trial: "flame", canceled: "muted", preview: "muted" };
const inputCls = "w-full border border-hair bg-paper px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]";

function priceSummary(a) {
  const one = Number(a.price_one_time) || 0, mo = Number(a.price_monthly) || 0;
  if (a.price_model === "one_time") return one ? `${usd(one)} one-time` : a.payment_link_one_time ? "Payment Link" : "Not priced";
  if (a.price_model === "monthly") return mo ? `${usd(mo)}/mo` : a.payment_link_monthly ? "Payment Link" : "Not priced";
  return one && mo ? `${usd(one)} + ${usd(mo)}/mo` : a.payment_link_monthly ? "Payment Link" : "Not priced";
}

export default function UpgradeStorePage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["addons", "admin"], queryFn: () => addonsCall("admin_overview"), staleTime: 15_000 });
  const [editing, setEditing] = useState(null); // addon object or {} for new
  const [selected, setSelected] = useState("");
  const d = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["addons"] });
  const addons = d?.addons || [];
  const sel = addons.find((a) => a.key === selected) || addons[0];
  const totals = useMemo(() => addons.reduce((t, a) => ({
    revenue: t.revenue + (a.funnel?.revenue || 0), mrr: t.mrr + (a.funnel?.mrr || 0), viewed: t.viewed + (a.funnel?.viewed || 0),
    trials: t.trials + (a.funnel?.trials || 0), buyers: t.buyers + (a.funnel?.buyers || 0), live: t.live + (a.status === "live" ? 1 : 0),
  }), { revenue: 0, mrr: 0, viewed: 0, trials: 0, buyers: 0, live: 0 }), [addons]);

  return (
    <div data-upgrade-store-admin>
      <PageHeader breadcrumb="Command / Upgrade Store" rightText={d ? `${addons.length} add-on${addons.length === 1 ? "" : "s"} · ${totals.live} live` : ""}>
        <button type="button" onClick={() => setEditing({})} className="flame-bg flex h-10 items-center gap-2 px-4 text-[13px] font-semibold text-white"><Plus className="h-4 w-4" /> New add-on</button>
      </PageHeader>
      <div className="space-y-5 px-5 py-6 md:px-8">
        {q.isLoading ? <p className="flex items-center gap-2 py-10 text-[13px] text-ink/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading the Upgrade Store…</p>
          : q.isError ? <p className="py-10 text-[13px] text-red-700">{errText(q.error, "Couldn't load the Upgrade Store.")}</p> : (
            <>
              <section className="grid grid-cols-2 overflow-hidden rounded-md border border-hair bg-card md:grid-cols-3 xl:grid-cols-6" data-totals>
                <Stat value={usd(totals.revenue)} label="Upgrade revenue" hint="real charges, all time" accent />
                <Stat value={usd(totals.mrr)} label="Add-on MRR" hint="active monthly licenses" />
                <Stat value={totals.viewed} label="Clients who looked" hint="opened a detail view" />
                <Stat value={totals.trials} label="Trials" hint={totals.viewed ? `${pct(totals.trials / totals.viewed)} of viewers` : ""} />
                <Stat value={totals.buyers} label="Purchases" hint={totals.trials ? `${pct(totals.buyers / totals.trials)} of trials` : ""} />
                <Stat value={d.stripe_ready ? "Ready" : "Off"} label="Stripe checkout" hint={d.stripe_ready ? "inline price_data" : "STRIPE_SECRET_KEY missing"} />
              </section>

              {!addons.length ? <Panel><Empty action={<button type="button" onClick={() => setEditing({})} className="flame-bg h-10 px-4 text-[13px] font-semibold text-white">Create the first add-on</button>}>No add-ons yet. Create one, price it, choose who sees it, then set it live.</Empty></Panel> : (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" data-addon-list>
                  {addons.map((a) => (
                    <article key={a.id} className={`rounded-md border bg-card ${sel?.key === a.key ? "border-[#ff3c00]" : "border-hair"}`}>
                      <button type="button" onClick={() => setSelected(a.key)} className="block w-full p-4 text-left">
                        <div className="flex flex-wrap items-center gap-2"><Tag tone={STATUS_TONE[a.status] || "muted"}>{a.status}</Tag><span className="mono-label text-[9px] text-ink/45">{a.key}</span></div>
                        <p className="mt-2 text-[17px] font-semibold tracking-[-0.02em]">{a.name}</p>
                        <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink/55">{a.tagline}</p>
                        <p className={`mt-2 text-[13px] font-medium ${a.plans?.length ? "" : "text-amber-700"}`}>{priceSummary(a)}</p>
                        {a.pricing_note && <p className="mt-1 flex items-start gap-1.5 bg-amber-500/10 px-2 py-1 text-[11.5px] text-amber-900"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{a.pricing_note}</p>}
                        <Funnel f={a.funnel} />
                        <p className="mt-2 text-[11.5px] text-ink/50">Visible to {a.availability === "all" ? "every client" : `${a.offered_to?.length || 0} client${a.offered_to?.length === 1 ? "" : "s"}`} · trial: {a.trial_mode === "none" ? "none" : a.trial_mode === "one_use" ? "one use" : a.trial_mode === "uses" ? `${a.trial_uses} uses` : `${a.trial_days} days`}</p>
                      </button>
                      <div className="flex gap-2 border-t border-hair px-4 py-2.5">
                        <button type="button" onClick={() => setEditing(a)} className="inline-flex h-8 items-center gap-1.5 border border-hair px-2.5 text-[12px] font-medium hover:border-ink/40"><Pencil className="h-3.5 w-3.5" /> Edit & price</button>
                        {a.offered_to?.[0] && <a href={`/portal/${a.offered_to[0]}?tab=upgrades&addon=${a.key}`} className="inline-flex h-8 items-center gap-1.5 border border-hair px-2.5 text-[12px] font-medium hover:border-ink/40"><Eye className="h-3.5 w-3.5" /> Preview in portal</a>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {sel && <ClientsPanel addon={sel} rows={(d.client_addons || []).filter((r) => r.addon_key === sel.key)} clients={d.clients || []} onChanged={refresh} />}
            </>
          )}
      </div>
      {editing && <Editor addon={editing} clients={d?.clients || []} onClose={() => setEditing(null)} onSaved={(a) => { setEditing(null); if (a?.key) setSelected(a.key); refresh(); }} />}
    </div>
  );
}

function Funnel({ f = {} }) {
  const steps = [["Views", f.viewed || 0, `${f.views || 0} opens`], ["Trials", f.trials || 0, pct(f.view_to_trial)], ["Purchases", f.buyers || 0, pct(f.trial_to_buy)]];
  const max = Math.max(1, ...steps.map((s) => s[1]));
  return (
    <div className="mt-3 space-y-1" data-funnel>
      {steps.map(([label, n, hint]) => (
        <div key={label} className="flex items-center gap-2 text-[11.5px]">
          <span className="w-16 text-ink/55">{label}</span>
          <div className="h-2 flex-1 bg-ink/[0.06]"><div className="h-full flame-bg" style={{ width: `${(n / max) * 100}%` }} /></div>
          <span className="w-6 text-right font-medium tabular-nums">{n}</span>
          <span className="w-16 text-right text-ink/45">{hint}</span>
        </div>
      ))}
      <p className="pt-1 text-[11.5px] text-ink/55">Revenue <span className="font-semibold text-ink">{usd(f.revenue)}</span>{f.mrr ? ` · ${usd(f.mrr)}/mo MRR` : ""}</p>
    </div>
  );
}

function ClientsPanel({ addon, rows, clients, onChanged }) {
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState("");
  const [key, setKey] = useState(null);
  const byClient = new Map(rows.map((r) => [r.client_id, r]));
  const ids = [...new Set([...(addon.offered_to || []), ...rows.map((r) => r.client_id)])];
  const list = ids.map((id) => ({ client: clients.find((c) => c.id === id) || { id, business: byClient.get(id)?.client_name || id }, row: byClient.get(id) || null }));
  const act = async (action, client_id, extra = {}) => {
    setBusy(`${action}:${client_id}`); setErr(""); setMsg(""); setConfirm("");
    try {
      const r = await addonsCall(action, { key: addon.key, client_id, ...extra });
      if (r?.error) throw new Error(r.error);
      if (action === "issue_key") setKey({ client_id, value: r.license_key });
      if (action === "mock_checkout_completed") setMsg(r?.result?.activated ? "Test purchase ran through the webhook path: add-on activated (marked test, not counted as revenue)." : `Test purchase result: ${JSON.stringify(r?.result || {})}`);
      if (action === "mock_subscription_deleted") setMsg("Test cancel ran through the webhook path: add-on deactivated.");
      if (action === "grant") setMsg("Granted. The client has full access now.");
      if (action === "revoke") setMsg("Revoked. Their work is kept; access is off.");
      if (action === "reset_trial") setMsg("Trial reset. They can try it again.");
      onChanged();
    } catch (e) { setErr(errText(e)); } finally { setBusy(""); }
  };
  const B = ({ action, id, children, tone = "", extra }) => (
    <button type="button" disabled={!!busy} onClick={() => act(action, id, extra)} className={`inline-flex h-7 items-center gap-1 border px-2 text-[11.5px] font-medium disabled:opacity-50 ${tone || "border-hair hover:border-ink/40"}`}>
      {busy === `${action}:${id}` && <Loader2 className="h-3 w-3 animate-spin" />}{children}
    </button>
  );
  return (
    <Panel label={addon.name} title="Clients, trials and access" action={
      <div className="flex items-center gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className="h-8 border border-hair bg-paper px-2 text-[12px]" aria-label="Client to grant">
          <option value="">Grant to a client…</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}
        </select>
        <button type="button" disabled={!pick || !!busy} onClick={() => act("grant", pick)} className="h-8 bg-ink px-3 text-[12px] font-medium text-white disabled:opacity-40">Grant</button>
      </div>
    }>
      {msg && <p role="status" className="border-b border-hair bg-green-50 px-4 py-2 text-[12.5px] text-green-900">{msg}</p>}
      {err && <p role="alert" className="border-b border-hair bg-red-50 px-4 py-2 text-[12.5px] text-red-800">{err}</p>}
      {key && (
        <div className="border-b border-hair bg-paper px-4 py-3 text-[12.5px]" data-license-key>
          <p className="flex items-center gap-1.5 font-medium"><KeyRound className="h-3.5 w-3.5 text-[#ff3c00]" /> App key for {clients.find((c) => c.id === key.client_id)?.business}. Shown once.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate border border-hair bg-card px-2 py-1.5 font-mono text-[11.5px]">{key.value}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(key.value).then(() => setMsg("Key copied.")).catch(() => setErr("Copy failed. Select the key and copy it."))} className="inline-flex h-8 items-center gap-1 border border-hair px-2.5 text-[12px]"><Copy className="h-3.5 w-3.5" /> Copy</button>
            <button type="button" onClick={() => setKey(null)} className="p-1.5 text-ink/45 hover:text-ink" aria-label="Hide key"><X className="h-4 w-4" /></button>
          </div>
          <p className="mt-1.5 text-ink/55">Paste it into the client app as the secret <span className="font-mono">MOTHERSHIP_ADDON_KEY</span>. Issuing a new key replaces this one.</p>
        </div>
      )}
      {!list.length ? <Empty>No client can see this add-on yet. Edit it and choose who sees it.</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[12.5px]" data-client-table>
            <thead><tr className="border-b border-hair text-left"><th className="px-4 py-2 font-medium text-ink/55">Client</th><th className="px-2 py-2 font-medium text-ink/55">State</th><th className="px-2 py-2 font-medium text-ink/55">Trial</th><th className="px-2 py-2 font-medium text-ink/55">Views</th><th className="px-2 py-2 font-medium text-ink/55">Paid</th><th className="px-2 py-2 font-medium text-ink/55">App key</th><th className="px-4 py-2 text-right font-medium text-ink/55">Actions</th></tr></thead>
            <tbody className="divide-y divide-hair">
              {list.map(({ client, row }) => {
                const paid = (row?.purchases || []).filter((p) => !p.test).reduce((s, p) => s + (Number(p.amount_usd) || 0), 0);
                const tests = (row?.purchases || []).filter((p) => p.test).length;
                return (
                  <tr key={client.id}>
                    <td className="px-4 py-2.5"><p className="font-medium">{client.business}</p>{client.industry && <p className="text-[11px] text-ink/45">{client.industry}</p>}</td>
                    <td className="px-2 py-2.5"><Tag tone={STATE_TONE[row?.state] || "muted"}>{row?.state || "preview"}</Tag>{row?.cancel_at && <p className="text-[10.5px] text-ink/45">ends {fmtDay(row.cancel_at)}</p>}</td>
                    <td className="px-2 py-2.5 tabular-nums">{row?.trial_started_at ? (row.trial_uses_total ? `${row.trial_uses_left ?? 0}/${row.trial_uses_total} left` : `ends ${fmtDay(row.trial_ends_at)}`) : "—"}</td>
                    <td className="px-2 py-2.5 tabular-nums">{row?.views || 0}</td>
                    <td className="px-2 py-2.5 tabular-nums">{paid ? usd(paid) : "—"}{tests ? <span className="ml-1 text-[10.5px] text-ink/45">+{tests} test</span> : null}</td>
                    <td className="px-2 py-2.5">{row?.has_license_key ? <span className="font-mono text-[11px] text-ink/55">…{row.license_key_hint}{row.last_app_check_at ? ` · seen ${fmtDay(row.last_app_check_at)}` : ""}</span> : <span className="text-ink/40">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {row?.state !== "active" && <B action="grant" id={client.id}>Grant</B>}
                        {row?.state === "active" && (confirm === client.id ? (
                          <>
                            <B action="revoke" id={client.id} tone="border-red-300 text-red-700 hover:border-red-500">Yes, revoke</B>
                            {row.stripe_subscription_id && <B action="revoke" id={client.id} extra={{ cancel_stripe: true }} tone="border-red-300 text-red-700 hover:border-red-500">Revoke + end Stripe sub</B>}
                            <button type="button" onClick={() => setConfirm("")} className="h-7 px-2 text-[11.5px] text-ink/55">Keep</button>
                          </>
                        ) : <button type="button" onClick={() => setConfirm(client.id)} className="inline-flex h-7 items-center border border-hair px-2 text-[11.5px] font-medium hover:border-ink/40">Revoke</button>)}
                        {row?.trial_started_at && <B action="reset_trial" id={client.id}>Reset trial</B>}
                        <B action="issue_key" id={client.id}><KeyRound className="h-3 w-3" /> {row?.has_license_key ? "New key" : "App key"}</B>
                        {addon.plans?.length > 0 && row?.state !== "active" && <B action="mock_checkout_completed" id={client.id} tone="border-dashed border-ink/25 text-ink/60"><FlaskConical className="h-3 w-3" /> Test purchase</B>}
                        {row?.state === "active" && row?.stripe_subscription_id && <B action="mock_subscription_deleted" id={client.id} tone="border-dashed border-ink/25 text-ink/60"><FlaskConical className="h-3 w-3" /> Test cancel</B>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-hair px-4 py-2.5 text-[11.5px] text-ink/45">Test purchase / Test cancel run the real webhook code on a fake Stripe payload. Nothing is charged and test rows never count as revenue.</p>
    </Panel>
  );
}

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const mediaFrom = (s) => lines(s).map((l) => { const [url, ...cap] = l.split("|").map((x) => x.trim()); return { type: /\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "image", url, caption: cap.join(" ") }; });

function Editor({ addon, clients, onClose, onSaved }) {
  const isNew = !addon.id;
  const [f, setF] = useState(() => ({
    name: "", key: "", tagline: "", category: "", description: "", demo_url: "", price_model: "one_time", price_one_time: "", price_monthly: "",
    payment_link_one_time: "", payment_link_monthly: "", pricing_note: "", trial_mode: "one_use", trial_uses: 3, trial_days: 7, availability: "selected",
    delivery_type: "external_url", external_url: "", feature_flag: "", provisioning_notes: "", status: "draft", sort_order: 100, notes: "",
    ...addon,
    highlights_text: (addon.highlights || []).join("\n"), media_text: (addon.media || []).map((m) => [m.url, m.caption].filter(Boolean).join(" | ")).join("\n"),
    industries_text: (addon.industries || []).join(", "), client_ids: addon.client_ids || [],
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));
  const toggleClient = (id) => setF((s) => ({ ...s, client_ids: s.client_ids.includes(id) ? s.client_ids.filter((x) => x !== id) : [...s.client_ids, id] }));
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const payload = {
        id: addon.id, key: isNew ? (f.key || f.name) : undefined, name: f.name, tagline: f.tagline, category: f.category, description: f.description, demo_url: f.demo_url,
        price_model: f.price_model, price_one_time: f.price_one_time === "" ? null : f.price_one_time, price_monthly: f.price_monthly === "" ? null : f.price_monthly,
        payment_link_one_time: f.payment_link_one_time, payment_link_monthly: f.payment_link_monthly, pricing_note: f.pricing_note,
        trial_mode: f.trial_mode, trial_uses: f.trial_uses, trial_days: f.trial_days, availability: f.availability, client_ids: f.client_ids,
        industries: f.industries_text.split(",").map((x) => x.trim()).filter(Boolean), highlights: lines(f.highlights_text), media: mediaFrom(f.media_text),
        delivery_type: f.delivery_type, external_url: f.external_url, feature_flag: f.feature_flag, provisioning_notes: f.provisioning_notes,
        status: f.status, sort_order: f.sort_order, notes: f.notes,
      };
      const r = await addonsCall("save", { addon: payload });
      if (r?.error) throw new Error(r.error);
      onSaved(r.addon);
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const L = ({ label, hint, children, wide }) => (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1 block text-[12px] font-medium">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-ink/45">{hint}</span>}</label>
  );
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-ink/40 backdrop-blur-[1px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={isNew ? "New add-on" : `Edit ${addon.name}`} className="flex h-full w-full max-w-[720px] flex-col bg-[#f7f5f2] shadow-2xl" data-addon-editor>
        <div className="h-[3px] shrink-0 bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" />
        <header className="flex items-center justify-between border-b border-hair px-5 py-4">
          <div><p className="mono-label text-[9.5px] text-ink/50">Upgrade Store</p><h2 className="text-[20px] font-semibold tracking-[-0.03em]">{isNew ? "New add-on" : addon.name}</h2></div>
          <button type="button" onClick={onClose} className="p-1.5 text-ink/50 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="grid gap-3 sm:grid-cols-2">
            <p className="mono-label text-[10px] text-[#ff3c00] sm:col-span-2">What it is</p>
            {L({ label: "Name", children: <input className={inputCls} value={f.name} onChange={set("name")} placeholder="Dreamscape 3D™" /> })}
            {L({ label: "Key", hint: isNew ? "Permanent. Client apps check this key." : "Permanent.", children: <input className={inputCls} value={f.key} onChange={set("key")} disabled={!isNew} placeholder="dreamscape_3d" /> })}
            {L({ label: "Tagline", wide: true, children: <input className={inputCls} value={f.tagline} onChange={set("tagline")} /> })}
            {L({ label: "Category", children: <input className={inputCls} value={f.category} onChange={set("category")} placeholder="Design & sales" /> })}
            {L({ label: "Live demo link (optional)", children: <input className={inputCls} value={f.demo_url} onChange={set("demo_url")} placeholder="https://…" /> })}
            {L({ label: "What it does", wide: true, hint: "Blank line = new paragraph.", children: <textarea rows={6} className={inputCls} value={f.description} onChange={set("description")} /> })}
            {L({ label: "Highlights", wide: true, hint: "One per line.", children: <textarea rows={4} className={inputCls} value={f.highlights_text} onChange={set("highlights_text")} /> })}
            {L({ label: "Screenshots / video", wide: true, hint: "One https link per line, optional caption after a |. .mp4 / .webm show as video.", children: <textarea rows={3} className={inputCls} value={f.media_text} onChange={set("media_text")} /> })}
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <p className="mono-label text-[10px] text-[#ff3c00] sm:col-span-2">Price (your call)</p>
            {L({ label: "Price model", children: <select className={inputCls} value={f.price_model} onChange={set("price_model")}><option value="one_time">One-time</option><option value="monthly">Monthly</option><option value="both">Setup + monthly</option></select> })}
            <div />
            {f.price_model !== "monthly" && L({ label: f.price_model === "both" ? "Setup fee (USD)" : "Price (USD)", children: <input type="number" min="0" className={inputCls} value={f.price_one_time ?? ""} onChange={set("price_one_time")} placeholder="Not priced" /> })}
            {f.price_model !== "one_time" && L({ label: "Monthly (USD)", children: <input type="number" min="0" className={inputCls} value={f.price_monthly ?? ""} onChange={set("price_monthly")} placeholder="Not priced" /> })}
            {f.price_model === "one_time" && L({ label: "Stripe Payment Link override (optional)", wide: true, hint: "Leave empty to use Stripe Checkout with the price above.", children: <input className={inputCls} value={f.payment_link_one_time} onChange={set("payment_link_one_time")} placeholder="https://buy.stripe.com/…" /> })}
            {f.price_model !== "one_time" && L({ label: "Stripe Payment Link override (optional)", wide: true, hint: "A subscription Payment Link. Leave empty to use Stripe Checkout with the prices above.", children: <input className={inputCls} value={f.payment_link_monthly} onChange={set("payment_link_monthly")} placeholder="https://buy.stripe.com/…" /> })}
            {L({ label: "Pricing note (internal)", wide: true, children: <input className={inputCls} value={f.pricing_note} onChange={set("pricing_note")} /> })}
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <p className="mono-label text-[10px] text-[#ff3c00] sm:col-span-2">Free try</p>
            {L({ label: "Trial", children: <select className={inputCls} value={f.trial_mode} onChange={set("trial_mode")}><option value="none">No trial</option><option value="one_use">One free use</option><option value="uses">N free uses</option><option value="days">N days</option></select> })}
            {f.trial_mode === "uses" && L({ label: "Free uses", children: <input type="number" min="1" className={inputCls} value={f.trial_uses} onChange={set("trial_uses")} /> })}
            {f.trial_mode === "days" && L({ label: "Trial days", children: <input type="number" min="1" className={inputCls} value={f.trial_days} onChange={set("trial_days")} /> })}
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <p className="mono-label text-[10px] text-[#ff3c00] sm:col-span-2">Who sees it</p>
            {L({ label: "Availability", children: <select className={inputCls} value={f.availability} onChange={set("availability")}><option value="selected">Selected clients</option><option value="industries">Industries (+ selected)</option><option value="all">All clients</option></select> })}
            {f.availability === "industries" && L({ label: "Industries", hint: "Comma-separated words matched in the client's industry.", children: <input className={inputCls} value={f.industries_text} onChange={set("industries_text")} placeholder="hardscap, landscap" /> })}
            {f.availability !== "all" && (
              <div className="sm:col-span-2">
                <span className="mb-1 block text-[12px] font-medium">Selected clients</span>
                <div className="grid max-h-48 gap-1 overflow-y-auto border border-hair bg-paper p-2 sm:grid-cols-2">
                  {clients.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-1 py-0.5 text-[12.5px]"><input type="checkbox" checked={f.client_ids.includes(c.id)} onChange={() => toggleClient(c.id)} className="accent-[#ff3c00]" />{c.business}</label>
                  ))}
                </div>
              </div>
            )}
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <p className="mono-label text-[10px] text-[#ff3c00] sm:col-span-2">Delivery</p>
            {L({ label: "How it's delivered", children: <select className={inputCls} value={f.delivery_type} onChange={set("delivery_type")}><option value="external_url">Client app (link)</option><option value="feature_flag">Feature flag in Møthership</option><option value="provisioning_task">Provisioning task for you</option></select> })}
            {f.delivery_type === "external_url" && L({ label: "App link", children: <input className={inputCls} value={f.external_url} onChange={set("external_url")} placeholder="https://…" /> })}
            {f.delivery_type === "feature_flag" && L({ label: "Feature flag key", children: <input className={inputCls} value={f.feature_flag} onChange={set("feature_flag")} /> })}
            {f.delivery_type === "provisioning_task" && L({ label: "What to set up", wide: true, children: <textarea rows={2} className={inputCls} value={f.provisioning_notes} onChange={set("provisioning_notes")} /> })}
          </section>
          <section className="grid gap-3 sm:grid-cols-2">
            <p className="mono-label text-[10px] text-[#ff3c00] sm:col-span-2">Status</p>
            {L({ label: "Status", hint: "Live turns on checkout and gating in client apps. It needs a price.", children: <select className={inputCls} value={f.status} onChange={set("status")}><option value="draft">Draft (only you see it in previews)</option><option value="live">Live</option><option value="retired">Retired (owners keep it)</option></select> })}
            {L({ label: "Sort order", children: <input type="number" className={inputCls} value={f.sort_order} onChange={set("sort_order")} /> })}
            {L({ label: "Internal notes", wide: true, children: <textarea rows={2} className={inputCls} value={f.notes} onChange={set("notes")} /> })}
          </section>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-hair px-5 py-3">
          <p className={`text-[12px] ${err ? "text-red-700" : "text-ink/45"}`} role={err ? "alert" : undefined}>{err || "Saved changes apply to the portal right away."}</p>
          <button type="button" onClick={save} disabled={busy || !f.name} className="flame-bg flex h-10 items-center gap-2 px-5 text-[13px] font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</button>
        </footer>
      </div>
    </div>
  );
}
