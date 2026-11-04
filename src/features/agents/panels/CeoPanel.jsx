import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import PanelShell from "./PanelShell";
import { Md, Section, Spinner, relTime } from "../ui";
import { agentsCall, savePrefs } from "../useAgentsData";

const PROMPTS_HQ = ["What did the agents do today?", "What's broken or failing?", "What needs my approval?", "Which clients need attention?", "What should we build next?", "Summarize this week"];
const PROMPTS_CLIENT = ["What are this client's agents doing?", "What's stuck or waiting on me?", "What do we still not know about this business?", "What should we do next for them?"];

function BriefCard({ brief }) {
  if (!brief) return null;
  const list = (title, items, tone) => (items?.length ? (
    <div className="mt-3">
      <p className="eyebrow !text-[9.5px]" style={tone ? { color: tone } : undefined}>{title}</p>
      <ul className="mt-1.5 space-y-1">{items.map((x, i) => <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-[var(--ink-m)]"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#ff6a00]" />{x}</li>)}</ul>
    </div>
  ) : null);
  return (
    <div className="rounded-xl border border-[rgba(255,106,0,.28)] bg-[linear-gradient(160deg,rgba(255,60,0,.10),rgba(255,106,0,.02)_45%,transparent)] p-4">
      <p className="eyebrow">{brief.is_retro ? "Weekly retro" : "CEO brief"} · {brief.date} · {brief.generated_by === "claude_task" ? "registry sync" : "in-app"}</p>
      <p className="mt-2 text-[15px] font-semibold leading-snug text-white">{brief.headline}</p>
      {brief.summary ? <div className="mt-1.5"><Md>{brief.summary}</Md></div> : null}
      {list("Needs your approval", brief.needs_approval, "#ffb27a")}
      {list("Failures", brief.failures, "#ff8a7f")}
      {list("Wins", brief.wins)}
      {list("Clients needing attention", brief.clients_attention)}
      {list("Recommendations", brief.recommendations)}
    </div>
  );
}

