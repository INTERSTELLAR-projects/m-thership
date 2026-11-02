import { useEffect, useState } from "react";
import { Check, ChevronDown, Plus, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Tag, Panel } from "@/features/clients/ui";
import { CRITERIA, KINDS, METHODS, DEFAULT_RULES, inputCls, nowIso, domainOf, csvToTargets, saveRules } from "./lib";

// ---------------- Client criteria ----------------

function CriteriaRow({ c, crit, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [v, setV] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [touched, setTouched] = useState(false);
  const profile = crit.profile;

  useEffect(() => {
    if (touched) return; // live reloads must not wipe what Justin is typing
    const m = crit.merged;
    setV({
      nap_name: m.name || "", nap_address: m.address || "", nap_phone: m.phone || "", website: m.website || "",
      industry: m.industry || "", services: Array.isArray(m.services) ? m.services.join(", ") : m.services || "",
      city: m.city || "", service_area: m.service_area || "", description: m.description || "",
      hours: profile?.hours || "", categories: (profile?.categories || []).join(", "),
      pitch_angles: profile?.pitch_angles || "", avoid: profile?.avoid || "",
    });
  }, [crit, profile, touched]);

  const write = async (fields) => {
    const data = { client_id: c.id, client_name: c.business, ...fields };
    if (profile?.id) await base44.entities.OutreachProfile.update(profile.id, data);
    else await base44.entities.OutreachProfile.create({ enabled: false, ...data });
  };
  const toggle = async () => { setBusy(true); try { await write({ enabled: !profile?.enabled }); } finally { setBusy(false); } };
  const save = async () => {
    setBusy(true);
    try {
      await write({
        ...v,
        services: String(v.services || "").split(",").map((s) => s.trim()).filter(Boolean),
        categories: String(v.categories || "").split(",").map((s) => s.trim()).filter(Boolean),
      });
      setSaved(true); setTouched(false); setTimeout(() => setSaved(false), 1500);
    } finally { setBusy(false); }
  };
  const set = (k) => (e) => { setTouched(true); setV((s) => ({ ...s, [k]: e.target.value })); };

  return (
    <div className="border-t border-hair first:border-t-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-[180px] flex-1 items-center gap-2 text-left">
          <ChevronDown className={`h-3.5 w-3.5 text-ink/40 transition-transform ${open ? "rotate-180" : ""}`} />
          <span className="text-[13.5px] font-medium">{c.business}</span>
          {crit.ready ? <Tag tone="green">ready</Tag> : <Tag tone="amber">missing {crit.missing.length}</Tag>}
        </button>
        <div className="flex flex-wrap gap-1">
          {CRITERIA.map((k) => {
            const val = crit.merged[k.key];
            const has = Array.isArray(val) ? val.length : !!String(val || "").trim();
            return <span key={k.key} title={k.label} className={`mono-label px-1.5 py-0.5 text-[8.5px] ${has ? "bg-green-600/10 text-green-800" : k.required ? "bg-red-600/10 text-red-700" : "bg-ink/[0.06] text-ink/45"}`}>{k.label.replace("NAP · ", "")}</span>;
          })}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink/65">
          <input type="checkbox" disabled={busy} checked={!!profile?.enabled} onChange={toggle} className="h-4 w-4 accent-[#ff3c00]" />
          Research on
        </label>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-hair bg-paper px-4 py-4 md:grid-cols-2">
          {!crit.ready && <p className="text-[12px] text-amber-800 md:col-span-2">Research won't run until these are filled: {crit.missing.join(", ")}.</p>}
          <p className="text-[11.5px] text-ink/50 md:col-span-2">Pre-filled from the client record and Constellations. Saving stores these as the exact NAP every citation should use (overrides for outreach only).</p>
          {CRITERIA.map((k) => (
            <label key={k.key} className={k.long ? "md:col-span-2" : ""}>
              <span className="mono-label mb-1 block text-[9px] text-ink/50">{k.label}{k.required ? " *" : ""}{k.list ? " (comma separated)" : ""}</span>
              {k.long ? <textarea rows={3} className={inputCls} value={v[k.field] || ""} onChange={set(k.field)} /> : <input className={inputCls} value={v[k.field] || ""} onChange={set(k.field)} />}
            </label>
          ))}
          <label><span className="mono-label mb-1 block text-[9px] text-ink/50">Hours</span><input className={inputCls} value={v.hours || ""} onChange={set("hours")} /></label>
          <label><span className="mono-label mb-1 block text-[9px] text-ink/50">Directory categories (comma separated)</span><input className={inputCls} value={v.categories || ""} onChange={set("categories")} /></label>
          <label className="md:col-span-2"><span className="mono-label mb-1 block text-[9px] text-ink/50">Pitch angles (news / podcasts)</span><textarea rows={2} className={inputCls} value={v.pitch_angles || ""} onChange={set("pitch_angles")} /></label>
          <label className="md:col-span-2"><span className="mono-label mb-1 block text-[9px] text-ink/50">Avoid (outlets, competitors, topics)</span><input className={inputCls} value={v.avoid || ""} onChange={set("avoid")} /></label>
          <div className="flex items-center gap-2 md:col-span-2">
            <button onClick={save} disabled={busy} className="h-9 bg-[#ff3c00] px-4 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-50">{busy ? "Saving…" : "Save criteria"}</button>
            {saved && <span className="inline-flex items-center gap-1 text-[12px] text-green-800"><Check className="h-3.5 w-3.5" /> Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function CriteriaPanel({ clients, criteria, single = false }) {
  const list = clients.filter((c) => single || c.status !== "Inactive");
  const ready = list.filter((c) => criteria[c.id]?.ready).length;
  return (
    <Panel label="Research criteria" title={single ? "What research needs" : `${ready} of ${list.length} clients ready for research`}>
      {list.map((c) => criteria[c.id] && <CriteriaRow key={c.id} c={c} crit={criteria[c.id]} startOpen={single} />)}
    </Panel>
  );
}

// ---------------- Add target + CSV import ----------------

const blank = { kind: "citation_directory", submission_method: "unknown", cost: "unknown", status: "qualified" };

export function AddTarget({ clients, defaultClientId = "" }) {
  const [v, setV] = useState({ ...blank, client_id: defaultClientId });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setV((s) => ({ ...s, client_id: defaultClientId || s.client_id })); }, [defaultClientId]);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const save = async () => {
    const client = clients.find((c) => c.id === v.client_id);
    if (!client) { setMsg("Pick a client."); return; }
    if (!String(v.name || "").trim()) { setMsg("Name is required."); return; }
    setBusy(true); setMsg("");
    try {
      await base44.entities.OutreachTarget.create({
        ...v, client_name: client.business, domain: domainOf(v.url), found_by: "justin", found_at: nowIso(), last_action_at: nowIso(),
      });
      setV({ ...blank, client_id: v.client_id });
      setMsg("Added.");
    } catch (e) { setMsg(e?.message || "Could not add."); } finally { setBusy(false); }
  };
  return (
    <Panel label="Manual" title="Add a target" bodyClass="grid gap-2 p-4 md:grid-cols-2">
      <select className={inputCls} value={v.client_id || ""} onChange={set("client_id")}>
        <option value="">Client…</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}
      </select>
      <input className={inputCls} placeholder="Name (outlet / directory) *" value={v.name || ""} onChange={set("name")} />
      <select className={inputCls} value={v.kind} onChange={set("kind")}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <select className={inputCls} value={v.submission_method} onChange={set("submission_method")}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input className={inputCls} placeholder="URL" value={v.url || ""} onChange={set("url")} />
      <input className={inputCls} placeholder="Submission URL" value={v.submission_url || ""} onChange={set("submission_url")} />
      <input className={inputCls} placeholder="Contact name" value={v.contact_name || ""} onChange={set("contact_name")} />
      <input className={inputCls} placeholder="Public contact email" value={v.contact_email || ""} onChange={set("contact_email")} />
      <select className={inputCls} value={v.cost} onChange={set("cost")}>{["free", "paid", "freemium", "unknown"].map((c) => <option key={c} value={c}>Cost: {c}</option>)}</select>
      <input className={inputCls} placeholder="Cost amount (as stated)" value={v.cost_amount || ""} onChange={set("cost_amount")} />
      <textarea rows={2} className={`${inputCls} md:col-span-2`} placeholder="Why it fits this client" value={v.relevance || ""} onChange={set("relevance")} />
      <div className="flex items-center gap-2 md:col-span-2">
        <button onClick={save} disabled={busy} className="inline-flex h-9 items-center gap-1.5 bg-[#ff3c00] px-4 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> {busy ? "Adding…" : "Add target"}</button>
        {msg && <span className="text-[12px] text-ink/60">{msg}</span>}
      </div>
    </Panel>
  );
}

export function CsvImport({ clients, targets, defaultClientId = "" }) {
  const [text, setText] = useState("");
  const [clientId, setClientId] = useState(defaultClientId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const parsed = text.trim() ? csvToTargets(text) : [];
  const resolveClient = (row) => clients.find((c) => c.id === clientId) || clients.find((c) => row.client_name && c.business.toLowerCase() === row.client_name.toLowerCase());
  const run = async () => {
    setBusy(true); setMsg("");
    let added = 0, dupes = 0, noClient = 0;
    try {
      for (const row of parsed) {
        const client = resolveClient(row);
        if (!client) { noClient++; continue; }
        const d = domainOf(row.url || row.submission_url);
        if (d && targets.some((t) => t.client_id === client.id && (t.domain || domainOf(t.url)) === d)) { dupes++; continue; }
        await base44.entities.OutreachTarget.create({
          kind: "other", submission_method: "unknown", cost: "unknown", status: "discovered",
          ...row, client_id: client.id, client_name: client.business, domain: d, found_by: "justin", found_at: nowIso(),
        });
        added++;
      }
      setMsg(`${added} added${dupes ? `, ${dupes} already tracked for that client` : ""}${noClient ? `, ${noClient} skipped (no client)` : ""}.`);
      if (added) setText("");
    } catch (e) { setMsg(e?.message || "Import failed."); } finally { setBusy(false); }
  };
  return (
    <Panel label="Import" title="Paste CSV" bodyClass="space-y-2 p-4">
      <p className="text-[12px] text-ink/55">Header row with any of: <span className="font-mono text-[11px]">name, url, submission_url, kind, contact_email, contact_name, method, cost, relevance, requirements, notes, client</span>. No header = name, url, submission_url, kind, contact_email. Tabs from a spreadsheet work too.</p>
      <select className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
        <option value="">Use the “client” column</option>
        {clients.map((c) => <option key={c.id} value={c.id}>All rows → {c.business}</option>)}
      </select>
      <textarea rows={6} className={`${inputCls} font-mono text-[12px]`} placeholder={"name,url,submission_url,kind\nMolalla Pioneer,https://…,https://…/submit,local_news"} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center gap-2">
        <button onClick={run} disabled={busy || !parsed.length} className="inline-flex h-9 items-center gap-1.5 bg-ink px-4 text-[12.5px] font-medium text-white hover:bg-[#ff3c00] disabled:opacity-40"><Upload className="h-3.5 w-3.5" /> {busy ? "Importing…" : `Import ${parsed.length || ""}`}</button>
        {msg && <span className="text-[12px] text-ink/60">{msg}</span>}
      </div>
    </Panel>
  );
}

// ---------------- Outreach rules ----------------

const NUM = [
  ["daily_cap", "Daily send cap"], ["follow_up_days", "Follow up after (days)"], ["max_follow_ups", "Max follow-ups"],
  ["same_domain_days", "Same-domain cooldown (days)"], ["research_per_run", "New targets per research run"],
];

export function RulesEditor({ rules, rulesId }) {
  const [v, setV] = useState(rules || DEFAULT_RULES);
  const [id, setId] = useState(rulesId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched && rules) setV({ ...rules, blocked_text: (rules.blocked_domains || []).join("\n") }); if (rulesId) setId(rulesId); }, [rules, rulesId, touched]);
  const set = (k) => (e) => { setTouched(true); setV((s) => ({ ...s, [k]: e.target.value })); };
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const { blocked_text, ...rest } = v;
      const newId = await saveRules(id, { ...rest, blocked_domains: String(blocked_text ?? "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean) });
      setId(newId); setTouched(false); setMsg("Saved. The scheduled tasks read these on every run.");
    } catch (e) { setMsg(e?.message || "Save failed."); } finally { setBusy(false); }
  };
  return (
    <Panel label="AppSettings · outreach_rules" title="Outreach rules" bodyClass="grid gap-3 p-4 md:grid-cols-2">
      <label className="flex items-center gap-2 text-[13px] md:col-span-2">
        <input type="checkbox" className="h-4 w-4 accent-[#ff3c00]" checked={!!v.sending_paused} onChange={(e) => { setTouched(true); setV((s) => ({ ...s, sending_paused: e.target.checked })); }} />
        Pause all sending (the SEND task exits without sending)
      </label>
      <label><span className="mono-label mb-1 block text-[9px] text-ink/50">Sender name</span><input className={inputCls} value={v.sender_name || ""} onChange={set("sender_name")} /></label>
      <label><span className="mono-label mb-1 block text-[9px] text-ink/50">Sender mailbox</span><input className={inputCls} value={v.sender_email || ""} onChange={set("sender_email")} /></label>
      {NUM.map(([k, l]) => (
        <label key={k}><span className="mono-label mb-1 block text-[9px] text-ink/50">{l}</span><input type="number" min={0} className={inputCls} value={v[k] ?? ""} onChange={set(k)} /></label>
      ))}
      <label className="md:col-span-2"><span className="mono-label mb-1 block text-[9px] text-ink/50">Signature block</span><textarea rows={4} className={inputCls} value={v.signature || ""} onChange={set("signature")} /></label>
      <label className="md:col-span-2"><span className="mono-label mb-1 block text-[9px] text-ink/50">Opt-out line (added to every email)</span><input className={inputCls} value={v.opt_out_line || ""} onChange={set("opt_out_line")} /></label>
      <label className="md:col-span-2"><span className="mono-label mb-1 block text-[9px] text-ink/50">Blocked domains (one per line; never researched or emailed)</span><textarea rows={4} className={`${inputCls} font-mono text-[12px]`} value={v.blocked_text ?? (v.blocked_domains || []).join("\n")} onChange={set("blocked_text")} /></label>
      <div className="flex items-center gap-2 md:col-span-2">
        <button onClick={save} disabled={busy} className="h-9 bg-[#ff3c00] px-4 text-[12.5px] font-medium text-white hover:bg-ink disabled:opacity-50">{busy ? "Saving…" : "Save rules"}</button>
        {msg && <span className="text-[12px] text-ink/60">{msg}</span>}
      </div>
    </Panel>
  );
}
