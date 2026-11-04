import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Pencil, Plug, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Btn, Field, Select, TextInput } from "../ui";
import { Toggle } from "../connUi";
import { MODE_LABEL, MODE_TONE, PLATFORMS, PLATFORM, defaultSecretName } from "./platforms";
import { INTERSTELLAR, KEYS, channels } from "./store";

// Channels: the 13 platforms for the selected brand. Each account is a SocialAccount (client_id = brand). Mode comes
// from the backend adapters: Auto (connector/secret in place), Needs connection (setup missing), Manual (no posting
// API, or a rule says post by hand). Secrets live in Base44 Secrets; accounts store only the secret's NAME.

const CONNECTOR_LABEL = { instagram: "Instagram Business", facebook_pages: "Facebook Pages", linkedin: "LinkedIn", x: "X", youtube: "YouTube", tiktok: "TikTok" };
const SECRET_PLATFORMS = ["discord", "telegram", "threads", "pinterest", "reddit"];

export default function Channels({ eng }) {
  const qc = useQueryClient();
  const { brand } = eng;
  const [edit, setEdit] = useState(null);
  const [testing, setTesting] = useState(null);
  const st = eng.status || {};
  const accs = eng.accounts.filter((a) => (a.client_id || INTERSTELLAR) === brand.key && a.platform && PLATFORM[a.platform]);
  const modeOf = (a) => eng.modeOf(a.id) || { mode: "manual", reason: eng.statusQ.isLoading ? "checking…" : "unknown" };
  const platformMode = (p) => {
    const mine = accs.filter((a) => a.platform === p.key && a.enabled !== false);
    if (!mine.length) return { mode: p.path.mode === "manual" ? "manual" : "needs_connection", reason: p.path.mode === "manual" ? "Manual assist: copy, download, open, Mark posted" : "Add an account" };
    const ms = mine.map(modeOf);
    return ms.find((m) => m.mode === "auto") || ms.find((m) => m.mode === "needs_connection") || ms[0];
  };
  const summary = PLATFORMS.reduce((s, p) => { const m = platformMode(p).mode; s[m] = (s[m] || 0) + 1; return s; }, {});

  const test = async (a) => {
    setTesting(a.id);
    try {
      const r = await channels("test_account", { account_id: a.id });
      const who = r?.test?.username || r?.test?.bot || r?.test?.webhook || r?.test?.member;
      toast({ title: r?.test?.ok ? "Connection looks good" : `Not ready: ${MODE_LABEL[r?.mode?.mode] || ""}`, description: [r?.mode?.reason, r?.test?.error, who].filter(Boolean).join(" · ") + " · read-only, nothing posted" });
    } catch (e) { toast({ title: "Test failed", description: String(e?.message || e), variant: "destructive" }); } finally { setTesting(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["auto", "needs_connection", "manual"].map((m) => <span key={m} className={`mono-label border px-2 py-1 text-[9px] ${MODE_TONE[m]}`}>{summary[m] || 0} {MODE_LABEL[m]}</span>)}
        <span className="text-[11.5px] text-ink/50">for {brand.name}</span>
        <Btn variant="ghost" className="ml-auto" onClick={() => eng.statusQ.refetch()} disabled={eng.statusQ.isFetching}><RefreshCw className={`h-3.5 w-3.5 ${eng.statusQ.isFetching ? "animate-spin" : ""}`} />Re-check</Btn>
      </div>

      <div className="grid gap-px border border-hair bg-hair md:grid-cols-2">
        <div className="bg-card px-3.5 py-2.5">
          <p className="mono-label text-[8.5px] text-ink/45">Base44 connectors (app-wide, Interstellar&apos;s accounts)</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(CONNECTOR_LABEL).map(([k, l]) => <span key={k} className={`mono-label border px-1.5 py-0.5 text-[8.5px] ${st.connectors?.[k] ? "border-ink bg-ink text-white" : "border-hair text-ink/50"}`}><Plug className="mr-0.5 inline h-2.5 w-2.5" />{l}{st.connectors?.[k] ? " ✓" : ""}</span>)}
          </div>
          {st.connectors?.facebook_pages && !(st.facebook_scopes || []).includes("instagram_content_publish") && <p className="mt-1.5 text-[11px] text-ink/55">Client Instagram publishing needs <span className="font-mono">instagram_content_publish</span> + <span className="font-mono">instagram_basic</span> added to the Facebook Pages connector.</p>}
        </div>
        <div className="bg-card px-3.5 py-2.5">
          <p className="mono-label text-[8.5px] text-ink/45">Base44 Secrets (names only, values never shown)</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(st.secrets || {}).map(([k, ok]) => <span key={k} className={`border px-1.5 py-0.5 font-mono text-[9.5px] ${ok ? "border-ink bg-ink text-white" : "border-hair text-ink/50"}`}><KeyRound className="mr-0.5 inline h-2.5 w-2.5" />{k}{ok ? " ✓" : ""}</span>)}
            {!Object.keys(st.secrets || {}).length && <span className="text-[11px] text-ink/45">{eng.statusQ.isLoading ? "Checking…" : "None referenced yet."}</span>}
          </div>
        </div>
      </div>

      <div className="divide-y divide-hair border border-hair bg-card">
        {PLATFORMS.map((p) => {
          const m = platformMode(p);
          const mine = accs.filter((a) => a.platform === p.key);
          return (
            <div key={p.key} className="grid gap-2 px-3.5 py-3 lg:grid-cols-[190px_minmax(0,1fr)_minmax(0,1.1fr)]">
              <div>
                <div className="flex items-center gap-2"><span className="font-mono text-[10px] font-semibold text-ink/50">{p.short}</span><span className="text-[13.5px] font-semibold">{p.label}</span></div>
                <span className={`mono-label mt-1 inline-block border px-1.5 py-0.5 text-[8.5px] ${MODE_TONE[m.mode]}`}>{MODE_LABEL[m.mode]}</span>
                <p className="mt-1 text-[11px] leading-snug text-ink/50">{m.reason}</p>
              </div>
              <div className="text-[11.5px] leading-snug text-ink/65">
                <p>{p.path.how}</p>
                {p.path.connector && <p className="mt-1 font-mono text-[10px] text-ink/50">Connector: {p.path.connector}{p.path.scopes ? ` · scopes: ${p.path.scopes.join(", ")}` : ""}</p>}
                {p.path.secrets && <p className="mt-1 font-mono text-[10px] text-ink/50">Secrets: {p.path.secrets.map((s) => s.replace("<BRAND>", brand.isInterstellar ? "INTERSTELLAR" : "<CLIENT>")).join(", ")}{!p.path.connector && p.path.scopes ? ` · scopes: ${p.path.scopes.join(", ")}` : ""}</p>}
                {p.notes && <p className="mt-1 text-ink/50">{p.notes}</p>}
              </div>
              <div className="space-y-1">
                {mine.map((a) => {
                  const am = a.enabled === false ? { mode: "manual", reason: "Switched off" } : modeOf(a);
                  return (
                    <div key={a.id} className={`flex items-center gap-2 border border-hair bg-paper px-2 py-1.5 ${a.enabled === false ? "opacity-50" : ""}`}>
                      <span className="min-w-0 flex-1 truncate text-[12px]">{a.display_name || a.handle || a.account_kind || p.label}{a.account_kind ? <span className="text-ink/45"> · {a.account_kind}</span> : null}{a.secret_ref ? <span className="font-mono text-[9.5px] text-ink/40"> · {a.secret_ref}</span> : null}</span>
                      <span className={`mono-label border px-1 py-0.5 text-[8px] ${MODE_TONE[am.mode]}`} title={am.reason}>{MODE_LABEL[am.mode]}</span>
                      <button type="button" onClick={() => test(a)} className="p-1 text-ink/45 hover:text-[#ff3c00]" title="Read-only test (posts nothing)">{testing === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}</button>
                      <button type="button" onClick={() => setEdit(a)} className="p-1 text-ink/45 hover:text-[#ff3c00]" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    </div>
                  );
                })}
                <Btn variant="ghost" className="h-8" onClick={() => setEdit({ platform: p.key, client_id: brand.key, enabled: true, account_kind: p.key === "linkedin" ? "company" : "", secret_ref: defaultSecretName(p.key, brand.isInterstellar ? "INTERSTELLAR" : brand.name) })}><Plus className="h-3.5 w-3.5" />Add {p.label} account</Btn>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11.5px] leading-snug text-ink/50">Connecting a connector or adding a secret is done by Justin in Base44 (Integrations / Secrets). Nothing on this page posts: Test runs read-only checks (Discord webhook info, Telegram getMe, Threads/Pinterest profile, LinkedIn member).</p>

      <AccountDialog a={edit} brand={brand} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); qc.invalidateQueries({ queryKey: KEYS.accounts }); qc.invalidateQueries({ queryKey: KEYS.status }); }} />
    </div>
  );
}

