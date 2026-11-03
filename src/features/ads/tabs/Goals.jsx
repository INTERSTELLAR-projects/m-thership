import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { E, KEYS, loadSettings, saveSettings } from "../lib/adsApi";
import { Btn, Field, Notice, Panel, TextInput } from "../ui";

const numOrNull = (v) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

export default function Goals({ readOnly = false }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEYS.settings, queryFn: () => loadSettings() });
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  if (!s) return null;
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const setAp = (k, v) => setS((x) => ({ ...x, auto_pause: { ...x.auto_pause, [k]: v } }));

  const save = async () => {
    setSaving(true);
    try {
      const pct = Math.min(50, Math.max(1, Number(s.max_budget_change_pct) || 20));
      const patch = {
        target_roas: numOrNull(s.target_roas), target_cpa: numOrNull(s.target_cpa), monthly_budget_cap: numOrNull(s.monthly_budget_cap),
        max_budget_change_pct: pct, pause_at_cap: !!s.pause_at_cap, optimizer_enabled: s.optimizer_enabled !== false,
        auto_pause: { enabled: !!s.auto_pause.enabled, roas_below: Number(s.auto_pause.roas_below) || 0.5, min_spend: Number(s.auto_pause.min_spend) || 50, lookback_days: Number(s.auto_pause.lookback_days) || 7, max_per_day: Math.min(10, Number(s.auto_pause.max_per_day) || 2) },
        conversion_action_types: String(Array.isArray(s.conversion_action_types) ? s.conversion_action_types.join(",") : s.conversion_action_types).split(/[,\s]+/).filter(Boolean),
        graph_version: String(s.graph_version || "v23.0").trim(),
        default_utm: s.default_utm || {},
      };
      const before = q.data;
      await saveSettings(patch);
      await E().AdChangeLog.create({ action: "settings", result: "ok", actor: "justin", before: { target_roas: before.target_roas, target_cpa: before.target_cpa, monthly_budget_cap: before.monthly_budget_cap, max_budget_change_pct: before.max_budget_change_pct, auto_pause: before.auto_pause, pause_at_cap: before.pause_at_cap }, after: { target_roas: patch.target_roas, target_cpa: patch.target_cpa, monthly_budget_cap: patch.monthly_budget_cap, max_budget_change_pct: patch.max_budget_change_pct, auto_pause: patch.auto_pause, pause_at_cap: patch.pause_at_cap }, message: "Ads Studio goals & safety settings saved" }).catch(() => null);
      qc.invalidateQueries({ queryKey: KEYS.settings });
      qc.invalidateQueries({ queryKey: KEYS.log });
      toast({ title: "Settings saved" });
    } catch (e) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <Panel label="Goals" title="What good looks like" bodyClass="space-y-3 p-3.5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Target ROAS" hint="e.g. 3 = $3 per $1"><TextInput type="number" step="0.1" value={s.target_roas ?? ""} onChange={(v) => set("target_roas", v)} disabled={readOnly} /></Field>
          <Field label="Target CPA" hint="$ per conversion"><TextInput type="number" value={s.target_cpa ?? ""} onChange={(v) => set("target_cpa", v)} disabled={readOnly} /></Field>
          <Field label="Monthly budget cap" hint="all platforms"><TextInput type="number" value={s.monthly_budget_cap ?? ""} onChange={(v) => set("monthly_budget_cap", v)} disabled={readOnly} /></Field>
        </div>
        <p className="text-[12px] text-ink/55">The agent judges ad sets against these targets. With no targets set it only flags creative fatigue. At or over the cap, budget increases and launches are refused and the dashboard shows a hard-stop warning; at 80% it warns.</p>
        <Field label="Meta conversion action types" hint="comma separated"><TextInput value={Array.isArray(s.conversion_action_types) ? s.conversion_action_types.join(", ") : s.conversion_action_types} onChange={(v) => set("conversion_action_types", v)} disabled={readOnly} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Graph API version"><TextInput value={s.graph_version} onChange={(v) => set("graph_version", v)} disabled={readOnly} /></Field>
          <Field label="Default utm_source"><TextInput value={s.default_utm?.source} onChange={(v) => set("default_utm", { ...s.default_utm, source: v })} disabled={readOnly} /></Field>
          <Field label="Default utm_medium"><TextInput value={s.default_utm?.medium} onChange={(v) => set("default_utm", { ...s.default_utm, medium: v })} disabled={readOnly} /></Field>
        </div>
      </Panel>

      <Panel label="Safety" title="Spend guardrails" bodyClass="space-y-3 p-3.5">
        <Notice>The agent only proposes. Spending, launching, unpausing and budget increases happen only when you approve that specific change. These limits apply even to approved changes.</Notice>
        <Field label="Max budget change per ad set per 24h (%)" hint="1–50, default 20"><TextInput type="number" min="1" max="50" value={s.max_budget_change_pct} onChange={(v) => set("max_budget_change_pct", v)} disabled={readOnly} /></Field>
        <Toggle label="Daily optimizer" desc="Runs at 6:07 AM PT after the sync and fills the approval inbox." checked={s.optimizer_enabled !== false} onChange={(v) => set("optimizer_enabled", v)} disabled={readOnly} />
        <div className="border border-hair p-3">
          <Toggle label="Auto-pause losers" desc="Off by default. When on, the daily run may PAUSE (never anything else) active ads / ad sets whose ROAS is under the threshold after the minimum spend. Needs revenue tracking. Logged and shown in the inbox." checked={!!s.auto_pause.enabled} onChange={(v) => setAp("enabled", v)} disabled={readOnly} />
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <Field label="ROAS below"><TextInput type="number" step="0.1" value={s.auto_pause.roas_below} onChange={(v) => setAp("roas_below", v)} disabled={readOnly} /></Field>
            <Field label="Min spend"><TextInput type="number" value={s.auto_pause.min_spend} onChange={(v) => setAp("min_spend", v)} disabled={readOnly} /></Field>
            <Field label="Lookback days"><TextInput type="number" value={s.auto_pause.lookback_days} onChange={(v) => setAp("lookback_days", v)} disabled={readOnly} /></Field>
            <Field label="Max per day" hint="cap"><TextInput type="number" value={s.auto_pause.max_per_day} onChange={(v) => setAp("max_per_day", v)} disabled={readOnly} /></Field>
          </div>
        </div>
        <Toggle label="Pause everything at the monthly cap" desc="Off by default. When on, the daily run pauses active Meta campaigns once month-to-date spend reaches the cap." checked={!!s.pause_at_cap} onChange={(v) => set("pause_at_cap", v)} disabled={readOnly} />
        {!readOnly && <Btn variant="flame" onClick={save} disabled={saving}><Save className="h-3.5 w-3.5" />Save settings</Btn>}
      </Panel>
    </div>
  );
}

function Toggle({ label, desc, checked, onChange, disabled }) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="mt-0.5 data-[state=checked]:bg-[#ff3c00]" />
      <div><p className="text-[13px] font-medium">{label}</p><p className="text-[12px] text-ink/55">{desc}</p></div>
    </div>
  );
}
