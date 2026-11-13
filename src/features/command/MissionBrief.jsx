import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw, Zap, AlertTriangle, CalendarClock } from "lucide-react";
import { clock12, toMin, zonedParts, TZ_DEFAULT, prettyDate } from "./engine";
import { PillarChip, Mono, PILLAR_COLOR, MicOrb, useMicGesture } from "./ui";
import { useListener } from "./voice";

const KIND = {
  focus: { label: "Focus", bar: "#ff3c00" },
  meeting: { label: "Meeting", bar: "#1a1a1a" },
  admin: { label: "Admin", bar: "#8a8580" },
  buffer: { label: "Buffer", bar: "transparent" },
  life: { label: "Life", bar: "transparent" },
  break: { label: "Break", bar: "#1f8a5b" },
  interruption: { label: "Came up", bar: "#7c4dff" },
};

function useNowMin() {
  const get = () => { const p = zonedParts(new Date(), TZ_DEFAULT); return p.hour * 60 + p.minute; };
  const [m, setM] = useState(get);
  useEffect(() => { const t = setInterval(() => setM(get()), 60000); return () => clearInterval(t); }, []);
  return m;
}

function SomethingCameUp({ onSubmit, busy }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mins, setMins] = useState(60);
  const voice = useListener({ onFinal: (t) => setText((x) => (x ? x + " " : "") + t) });
  const mic = useMicGesture({ listening: voice.listening, start: voice.start, stop: voice.stop });
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 border border-white/25 px-3 text-[12.5px] text-white/85 transition-colors hover:border-white hover:text-white">
        <Zap className="h-3.5 w-3.5" /> Something came up
      </button>
    );
  }
  const submit = (e) => { e?.preventDefault(); if (!text.trim()) return; onSubmit(text.trim(), mins); setText(""); setOpen(false); };
  return (
    <form onSubmit={submit} className="mt-4 w-full border border-white/20 bg-white/[0.04] p-3">
      <Mono className="text-white/55">What came up? The rest of today moves around it.</Mono>
      <div className="mt-2 flex items-center gap-2">
        <input autoFocus value={voice.interim ? `${text} ${voice.interim}` : text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Tree emergency at North Woods, need 2 hours" className="h-11 min-w-0 flex-1 border border-white/20 bg-transparent px-3 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-[#ff6a00]" />
        {voice.supported && <MicOrb size={44} dark listening={voice.listening} {...mic} label="Say what came up" />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {[30, 60, 120, 180].map((m) => (
          <button key={m} type="button" onClick={() => setMins(m)} className={`h-8 px-3 font-mono text-[11px] ${mins === m ? "bg-white text-ink" : "border border-white/20 text-white/70"}`}>{m < 60 ? `${m}m` : `${m / 60}h`}</button>
        ))}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-9 px-3 text-[12.5px] text-white/60 hover:text-white">Cancel</button>
          <button type="submit" disabled={busy || !text.trim()} className="h-9 bg-[#ff3c00] px-4 text-[12.5px] font-medium text-white disabled:opacity-40">Re-plan around it</button>
        </div>
      </div>
      {voice.error && <p className="mt-2 text-[12px] text-[#ffaa00]">{voice.error}</p>}
    </form>
  );
}

function Timeline({ blocks, nowMin, afterHours }) {
  if (afterHours || !blocks.length) {
    return <p className="px-5 py-6 text-[14px] text-ink/60 md:px-6">Your workday is over. Tomorrow's plan is below; nothing else needs you tonight unless it's in Needs you.</p>;
  }
  return (
    <ol className="divide-y divide-hair/70">
      {blocks.map((b, i) => {
        const a = toMin(b.start), e = toMin(b.end);
        const past = e <= nowMin;
        const live = a <= nowMin && nowMin < e;
        const k = KIND[b.kind] || KIND.admin;
        const soft = b.kind === "buffer" || b.kind === "life";
        return (
          <li key={`${b.start}-${i}`} className={`relative flex items-stretch gap-3 px-4 py-2.5 md:px-6 ${past ? "opacity-45" : ""} ${live ? "bg-[#ff3c00]/[0.05]" : ""}`}>
            <div className="w-[68px] shrink-0 pt-0.5 font-mono text-[11px] tabular-nums text-ink/55">{clock12(b.start)}<span className="block text-ink/35">{clock12(b.end)}</span></div>
            <span className={`w-[3px] shrink-0 ${soft ? "cmd-hatch" : ""}`} style={{ background: soft ? undefined : b.pillar ? PILLAR_COLOR[b.pillar] : k.bar }} />
            <div className="min-w-0 flex-1">
              <p className={`text-[14px] leading-snug ${soft ? "text-ink/55" : "font-medium text-ink"}`}>{b.title}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/40">{k.label} · {e - a}m</span>
                {b.pillar && <PillarChip id={b.pillar} />}
                {b.ref?.path && <Link to={b.ref.path} className="inline-flex items-center gap-0.5 text-[11.5px] text-ink/50 hover:text-[#ff3c00]">Open<ArrowUpRight className="h-3 w-3" /></Link>}
              </div>
            </div>
            {live && <span className="absolute left-0 top-0 h-full w-[3px] bg-[#ff3c00]" aria-label="Now" />}
          </li>
        );
      })}
    </ol>
  );
}

function DayCard({ title, day }) {
  const items = day?.items || [];
  return (
    <div className="min-w-0 border border-hair bg-paper/80">
      <div className="flex items-baseline justify-between gap-2 border-b border-hair px-4 py-3">
        <h3 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h3>
        <Mono className="text-ink/45">{day?.weekday?.slice(0, 3)} {day?.date ? prettyDate(day.date) : ""}</Mono>
      </div>
      {items.length ? (
        <ul className="divide-y divide-hair/60">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2.5 px-4 py-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: it.pillar ? PILLAR_COLOR[it.pillar] : "#cfccc7" }} />
              <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink/80">{it.time ? <span className="mr-1.5 font-mono text-[11px] text-ink/45">{clock12(it.time)}</span> : null}{it.title}</span>
              {it.ref?.path && <Link to={it.ref.path} className="shrink-0 text-ink/35 hover:text-[#ff3c00]" aria-label="Open"><ArrowUpRight className="h-3.5 w-3.5" /></Link>}
            </li>
          ))}
        </ul>
      ) : <p className="px-4 py-4 text-[13px] text-ink/45">Nothing scheduled yet. Open time.</p>}
    </div>
  );
}

