import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CircleDashed, Facebook, Instagram, Loader2, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/use-toast";
import { DEFAULT_PUBLISH, SOCIAL_STATUS_KEY, fmtTime, saveSocialSettings, tzAbbr } from "./lib/publish";
import { useSocialStatus } from "./PublishDialogs";
import { Btn, Field, Select, TextInput, inputCls } from "./ui";

export function Toggle({ on, onChange, disabled, label, sub }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!on)} className="flex w-full items-start gap-3 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-45">
      <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center border p-0.5 transition-colors ${on ? "border-[#ff3c00] bg-[#ff3c00]" : "border-ink/25 bg-paper"}`}>
        <span className={`h-3.5 w-3.5 transition-transform ${on ? "translate-x-4 bg-white" : "bg-ink/35"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{label}</span>
        {sub && <span className="block text-[11.5px] leading-snug text-ink/50">{sub}</span>}
      </span>
    </button>
  );
}

function Card({ label, title, right, children }) {
  return (
    <section className="border border-hair bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-hair px-4 py-2.5">
        <div>
          <p className="mono-label text-[8.5px] text-ink/45">{label}</p>
          <h3 className="text-[14px] font-semibold tracking-[-0.02em]">{title}</h3>
        </div>
        {right}
      </header>
      <div className="space-y-3 px-4 py-3.5">{children}</div>
    </section>
  );
}

const Pill = ({ ok, children }) => (
  <span className={`mono-label inline-flex items-center gap-1 border px-1.5 py-0.5 text-[8.5px] ${ok ? "border-ink bg-ink text-white" : "border-hair text-ink/50"}`}>
    {ok ? <Check className="h-2.5 w-2.5" /> : <CircleDashed className="h-2.5 w-2.5" />}{children}
  </span>
);

