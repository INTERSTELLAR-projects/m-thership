import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, FileUp, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { E, KEYS, adsSync, inScope } from "../lib/adsApi";
import { importGoogleRows, mapGoogleReport } from "../lib/googleCsv";
import { money } from "../lib/metrics";
import { Btn, Field, Notice, Panel, Pill, TextInput, fmtDate } from "../ui";

export default function Connections({ clientId = "", readOnly = false }) {
  const qc = useQueryClient();
  const st = useQuery({ queryKey: KEYS.status, queryFn: () => adsSync({ action: "status" }) });
  const [metaList, setMetaList] = useState(null);
  const [busy, setBusy] = useState("");
  const accounts = (st.data?.accounts || []).filter(inScope(clientId));
  const meta = accounts.filter((a) => a.platform === "meta");
  const google = accounts.filter((a) => a.platform === "google");
  const connected = !!st.data?.meta_connected;

  const refresh = () => { qc.invalidateQueries({ queryKey: KEYS.status }); qc.invalidateQueries({ queryKey: KEYS.accounts }); qc.invalidateQueries({ queryKey: ["ads"] }); };
  const run = async (label, fn) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast({ title: `${label} failed`, description: e.message, variant: "destructive" }); } finally { setBusy(""); }
  };

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Panel label="Meta Ads · Facebook + Instagram" title={connected ? "Connector connected" : "Not connected yet"} right={<Pill tone={connected ? "ok" : "warn"}>{connected ? "connected" : "action needed"}</Pill>} bodyClass="space-y-3 p-3.5">
        {!connected && (
          <ol className="list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-ink/75">
            <li>In the Base44 editor for Møthership open <strong>Integrations</strong> (Connectors) → <strong>Meta Ads</strong>.</li>
            <li>Connect it as the app&apos;s <strong>shared connector</strong> and sign in with the Facebook account that has access to Interstellar&apos;s ad account in Business Manager. Approve the ads permissions Meta asks for.</li>
            <li>Come back here and press <strong>Load ad accounts</strong>, then pick Interstellar&apos;s ad account.</li>
            <li>Add the Facebook <strong>Page id</strong> (and optionally the Instagram account id and pixel id) on the account below — needed only for pushing drafts.</li>
          </ol>
        )}
        <Notice>Sync is read-only and runs daily (5:23 AM PT) plus whenever you press Sync. Anything that changes Meta — budgets, pauses, pushing or launching — only happens from an approval dialog.</Notice>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => run("Status", async () => { await st.refetch(); })} disabled={!!busy}><RefreshCw className="h-3.5 w-3.5" />Re-check</Btn>
            <Btn variant="ink" disabled={!connected || !!busy} onClick={() => run("Load ad accounts", async () => { const out = await adsSync({ action: "list_meta_accounts" }); setMetaList(out.accounts || []); })}>{busy === "Load ad accounts" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Load ad accounts</Btn>
            <Btn variant="flame" disabled={!connected || !meta.length || !!busy} onClick={() => run("Sync", async () => {
              const out = await adsSync({ action: "sync", days: 30 });
              const r = (out.results || [])[0] || {};
              toast({ title: out.ok ? "Synced from Meta" : "Sync finished with errors", description: r.error || `${r.campaigns ?? 0} campaigns · ${r.adsets ?? 0} ad sets · ${r.ads ?? 0} ads · ${(r.metrics_new ?? 0) + (r.metrics_updated ?? 0)} metric rows` });
              refresh();
            })}>{busy === "Sync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Sync now</Btn>
          </div>
        )}
        {metaList && (
          <div className="border border-hair">
            {!metaList.length && <p className="p-3 text-[12px] text-ink/50">This login can&apos;t see any ad accounts.</p>}
            {metaList.map((a) => {
              const have = meta.some((m) => m.account_id === String(a.account_id));
              return (
                <div key={a.account_id} className="flex items-center gap-2 border-b border-hair px-3 py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{a.name}</p>
                    <p className="text-[11px] text-ink/50">act_{a.account_id} · {a.currency} · {a.timezone_name}{a.business?.name ? ` · ${a.business.name}` : ""}{a.account_status !== 1 ? " · not active" : ""}</p>
                  </div>
                  {have ? <Pill tone="ok">added</Pill> : <Btn className="h-7" onClick={() => run("Add account", async () => { await adsSync({ action: "add_account", account_id: a.account_id, name: a.name, currency: a.currency, timezone: a.timezone_name, client_id: clientId, is_primary: !meta.length }); refresh(); })}>Use this account</Btn>}
                </div>
              );
            })}
          </div>
        )}
        {meta.map((a) => <AccountCard key={a.id} a={a} readOnly={readOnly} onSaved={refresh} />)}
      </Panel>

      <div className="space-y-3">
        <Panel label="Google Ads" title="Coming soon — API needs a developer token" right={<Pill tone="info">CSV import</Pill>} bodyClass="space-y-3 p-3.5">
          <p className="text-[12.5px] leading-relaxed text-ink/70">
            Base44 has no Google Ads connector. A direct API connection needs a Google Ads <strong>developer token</strong> (applied for in a Google Ads manager account, API Center), an <strong>OAuth client</strong> (Google Cloud) and a refresh token. The data model is ready (AdAccount platform &quot;google&quot;, the same campaign / metric mirrors), so it can be switched on later without changing the dashboard.
          </p>
          <GoogleCsv clientId={clientId} readOnly={readOnly} onDone={refresh} />
          {google.map((g) => <p key={g.id} className="text-[11.5px] text-ink/55">{g.name} · last import {fmtDate(g.last_synced_at)}</p>)}
        </Panel>
        <Panel label="Later" title="Other platforms" bodyClass="space-y-2 p-3.5">
          {[["TikTok Ads", "Marketing API via a TikTok for Business app; no Base44 connector yet."], ["LinkedIn Ads", "Marketing Developer Platform access required; no Base44 connector yet."], ["Facebook Pages connector", "Not needed for ads — Meta Ads covers Facebook and Instagram placements. Social Studio uses Pages/Instagram for organic posts."]].map(([t, d]) => (
            <div key={t} className="flex items-start gap-2"><CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-ink/30" /><div><p className="text-[13px] font-medium">{t}</p><p className="text-[12px] text-ink/55">{d}</p></div></div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function AccountCard({ a, readOnly, onSaved }) {
  const [f, setF] = useState({ page_id: a.page_id || "", instagram_user_id: a.instagram_user_id || "", pixel_id: a.pixel_id || "" });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await E().AdAccount.update(a.id, f); onSaved(); toast({ title: "Saved" }); } catch (e) { toast({ title: "Couldn't save", description: e.message, variant: "destructive" }); } finally { setSaving(false); }
  };
  return (
    <div className="border border-hair bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-[#ff3c00]" />
        <span className="text-[13px] font-semibold">{a.name || `act_${a.account_id}`}</span>
        <span className="text-[11.5px] text-ink/50">act_{a.account_id} · {a.currency || "USD"}{a.is_primary ? " · primary" : ""}</span>
        <span className="ml-auto text-[11px] text-ink/45">last sync {fmtDate(a.last_synced_at)}</span>
      </div>
      {a.last_sync_error && <p className="mt-1.5 text-[11.5px] text-[#d83300]">{a.last_sync_error}</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Field label="Facebook Page id"><TextInput value={f.page_id} onChange={(v) => setF((x) => ({ ...x, page_id: v.trim() }))} disabled={readOnly} /></Field>
        <Field label="Instagram account id"><TextInput value={f.instagram_user_id} onChange={(v) => setF((x) => ({ ...x, instagram_user_id: v.trim() }))} disabled={readOnly} placeholder="optional" /></Field>
        <Field label="Pixel / dataset id"><TextInput value={f.pixel_id} onChange={(v) => setF((x) => ({ ...x, pixel_id: v.trim() }))} disabled={readOnly} placeholder="for leads / sales goals" /></Field>
      </div>
      {!readOnly && <Btn className="mt-2 h-7" onClick={save} disabled={saving}>Save ids</Btn>}
    </div>
  );
}

function GoogleCsv({ clientId, readOnly, onDone }) {
  const [parsed, setParsed] = useState(null);
  const [busy, setBusy] = useState(false);
  if (readOnly) return null;
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParsed({ ...mapGoogleReport(await file.text()), file: file.name });
  };
  const doImport = async () => {
    setBusy(true);
    try {
      const out = await importGoogleRows(parsed.rows, { clientId });
      toast({ title: "Google Ads data imported", description: `${out.created} new · ${out.updated} updated rows · ${out.campaigns} new campaigns` });
      setParsed(null);
      onDone();
    } catch (err) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 border border-dashed border-hair p-3">
      <p className="text-[12px] text-ink/65">Google Ads → Campaigns (or Ad groups) → <em>Segment → Time → Day</em> → Download → CSV. Columns used: Day, Campaign, (Ad group), Cost, Impr., Clicks, Conversions, Conv. value, Currency code.</p>
      <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 border border-hair bg-card px-3 text-[12.5px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00]">
        <FileUp className="h-3.5 w-3.5" />Choose CSV
        <input type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" className="hidden" onChange={onFile} />
      </label>
      {parsed && (parsed.errors?.length ? <Notice tone="danger">{parsed.errors.join(" ")}</Notice> : (
        <div className="space-y-2">
          <Notice>{parsed.file}: {parsed.summary.rows} rows · {parsed.summary.campaigns} campaigns · {parsed.summary.from} → {parsed.summary.to} · {money(parsed.summary.spend)} spend ({parsed.level === "adset" ? "with ad groups" : "campaign level"}). Re-importing the same days updates them instead of duplicating.</Notice>
          <div className="flex gap-2"><Btn variant="flame" onClick={doImport} disabled={busy}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Import</Btn><Btn onClick={() => setParsed(null)}>Cancel</Btn></div>
        </div>
      ))}
    </div>
  );
}
