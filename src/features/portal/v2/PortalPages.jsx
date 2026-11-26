// Portal simplification (Nov 2026): four pages. Glance (home) · Requests & self-serve · Brand & assets · Billing.
// This file holds the client-friendly pillars band (Glance), the self-serve strip (Requests) and the Brand & assets page.
// Old tab keys (brain, files, brand, signatures, qr, playbook, resources, …) still open exactly as before.
import { useState } from "react";
import { ArrowUpRight, Brain, FolderOpen, Palette, PenLine, QrCode, Compass, BookOpen, Radio, Sun, Snowflake } from "lucide-react";
import { PillarRadial, TONE } from "@/features/build/ClientPillars";

export function PortalPillarsBand({ pillars }) {
  const list = Array.isArray(pillars) ? pillars : [];
  if (!list.length) return null;
  const known = list.filter((p) => p.score != null);
  return (
    <section className="rounded-md border border-hair bg-card p-5" aria-labelledby="pillars-h" data-testid="portal-pillars">
      <p className="ms-kicker">(Your business, pillar by pillar)</p>
      <h2 id="pillars-h" className="mt-1 text-[22px] font-semibold tracking-[-0.035em]">How each part of your business <span className="text-[#ff3c00]">/is doing</span></h2>
      <div className="mt-4 grid items-center gap-5 sm:grid-cols-[auto_1fr]">
        <div className="mx-auto"><PillarRadial pillars={list} size={180} /></div>
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {list.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 text-[13.5px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE[p.tone] || TONE.none }} aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="font-medium">{p.label}</span> <span className="text-ink/50">· {p.line}</span></span>
              <span className="font-mono text-[11px] text-ink/45">{p.score == null ? "—" : p.score}</span>
            </li>
          ))}
        </ul>
      </div>
      {known.length < list.length ? <p className="mt-3 text-[12px] text-ink/50">A dash means we don't have enough information yet. Answering your Brain questions fills these in.</p> : null}
    </section>
  );
}

// Self-serve (stubs): switch the season, turn an offer on. Each files a normal request. Projects, drops and products
// now go through the Submit intake (PortalSubmit).
export function SelfServeStrip({ call, refresh, preview }) {
  const [sent, setSent] = useState("");
  const [season, setSeason] = useState("");
  const send = async (title, details) => {
    if (preview) { setSent(`${title} (preview: not sent)`); return; }
    try { await call("create_request", { kind: "content", title, details }); setSent(title); refresh?.(); } catch { setSent("Couldn't send. Please try again."); }
  };
  return (
    <section className="space-y-3" data-testid="portal-self-serve">
      <div>
        <p className="label-cross">(Self-serve)</p>
        <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.04em]">Do it <span className="text-[#ff3c00]">/yourself</span></h2>
        <p className="mt-1 text-[13px] text-ink/55">Each one starts a request we pick up. To send us a job, a drop or photos, use Submit above.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-hair bg-card p-4">
          <p className="text-[14px] font-semibold">Season</p>
          <p className="text-[12px] text-ink/55">Tell us your busy and slow seasons so content and offers match.</p>
          <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Season">
            {[["busy", "Busy season", Sun], ["slow", "Slow season", Snowflake]].map(([k, l, I]) => (
              <button key={k} type="button" role="radio" aria-checked={season === k} onClick={() => { setSeason(k); send(`Season: ${l}`, `Self-serve: switched to ${l}`); }} className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] ${season === k ? "border-[#ff3c00] text-ink" : "border-hair text-ink/65"}`}><I className="h-3.5 w-3.5" />{l}</button>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-hair bg-card p-4">
          <p className="text-[14px] font-semibold">Offers</p>
          <p className="text-[12px] text-ink/55">Run a promotion on your site and Google profile.</p>
          <button type="button" onClick={() => send("Start an offer", "Self-serve: start an offer")} className="mt-3 inline-flex h-9 items-center rounded-full border border-hair px-3 text-[12.5px] hover:border-ink/40">Start an offer</button>
        </div>
      </div>
      {sent ? <p className="text-[12.5px] text-ink/60" role="status">Sent: {sent}</p> : null}
    </section>
  );
}

// Workspace hub pages (Plan, Brand & files, Account): the group's tiles, an optional extra tile list, then `children`
// (e.g. Goals under Plan, Billing under Account). Locked tiles keep their label and still open their preview.
export function HubPage({ group, extra = [], go, children }) {
  if (!group && !extra.length) return children || null;
  const items = [...extra, ...(group?.items || [])];
  return (
    <div className="space-y-6" data-testid={`portal-hub-${group?.id || "x"}`}>
      <div>
        <p className="label-cross">({group?.label})</p>
        <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">{group?.label}</h2>
        {group?.hint ? <p className="mt-1 text-[14px] text-ink/55">{group.hint}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <button key={i.k} type="button" onClick={() => go(i.k)} className="card-hover flex items-center gap-3 rounded-md border border-hair bg-card p-4 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md flame-bg text-white"><i.icon className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[15px] font-semibold">{i.label}{i.badge ? <span className="rounded-full bg-[#ff3c00] px-1.5 font-mono text-[10px] text-white">{i.badge}</span> : null}{i.locked ? <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink/45">{i.locked}</span> : null}</span>
              <span className="block text-[12.5px] text-ink/55">{i.desc}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 text-ink/40" />
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

// Brand & assets (pre-Workspace page; kept for reference): one page linking every brand thing the client has.
export function BrandAssetsPage({ tabs, go, d }) {
  const has = new Set(tabs);
  const items = [
    { k: "brain", icon: Brain, title: "Your Brain", desc: `What we know about your business${d?.brain?.open ? ` · ${d.brain.open} questions for you` : ""}` },
    { k: "brand", icon: Palette, title: "Brand kit", desc: "Logo rules, colors, fonts and voice" },
    { k: "files", icon: FolderOpen, title: "Files", desc: "Everything we delivered" },
    { k: "signatures", icon: PenLine, title: "Email signatures", desc: "On-brand signatures for your team" },
    { k: "qr", icon: QrCode, title: "QR codes", desc: "Branded codes you can re-point" },
    { k: "playbook", icon: Compass, title: "Playbook", desc: "Your industry growth plan" },
    { k: "resources", icon: BookOpen, title: "SOPs & guides", desc: "How your business runs" },
  ].filter((i) => has.has(i.k));
  return (
    <div className="space-y-4" data-testid="portal-brand-assets">
      <div>
        <p className="label-cross">(Brand & assets)</p>
        <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">Your brand, <span className="text-[#ff3c00]">/in one place</span></h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <button key={i.k} type="button" onClick={() => go(i.k)} className="card-hover flex items-center gap-3 rounded-md border border-hair bg-card p-4 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md flame-bg text-white"><i.icon className="h-[18px] w-[18px]" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{i.title}</span><span className="block text-[12.5px] text-ink/55">{i.desc}</span></span>
            <ArrowUpRight className="h-4 w-4 text-ink/40" />
          </button>
        ))}
        <div className="flex items-center gap-3 rounded-md border border-dashed border-hair p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink/10"><Radio className="h-[18px] w-[18px] text-ink/50" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Transmission</span><span className="block text-[12.5px] text-ink/55">Your brand story, broadcast. Coming soon.</span></span>
        </div>
      </div>
    </div>
  );
}