const TARGET_HINT = {
  facebook: "Facebook Page ID (Interstellar uses the Page chosen in Social connections)",
  linkedin: "Company page: numeric organization ID (from the admin URL)",
  pinterest: "Board ID",
  telegram: "Channel: @username or -100… id",
  reddit: "Subreddit name (without r/)",
  threads: "Threads user id (empty = “me”)",
  discord: "Not needed: the webhook is the channel",
  instagram: "Clients: linked through Client Instagram (partner access)",
};
const SYSTEM = ["id", "created_date", "updated_date", "created_by", "created_by_id", "is_sample"];

function AccountDialog({ a, brand, onClose, onSaved }) {
  const [f, setF] = useState(a || {});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { setF(a || {}); setConfirmDel(false); }, [a]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const p = PLATFORM[f.platform];
  const secretOk = !f.secret_ref || /^SOCIAL_[A-Z0-9_]{2,60}$/.test(f.secret_ref);
  const save = async () => {
    if (!secretOk) { toast({ title: "Secret names start with SOCIAL_", description: "Upper case, digits and _ only. Store the value in Base44 Secrets." }); return; }
    setSaving(true);
    try {
      const data = Object.fromEntries(Object.entries(f).filter(([k]) => !SYSTEM.includes(k)));
      const payload = { ...data, client_id: brand.key, client_name: brand.name, source: data.source || "manual" };
      if (f.id) await base44.entities.SocialAccount.update(f.id, payload); else await base44.entities.SocialAccount.create(payload);
      onSaved();
    } catch (e) { toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" }); } finally { setSaving(false); }
  };
  const remove = async () => { await base44.entities.SocialAccount.delete(f.id); setConfirmDel(false); onSaved(); };
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.id ? "Edit" : "Add"} {p?.label} account · {brand.name}</DialogTitle>
          <DialogDescription>{p?.path.how}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Field label="Display name"><TextInput value={f.display_name} onChange={(v) => set("display_name", v)} placeholder={brand.name} /></Field>
          <Field label="Handle"><TextInput value={f.handle} onChange={(v) => set("handle", v)} placeholder="without @" /></Field>
          {f.platform === "linkedin" && <Field label="Kind"><Select value={f.account_kind || "company"} onChange={(v) => set("account_kind", v)} options={[{ value: "company", label: "Company page" }, { value: "personal", label: "Personal profile" }]} /></Field>}
          <Field label="Profile / channel URL" className={f.platform === "linkedin" ? "" : "sm:col-span-2"}><TextInput value={f.url} onChange={(v) => set("url", v)} placeholder="https://…" /></Field>
          <Field label="Target" hint={TARGET_HINT[f.platform] || ""} className="sm:col-span-2"><TextInput value={f.target_id} onChange={(v) => set("target_id", v)} /></Field>
          {SECRET_PLATFORMS.includes(f.platform) && (
            <Field label={f.platform === "reddit" ? "Secret prefix (+ _CLIENT_ID, _CLIENT_SECRET, _USERNAME, _PASSWORD)" : "Base44 Secret name"} hint="the NAME only, never the value" className="sm:col-span-2">
              <TextInput value={f.secret_ref} onChange={(v) => set("secret_ref", v.toUpperCase())} className={secretOk ? "" : "border-[#b42318]"} />
            </Field>
          )}
          <Field label="Max posts / day" hint="blank = schedule default"><TextInput type="number" value={f.daily_limit ?? ""} onChange={(v) => set("daily_limit", v === "" ? null : Number(v))} /></Field>
        </div>
        <Toggle on={f.enabled !== false} onChange={(v) => set("enabled", v)} label="Enabled" sub="Off: no drafts are made for it." />
        <Toggle on={f.mode_override === "manual"} onChange={(v) => set("mode_override", v ? "manual" : "")} label="Always post by hand" sub="Never auto-post this account even when it could." />
        {f.platform === "reddit" && <Toggle on={!!f.own_subreddit} onChange={(v) => set("own_subreddit", v)} label="We own / moderate this subreddit" sub="Only then can it auto-post. Everywhere else, follow the sub's self-promotion rules and post by hand." />}
        <DialogFooter className="gap-2">
          {f.id && (confirmDel ? <Btn variant="ink" onClick={remove}>Confirm remove</Btn> : <Btn variant="ghost" onClick={() => setConfirmDel(true)}>Remove</Btn>)}
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="flame" onClick={save} disabled={saving}>{saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Save</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
