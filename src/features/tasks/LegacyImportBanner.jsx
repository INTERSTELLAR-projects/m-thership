import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// One-time: bring the old To-Do list (ToDoItem) into the new task engine. Hides itself once done.
export default function LegacyImportBanner() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const { data } = useQuery({
    queryKey: ["legacy-import-check"],
    queryFn: async () => (await base44.functions.invoke("migrate-todo-items", { dry_run: true })).data,
    staleTime: Infinity,
    retry: false,
  });
  if (result) {
    return (
      <div className="mx-5 mt-5 border border-green-700/30 bg-green-600/10 px-4 py-3 text-[13px] text-green-900 md:mx-8">
        Imported {result.created} tasks from your old To-Do list{result.unmatched_assignees?.length ? ` (${result.unmatched_assignees.length} assignees didn't match a client and were noted on the task)` : ""}.
      </div>
    );
  }
  if (!data?.to_create) return null;
  const run = async () => {
    setBusy(true);
    try {
      const res = (await base44.functions.invoke("migrate-todo-items", {})).data;
      setResult(res);
      qc.invalidateQueries({ queryKey: ["Task"] });
      qc.invalidateQueries({ queryKey: ["legacy-import-check"] });
    } finally { setBusy(false); }
  };
  return (
    <div className="band-dark grain mx-5 mt-5 flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:mx-8">
      <div>
        <p className="mono-label text-[10px] text-white/50">One-time import</p>
        <p className="text-[14px] text-white">{data.to_create} tasks from your old To-Do list are ready to move into the new task engine{data.matched_clients ? `, ${data.matched_clients} linked to clients` : ""}.</p>
      </div>
      <button onClick={run} disabled={busy} className="h-10 bg-[#ff3c00] px-5 text-[13px] font-medium text-white hover:bg-white hover:text-ink disabled:opacity-50">{busy ? "Importing…" : "Import them"}</button>
    </div>
  );
}