export default function CeoPanel({ scope = "interstellar", client, data, prefs, onClose, refresh }) {
  const isClient = scope === "client";
  const storeKey = `agx-chat:${isClient ? client?.id : "hq"}`;
  const defaultName = prefs?.pageSettings?.ceo_name || "Commander";
  const [name, setName] = useState(defaultName);
  const [editing, setEditing] = useState(false);
  const [msgs, setMsgs] = useState(() => { try { return JSON.parse(sessionStorage.getItem(storeKey) || "[]"); } catch { return []; } });
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [briefBusy, setBriefBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => { setName(defaultName); }, [defaultName]);
  useEffect(() => { try { sessionStorage.setItem(storeKey, JSON.stringify(msgs.slice(-30))); } catch { /* ignore */ } end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, storeKey]);

  const brief = useMemo(() => {
    const list = data.briefs.filter((b) => (isClient ? b.client_id === client?.id : b.scope === "interstellar"));
    return list.sort((a, b) => String(b.generated_at || "").localeCompare(String(a.generated_at || "")))[0] || null;
  }, [data.briefs, isClient, client]);

  const ask = async (text) => {
    const q = String(text || input).trim();
    if (!q || thinking) return;
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setThinking(true);
    try {
      const r = await agentsCall("ceo_chat", { messages: next, scope, client_id: client?.id, client_name: client?.business, ceo_name: name });
      setMsgs((m) => [...m, { role: "assistant", content: r.text || "No answer." }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `I couldn't answer that: ${e.message}`, error: true }]);
    }
    setThinking(false);
  };

  const writeBrief = async () => {
    setBriefBusy(true);
    try {
      await agentsCall("ceo_brief", { client_id: isClient ? client?.id : undefined });
      toast({ title: "Brief written", description: "Today's brief is up to date." });
      refresh();
    } catch (e) {
      toast({ title: "Couldn't write the brief", description: e.message, variant: "destructive" });
    }
    setBriefBusy(false);
  };

  const rename = async () => {
    const v = name.trim() || "Commander";
    setEditing(false);
    try { await savePrefs(prefs, { ceo_name: v }); refresh(); } catch (e) { toast({ title: "Couldn't rename", description: e.message, variant: "destructive" }); }
  };

  const title = isClient ? `${client?.business || "Client"} CEO` : name;
  return (
    <PanelShell onClose={onClose} wide label={title}>
      <header className="px-5 pb-3 pt-5 pr-12">
        <p className="eyebrow">{isClient ? "Client CEO agent" : "CEO agent · reports to Justin"}</p>
        <div className="mt-2 flex items-center gap-2">
          {editing && !isClient ? (
            <>
              <input autoFocus className="inp !h-9 !text-[18px] font-semibold" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rename()} />
              <button type="button" className="btn-d" onClick={rename} aria-label="Save name"><Check className="h-4 w-4" /></button>
            </>
          ) : (
            <>
              <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-white">{isClient ? <>{client?.business} <span className="text-[#ff3c00]">/CEO</span></> : <>{name.split(" ").slice(0, -1).join(" ")} <span className="text-[#ff3c00]">/{name.split(" ").slice(-1)[0]}</span></>}</h2>
              {!isClient ? <button type="button" onClick={() => setEditing(true)} aria-label="Rename the CEO agent" className="grid h-7 w-7 place-items-center rounded-md text-[var(--ink-s)] hover:bg-white/5 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button> : null}
            </>
          )}
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-m)]">
          {isClient ? "Answers only from this client's brain and its agents' runs. It never sees another client." : "Answers only from the agent registry, logged runs, learnings, research notes and open approvals. If it isn't on record, it says so."}
        </p>
      </header>

      <Section title="Today" right={<button type="button" className="btn-d !h-7 !px-2.5 !text-[11.5px]" onClick={writeBrief} disabled={briefBusy}>{briefBusy ? <Spinner size={12} /> : <RefreshCw className="h-3 w-3" />}{brief ? "Rewrite brief" : "Write brief"}</button>}>
        {brief ? <BriefCard brief={brief} /> : <p className="text-[12.5px] text-[var(--ink-s)]">No brief yet{isClient ? " for this client" : ""}. The daily registry sync writes one at 5:47 PM PT; you can write one now.</p>}
        {brief?.generated_at ? <p className="mono mt-2 text-[10.5px] text-[var(--ink-s)]">Written {relTime(brief.generated_at)}</p> : null}
      </Section>

      <Section title="Ask">
        <div className="space-y-3">
          {msgs.length === 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {(isClient ? PROMPTS_CLIENT : PROMPTS_HQ).map((p) => <button key={p} type="button" className="chip" onClick={() => ask(p)}>{p}</button>)}
            </div>
          ) : null}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[rgba(255,60,0,.16)] px-3.5 py-2 text-[13px] text-white">{m.content}</p>
              ) : (
                <div className={`rounded-2xl rounded-bl-md border px-3.5 py-2.5 ${m.error ? "border-[rgba(255,68,51,.4)]" : "border-[var(--hair-d)] bg-white/[0.02]"}`}>
                  <p className="mono mb-1 flex items-center gap-1.5 text-[9.5px] uppercase tracking-[.16em] text-[#ff8a3d]"><Sparkles className="h-3 w-3" />{title}</p>
                  <Md>{m.content}</Md>
                </div>
              )}
            </div>
          ))}
          {thinking ? <p className="flex items-center gap-2 text-[12.5px] text-[var(--ink-s)]"><Spinner />Reading the records…</p> : null}
          <div ref={end} />
        </div>
      </Section>
      <div className="sticky bottom-0 mt-auto border-t border-[var(--hair-d)] bg-[rgba(10,11,17,.92)] p-3 backdrop-blur">
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex items-end gap-2">
          <textarea
            className="inp min-h-[40px] flex-1"
            rows={1}
            placeholder={isClient ? "Ask about this client…" : `Ask ${name}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
          />
          <button type="submit" className="btn-f !h-10 !w-10 !px-0" disabled={!input.trim() || thinking} aria-label="Send"><ArrowUp className="h-4 w-4" /></button>
        </form>
        {msgs.length ? <button type="button" className="mt-2 text-[11px] text-[var(--ink-s)] hover:text-white" onClick={() => setMsgs([])}>Clear conversation</button> : null}
      </div>
    </PanelShell>
  );
}
