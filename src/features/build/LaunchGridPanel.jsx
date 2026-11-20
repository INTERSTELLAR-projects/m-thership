// Launch grid on the client page (Build Engine, Nov 19 2026). One tile per directory for the client's niche
// (LaunchListing rows; list in src/lib/launchGrid.js): live + NAP correct = lit, pending = amber, missing = dim.
// Click a tile to set its status or listing URL. "Check now" runs the read-only check (URL resolves + NAP matches);
// it also runs monthly. Missing tiles make ONE checklist with the NAP ready to copy, plus a portal request for
// verification codes. Citation submissions stay off; the submission service is unset until Justin picks one.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ListChecks, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useList, timeAgo } from "@/lib/useData";
import { STATES, tileCounts, SUBMISSION_NOTE } from "@/lib/launchGrid";

const TONE = {
  live: "border-[#ff3c00]/50 bg-[#ff3c00]/[0.08] text-ink",
  pending: "border-amber-400/60 bg-amber-50 text-ink/80",
  missing: "border-hair bg-paper text-ink/40",
};
const DOT = { live: "bg-[#ff3c00] shadow-[0_0_8px_rgba(255,60,0,0.6)]", pending: "bg-amber-400", missing: "bg-ink/15" };

export default function LaunchGridPanel({ client }) {
  const qc = useQueryClient();
  const rowsQ = useList("LaunchListing", { filter: { client_id: client.id }, limit: 100, sort: "name" });
  const settingsQ = useList("AppSettings", { filter: { key: "launch_grid" }, limit: 1 });
  const [open, setOpen] = useState(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const rows = rowsQ.data || [];
  const counts = tileCounts(rows);
  const service = settingsQ.data?.[0]?.pageSettings?.submission_service || "";

  const call = async (what, args) => {
    setBusy(what); setMsg("");
    try {
      const r = await base44.functions.invoke("launch-grid", { client_id: client.id, ...args });
      const d = r.data || {};
      if (d.error) throw new Error(d.error);
      if (what === "checklist") setMsg(d.note || `Checklist ready (${d.missing} missing) in Tasks, and the client was asked for verification codes in their portal.`);
      if (what === "check") setMsg(`Checked ${(d.results || []).length} listings with a URL.`);
      if (what === "seed") setMsg(d.created ? `Added ${d.created} directories.` : "Every directory for this niche is already on the grid.");
      await qc.invalidateQueries({ queryKey: ["LaunchListing"] });
      return d;
    } catch (e) { setMsg(String(e?.message || e)); }
    finally { setBusy(""); }
  };
  const set = async (row, patch) => { await call("set", { action: "set", id: row.id, ...patch }); setOpen(null); };

  if (!rows.length) {
    return (
      <div className="px-4 py-4 text-[12.5px] text-ink/55">
        The launch grid starts when the Business basics unlock is on (name, NAP, hours, services, service area).
        <button type="button" onClick={() => call("seed", { action: "seed" })} disabled={!!busy} className="ml-2 border border-hair px-2 py-0.5 text-[11.5px] hover:border-[#ff3c00] hover:text-[#ff3c00]">Start it now</button>
        {msg ? <p className="mt-1 text-[11.5px]">{msg}</p> : null}
      </div>
    );
  }
  return (
    <div data-testid="launch-grid-real">
      <div className="flex flex-wrap items-center gap-3 border-b border-hair px-4 py-2 font-mono text-[10.5px] text-ink/55">
        <span><i className={`mr-1 inline-block h-2 w-2 rounded-full ${DOT.live}`} />{counts.live} live</span>
        <span><i className={`mr-1 inline-block h-2 w-2 rounded-full ${DOT.pending}`} />{counts.pending} pending</span>
        <span><i className={`mr-1 inline-block h-2 w-2 rounded-full ${DOT.missing}`} />{counts.missing} missing</span>
      </div>
      <ul className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-3">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => { setOpen(open === r.id ? null : r.id); setUrl(r.url || ""); }} title={r.check_result || STATES[r.status]?.label} className={`w-full border px-2 py-2 text-left text-[11.5px] leading-tight transition-colors ${TONE[r.status] || TONE.missing}`}>
              <span className={`mb-1 block h-2 w-2 rounded-full ${DOT[r.status] || DOT.missing}`} />
              {r.name}
              {r.last_checked_at ? <span className="mt-0.5 block font-mono text-[9.5px] text-ink/40">checked {timeAgo(r.last_checked_at)}</span> : null}
            </button>
            {open === r.id ? (
              <div className="mt-1 space-y-1.5 border border-hair bg-paper p-2 text-[11.5px]">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… listing URL" className="w-full border border-hair px-1.5 py-1 text-[11.5px]" />
                <div className="flex flex-wrap gap-1">
                  {Object.keys(STATES).map((k) => <button key={k} type="button" disabled={!!busy} onClick={() => set(r, { status: k, url })} className={`border px-1.5 py-0.5 ${r.status === k ? "border-ink" : "border-hair"} hover:border-[#ff3c00]`}>{k}</button>)}
                  <button type="button" disabled={!!busy} onClick={() => set(r, { url })} className="border border-hair px-1.5 py-0.5 hover:border-[#ff3c00]">Save URL</button>
                </div>
                {r.check_result ? <p className="text-ink/50">{r.check_result}</p> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-hair px-4 py-2">
        <button type="button" disabled={!!busy || !counts.missing} onClick={() => call("checklist", { action: "missing_checklist" })} className="inline-flex items-center gap-1 bg-ink px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-[#ff3c00] disabled:opacity-40">
          {busy === "checklist" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ListChecks className="h-3 w-3" />} Checklist for {counts.missing} missing
        </button>
        <button type="button" disabled={!!busy} onClick={() => call("check", { action: "check_client" })} className="inline-flex items-center gap-1 border border-hair px-2.5 py-1 text-[11.5px] text-ink/60 hover:border-[#ff3c00] hover:text-[#ff3c00]">
          {busy === "check" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Check now
        </button>
        <span className="font-mono text-[10px] text-ink/40">Read-only checks · monthly</span>
      </div>
      {msg ? <p className="px-4 pb-2 text-[11.5px] text-ink/60">{msg}</p> : null}
      <p className="border-t border-hair px-4 py-2 text-[11px] text-ink/45">Submission service: {service || "not set"}. {service ? "" : SUBMISSION_NOTE}</p>
    </div>
  );
}