// `between` renders right after the brief's hero (Today puts the Needs-you stack there: decisions before the timeline).
export default function MissionBrief({ brief, busy, onReplan, onInterrupt, stale, error, between = null }) {
  const nowMin = useNowMin();
  if (!brief) return null;
  const outcomes = brief.outcomes || [];
  const genAt = brief.generated_at ? new Date(brief.generated_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: brief.tz || TZ_DEFAULT }) + " PT" : "";
  return (
    <div className="space-y-4">
      <section className="band-dark grain px-5 pb-6 pt-5 md:px-8 md:pb-8 md:pt-7" aria-label="Mission brief">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Mono className="text-white/55">(Mission brief) · v{brief.version || 1} · {brief.source === "llm" ? "AI-written, record-checked" : "rule-built"} · {genAt}</Mono>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onReplan} disabled={busy} className="inline-flex h-9 items-center gap-2 border border-white/25 px-3 text-[12.5px] text-white/85 transition-colors hover:border-white hover:text-white disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} /> {busy ? "Planning…" : "Re-plan my day"}
              </button>
              <SomethingCameUp onSubmit={onInterrupt} busy={busy} />
            </div>
          </div>
          {(stale || error) && (
            <p className="mt-3 inline-flex items-center gap-2 text-[12.5px] text-[#ffaa00]"><AlertTriangle className="h-3.5 w-3.5" />{error ? `Showing the last good brief (${error}).` : "Showing the last good brief."} <button type="button" onClick={onReplan} className="underline underline-offset-2">Retry</button></p>
          )}
          <h1 className="mt-4 max-w-[30ch] text-[27px] font-semibold leading-[1.08] tracking-[-0.035em] text-white md:text-[38px]">{brief.greeting}</h1>
          {brief.since_yesterday?.length ? (
            <div className="mt-5">
              <Mono className="text-white/45">Since yesterday</Mono>
              <ul className="mt-2 space-y-1">
                {brief.since_yesterday.map((s, i) => <li key={i} className="text-[13.5px] leading-snug text-white/75">{s}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="mt-7">
            <Mono className="text-[#ff6a00]">Today's top 3</Mono>
            <ol className="mt-3 divide-y divide-white/10 border-y border-white/10">
              {outcomes.map((o, i) => (
                <li key={o.id || i} className="cmd-rise flex gap-4 py-4" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="font-mono text-[22px] font-semibold leading-none text-white/30 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-medium leading-snug text-white md:text-[19px]">{o.title}</p>
                    <p className="mt-1 text-[13px] leading-snug text-white/60">{o.why}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <PillarChip id={o.pillar} dark />
                      {o.ref?.path && <Link to={o.ref.path} className="inline-flex items-center gap-1 text-[12px] text-white/60 hover:text-white">{o.ref.label ? o.ref.label.slice(0, 40) : "Open"}<ArrowUpRight className="h-3 w-3" /></Link>}
                    </div>
                  </div>
                </li>
              ))}
              {!outcomes.length && <li className="py-4 text-[14px] text-white/60">No work is waiting on you right now. Use the open time, or teach the Brain.</li>}
            </ol>
          </div>
        </div>
      </section>

      {between}

      <section className="border border-hair bg-paper/80" aria-label="Today's plan">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hair px-4 py-3 md:px-6">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]"><CalendarClock className="h-4 w-4 text-[#ff3c00]" />Today, time-blocked</h2>
          <Mono className="text-ink/45">Hatched = life / unplanned buffer</Mono>
        </div>
        <Timeline blocks={brief.plan_today || []} nowMin={nowMin} afterHours={brief.facts?.after_hours} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <DayCard title="Tomorrow" day={brief.tomorrow} />
        <DayCard title="Day after" day={brief.day_after} />
      </div>

      {brief.gaps?.length ? (
        <section className="border border-dashed border-hair px-4 py-3 md:px-6">
          <Mono className="text-ink/45">What I can't see yet</Mono>
          <ul className="mt-1.5 space-y-1">{brief.gaps.map((g, i) => <li key={i} className="text-[12.5px] leading-snug text-ink/60">{g}</li>)}</ul>
        </section>
      ) : null}
    </div>
  );
}