export default function ConnectionsPanel({ open, onClose }) {
  const qc = useQueryClient();
  const st = useSocialStatus();
  const [s, setS] = useState(DEFAULT_PUBLISH);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open && st.data) setS({ ...DEFAULT_PUBLISH, ...st.data.settings }); }, [open, st.data]);

  const save = async (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    setSaving(true);
    try {
      const r = await saveSocialSettings(patch);
      qc.setQueryData(SOCIAL_STATUS_KEY, (old) => (old ? { ...old, settings: r.settings } : old));
    } catch (e) {
      toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const ig = st.instagram || {};
  const fb = st.facebook || {};
  const fbReady = fb.connected && !!s.facebook_page_id;
  const setTime = (i, v) => save({ default_times: s.default_times.map((t, j) => (j === i ? v : t)).filter(Boolean) });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-hair bg-[#ebe8e4] p-0 sm:max-w-[580px]">
        <SheetHeader className="border-b border-hair px-5 pb-4 pt-6 text-left">
          <p className="label-cross text-ink/60">(Social Studio)</p>
          <SheetTitle className="text-[30px] font-semibold leading-none tracking-[-0.045em]">Social <span className="text-[#ff3c00]">/connections</span></SheetTitle>
          <SheetDescription className="text-[12.5px]">Where approved posts go, when they go, and who can see the numbers. {saving && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-5 py-5">
          {/* Instagram */}
          <Card label="Publishing" title="Instagram" right={<Btn variant="ghost" onClick={() => st.refetch()} disabled={st.isFetching}><RefreshCw className={`h-3.5 w-3.5 ${st.isFetching ? "animate-spin" : ""}`} />Check</Btn>}>
            {st.isLoading ? <p className="text-[12.5px] text-ink/50"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Checking the connector…</p> : ig.connected ? (
              <div className="flex items-center gap-3">
                {ig.profile_picture_url ? <img src={ig.profile_picture_url} alt="" className="h-11 w-11 border border-hair object-cover" /> : <Instagram className="h-9 w-9 text-ink/40" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold tracking-[-0.02em]">@{ig.username}</p>
                  <p className="font-mono text-[10.5px] text-ink/50">{ig.followers_count ?? "—"} followers · {ig.media_count ?? "—"} posts</p>
                </div>
                <Pill ok>Connected</Pill>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-[12.5px] text-[#b42318]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Instagram isn&apos;t reachable{ig.error ? `: ${ig.error}` : ""}. Reconnect it in Base44 → Integrations → Instagram Business.</div>
            )}
            {ig.quota && (
              <div>
                <div className="flex justify-between font-mono text-[10px] text-ink/50"><span>API posts, last {ig.quota.window_hours}h</span><span>{ig.quota.usage ?? 0} / {ig.quota.total}</span></div>
                <div className="mt-1 h-1 bg-ink/[0.08]"><div className="h-full flame-bg" style={{ width: `${Math.min(100, ((ig.quota.usage || 0) / (ig.quota.total || 25)) * 100)}%` }} /></div>
              </div>
            )}
            <p className="text-[11.5px] leading-snug text-ink/50">Shared connector on the Interstellar account. Posts publish as single 1080 × 1080 images with the caption and alt text.</p>
          </Card>

          {/* Facebook */}
          <Card label="Cross-posting" title="Facebook Page" right={<Pill ok={fbReady}>{fb.connected ? (s.facebook_page_id ? "Ready" : "Pick a Page") : "Not connected"}</Pill>}>
            {!fb.connected ? (
              <div className="space-y-2 text-[12.5px] leading-snug text-ink/70">
                <p>Connect the Interstellar Facebook Page once and approved posts can go there too.</p>
                <ol className="list-decimal space-y-1 pl-4 text-[12px] text-ink/60">
                  <li>Create the Interstellar Strategies Facebook Page (it doubles as the ads account&apos;s Page).</li>
                  <li>In Base44, open this app → <b>Integrations</b> → <b>Facebook Pages</b> → connect as a <b>shared</b> connector.</li>
                  <li>Grant <span className="font-mono text-[11px]">pages_show_list</span>, <span className="font-mono text-[11px]">pages_manage_posts</span>, <span className="font-mono text-[11px]">pages_read_engagement</span> and tick the Interstellar Page.</li>
                  <li>Come back here, press <b>Check</b>, pick the Page.</li>
                </ol>
              </div>
            ) : (
              <>
                <Field label="Post to this Page">
                  <Select value={s.facebook_page_id} onChange={(v) => save({ facebook_page_id: v })} placeholder="Choose a Page" options={(fb.pages || []).map((p) => ({ value: p.id, label: `${p.name}${p.instagram ? ` · @${p.instagram}` : ""}` }))} />
                </Field>
                {fb.error && <p className="text-[11.5px] text-[#b42318]">{fb.error}</p>}
              </>
            )}
            <Toggle on={!!s.auto_facebook && fbReady} disabled={!fbReady} onChange={(v) => save({ auto_facebook: v })} label="Auto cross-post to Facebook" sub={fbReady ? "New approvals default to Instagram + Facebook. You can still switch it per post." : "Turns on once a Page is connected and chosen."} />
          </Card>

          {/* Schedule defaults */}
          <Card label="Defaults" title={`Posting times · ${tzAbbr(s.timezone)}`}>
            <div className="flex flex-wrap items-end gap-2">
              {s.default_times.map((t, i) => (
                <div key={i} className="flex items-center border border-hair bg-paper">
                  <input type="time" step={900} value={t} onChange={(e) => setTime(i, e.target.value)} className="h-9 bg-transparent px-2 font-mono text-[12.5px] outline-none" />
                  {s.default_times.length > 1 && <button type="button" onClick={() => save({ default_times: s.default_times.filter((_, j) => j !== i) })} className="px-1.5 text-ink/35 hover:text-[#ff3c00]" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
              {s.default_times.length < 4 && <Btn variant="ghost" onClick={() => save({ default_times: [...s.default_times, "17:00"] })}><Plus className="h-3.5 w-3.5" />Time</Btn>}
            </div>
            <p className="text-[11.5px] text-ink/50">Approve suggests the planned day at {s.default_times.map(fmtTime).join(" or ")}. &ldquo;Next open slot&rdquo; uses these times.</p>
            <Field label="Posts per day">
              <div className="flex border border-hair">
                {[1, 2, 3].map((n) => <button key={n} type="button" onClick={() => save({ max_per_day: n })} className={`h-8 flex-1 text-[12px] ${Number(s.max_per_day) === n ? "bg-ink text-white" : "bg-paper text-ink/60"}`}>{n}</button>)}
              </div>
            </Field>
            <Toggle on={!!s.post_weekends} onChange={(v) => save({ post_weekends: v })} label="Allow weekend slots" sub="Next open slot skips Saturday and Sunday when off." />
            <Toggle on={!!s.paused} onChange={(v) => save({ paused: v })} label="Pause automatic publishing" sub="Scheduled posts wait until you turn this off. Post now still works." />
          </Card>

          <ClientInstagram connectorId={s.ig_app_user_connector_id} onSaveConnector={(v) => save({ ig_app_user_connector_id: v })} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Client Instagram (portal Results panel) ───────────────────────── */
function ClientInstagram({ connectorId, onSaveConnector }) {
  const qc = useQueryClient();
  const [cid, setCid] = useState(connectorId || "");
  useEffect(() => setCid(connectorId || ""), [connectorId]);
  const accountsQ = useQuery({ queryKey: ["SocialAccount"], queryFn: () => base44.entities.SocialAccount.list("-updated_date", 200) });
  const clientsQ = useQuery({ queryKey: ["CRMClient", "social-picker"], queryFn: () => base44.entities.CRMClient.list("business", 500) });
  const [adding, setAdding] = useState("");
  const accounts = accountsQ.data || [];
  const clients = clientsQ.data || [];
  const free = clients.filter((c) => !accounts.some((a) => a.client_id === c.id));
  const refresh = () => qc.invalidateQueries({ queryKey: ["SocialAccount"] });

  const add = async () => {
    const c = clients.find((x) => x.id === adding);
    if (!c) return;
    await base44.entities.SocialAccount.create({ client_id: c.id, client_name: c.business, platform: "instagram", source: "manual", portal_visible: true, invite_connect: false });
    setAdding("");
    refresh();
  };

  return (
    <Card label="Client portal" title="Client Instagram" right={<Users className="h-4 w-4 text-ink/35" />}>
      <p className="text-[12px] leading-snug text-ink/60">
        Clients see an Instagram panel in their portal&apos;s Results tab once there&apos;s data: either they connect their own account, or you fill in their numbers here. Nothing shows until then.
      </p>
      <Field label="App-user connector id" hint={connectorId ? "client connect is on" : "client connect is off"}>
        <div className="flex gap-2">
          <TextInput value={cid} onChange={setCid} placeholder="e.g. 6a1f… (Workspace → Connectors)" />
          <Btn onClick={() => onSaveConnector(cid.trim())} disabled={cid.trim() === (connectorId || "")}>Save</Btn>
        </div>
      </Field>
      <p className="text-[11px] leading-snug text-ink/45">
        Instagram supports per-client connections, but it needs a workspace connector first: Base44 workspace settings → Connectors → add Instagram (your Meta app&apos;s client ID and secret, scopes instagram_business_basic + instagram_business_manage_insights), turn on per-user connections, then paste its id here. Clients with &ldquo;Invite to connect&rdquo; on get a Connect your Instagram button.
      </p>

      <div className="divide-y divide-hair border border-hair bg-paper">
        {accounts.length === 0 && <p className="px-3 py-4 text-center text-[12px] text-ink/45">No client accounts yet.</p>}
        {accounts.map((a) => <AccountRow key={a.id} a={a} onChange={refresh} />)}
      </div>
      <div className="flex gap-2">
        <Select value={adding} onChange={setAdding} placeholder="Add a client…" options={free.map((c) => ({ value: c.id, label: c.business }))} />
        <Btn onClick={add} disabled={!adding}><Plus className="h-3.5 w-3.5" />Add</Btn>
      </div>
    </Card>
  );
}

function AccountRow({ a, onChange }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(a);
  useEffect(() => setD(a), [a]);
  const save = async (patch) => {
    setD((x) => ({ ...x, ...patch }));
    await base44.entities.SocialAccount.update(a.id, patch).catch((e) => toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" }));
    onChange();
  };
  const num = (v) => (v === "" || v == null ? null : Number(v));
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Instagram className="h-4 w-4 shrink-0 text-ink/40" />
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-[13px] font-medium">{a.client_name}</p>
          <p className="truncate font-mono text-[10px] text-ink/45">{a.handle ? `@${a.handle}` : "no handle"} · {a.source === "app_user_connector" ? `connected${a.synced_at ? ` ${new Date(a.synced_at).toLocaleDateString()}` : ""}` : "manual"}{a.followers_count != null ? ` · ${a.followers_count} followers` : ""}</p>
        </button>
        <Btn variant="ghost" onClick={() => setOpen(!open)}>{open ? "Close" : "Edit"}</Btn>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Handle"><TextInput value={d.handle} onChange={(v) => setD({ ...d, handle: v.replace(/^@/, "") })} onBlur={() => save({ handle: d.handle })} /></Field>
            <Field label="Followers"><input type="number" value={d.followers_count ?? ""} onChange={(e) => setD({ ...d, followers_count: e.target.value })} onBlur={() => save({ followers_count: num(d.followers_count) })} className={inputCls} /></Field>
            <Field label="Posts"><input type="number" value={d.media_count ?? ""} onChange={(e) => setD({ ...d, media_count: e.target.value })} onBlur={() => save({ media_count: num(d.media_count) })} className={inputCls} /></Field>
            <Field label="Likes (last 12 posts)"><input type="number" value={d.totals?.likes ?? ""} onChange={(e) => setD({ ...d, totals: { ...(d.totals || {}), likes: e.target.value } })} onBlur={() => save({ totals: { ...(d.totals || {}), likes: num(d.totals?.likes) }, synced_at: new Date().toISOString() })} className={inputCls} /></Field>
          </div>
          <Toggle on={a.invite_connect === true} onChange={(v) => save({ invite_connect: v })} label="Invite to connect" sub="Shows a Connect your Instagram card in their Results tab (needs the connector id above)." />
          <Toggle on={a.portal_visible !== false} onChange={(v) => save({ portal_visible: v })} label="Show in portal" />
          {a.sync_error && <p className="text-[11px] text-[#b42318]">{a.sync_error}</p>}
          <button type="button" onClick={async () => { await base44.entities.SocialAccount.delete(a.id); onChange(); }} className="text-[11.5px] text-ink/45 hover:text-[#b42318]"><Trash2 className="mr-1 inline h-3 w-3" />Remove</button>
        </div>
      )}
    </div>
  );
}

