import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { KEYS, adsPolicy, loadSettings, saveSettings } from "../lib/adsApi";
import { Btn, Field, Notice, Panel, Pill, TextInput } from "../ui";

export default function Policy({ readOnly = false }) {
  const qc = useQueryClient();
  const rQ = useQuery({ queryKey: KEYS.rules, queryFn: () => adsPolicy({ action: "rules" }) });
  const [draft, setDraft] = useState({ key: "", title: "", pattern: "", severity: "soft", message: "" });
  const [busy, setBusy] = useState(false);
  const rules = rQ.data?.rules || [];

  const patch = async (fn) => {
    setBusy(true);
    try {
      const s = await loadSettings();
      await saveSettings(fn(s));
      qc.invalidateQueries({ queryKey: KEYS.rules });
      qc.invalidateQueries({ queryKey: KEYS.settings });
    } catch (e) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const override = (key, o) => patch((s) => ({ policy_overrides: { ...(s.policy_overrides || {}), [key]: { ...((s.policy_overrides || {})[key] || {}), ...o } } }));
  const addCustom = () => {
    try { new RegExp(draft.pattern, "iu"); } catch { toast({ title: "That pattern isn't a valid regular expression", variant: "destructive" }); return; }
    const key = `custom_${draft.key || draft.title}`.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 40);
    patch((s) => ({ custom_rules: [...(s.custom_rules || []).filter((r) => r.key !== key), { key, title: draft.title, message: draft.message, severity: draft.severity, patterns: [draft.pattern] }] }));
    setDraft({ key: "", title: "", pattern: "", severity: "soft", message: "" });
  };
  const removeCustom = (key) => patch((s) => ({ custom_rules: (s.custom_rules || []).filter((r) => r.key !== key) }));

  return (
    <div className="space-y-3">
      <Notice>
        Rules version {rQ.data?.version || "…"}. <strong>Hard</strong> blocks pushing, <strong>soft</strong> warns, <strong>note</strong> informs. &quot;Verified&quot; means the source page was fetched and read when the rule was written; Meta&apos;s transparency pages render client-side and could not be fetched, so Meta-specific wording is marked unverified with what it was checked against. Passing here doesn&apos;t guarantee approval — Meta and Google review every ad.
      </Notice>
      {rQ.isLoading ? <p className="py-10 text-center text-[13px] text-ink/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading rules…</p> : (
        <div className="grid gap-2 lg:grid-cols-2">
          {rules.map((r) => (
            <div key={r.key} className={`border bg-card p-3 ${r.enabled === false ? "border-dashed border-hair opacity-60" : "border-hair"}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={r.severity}>{r.severity}</Pill>
                {r.platforms.map((p) => <Pill key={p} tone="info">{p}</Pill>)}
                <span className="text-[13px] font-semibold">{r.title}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink/65">{r.message}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] text-ink/45">
                {/^https?:/.test(r.source_url) ? <a href={r.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-[#ff3c00]">{new URL(r.source_url).hostname}<ExternalLink className="h-2.5 w-2.5" /></a> : <span>Agency Knowledge / Justin</span>}
                <span className={r.verified ? "text-green-800" : "text-[#c44a00]"}>{r.verified ? "verified" : "unverified"}</span>
                {r.verified_note && <span title={r.verified_note} className="max-w-full truncate">· {r.verified_note}</span>}
              </div>
              {!readOnly && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={r.severity} disabled={busy} onChange={(e) => override(r.key, { severity: e.target.value })} className="h-7 border border-hair bg-paper px-1.5 text-[11.5px]">
                    <option value="hard">hard (block)</option><option value="soft">soft (warn)</option><option value="info">note</option>
                  </select>
                  <Btn className="h-7" disabled={busy} onClick={() => override(r.key, { enabled: r.enabled === false })}>{r.enabled === false ? "Enable" : "Disable"}</Btn>
                  {r.key.startsWith("custom_") && <Btn variant="ghost" className="h-7" disabled={busy} onClick={() => removeCustom(r.key)}><Trash2 className="h-3.5 w-3.5" /></Btn>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <Panel label="Custom rule" title="Add a phrase or pattern to flag" bodyClass="grid gap-2 p-3.5 md:grid-cols-[1fr_1fr_120px]">
          <Field label="Title"><TextInput value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder="e.g. No 'free website'" /></Field>
          <Field label="Pattern (regex, case-insensitive)"><TextInput value={draft.pattern} onChange={(v) => setDraft((d) => ({ ...d, pattern: v }))} placeholder="\bfree website\b" /></Field>
          <Field label="Severity">
            <select value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value }))} className="h-9 w-full border border-hair bg-paper px-2 text-[12.5px]"><option value="hard">hard</option><option value="soft">soft</option><option value="info">note</option></select>
          </Field>
          <Field label="Message" className="md:col-span-2"><TextInput value={draft.message} onChange={(v) => setDraft((d) => ({ ...d, message: v }))} placeholder="Why it's flagged and what to write instead" /></Field>
          <div className="flex items-end"><Btn variant="flame" className="w-full" disabled={busy || !draft.title || !draft.pattern} onClick={addCustom}><Plus className="h-3.5 w-3.5" />Add</Btn></div>
        </Panel>
      )}
    </div>
  );
}
