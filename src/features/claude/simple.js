// Small pure helpers for the Simple view of the Claude Queue.
import { useEffect, useState } from "react";

const VIEW_KEY = "mothership.claudeQueue.view";

export function readViewMode() {
  try { return localStorage.getItem(VIEW_KEY) === "detailed" ? "detailed" : "simple"; } catch { return "simple"; }
}

export function useViewMode() {
  const [mode, setMode] = useState(readViewMode);
  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, mode); } catch { /* storage blocked */ }
  }, [mode]);
  return [mode, setMode];
}

const STATUS_LINES = {
  queued: "Queued — Claude will start on the next run.",
  running: "Claude is working on this now.",
  needs_review: "Claude finished — ready for your review.",
  needs_approval: "Claude finished — ready for your OK.",
  changes_requested: "Sent back — Claude will redo it on the next run.",
  approved: "Approved and done.",
  done: "Done.",
  failed: "The run failed — retry or send it back with a note.",
  cancelled: "Cancelled.",
};

// One plain-English line: first sentence of the result, else a status line.
export function oneLine(job, max = 140) {
  if (job?.status === "queued" && job?.context?.held_for === "build_engine_step3") return "Queued for the build agent (Build Engine step 3, not live yet). It waits here until then.";
  const text = String(job?.result_summary || "").replace(/\s+/g, " ").trim();
  if (!text) return STATUS_LINES[job?.status] || STATUS_LINES.queued;
  const m = text.match(/^.+?[.!?](?=\s|$)/);
  const first = (m ? m[0] : text).trim();
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

// needs_from_justin may be a string (lines / bullets) or an array.
export function needsList(job) {
  const v = job?.needs_from_justin;
  if (!v) return [];
  const items = Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : x?.label || x?.text || JSON.stringify(x))) : String(v).split(/\n+/);
  return items.map((s) => String(s).replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
}

export const SIMPLE_GROUPS = [
  { key: "review", label: "Needs your OK", match: ["needs_approval", "needs_review", "failed"] },
  { key: "working", label: "Running & queued", match: ["running", "queued", "changes_requested"] },
  { key: "done", label: "Done", match: ["approved", "done", "cancelled"], collapsed: true },
];
