import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, Instagram, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { Btn, Field, Select, TextInput, copyText, inputCls } from "./ui";
import { Card, Toggle } from "./connUi";

/* ─── Client Instagram (portal Results + client reports) ────────────── */
// Agency/partner model: the client gives Interstellar access to their Facebook Page (and its linked
// Instagram professional account); the shared Facebook Pages connection can then read it. No passwords.
const CLIENT_KEY = ["social-clients", "reachable"];
const NEEDED_SCOPES = "pages_show_list, pages_read_engagement, pages_messaging, pages_manage_posts, read_insights, pages_manage_metadata, pages_manage_ads, business_management, instagram_basic, instagram_manage_insights";

export const CLIENT_ACCESS_INSTRUCTIONS = `How to give Interstellar access to your Instagram insights (about 3 minutes, no passwords)

Before you start: your Instagram needs to be a Business or Creator account and linked to your Facebook Page. (Instagram app → Settings → Account type and tools. To link: Meta Business Suite → Settings → Linked accounts → Instagram.)

Option 1: Meta Business Suite (recommended)
1. Go to business.facebook.com and open your business.
2. Settings → Users → Partners → Add → "Give a partner access to your assets".
3. Enter Interstellar's Business ID: [INTERSTELLAR BUSINESS ID].
4. Select your Facebook Page and your Instagram account. Turn on "View performance" (insights). Nothing else is needed.
5. Click Save. That's it.

Option 2: Page access (if you don't use Business Suite)
1. On Facebook, switch into your Page → Settings → Page setup → Page access.
2. Under "People with Facebook access", click Add New → search "Justin Cowell" → allow "Insights" (task access is enough; no full control needed).
3. Confirm with your password when Facebook asks. Justin accepts the invite on his side.

We can only view your numbers. We can't post, message or change anything from this access, and you can remove it any time from the same screen.`;

const callClients = async (action, args = {}) => {
  try {
    return (await base44.functions.invoke("social-clients", { action, ...args })).data;
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || "Request failed");
  }
};

