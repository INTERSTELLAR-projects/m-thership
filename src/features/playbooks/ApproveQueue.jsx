import { useState } from "react";
import { Check, X, Pencil, GitCompare, Eye } from "lucide-react";
import { Spinner, Empty, Md, relTime } from "@/features/agents/ui";
import { agentCall, updateEntity, livePrompt, shortDate } from "./data";
import { DiffView } from "./AreaView";

function useAct(refresh) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const act = async (key, fn) => {
    setBusy(key); setErr("");
    try { await fn(); refresh(); } catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  };
  return { busy, err, act };
}

function PatternCard({ p, areas, standards = [], refresh }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ title: p.title || "", rule: p.rule || "", how_to_check: p.how_to_check || "", kind: p.kind || "other" });
  const { busy, err, act } = useAct(refresh);
  const area = areas.find((a) => a.id === p.area_id);
  const covered = p.standard_id ? standards.find((s) => s.id === p.standard_id) : null;
  return (
    <div className="card p-4">
      {p.status === "proposed" ? <span className="run-border" /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow !text-[9.5px]">Pattern · {area?.name || "No area"} · seen {p.count || 0}× · {(p.clients || []).length} client{(p.clients || []).length === 1 ? "" : "s"}</p>
          {editing ? (
            <div className="mt-2 space-y-2">
              <input className="inp w-full" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Title" />
              <textarea className="inp w-full" rows={2} value={f.rule} onChange={(e) => setF({ ...f, rule: e.target.value })} aria-label="Rule" />
              <input className="inp w-full" value={f.how_to_check} onChange={(e) => setF({ ...f, how_to_check: e.target.value })} placeholder="How to check" aria-label="How to check" />
              <select className="inp" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Standards matrix">
                {["website", "app", "mappack", "brand", "account", "other"].map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          ) : (
            <>
              <p className="mt-1 text-[15px] font-medium text-white">{p.title}</p>
              <p className="mt-0.5 text-[12.5px] text-[var(--ink-m)]">{p.rule}</p>
              {p.how_to_check ? <p className="mt-0.5 text-[11.5px] text-[var(--ink-s)]">Check: {p.how_to_check}</p> : null}
            </>
          )}
          {(p.example_quotes || []).length ? (
            <ul className="mt-2 space-y-1 border-l border-[rgba(255,106,0,.35)] pl-3">{p.example_quotes.slice(0, 3).map((q, i) => <li key={i} className="text-[12px] italic text-[var(--ink-m)]">"{q}"</li>)}</ul>
          ) : null}
          {(p.clients || []).length ? <p className="mono mt-2 text-[10px] text-[var(--ink-s)]">{p.clients.join(" · ")} · last {relTime(p.last_seen)}</p> : null}
          {covered ? <p className="mono mt-2 inline-flex rounded-md border border-[rgba(255,106,0,.35)] px-2 py-0.5 text-[10px] text-[#ffb27a]">Already a standard: {covered.title}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {err ? <span className="mr-auto text-[12px] text-[#ff8a7f]">{err}</span> : null}
        {editing ? (
          <>
            <button type="button" className="btn-d" onClick={() => setEditing(false)}>Cancel</button>
            <button type="button" className="btn-d" disabled={!!busy} onClick={() => act("save", async () => { await updateEntity("PromptPattern", p.id, f); setEditing(false); })}>{busy === "save" ? <Spinner size={12} /> : null}Save</button>
          </>
        ) : (
          <>
            <button type="button" className="btn-d" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Edit</button>
            <button type="button" className="btn-d" disabled={!!busy} onClick={() => act("reject", () => agentCall("reject_pattern", { pattern_id: p.id }))}>{busy === "reject" ? <Spinner size={12} /> : <X className="h-3.5 w-3.5" />}Reject</button>
          </>
        )}
        <button type="button" className="btn-f" disabled={!!busy} onClick={() => act("approve", () => agentCall("approve_pattern", { pattern_id: p.id, ...f }))}>{busy === "approve" ? <Spinner size={12} /> : <Check className="h-3.5 w-3.5" />}{covered ? "Confirm" : "Approve as standard"}</button>
      </div>
    </div>
  );
}

function DraftCard({ d, areas, prompts, refresh }) {
  const [mode, setMode] = useState("changes");
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(d.body || "");
  const [changelog, setChangelog] = useState(d.changelog || "");
  const { busy, err, act } = useAct(refresh);
  const area = areas.find((a) => a.id === d.area_id);
  const live = livePrompt(prompts, d.area_id, d.industry || "");
  const base = prompts.find((p) => p.id === d.based_on_id) || live;
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow !text-[9.5px]">Prompt draft · {area?.name || "?"}{d.industry ? ` · ${d.industry}` : ""} · v{d.version} · {d.drafted_by === "prompt_agent" ? "by the prompt agent" : d.drafted_by} · {relTime(d.created_date)}</p>
          <p className="mt-1 text-[15px] font-medium text-white">{d.title}</p>
        </div>
        <div className="seg">
          <button type="button" className={mode === "changes" ? "on" : ""} onClick={() => setMode("changes")}><GitCompare className="h-3.5 w-3.5" />Changes</button>
          <button type="button" className={mode === "full" ? "on" : ""} onClick={() => setMode("full")}><Eye className="h-3.5 w-3.5" />Full</button>
        </div>
      </div>
      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea className="inp prompt-box w-full" rows={16} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Prompt body" />
          <textarea className="inp w-full" rows={3} value={changelog} onChange={(e) => setChangelog(e.target.value)} aria-label="Changelog" />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {d.changelog ? <div className="rounded-lg border border-[var(--hair-d)] bg-white/[0.02] p-3"><p className="eyebrow mb-1 !text-[9px]">Changelog</p><Md>{d.changelog}</Md></div> : null}
          {mode === "changes" ? <DiffView from={base} to={d} /> : <div className="prompt-box scroll-d max-h-[460px] overflow-auto rounded-lg border border-[var(--hair-d)] bg-black/30 p-3">{d.body}</div>}
          {base ? <p className="mono text-[10px] text-[var(--ink-s)]">Compared with v{base.version} (live since {shortDate(base.approved_at)})</p> : null}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {err ? <span className="mr-auto text-[12px] text-[#ff8a7f]">{err}</span> : null}
        {editing ? (
          <>
            <button type="button" className="btn-d" onClick={() => { setEditing(false); setBody(d.body || ""); setChangelog(d.changelog || ""); }}>Cancel</button>
            <button type="button" className="btn-d" disabled={!!busy || !body.trim()} onClick={() => act("save", async () => { await updateEntity("FoundationPrompt", d.id, { body: body.replace(/®/g, "™"), changelog, drafted_by: d.drafted_by === "prompt_agent" ? "prompt_agent" : "justin" }); setEditing(false); })}>{busy === "save" ? <Spinner size={12} /> : null}Save edits</button>
          </>
        ) : (
          <>
            <button type="button" className="btn-d" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Edit</button>
            <button type="button" className="btn-d" disabled={!!busy} onClick={() => act("reject", () => agentCall("reject_prompt", { prompt_id: d.id }))}>{busy === "reject" ? <Spinner size={12} /> : <X className="h-3.5 w-3.5" />}Reject</button>
          </>
        )}
        <button type="button" className="btn-f" disabled={!!busy || editing} onClick={() => act("approve", () => agentCall("approve_prompt", { prompt_id: d.id }))}>{busy === "approve" ? <Spinner size={12} /> : <Check className="h-3.5 w-3.5" />}Approve · make live</button>
      </div>
    </div>
  );
}

export default function ApproveQueue({ data, refresh }) {
  const { patterns, prompts, areas, standards } = data;
  const proposed = patterns.filter((p) => p.status === "proposed").sort((a, b) => (b.count || 0) - (a.count || 0));
  const drafts = prompts.filter((p) => p.status === "draft").sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
  const watching = patterns.filter((p) => (p.status || "watching") === "watching" && (p.count || 0) > 0).sort((a, b) => (b.count || 0) - (a.count || 0));
  const [showWatch, setShowWatch] = useState(false);
  return (
    <div className="space-y-6 pt-5">
      <section>
        <p className="eyebrow mb-3">Prompt drafts · {drafts.length}</p>
        {drafts.length ? <div className="grid gap-3 xl:grid-cols-2">{drafts.map((d) => <DraftCard key={d.id} d={d} areas={areas} prompts={prompts} refresh={refresh} />)}</div> : <Empty>No prompt drafts waiting. Approve a pattern and run the agent, and it drafts the next version of that area's prompt.</Empty>}
      </section>
      <section>
        <p className="eyebrow mb-3">Proposed patterns · {proposed.length}</p>
        {proposed.length ? <div className="grid gap-3 xl:grid-cols-2">{proposed.map((p) => <PatternCard key={p.id} p={p} areas={areas} standards={standards} refresh={refresh} />)}</div> : <Empty>No patterns proposed. A request becomes a proposal once it shows up 3 times or for 2 clients.</Empty>}
      </section>
      <section>
        <button type="button" className="eyebrow mb-3 hover:text-white" onClick={() => setShowWatch((v) => !v)} aria-expanded={showWatch}>{showWatch ? "▾" : "▸"} Watching · {watching.length} (not repeated enough yet)</button>
        {showWatch ? (
          watching.length ? (
            <div className="grid gap-3 xl:grid-cols-2">{watching.map((p) => <PatternCard key={p.id} p={p} areas={areas} standards={standards} refresh={refresh} />)}</div>
          ) : <Empty>Nothing being watched yet.</Empty>
        ) : null}
      </section>
    </div>
  );
}
