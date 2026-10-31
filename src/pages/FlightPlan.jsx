import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Diamond, RotateCw, TriangleAlert, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useList } from "@/lib/useData";
import { fmtMinutes, itemMinutes } from "@/features/tasks/lib/estimate";
import { packagePath, packageByKey } from "@/features/packages/registry";
import { DELIVERABLES } from "@/features/packages/deliverables";
import { ADDONS, LANES, LOOSE_ENDS, SOP_TO_PACKAGE, STAGES, TIERS, scenarioPieces } from "@/features/flight/flightPlan";
import { cn } from "@/lib/utils";

/* Flight Plan — one huge map of every purchase and everything that has to happen to deliver it.
   Columns are the ways a client can buy (top). Rows are the stages, top to bottom.
   Click any node to see the actual SOP steps (live from the SOP library). */

const HYPER = "#ff3c00";
const GRAVITY = "#0f766e";
const COLS = "grid-cols-[260px_repeat(5,minmax(190px,1fr))]";

const piecesItems = (byKey, pieces) =>
  pieces.flatMap((p) => {
    const t = byKey.get(p.sop);
    const items = Array.isArray(t?.items) ? t.items : [];
    return (p.filter ? items.filter(p.filter) : items).map((i) => ({ ...i, _sop: t?.name || p.sop }));
  });
const sumMin = (items) => items.reduce((s, i) => s + itemMinutes(i), 0);

/* ---------- lane line + nodes ---------- */
function Line({ color, dim, left = "50%", dashed }) {
  return (
    <span
      className="pointer-events-none absolute bottom-0 top-0 w-[2px] -translate-x-1/2"
      style={{ left, background: dashed ? `repeating-linear-gradient(${color} 0 6px, transparent 6px 11px)` : color, opacity: dim ? 0.18 : 0.9 }}
    />
  );
}

function Node({ title, meta, color, dashed, tag, onClick, dim, small }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative z-10 w-full max-w-[200px] border bg-paper px-3 py-2 text-left shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-all hover:-translate-y-[1px] hover:shadow-md",
        small && "max-w-[96px] px-2 py-1.5",
        dim && "opacity-25"
      )}
      style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid", borderLeftWidth: small ? 1 : 4 }}
    >
      {tag ? <span className="mono-label block text-[8.5px]" style={{ color }}>{tag}</span> : null}
      <span className={cn("block font-semibold leading-tight tracking-[-0.01em] text-ink", small ? "text-[11px]" : "text-[12.5px]")}>{title}</span>
      {meta ? <span className="mt-0.5 block font-mono text-[10px] text-ink/50">{meta}</span> : null}
    </button>
  );
}

