import { useState } from "react";
import { motion } from "framer-motion";
import { X, Presentation, Sparkles, Check } from "lucide-react";
import { STATUS, defcon } from "./pillars";
import { queueCustom, useRefreshJobs } from "@/features/claude/jobs";

const ORDER = ["done", "partial", "missing", "na"];

export function StatusPicker({ value, onPick }) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded border border-[#9ff3ff]/15">
      {ORDER.map((s) => (
        <button key={s} title={STATUS[s].label} onClick={(e) => { e.stopPropagation(); onPick(s); }}
          className="w-6 py-0.5 text-[11px] transition-colors"
          style={value === s ? { background: STATUS[s].color, color: "#021012", fontWeight: 700 } : { color: "rgba(159,243,255,.45)" }}>
          {STATUS[s].short}
        </button>
      ))}
    </div>
  );
}

export function claudeBrief(client, pillar, item) {
  return [
    `# Constellations · ${pillar.name} (${pillar.title}) — ${item.label}`,
    `Client: ${client.business}${client.domain ? ` (${client.domain})` : ""}`,
    "",
    `Why it matters: ${item.why}`,
    `Principle: ${pillar.principle}`,
    "",
    "## What to do",
    `1. Read this client's ClientDossier (entity ClientDossier, client_id ${client.id}) and their CRMClient record.`,
    `2. Work out what it takes to get "${item.label}" to secured for this business. Do the parts you can (research, drafts, copy, pages, setup in their Base44 apps) and list what needs Justin.`,
    `3. When it's done or improved, update ClientDossier.pillars.${pillar.id}.items.${item.id} = { status: "done" | "partial", note, evidence, by: "claude", updated_at } with real evidence (URL, screenshot, record id). Never mark done without evidence.`,
    "4. Return a short summary for approval.",
  ].join("\n");
}

export default function BriefPanel({ pillar, r, con, client, onClose, onOpenDeck }) {
  const dc = defcon(r.score);
  const refresh = useRefreshJobs();
  const [queued, setQueued] = useState({});
  const send = async (item) => {
    if (!window.confirm(`Authorize Claude to work on "${item.label}" for ${client.business}?`)) return;
    await queueCustom({ title: `${pillar.name}: ${item.label} — ${client.business}`, kind: "task", instructions: claudeBrief(client, pillar, item), client });
    setQueued((q) => ({ ...q, [item.id]: true }));
    refresh();
  };
  const open = r.items.filter((i) => i.status !== "done" && i.status !== "na");
  const done = r.items.filter((i) => i.status === "done");

  return (
    <motion.aside
      initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 240 }}
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-3 right-3 top-16 z-20 flex w-[min(440px,calc(100%-24px))] flex-col overflow-hidden rounded-xl border bg-[#031417]/90 backdrop-blur-xl"
      style={{ borderColor: `${dc.color}66`, boxShadow: `0 0 60px -20px ${dc.color}` }}>
      <div className="border-b border-[#9ff3ff]/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] tracking-[.3em] text-[#9ff3ff]/50">{pillar.code} // SECTOR BRIEF</p>
            <p className="mt-1 text-[24px] font-bold tracking-[.14em] text-[#e9feff]">{pillar.name}</p>
            <p className="text-[11px] tracking-[.12em] text-[#9ff3ff]/60">{pillar.title.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-[40px] font-bold leading-none tabular-nums" style={{ color: dc.color, textShadow: `0 0 20px ${dc.color}` }}>{r.score ?? "—"}</p>
            <p className="mt-1 text-[9px] tracking-[.22em]" style={{ color: dc.color }}>DEFCON {dc.level} · {dc.label}</p>
          </div>
          <button onClick={onClose} className="-mr-1 -mt-1 rounded p-1 text-[#9ff3ff]/50 hover:text-[#e9feff]"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-[#cfeff3]/80" style={{ fontFamily: "var(--font-sans)" }}>{pillar.principle}</p>
        <p className="mt-2 text-[9px] tracking-[.14em] text-[#3df5c8]/70">◆ {pillar.hormozi}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5" style={{ fontFamily: "var(--font-sans)" }}>
        {open.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-[9px] tracking-[.25em] text-[#ff6a00]">BREACHES · WHAT THIS BUSINESS NEEDS</p>
            <div className="space-y-1.5">
              {open.map((i) => (
                <div key={i.id} className="rounded-md border border-[#9ff3ff]/10 bg-black/25 p-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[#e9feff]">{i.label} <span className="font-mono text-[9px] text-[#9ff3ff]/40">×{i.weight}</span></p>
                      <p className="text-[11px] text-[#9ff3ff]/55">{i.note || i.why}</p>
                    </div>
                    <StatusPicker value={i.status} onPick={(s) => con.setItem(pillar.id, i.id, s)} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="font-mono text-[8.5px] tracking-[.16em] text-[#9ff3ff]/35">{i.source === "auto" ? "AUTO-DETECTED" : i.source === "unset" ? "NOT CHECKED YET" : `SET BY ${String(i.source).toUpperCase()}`}</span>
                    <button onClick={() => send(i)} disabled={queued[i.id]} className="flex items-center gap-1 font-mono text-[9px] tracking-[.14em] text-[#3df5c8] hover:text-[#e9feff] disabled:text-[#9ff3ff]/40">
                      {queued[i.id] ? <><Check className="h-3 w-3" /> QUEUED</> : <><Sparkles className="h-3 w-3" /> SEND TO CLAUDE</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {r.gaps.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-[9px] tracking-[.25em] text-[#ffaa00]">INTEL FINDINGS · −{r.penalty} PTS</p>
            {r.gaps.map((g) => (
              <div key={g.id} className="mb-1.5 rounded-md border border-[#ffaa00]/20 bg-[#ffaa00]/5 p-2.5">
                <p className="text-[12.5px] font-medium text-[#ffe2b0]">{g.title}</p>
                {g.recommendation && <p className="text-[11px] text-[#ffe2b0]/60">{g.recommendation}</p>}
              </div>
            ))}
          </div>
        )}
        {done.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-[9px] tracking-[.25em] text-[#3df5c8]">SECURED</p>
            {done.map((i) => (
              <div key={i.id} className="flex items-center gap-2.5 py-1">
                <p className="min-w-0 flex-1 truncate text-[12.5px] text-[#cfeff3]/80">{i.label}</p>
                <StatusPicker value={i.status} onPick={(s) => con.setItem(pillar.id, i.id, s)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[#9ff3ff]/10 p-4">
        <button onClick={onOpenDeck} className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 font-mono text-[11px] font-bold tracking-[.2em] text-[#021012]" style={{ background: dc.color, boxShadow: `0 0 30px -6px ${dc.color}` }}>
          <Presentation className="h-4 w-4" /> OPEN FULL BRIEFING
        </button>
      </div>
    </motion.aside>
  );
}
