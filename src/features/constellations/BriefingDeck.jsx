import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Sparkles, Check } from "lucide-react";
import { PILLAR_BY_ID, STATUS, defcon } from "./pillars";
import { claudeBrief } from "./BriefPanel";
import { queueCustom, useRefreshJobs } from "@/features/claude/jobs";

const mono = { fontFamily: '"JetBrains Mono", ui-monospace, monospace' };

function Eyebrow({ children, color = "#3df5c8" }) {
  return <p className="text-[11px] tracking-[.35em]" style={{ ...mono, color }}>{children}</p>;
}
function H({ children }) {
  return <h2 className="mt-3 text-[clamp(30px,4.4vw,60px)] font-semibold leading-[1.02] tracking-[-0.03em] text-[#eafeff]">{children}</h2>;
}
function ItemRow({ i }) {
  const s = STATUS[i.status];
  return (
    <div className="flex items-start gap-4 border-b border-white/5 py-3.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold" style={{ background: `${s.color}22`, color: s.color, border: `1px solid ${s.color}66` }}>{s.short}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[18px] font-medium text-[#eafeff]">{i.label}</p>
        <p className="mt-0.5 text-[14px] text-[#9fdbe2]/70">{i.note || i.why}{i.evidence ? ` · ${i.evidence}` : ""}</p>
      </div>
      <span className="shrink-0 text-[10px] tracking-[.2em]" style={{ ...mono, color: s.color }}>{s.label.toUpperCase()}</span>
    </div>
  );
}

function dataSlide(pillar, d, ctx) {
  const L = (label, v) => (v && (Array.isArray(v) ? v.length : String(v).trim()) ? { label, v: Array.isArray(v) ? v.join(" · ") : v } : null);
  let rows = [];
  if (pillar.id === "payload") rows = [L("Dream outcome", d.dream_outcome), L("Why choose them", d.usp), L("Differentiators", d.differentiators), ...(d.offers || []).map((o) => L(`${o.kind ? o.kind.toUpperCase() + " · " : ""}${o.name}`, [o.price, o.promise, o.guarantee && `Guarantee: ${o.guarantee}`].filter(Boolean).join(" — ")))];
  if (pillar.id === "insignia") rows = [L("Tagline", d.tagline), L("Pitch", d.elevator_pitch), L("Voice", d.brand_voice?.tone), L("Personality", d.brand_voice?.personality), L("Always say", d.brand_voice?.say), L("Never say", d.brand_voice?.never_say), L("Colors", d.brand_identity?.colors), L("Fonts", d.brand_identity?.fonts), L("Style", d.brand_identity?.style)];
  if (pillar.id === "command") rows = [...ctx.goals.map((g) => L(`2027 goal`, `${g.title}${g.target_value != null ? ` → ${g.target_value}${g.unit ? ` ${g.unit}` : ""}` : ""}`)), ...Object.entries(d.kpis || {}).map(([k, v]) => L(k, typeof v === "object" ? JSON.stringify(v) : String(v)))];
  if (pillar.id === "intercept") rows = [L("Lead sources", d.lead_sources), L("Ideal customer", d.audience?.ideal_customer), L("Objections", d.audience?.objections)];
  if (pillar.id === "engine") rows = [L("Current software", d.tools), L("Team", d.team_size)];
  if (pillar.id === "orbit") rows = (d.offers || []).filter((o) => ["upsell", "continuity", "downsell"].includes(o.kind)).map((o) => L(o.kind, `${o.name} ${o.price || ""}`));
  if (pillar.id === "shield") rows = [ctx.reviews && L("Google", `${ctx.reviews.rating ?? "—"}★ · ${ctx.reviews.count} reviews`), ...(d.competitors || []).map((c) => L(`Competitor · ${c.name}`, [c.strength, c.weakness && `weak: ${c.weakness}`].filter(Boolean).join(" — ")))];
  rows = rows.filter(Boolean);
  if (pillar.id === "signal" || pillar.id === "beacon") {
    const kw = (d.keywords || []).filter((k) => k.status !== "retired");
    const cities = d.service_area?.cities || [];
    if (!kw.length && !cities.length) return null;
    return { kind: "seo", kw, cities, primary: d.service_area?.primary_city, updated: d.keywords_updated_at };
  }
  return rows.length ? { kind: "rows", rows } : null;
}

export default function BriefingDeck({ pillarId, con, client, onClose }) {
  const pillar = PILLAR_BY_ID[pillarId];
  const r = con.by[pillarId];
  const dc = defcon(r.score);
  const refresh = useRefreshJobs();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [queued, setQueued] = useState({});

  const open = r.items.filter((x) => x.status !== "done" && x.status !== "na");
  const done = r.items.filter((x) => x.status === "done");
  const next = [...open].sort((a, b) => b.weight * (a.status === "missing" ? 1 : 0.5) - a.weight * (b.status === "missing" ? 1 : 0.5)).slice(0, 3);
  const data = dataSlide(pillar, con.d, con.ctx);

  const send = async (item) => {
    if (!window.confirm(`Authorize Claude to work on "${item.label}"?`)) return;
    await queueCustom({ title: `${pillar.name}: ${item.label} — ${client.business}`, kind: "task", instructions: claudeBrief(client, pillar, item), client });
    setQueued((q) => ({ ...q, [item.id]: true })); refresh();
  };

  const slides = useMemo(() => {
    const s = [];
    s.push(
      <div className="flex h-full flex-col justify-between">
        <Eyebrow>{pillar.code} // CONSTELLATIONS BRIEFING · {(client.business || "").toUpperCase()}</Eyebrow>
        <div>
          <p className="text-[clamp(56px,10vw,150px)] font-bold leading-[.85] tracking-[.06em]" style={{ ...mono, color: "#eafeff", textShadow: `0 0 60px ${dc.color}66` }}>{pillar.name}</p>
          <p className="mt-4 text-[clamp(18px,2vw,26px)] text-[#9fdbe2]/80">{pillar.title}</p>
        </div>
        <div className="flex flex-wrap items-end gap-10">
          <div><p className="text-[88px] font-bold leading-none tabular-nums" style={{ ...mono, color: dc.color, textShadow: `0 0 40px ${dc.color}` }}>{r.score ?? "—"}</p><p className="mt-2 text-[11px] tracking-[.3em]" style={{ ...mono, color: dc.color }}>SECTOR HEALTH</p></div>
          <div><p className="text-[40px] font-bold leading-none" style={{ ...mono, color: dc.color }}>DEFCON {dc.level}</p><p className="mt-2 text-[11px] tracking-[.3em] text-[#9fdbe2]/60" style={mono}>{dc.label} · {r.done}/{r.total} SECURED</p></div>
        </div>
      </div>
    );
    s.push(
      <div className="flex h-full max-w-[900px] flex-col justify-center">
        <Eyebrow>WHY THIS SECTOR MATTERS</Eyebrow>
        <H>{pillar.principle}</H>
        <p className="mt-8 text-[13px] tracking-[.18em] text-[#3df5c8]/80" style={mono}>◆ {pillar.hormozi.toUpperCase()}</p>
      </div>
    );
    if (open.length) s.push(
      <div className="flex h-full flex-col">
        <Eyebrow color="#ff6a00">BREACHES · {open.length} OPEN</Eyebrow>
        <H>What {client.business} still needs here.</H>
        <div className="mt-6 flex-1 overflow-y-auto pr-2">{open.map((x) => <ItemRow key={x.id} i={x} />)}</div>
      </div>
    );
    if (r.gaps.length) s.push(
      <div className="flex h-full flex-col">
        <Eyebrow color="#ffaa00">INTEL FINDINGS · −{r.penalty} PTS</Eyebrow>
        <H>What the audit found.</H>
        <div className="mt-6 grid flex-1 content-start gap-3 overflow-y-auto md:grid-cols-2">
          {r.gaps.map((g) => (
            <div key={g.id} className="rounded-xl border border-[#ffaa00]/25 bg-[#ffaa00]/5 p-5">
              <p className="text-[10px] tracking-[.25em] text-[#ffaa00]" style={mono}>{(g.severity || "").toUpperCase()} · {(g.status || "").toUpperCase()}</p>
              <p className="mt-2 text-[18px] font-medium text-[#fff1d6]">{g.title}</p>
              {g.impact && <p className="mt-1 text-[14px] text-[#ffe2b0]/70">{g.impact}</p>}
              {g.recommendation && <p className="mt-2 text-[14px] text-[#eafeff]">→ {g.recommendation}</p>}
            </div>
          ))}
        </div>
      </div>
    );
    if (data?.kind === "rows") s.push(
      <div className="flex h-full flex-col">
        <Eyebrow>DOSSIER · WHAT WE KNOW</Eyebrow>
        <H>The intel on file.</H>
        <div className="mt-6 flex-1 overflow-y-auto pr-2">
          {data.rows.map((row, k) => (
            <div key={k} className="grid gap-1 border-b border-white/5 py-3 md:grid-cols-[220px_1fr]">
              <p className="text-[11px] tracking-[.2em] text-[#3df5c8]/80" style={mono}>{row.label.toUpperCase()}</p>
              <p className="text-[16px] text-[#eafeff]">{row.v}</p>
            </div>
          ))}
        </div>
      </div>
    );
    if (data?.kind === "seo") s.push(
      <div className="flex h-full flex-col">
        <Eyebrow>TARGETING · MANAGED BY CLAUDE{data.updated ? ` · REFRESHED ${new Date(data.updated).toLocaleDateString()}` : ""}</Eyebrow>
        <H>Where we're aiming{data.primary ? ` from ${data.primary}` : ""}.</H>
        <div className="mt-6 grid flex-1 gap-6 overflow-hidden lg:grid-cols-[1fr_300px]">
          <div className="overflow-y-auto pr-2">
            {data.kw.slice(0, 40).map((k, n) => (
              <div key={n} className="flex items-center gap-3 border-b border-white/5 py-2">
                <span className="w-20 shrink-0 text-[9px] tracking-[.18em] text-[#3df5c8]/70" style={mono}>{(k.priority || "").toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] text-[#eafeff]">{k.term}</span>
                {k.rank != null && <span className="text-[12px] text-[#ffaa00]" style={mono}>#{k.rank}</span>}
                <span className="text-[9px] tracking-[.18em] text-[#9fdbe2]/50" style={mono}>{(k.status || "target").toUpperCase()}</span>
              </div>
            ))}
            {!data.kw.length && <p className="text-[15px] text-[#9fdbe2]/60">Keywords are being built — Claude refreshes them on schedule.</p>}
          </div>
          <div className="overflow-y-auto">
            <p className="mb-2 text-[10px] tracking-[.25em] text-[#3df5c8]" style={mono}>SERVICE AREA</p>
            {data.cities.map((c, n) => (
              <div key={n} className="flex items-center justify-between border-b border-white/5 py-2">
                <span className="text-[15px] text-[#eafeff]">{c.city}{c.state ? `, ${c.state}` : ""}</span>
                <span className="text-[9px] tracking-[.18em]" style={{ ...mono, color: c.page_url ? "#3df5c8" : "#ff6a00" }}>{c.page_url ? "PAGE LIVE" : (c.priority || "target").toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    if (done.length) s.push(
      <div className="flex h-full flex-col">
        <Eyebrow>SECURED · {done.length}</Eyebrow>
        <H>Already locked in.</H>
        <div className="mt-6 flex-1 overflow-y-auto pr-2">{done.map((x) => <ItemRow key={x.id} i={x} />)}</div>
      </div>
    );
    s.push(
      <div className="flex h-full flex-col">
        <Eyebrow color="#ffaa00">NEXT MOVES</Eyebrow>
        <H>{next.length ? "Do these next — in this order." : "This sector is secured."}</H>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {next.map((x, n) => (
            <div key={x.id} className="flex flex-col rounded-xl border border-[#3df5c8]/20 bg-[#3df5c8]/[.04] p-5">
              <p className="text-[40px] font-bold leading-none text-[#3df5c8]/40" style={mono}>0{n + 1}</p>
              <p className="mt-3 text-[19px] font-medium text-[#eafeff]">{x.label}</p>
              <p className="mt-1 flex-1 text-[14px] text-[#9fdbe2]/70">{x.why}</p>
              <button onClick={() => send(x)} disabled={queued[x.id]} className="mt-4 flex items-center justify-center gap-1.5 rounded-md border border-[#3df5c8]/40 py-2 text-[10px] tracking-[.2em] text-[#3df5c8] hover:bg-[#3df5c8]/10 disabled:opacity-50" style={mono}>
                {queued[x.id] ? <><Check className="h-3.5 w-3.5" /> QUEUED FOR CLAUDE</> : <><Sparkles className="h-3.5 w-3.5" /> SEND TO CLAUDE</>}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pillarId, r, con.d, queued]);

  const go = (n) => { setDir(n > i ? 1 : -1); setI(Math.max(0, Math.min(slides.length - 1, n))); };
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-hidden" style={{ background: "radial-gradient(120% 90% at 30% 20%,#0d3238 0%,#05161a 50%,#020709 100%)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px)" }} />
      <div className="pointer-events-none absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full blur-[140px]" style={{ background: `${dc.color}22` }} />
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg,${dc.color} ${((i + 1) / slides.length) * 100}%,rgba(255,255,255,.06) 0)` }} />
      <button onClick={onClose} className="absolute right-5 top-5 z-10 rounded-full border border-white/10 p-2 text-[#9fdbe2] hover:text-white"><X className="h-5 w-5" /></button>
      <div className="absolute inset-0 px-[6vw] pb-24 pt-16">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={i} custom={dir} initial={{ opacity: 0, x: dir * 60, filter: "blur(6px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -dir * 60, filter: "blur(6px)" }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }} className="h-full">
            {slides[i]}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-[6vw] py-6">
        <p className="text-[10px] tracking-[.3em] text-[#9fdbe2]/50" style={mono}>{pillar.code} · {String(i + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</p>
        <div className="flex gap-2">
          <button onClick={() => go(i - 1)} disabled={i === 0} className="rounded-full border border-white/10 p-2.5 text-[#eafeff] disabled:opacity-25"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={() => go(i + 1)} disabled={i === slides.length - 1} className="rounded-full border p-2.5 text-[#021012] disabled:opacity-25" style={{ background: dc.color, borderColor: dc.color }}><ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    </div>,
    document.body
  );
}