/* ---------- side drawer: the real SOP steps ---------- */
function Drawer({ open, onClose }) {
  if (!open) return null;
  const { title, kicker, note, items, sops, pkgKey, deliverKey } = open;
  const phases = [];
  items.forEach((i) => {
    const key = (sops.length > 1 ? i._sop + " · " : "") + (i.phase || "Steps");
    const last = phases[phases.length - 1];
    if (last && last.key === key) last.rows.push(i); else phases.push({ key, rows: [i] });
  });
  const total = sumMin(items);
  const pkg = pkgKey ? packageByKey(pkgKey) : null;
  const gets = deliverKey ? DELIVERABLES[deliverKey] : null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-ink/30" onMouseDown={onClose}>
      <aside onMouseDown={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[520px] flex-col border-l border-hair bg-canvas shadow-2xl">
        <header className="border-b border-hair px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mono-label text-[9.5px] text-ink/50">{kicker}</p>
              <h3 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.03em]">{title}</h3>
            </div>
            <button type="button" onClick={onClose} className="p-1 text-ink/50 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          {note ? <p className="mt-2 text-[12.5px] leading-relaxed text-ink/65">{note}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-ink/60">
            <span>{items.length} steps</span>
            {total > 0 ? <span>{fmtMinutes(total)} of work</span> : null}
            {sops.map((s) => s.id ? (
              <Link key={s.id} to={`/tasks/sops?sop=${s.id}`} className="inline-flex items-center gap-1 text-[#ff3c00] hover:underline">{s.sop_code || s.name} in SOP library <ArrowUpRight className="h-3 w-3" /></Link>
            ) : null)}
            {pkg ? <Link to={packagePath(pkg.key)} className="inline-flex items-center gap-1 text-ink/70 hover:text-ink hover:underline">{pkg.label} page <ArrowUpRight className="h-3 w-3" /></Link> : null}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phases.length === 0 ? <p className="text-[13px] text-ink/55">No steps found. Check this SOP exists in the SOP library.</p> : null}
          {phases.map((p) => (
            <section key={p.key} className="mb-5">
              <p className="mono-label mb-2 text-[9.5px] text-[#ff3c00]">{p.key}</p>
              <ol className="divide-y divide-hair border border-hair bg-paper">
                {p.rows.map((i, idx) => (
                  <li key={idx} className="flex items-start gap-3 px-3 py-2.5">
                    <span className="mt-[3px] h-3.5 w-3.5 shrink-0 border border-ink/30" />
                    <span className="flex-1 text-[13px] leading-snug text-ink">{i.title}</span>
                    <span className="shrink-0 text-right font-mono text-[10.5px] text-ink/45">
                      {itemMinutes(i) > 0 ? fmtMinutes(itemMinutes(i)) : ""}
                      {Number(i.offset_days) > 0 ? <span className="block">day {i.offset_days}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {gets?.includes ? (
            <section className="mb-4">
              <p className="mono-label mb-2 text-[9.5px] text-ink/50">What the client gets · {gets.price}</p>
              <ul className="space-y-1.5">
                {gets.includes.map((g) => (
                  <li key={g} className="flex gap-2 text-[12.5px] leading-snug text-ink/75"><Check className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[#ff3c00]" />{g}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

/* ---------- page ---------- */
export default function FlightPlan() {
  const templates = useList("TaskTemplate", { sort: "sort_order", limit: 200 });
  const byKey = useMemo(() => {
    const m = new Map();
    (templates.data || []).forEach((t) => { if (t.service_key && !m.has(t.service_key)) m.set(t.service_key, t); });
    return m;
  }, [templates.data]);

  const [focus, setFocus] = useState(null); // lane key or null = show all
  const [care, setCare] = useState("hyper"); // hyper | gravity
  const [tier, setTier] = useState("local");
  const [addon, setAddon] = useState("ops_command");
  const [drawer, setDrawer] = useState(null);

  const tierRow = TIERS.find((t) => t.key === tier) || TIERS[0];
  const laneOf = (k) => LANES.find((l) => l.key === k);

  const piece = (sop, filter) => {
    const t = byKey.get(sop);
    const items = Array.isArray(t?.items) ? t.items : [];
    const rows = filter ? items.filter(filter) : items;
    return { t, rows, min: sumMin(rows) };
  };

  const openPieces = ({ title, kicker, note, pieces, pkgSop }) => {
    const items = piecesItems(byKey, pieces);
    const sops = [...new Set(pieces.map((p) => p.sop))].map((k) => byKey.get(k) || { name: k });
    const pkgKey = SOP_TO_PACKAGE[pkgSop || pieces[0]?.sop];
    setDrawer({ title, kicker, note, items, sops, pkgKey, deliverKey: pkgKey });
  };

  // Totals for the focused scenario.
  const summary = useMemo(() => {
    if (!focus) return null;
    const lane = focus;
    const pieces = scenarioPieces({ lane, care: lane === "addon" ? null : care, tier, addon });
    const items = piecesItems(byKey, pieces);
    const sopCount = new Set(pieces.map((p) => p.sop)).size;
    return { items: items.length, min: sumMin(items), sops: sopCount };
  }, [focus, care, tier, addon, byKey]);

  const missing = useMemo(() => {
    if (!templates.data) return [];
    const keys = new Set();
    STAGES.forEach((s) => s.rows.forEach((r) => {
      if (r.sop) keys.add(r.sop);
      if (r.gravity?.sop) keys.add(r.gravity.sop);
    }));
    TIERS.forEach((t) => t.streams.forEach((k) => keys.add(k)));
    return [...keys].filter((k) => !byKey.has(k));
  }, [templates.data, byKey]);

  const focusLane = focus ? laneOf(focus) : null;
  const priceLine = () => {
    if (!focusLane) return "";
    if (focus === "addon") return (ADDONS.find((a) => a.key === addon)?.price || "") + " one-time";
    const monthly = care === "hyper" ? `$${tierRow.price.toLocaleString()}/mo HyperCare+ ${tierRow.label}` : "$197/mo GravïtyCare";
    return `${focusLane.price} + ${monthly}`;
  };

  /* ----- cell renderers ----- */
  const cellFor = (row, lane) => {
    const state = row.lanes?.[lane.key];
    const dim = focus && focus !== lane.key;
    const dimNode = dim;

    // Care fork rows: the lane splits into HyperCare+ (left) and GravïtyCare (right).
    if (row.fork) {
      if (lane.key === "addon") {
        return (
          <div className="relative flex min-h-[86px] items-center justify-center">
            <Line color={lane.color} dim dashed />
          </div>
        );
      }
      const hyperOff = focus === lane.key && care !== "hyper";
      const gravOff = focus === lane.key && care !== "gravity";
      const hp = row.hyper.tier
        ? tierRow.streams.filter((k) => k !== "orbit_setup" && k !== "starship").map((k) => ({ sop: k }))
        : [...row.hyper.streams.map((k) => ({ sop: k })), { sop: "starship", filter: (i) => /setup/i.test(i.phase || "") }];
      const hItems = piecesItems(byKey, hp);
      const g = piece(row.gravity.sop, row.gravity.filter);
      return (
        <div className="relative grid min-h-[86px] grid-cols-2 items-center gap-1 px-1">
          <Line color={HYPER} dim={dim || hyperOff} left="25%" />
          <Line color={GRAVITY} dim={dim || gravOff} left="75%" />
          <div className="relative flex justify-center">
            <Node small dim={dimNode || hyperOff} color={HYPER} tag={row.hyper.tier ? tierRow.label : "H+"} title={row.hyper.tier ? "Monthly" : "Setup"}
              meta={`${hItems.length} · ${fmtMinutes(sumMin(hItems))}`}
              onClick={() => openPieces({ title: row.hyper.tier ? `HyperCare+ ${tierRow.label} · every month` : "HyperCare+ · month 0 setup", kicker: lane.label + " → HyperCare+", note: row.hyper.tier ? (tierRow.note || "Change the tier in the bar above the chart.") : "Includes the GravïtyCare setup, because HyperCare+ includes GravïtyCare.", pieces: hp, pkgSop: "orbit_setup" })} />
          </div>
          <div className="relative flex justify-center">
            <Node small dim={dimNode || gravOff} color={GRAVITY} tag="Grav" title={row.loop ? "Monthly" : "Setup"}
              meta={`${g.rows.length} · ${fmtMinutes(g.min)}`}
              onClick={() => openPieces({ title: row.gravity.label, kicker: lane.label + " → GravïtyCare", note: "Hosting, uptime, updates, backups and up to 3 hrs of small edits a month. No search work.", pieces: [{ sop: row.gravity.sop, filter: row.gravity.filter }] })} />
          </div>
          {row.loop ? <RotateCw className="absolute bottom-1 left-1/2 h-3.5 w-3.5 -translate-x-1/2 text-ink/35" /> : null}
        </div>
      );
    }

    // Gate: diamond where the lane forks into the two care plans.
    if (row.gate) {
      if (state === "keep") {
        return (
          <div className="relative flex min-h-[86px] items-center justify-center">
            <Line color={lane.color} dim dashed />
            <span className={cn("relative z-10 max-w-[170px] border border-dashed bg-canvas px-2 py-1 text-center text-[11px] text-ink/55", dim && "opacity-25")} style={{ borderColor: lane.color }}>Stays on their current care plan</span>
          </div>
        );
      }
      return (
        <div className="relative flex min-h-[86px] flex-col items-center justify-center">
          <span className="pointer-events-none absolute left-1/2 top-0 h-1/2 w-[2px] -translate-x-1/2" style={{ background: lane.color, opacity: dim ? 0.18 : 0.9 }} />
          <span className="pointer-events-none absolute bottom-0 left-1/4 h-1/2 w-[2px] -translate-x-1/2" style={{ background: HYPER, opacity: dim ? 0.18 : 0.9 }} />
          <span className="pointer-events-none absolute bottom-0 left-3/4 h-1/2 w-[2px] -translate-x-1/2" style={{ background: GRAVITY, opacity: dim ? 0.18 : 0.9 }} />
          <span className="pointer-events-none absolute left-1/4 right-1/4 top-1/2 h-[2px]" style={{ background: "#1a1a1a", opacity: dim ? 0.18 : 0.5 }} />
          <span className={cn("relative z-10 flex items-center gap-1.5 border border-ink bg-ink px-2.5 py-1 text-[11px] font-semibold text-white", dim && "opacity-25")}>
            <Diamond className="h-3 w-3 text-[#ff3c00]" /> Required
          </span>
          <span className={cn("relative z-10 mt-1 flex w-full justify-between px-2 font-mono text-[9.5px] font-semibold", dim && "opacity-25")}>
            <span style={{ color: HYPER }}>HyperCare+</span><span style={{ color: GRAVITY }}>GravïtyCare</span>
          </span>
        </div>
      );
    }

    if (!state) {
      return (
        <div className="relative min-h-[76px]">
          <Line color={lane.color} dim dashed />
        </div>
      );
    }

    // Normal node.
    let meta = "";
    let onClick = () => {};
    let title = row.label || byKey.get(row.sop)?.name || row.title;
    let tag = "";
    if (row.manual) {
      meta = `${row.steps.length} steps · manual`;
      onClick = () => setDrawer({ title: row.title, kicker: "Stage 01 · " + lane.label, note: row.doing, items: row.steps, sops: [], pkgKey: null });
    } else if (row.milestone) {
      const parts = (row.laneFrom[lane.key] || []).map((i) => row.from[i]);
      const items = piecesItems(byKey, parts);
      meta = `${items.length} steps · inside the builds`;
      tag = "Milestone";
      onClick = () => openPieces({ title: row.label, kicker: "Stage 06 · " + lane.label, note: "These steps are already counted in the build SOPs above. Shown together so you can run launch day from one list." + (lane.key === "alpha" ? " ALPHA promise: live in 45 days or the first 3 months of HyperCare+ are free." : ""), pieces: parts });
    } else {
      const p = piece(row.sop, row.filter);
      title = row.label || p.t?.name || row.sop;
      meta = p.t ? `${p.rows.length} steps · ${fmtMinutes(p.min)}` : "SOP missing";
      tag = p.t?.sop_code || "";
      if (state === "if") tag = "If bought";
      const addonLabel = ADDONS.find((a) => a.key === row.addon)?.label;
      onClick = () => openPieces({ title, kicker: lane.label + (state === "if" ? " · only if they bought " + (addonLabel || "it") : ""), note: p.t?.description, pieces: [{ sop: row.sop, filter: row.filter }] });
    }
    const addonDim = focus === "addon" && lane.key === "addon" && state === "if" && row.addon !== addon;
    return (
      <div className="relative flex min-h-[76px] items-center justify-center px-2 py-2">
        <Line color={lane.color} dim={dim} />
        <Node title={title} meta={meta} tag={tag} color={lane.color} dashed={state === "if"} dim={dimNode || addonDim} onClick={onClick} />
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <PageHeader breadcrumb="Command / Flight Plan" rightText="Every purchase · every stage · every SOP step" />

      <div className="space-y-5 px-5 py-6 md:px-8">
        {/* Intro + legend */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-2xl text-[14px] leading-relaxed text-ink/70">
            The ways a client can buy are across the top. Follow a column down to see every stage that purchase goes through until it's delivered and on a care plan.
            Click any box to see the actual steps from the SOP library. Click a column header to focus on one purchase and see its totals.
          </p>
          <div className="flex flex-wrap items-center gap-4 font-mono text-[10.5px] text-ink/60">
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 border border-l-4 border-ink bg-paper" /> Always</span>
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-5 border border-dashed border-ink bg-paper" /> Only if bought</span>
            <span className="flex items-center gap-1.5"><span className="h-4 w-[2px]" style={{ background: "repeating-linear-gradient(#1a1a1a 0 4px, transparent 4px 7px)", opacity: 0.4 }} /> Skips this stage</span>
            <span className="flex items-center gap-1.5"><RotateCw className="h-3 w-3" /> Repeats monthly</span>
          </div>
        </div>

        {/* Scenario bar */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border border-hair bg-paper px-4 py-3">
          <div className="min-w-0">
            <p className="mono-label text-[9px] text-ink/50">{focusLane ? "Focused purchase" : "Showing every purchase"}</p>
            <p className="mt-0.5 text-[15px] font-semibold tracking-[-0.02em]">
              {focusLane ? (focus === "addon" ? (ADDONS.find((a) => a.key === addon)?.label + " (add-on)") : `${focusLane.label} + ${care === "hyper" ? "HyperCare+ " + tierRow.label : "GravïtyCare"}`) : "Pick a column header to focus"}
            </p>
            {focusLane ? <p className="font-mono text-[11px] text-ink/55">{priceLine()}</p> : null}
          </div>
          {summary ? (
            <div className="flex items-center gap-6">
              <div><p className="mono-label text-[8.5px] text-ink/45">SOPs</p><p className="text-[22px] font-semibold leading-none tracking-[-0.03em]">{summary.sops}</p></div>
              <div><p className="mono-label text-[8.5px] text-ink/45">Steps</p><p className="text-[22px] font-semibold leading-none tracking-[-0.03em]">{summary.items}</p></div>
              <div><p className="mono-label text-[8.5px] text-ink/45">Work (first cycle)</p><p className="text-[22px] font-semibold leading-none tracking-[-0.03em] text-[#ff3c00]">{fmtMinutes(summary.min)}</p></div>
            </div>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {focus && focus !== "addon" ? (
              <>
                <div className="flex border border-hair">
                  {[["hyper", "HyperCare+"], ["gravity", "GravïtyCare"]].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setCare(k)} className={cn("px-3 py-1.5 text-[12px] font-medium", care === k ? "bg-ink text-white" : "bg-paper text-ink/60 hover:text-ink")}>{l}</button>
                  ))}
                </div>
                {care === "hyper" ? (
                  <div className="flex border border-hair">
                    {TIERS.map((t) => (
                      <button key={t.key} type="button" onClick={() => setTier(t.key)} className={cn("px-2.5 py-1.5 text-[11.5px]", tier === t.key ? "bg-[#ff3c00] text-white" : "bg-paper text-ink/60 hover:text-ink")}>{t.label}</button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
            {focus === "addon" ? (
              <div className="flex flex-wrap border border-hair">
                {ADDONS.map((a) => (
                  <button key={a.key} type="button" onClick={() => setAddon(a.key)} className={cn("px-2.5 py-1.5 text-[11.5px]", addon === a.key ? "bg-[#b45309] text-white" : "bg-paper text-ink/60 hover:text-ink")}>{a.label}</button>
                ))}
              </div>
            ) : null}
            {focus ? <button type="button" onClick={() => setFocus(null)} className="px-2 py-1.5 text-[12px] text-ink/55 hover:text-ink">Show all</button> : null}
          </div>
        </div>

        {missing.length ? (
          <p className="flex items-center gap-2 border border-red-300 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
            <TriangleAlert className="h-4 w-4" /> Missing from the SOP library: {missing.join(", ")}
          </p>
        ) : null}

        {/* The chart */}
        <div className="overflow-x-auto border border-hair bg-canvas">
          <div className={cn("grid min-w-[1260px]", COLS)}>
            {/* Header: purchase scenarios */}
            <div className="sticky left-0 z-20 border-b border-r border-hair bg-canvas px-4 py-4">
              <p className="mono-label text-[9.5px] text-ink/50">What they bought →</p>
              <p className="mt-1 text-[12px] leading-snug text-ink/60">Every mission, website and app ends on a care plan.</p>
            </div>
            {LANES.map((lane) => {
              const active = focus === lane.key;
              return (
                <button key={lane.key} type="button" onClick={() => setFocus(active ? null : lane.key)}
                  className={cn("relative border-b border-hair px-3 pb-4 pt-4 text-left transition-colors", active ? "bg-paper" : "hover:bg-paper/70", focus && !active && "opacity-40")}>
                  <span className="absolute inset-x-0 top-0 h-[4px]" style={{ background: lane.color }} />
                  <p className="text-[15px] font-semibold tracking-[-0.02em]">{lane.label}</p>
                  <p className="font-mono text-[11px]" style={{ color: lane.color }}>{lane.price}</p>
                  <p className="mt-1 text-[11.5px] leading-snug text-ink/55">{lane.sub}</p>
                  <p className="mt-2 mono-label text-[8.5px] text-ink/40">{active ? "Focused · click to clear" : "Click to focus"}</p>
                </button>
              );
            })}

            {STAGES.map((stage) => (
              <React.Fragment key={stage.num}>
                {/* Stage header row */}
                <div className="sticky left-0 z-20 border-r border-t border-hair bg-ink px-4 py-3 text-white">
                  <p className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] text-[#ff6a00]">{stage.num}</span>
                    <span className="text-[16px] font-semibold tracking-[-0.02em]">{stage.title}</span>
                    {stage.parallel ? <span className="mono-label text-[8.5px] text-white/50">in parallel</span> : null}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-white/60">{stage.hint}</p>
                </div>
                {LANES.map((lane) => (
                  <div key={lane.key} className="relative border-t border-hair bg-ink/[0.035]">
                    {stage.care && lane.key !== "addon" ? (
                      <>
                        <Line color={lane.color} dim={focus && focus !== lane.key} />
                      </>
                    ) : (
                      <Line color={lane.color} dim={!!(focus && focus !== lane.key)} />
                    )}
                  </div>
                ))}

                {stage.rows.map((row) => (
                  <React.Fragment key={row.key}>
                    <div className="sticky left-0 z-20 border-r border-hair bg-canvas px-4 py-3">
                      <p className="text-[13px] font-semibold leading-tight tracking-[-0.01em] text-ink">{row.label || row.title || byKey.get(row.sop)?.name || row.sop}</p>
                      <p className="mt-1 text-[11.5px] leading-snug text-ink/60">{row.doing}</p>
                    </div>
                    {LANES.map((lane) => (
                      <div key={lane.key}>{cellFor(row, lane)}</div>
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}

            {/* Footer: delivered */}
            <div className="sticky left-0 z-20 border-r border-t border-hair bg-canvas px-4 py-4">
              <p className="mono-label text-[9.5px] text-[#ff3c00]">Delivered</p>
              <p className="mt-1 text-[12px] leading-snug text-ink/60">Paid for, built, live and on a care plan. The monthly loop runs until they cancel.</p>
            </div>
            {LANES.map((lane) => (
              <div key={lane.key} className={cn("flex items-center justify-center border-t border-hair px-3 py-4", focus && focus !== lane.key && "opacity-30")}>
                <span className="flex items-center gap-1.5 border px-2.5 py-1 text-[11.5px] font-semibold" style={{ borderColor: lane.color, color: lane.color }}>
                  <Check className="h-3.5 w-3.5" /> {lane.key === "addon" ? "Package handed over" : "Live + cared for"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Loose ends */}
        <section className="border border-hair bg-paper">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hair px-4 py-3">
            <p className="text-[15px] font-semibold tracking-[-0.02em]">Loose <span className="text-[#ff3c00]">/ends</span></p>
            <p className="font-mono text-[10.5px] text-ink/50">Where "Start a service" doesn't match this flow yet · found Oct 31, 2026</p>
          </header>
          <ul className="grid gap-px bg-hair md:grid-cols-2">
            {LOOSE_ENDS.map((l) => (
              <li key={l.title} className="bg-paper px-4 py-3">
                <p className="flex items-start gap-2 text-[13px] font-semibold leading-snug"><TriangleAlert className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[#ff3c00]" />{l.title}</p>
                <p className="mt-1 pl-[22px] text-[12px] leading-relaxed text-ink/60">{l.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Drawer open={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}
