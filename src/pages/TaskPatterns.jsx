import React, { useCallback, useEffect, useState } from "react";
import { Brain, Play, Repeat, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import PatternRow from "@/features/tasks/components/PatternRow";
import EmptyState from "@/features/tasks/ui-kit/EmptyState";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { itemsOf } from "@/features/tasks/lib/clients";
import { btnGhost } from "@/features/tasks/lib/ui";

export default function TaskPatterns() {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.RecurringPattern.filter({}, { sort: "-occurrences", limit: 200 });
      setPatterns(itemsOf(page));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const detect = async () => {
    setBusy(true);
    setNotice("Scanning your tasks for repeats...");
    try {
      const response = await base44.functions.invoke("detect-patterns", {});
      const data = (response && response.data) || {};
      setNotice("Found " + (data.detected || 0) + " patterns. " + (data.created || 0) + " new, " + (data.updated || 0) + " refreshed.");
      await load();
    } catch (error) {
      setNotice("Could not scan right now.");
    }
    setBusy(false);
  };

  const runDue = async () => {
    setBusy(true);
    setNotice("Generating tasks that are due...");
    try {
      const response = await base44.functions.invoke("run-patterns", {});
      const data = (response && response.data) || {};
      setNotice((data.created || 0) + " tasks created, " + (data.skipped || 0) + " already queued.");
      await load();
    } catch (error) {
      setNotice("Could not generate right now.");
    }
    setBusy(false);
  };

  const toggle = async (pattern) => {
    const next = pattern.status === "enabled" ? "paused" : "enabled";
    const patch = { status: next };
    const today = new Date().toISOString().slice(0, 10);
    if (next === "enabled" && (!pattern.next_due_date || String(pattern.next_due_date).slice(0, 10) <= today)) {
      patch.next_due_date = today;
    }
    setPatterns((prev) => prev.map((row) => (row.id === pattern.id ? { ...row, ...patch } : row)));
    await base44.entities.RecurringPattern.update(pattern.id, patch);
  };

  const setCadence = async (pattern, cadenceDays) => {
    if (!cadenceDays || cadenceDays < 1) return;
    setPatterns((prev) => prev.map((row) => (row.id === pattern.id ? { ...row, cadence_days: cadenceDays } : row)));
    await base44.entities.RecurringPattern.update(pattern.id, { cadence_days: cadenceDays });
  };

  const remove = async (pattern) => {
    setPatterns((prev) => prev.filter((row) => row.id !== pattern.id));
    await base44.entities.RecurringPattern.delete(pattern.id);
  };

  const groups = {
    enabled: patterns.filter((pattern) => pattern.status === "enabled"),
    suggested: patterns.filter((pattern) => pattern.status === "suggested"),
    paused: patterns.filter((pattern) => pattern.status === "paused")
  };

  return (
    <div className="min-h-screen pb-24">
      <PageHeader breadcrumb="Command / Tasks" title="Patterns Library" rightText={groups.enabled.length + " running"}>
        <button type="button" onClick={runDue} disabled={busy} className={btnGhost}>
          <Play className="h-3.5 w-3.5" />
          Generate due
        </button>
        <RollButton label="Detect patterns" icon={Sparkles} onClick={detect} disabled={busy} />
      </PageHeader>

      <div className="space-y-6 px-5 py-6 md:px-8">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink/60">
          The core watches for work you do over and over and drafts a recurring pattern from it. Toggle one on and it starts filing the next occurrence itself.
        </p>
        {notice ? <p className="mono-label text-[10px] text-[#ff3c00]">{notice}</p> : null}

        {loading ? (
          <p className="py-12 text-center text-[12.5px] text-ink/45">Reading the pattern field...</p>
        ) : patterns.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No patterns yet"
            hint="The core needs to see the same task three times before it drafts a pattern. Hit Detect patterns once you have a few weeks of tasks."
          />
        ) : (
          <div className="space-y-8">
            <PatternGroup label="Enabled" patterns={groups.enabled} onToggle={toggle} onCadence={setCadence} onDelete={remove} />
            <PatternGroup label="Suggested" patterns={groups.suggested} onToggle={toggle} onCadence={setCadence} onDelete={remove} />
            <PatternGroup label="Paused" patterns={groups.paused} onToggle={toggle} onCadence={setCadence} onDelete={remove} />
          </div>
        )}
      </div>
    </div>
  );
}

function PatternGroup({ label, patterns, onToggle, onCadence, onDelete }) {
  if (!patterns.length) return null;
  return (
    <section>
      <p className="label-cross mb-3">
        ({label} · {patterns.length})
        <Repeat className="h-3 w-3 text-ink/40" />
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {patterns.map((pattern) => (
          <PatternRow key={pattern.id} pattern={pattern} onToggle={onToggle} onCadence={onCadence} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}