export default function ClientInstagram({ connectorId, onSaveConnector }) {
  const qc = useQueryClient();
  const reach = useQuery({ queryKey: CLIENT_KEY, queryFn: () => callClients("reachable"), staleTime: 5 * 60000, retry: false });
  const accountsQ = useQuery({ queryKey: ["SocialAccount"], queryFn: () => base44.entities.SocialAccount.list("-updated_date", 200) });
  const clientsQ = useQuery({ queryKey: ["CRMClient", "social-picker"], queryFn: () => base44.entities.CRMClient.list("business", 500) });
  const [adding, setAdding] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [cid, setCid] = useState(connectorId || "");
  useEffect(() => setCid(connectorId || ""), [connectorId]);
  const accounts = (accountsQ.data || []).filter((a) => (a.platform || "instagram") === "instagram");
  const clients = clientsQ.data || [];
  const free = clients.filter((c) => !accounts.some((a) => a.client_id === c.id));
  const r = reach.data || {};
  const reachable = r.accounts || [];
  const missing = r.missing_scopes || [];
  const refresh = () => { qc.invalidateQueries({ queryKey: ["SocialAccount"] }); qc.invalidateQueries({ queryKey: CLIENT_KEY }); };

  const add = async () => {
    const c = clients.find((x) => x.id === adding);
    if (!c) return;
    await base44.entities.SocialAccount.create({ client_id: c.id, client_name: c.business, platform: "instagram", source: "manual", portal_visible: true, invite_connect: false });
    setAdding("");
    refresh();
  };
  const link = async (clientId, igId) => {
    setBusy(clientId);
    try {
      const res = await callClients("link", { client_id: clientId, ig_user_id: igId });
      const failed = res?.sync?.results?.find((x) => !x.ok);
      toast({ title: failed ? "Linked, but the first sync failed" : "Instagram linked and synced", description: failed?.error, variant: failed ? "destructive" : undefined });
    } catch (e) {
      toast({ title: "Couldn't link", description: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(""); refresh(); }
  };
  const unlink = async (clientId) => { await callClients("unlink", { client_id: clientId }).catch(() => null); refresh(); };
  const syncNow = async () => {
    setBusy("sync");
    try {
      const res = await callClients("sync");
      toast({ title: `Synced ${res?.synced ?? 0} account${res?.synced === 1 ? "" : "s"}`, description: (res?.results || []).filter((x) => !x.ok).map((x) => `${x.client}: ${x.error}`).join(" · ") || undefined });
    } catch (e) {
      toast({ title: "Sync failed", description: String(e?.message || e), variant: "destructive" });
    } finally { setBusy(""); refresh(); }
  };
  const copy = async () => { if (await copyText(CLIENT_ACCESS_INSTRUCTIONS)) { setCopied(true); setTimeout(() => setCopied(false), 1600); } };

  return (
    <Card label="Client reports" title="Client Instagram" right={<Btn variant="ghost" onClick={syncNow} disabled={busy === "sync"}><RefreshCw className={`h-3.5 w-3.5 ${busy === "sync" ? "animate-spin" : ""}`} />Sync all</Btn>}>
      <p className="text-[12px] leading-snug text-ink/60">
        Clients give Interstellar access to their Facebook Page and linked Instagram (no passwords). Link each one to its client here: followers, reach, views, accounts engaged and recent posts sync daily into the client&apos;s Performance tab, monthly report data and portal Results.
      </p>

      {reach.isLoading ? (
        <p className="text-[12px] text-ink/50"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Checking what the Facebook connection can see…</p>
      ) : !r.connected ? (
        <p className="flex items-start gap-1.5 text-[12px] text-[#b42318]"><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />Facebook Pages isn&apos;t connected{r.error ? `: ${r.error}` : ""}.</p>
      ) : (
        <div className="space-y-2 border border-hair bg-paper px-3 py-2.5">
          <p className="font-mono text-[10.5px] text-ink/55">{(r.pages || []).length} Page{(r.pages || []).length === 1 ? "" : "s"} visible · {reachable.length} with Instagram linked</p>
          {missing.length > 0 && (
            <div className="flex items-start gap-1.5 text-[11.5px] leading-snug text-[#c44a00]">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>The Facebook connection is missing <span className="font-mono">{missing.join(", ")}</span>, so Instagram accounts behind client Pages can&apos;t be read yet. Reconnect Facebook Pages with: <span className="font-mono text-[10.5px]">{NEEDED_SCOPES}</span>.</span>
            </div>
          )}
          {(r.pages || []).filter((p) => !p.has_instagram).length > 0 && missing.length === 0 && (
            <p className="text-[11px] text-ink/45">Pages with no Instagram: {(r.pages || []).filter((p) => !p.has_instagram).map((p) => p.name).join(", ")}. The client needs to link their Instagram to that Page.</p>
          )}
        </div>
      )}

      <div className="divide-y divide-hair border border-hair bg-paper">
        {accounts.length === 0 && <p className="px-3 py-4 text-center text-[12px] text-ink/45">No client accounts yet. Add a client below.</p>}
        {accounts.map((a) => <AccountRow key={a.id} a={a} reachable={reachable} busy={busy === a.client_id} onLink={(ig) => link(a.client_id, ig)} onUnlink={() => unlink(a.client_id)} onChange={refresh} />)}
      </div>
      <div className="flex gap-2">
        <Select value={adding} onChange={setAdding} placeholder="Add a client…" options={free.map((c) => ({ value: c.id, label: c.business }))} />
        <Btn onClick={add} disabled={!adding}><Plus className="h-3.5 w-3.5" />Add</Btn>
      </div>

      <div className="border-t border-hair pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-medium">Send clients: how to give access</p>
          <Btn onClick={copy}>{copied ? <Check className="h-3.5 w-3.5 text-[#ff3c00]" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy instructions"}</Btn>
        </div>
        <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap border border-hair bg-paper p-2.5 font-sans text-[11px] leading-snug text-ink/60">{CLIENT_ACCESS_INSTRUCTIONS}</pre>
      </div>

      <button type="button" onClick={() => setAdvanced(!advanced)} className="mono-label text-[9px] text-ink/45 hover:text-[#ff3c00]">{advanced ? "Hide" : "Show"} self-connect option (advanced)</button>
      {advanced && (
        <div className="space-y-2">
          <Field label="App-user connector id" hint={connectorId ? "client self-connect is on" : "off"}>
            <div className="flex gap-2">
              <TextInput value={cid} onChange={setCid} placeholder="Workspace → Connectors → Instagram id" />
              <Btn onClick={() => onSaveConnector(cid.trim())} disabled={cid.trim() === (connectorId || "")}>Save</Btn>
            </div>
          </Field>
          <p className="text-[11px] leading-snug text-ink/45">Only for a workspace Instagram connector backed by your own Meta app (needs Meta App Review). With it set, clients with &ldquo;Invite to self-connect&rdquo; get a Connect your Instagram button in their portal.</p>
        </div>
      )}
    </Card>
  );
}

function AccountRow({ a, reachable, busy, onLink, onUnlink, onChange }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(a);
  useEffect(() => setD(a), [a]);
  const save = async (patch) => {
    setD((x) => ({ ...x, ...patch }));
    await base44.entities.SocialAccount.update(a.id, patch).catch((e) => toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" }));
    onChange();
  };
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const linked = a.source === "facebook_partner" && a.ig_user_id;
  const options = reachable.filter((x) => !x.linked_client_id || x.linked_client_id === a.client_id).map((x) => ({ value: x.ig_user_id, label: `@${x.username} · ${x.page_name}` }));
  const ins = a.insights_30d || {};
  const sourceLabel = linked ? `linked via ${a.fb_page_name || "Facebook Page"}` : a.source === "app_user_connector" ? "self-connected" : "manual";
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        {a.profile_picture_url ? <img src={a.profile_picture_url} alt="" className="h-7 w-7 border border-hair object-cover" /> : <Instagram className="h-4 w-4 shrink-0 text-ink/40" />}
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-[13px] font-medium">{a.client_name}</p>
          <p className="truncate font-mono text-[10px] text-ink/45">{a.handle ? `@${a.handle}` : "not linked"} · {sourceLabel}{a.followers_count != null ? ` · ${Number(a.followers_count).toLocaleString()} followers` : ""}{a.synced_at ? ` · synced ${new Date(a.synced_at).toLocaleDateString()}` : ""}</p>
        </button>
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-ink/40" /> : <Btn variant="ghost" onClick={() => setOpen(!open)}>{open ? "Close" : linked ? "Details" : "Link"}</Btn>}
      </div>
      {a.sync_error && <p className="mt-1.5 text-[11px] leading-snug text-[#b42318]">{a.sync_error}</p>}
      {open && (
        <div className="mt-2.5 space-y-2.5">
          <Field label="Link Instagram" hint={options.length ? `${options.length} reachable` : "none reachable yet"}>
            <div className="flex gap-2">
              <Select value={linked ? a.ig_user_id : ""} onChange={(v) => v && onLink(v)} placeholder={options.length ? "Pick the client's Instagram…" : "Waiting for client access"} options={options} />
              {linked && <Btn variant="ghost" onClick={onUnlink}>Unlink</Btn>}
            </div>
          </Field>
          {linked && (
            <div className="grid grid-cols-3 gap-px border border-hair bg-hair">
              {[["Reach · 30d", ins.reach], ["Views · 30d", ins.views], ["Engaged · 30d", ins.accounts_engaged]].map(([l, v]) => (
                <div key={l} className="bg-card px-2.5 py-2">
                  <p className="mono-label text-[8px] text-ink/45">{l}</p>
                  <p className="text-[16px] font-semibold tabular-nums tracking-[-0.03em]">{v == null ? "—" : Number(v).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
          {!linked && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Handle"><TextInput value={d.handle} onChange={(v) => setD({ ...d, handle: v.replace(/^@/, "") })} onBlur={() => save({ handle: d.handle })} /></Field>
              <Field label="Followers"><input type="number" value={d.followers_count ?? ""} onChange={(e) => setD({ ...d, followers_count: e.target.value })} onBlur={() => save({ followers_count: num(d.followers_count), synced_at: new Date().toISOString() })} className={inputCls} /></Field>
            </div>
          )}
          <Toggle on={a.portal_visible !== false} onChange={(v) => save({ portal_visible: v })} label="Show in client portal" sub="Results tab, once there's data." />
          <Toggle on={a.invite_connect === true} onChange={(v) => save({ invite_connect: v })} label="Invite to self-connect" sub="Only works with the advanced self-connect option set up." />
          <button type="button" onClick={async () => { await base44.entities.SocialAccount.delete(a.id); onChange(); }} className="text-[11.5px] text-ink/45 hover:text-[#b42318]"><Trash2 className="mr-1 inline h-3 w-3" />Remove</button>
        </div>
      )}
    </div>
  );
}
