// The lead-tier portal: what a lead sees after logging in. "We built this for <Business>", their website preview
// (phone / desktop), their Command System preview (sample data, read-only), what Interstellar is (packages from
// OfferCatalog, no prices: quotes are custom), the $30-for-30-minutes offer and the walkthrough booking.
// Used by the portal (PortalApp, lead tier) and by Møthership's "Their portal" button (same view, preview flag).
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarCheck, Check, LayoutDashboard, LogOut, MonitorSmartphone, Sparkles, Eye, Images } from "lucide-react";
import PortfolioView from "./PortfolioView";
import BrandLockup from "@/components/brand/BrandLockup";
import WebsitePreview from "./WebsitePreview";
import CommandPreview from "./CommandPreview";
import PreviewFrame, { DeviceToggle } from "./PreviewFrame";

const VIEWS = [["home", "Welcome", Sparkles], ["website", "Your website", MonitorSmartphone], ["command", "Your Command System", LayoutDashboard], ["work", "Our work", Images], ["offer", "Interstellar", Check]];

export default function LeadPortalView({ d, track, onBook, onLogout, preview = false, previewNote }) {
  const [view, setView] = useState("home");
  const [device, setDevice] = useState("desktop");
  const c = d?.client || {};
  const p = d?.preview || null;
  const t0 = useRef(Date.now());
  // Engagement: a session on open, a view event per tab, and time on each tab (sent every 30s and on switch).
  useEffect(() => { track?.({ event: "session", view: "home" }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    t0.current = Date.now();
    track?.({ event: "view", view });
    const flush = () => { const s = Math.round((Date.now() - t0.current) / 1000); t0.current = Date.now(); if (s > 0 && document.visibilityState === "visible") track?.({ event: "time", view, seconds: Math.min(60, s) }); };
    const iv = setInterval(flush, 30000);
    return () => { clearInterval(iv); flush(); };
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (v) => { setView(v); window.scrollTo?.({ top: 0 }); };
  const first = String(c.contact || "").split(/\s+/)[0];

  return (
    <div className="grid-canvas min-h-screen text-ink" data-lead-portal>
      {preview ? <div className="relative z-30 flex items-center justify-center gap-2 bg-ink px-4 py-2 text-[12px] text-white"><Eye className="h-3.5 w-3.5 text-[#ff3c00]" />{previewNote || `Previewing exactly what ${c.business} sees (lead tier).`}</div> : null}
      <header className="sticky top-0 z-20 border-b border-hair bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-[64px] max-w-[1280px] items-center gap-3 px-4 md:px-8">
          <BrandLockup word="INTERSTELLAR" sub="" size={13} />
          <span className="h-8 w-px bg-hair" aria-hidden="true" />
          <div className="flex min-w-0 items-center gap-2">{c.logo_url ? <img src={c.logo_url} alt="" className="h-8 w-8 object-contain" /> : null}<p className="truncate text-[14px] font-semibold tracking-[-0.02em]">{c.business}</p></div>
          <nav aria-label="Your preview" className="ml-auto hidden items-center gap-0.5 lg:flex">
            {VIEWS.map(([k, l]) => <button key={k} type="button" aria-current={view === k ? "page" : undefined} onClick={() => go(k)} className={`relative h-10 px-3 text-[13.5px] font-medium ${view === k ? "text-ink" : "text-ink/55 hover:text-ink"}`}>{l}{view === k ? <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-[#ff3c00]" /> : null}</button>)}
          </nav>
          <button type="button" onClick={onBook} className="ml-auto inline-flex h-10 items-center gap-1.5 bg-[#ff3c00] px-3 text-[13px] font-medium text-white hover:bg-ink lg:ml-2"><CalendarCheck className="h-4 w-4" /><span className="hidden sm:inline">Book your 30 minutes</span><span className="sm:hidden">Book</span></button>
          {onLogout && !preview ? <button type="button" onClick={onLogout} aria-label="Log out" className="grid h-10 w-9 place-items-center text-ink/45 hover:text-[#ff3c00]"><LogOut className="h-4 w-4" /></button> : null}
        </div>
        <nav aria-label="Your preview" className="flex gap-1 overflow-x-auto border-t border-hair px-3 py-1.5 lg:hidden">
          {VIEWS.map(([k, l]) => <button key={k} type="button" aria-current={view === k ? "page" : undefined} onClick={() => go(k)} className={`h-9 shrink-0 px-3 text-[13px] ${view === k ? "bg-ink text-white" : "text-ink/60"}`}>{l}</button>)}
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-[1280px] px-4 pb-24 pt-8 md:px-8">
        {view === "home" ? (
          <div className="page-enter space-y-10">
            <section className="relative overflow-hidden border border-hair bg-ink px-6 py-12 text-white md:px-12 md:py-16">
              <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] flame-bg" />
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50"><span className="text-[#ff3c00]">+</span> Built for {c.business}</p>
              <h1 className="mt-4 max-w-3xl text-[40px] font-semibold leading-[0.98] tracking-[-0.045em] md:text-[64px]">We built this for <span className="bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00] bg-clip-text text-transparent">{c.business}</span>.</h1>
              <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/70">{first ? `${first}, n` : "N"}o strings attached: a brand-new website and a Command System, the software that runs your leads, jobs, customers and invoices in one place. Look around. When you're ready, give us 30 minutes and we'll pay you for your time.</p>
              <div className="mt-8 flex flex-wrap gap-2">
                <button type="button" onClick={() => go("website")} className="inline-flex h-11 items-center gap-2 bg-[#ff3c00] px-5 text-[14px] font-medium text-white hover:bg-white hover:text-ink">See your website <ArrowRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => go("command")} className="inline-flex h-11 items-center gap-2 border border-white/25 px-5 text-[14px] font-medium text-white hover:border-white">Open your Command System</button>
              </div>
            </section>
            <div className="grid gap-4 md:grid-cols-3">
              {[["website", "01", "Your website", "Built with your name, your services and your area. See it on your phone and on a desktop."], ["command", "02", "Your Command System", "A clickable demo of the software behind it, filled with sample data so you can see how your day would run."], ["offer", "03", "$30 for 30 minutes", "Book a walkthrough. We pay $1 a minute, $30 total, whether you love it or not."]].map(([k, n, title, text]) => (
                <button key={k} type="button" onClick={() => (k === "offer" ? onBook() : go(k))} className="card-hover border border-hair bg-paper p-6 text-left">
                  <span className="font-mono text-[11px] text-[#ff3c00]">{n}</span>
                  <span className="mt-3 block text-[22px] font-semibold tracking-[-0.03em]">{title}</span>
                  <span className="mt-2 block text-[13.5px] leading-relaxed text-ink/60">{text}</span>
                </button>
              ))}
            </div>
            <OfferBand d={d} onBook={onBook} booked={d?.booked} />
          </div>
        ) : null}
        {view === "website" ? (
          <div className="page-enter space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label-cross">(Your website)</p><h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">{c.business}, online</h2></div><DeviceToggle device={device} setDevice={setDevice} /></div>
            {p?.website ? <PreviewFrame device={device}><WebsitePreview config={p.website} onCta={onBook} /></PreviewFrame> : <Pending />}
          </div>
        ) : null}
        {view === "command" ? (
          <div className="page-enter space-y-4">
            <div><p className="label-cross">(Your Command System)</p><h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">How {c.business} would run</h2><p className="mt-1 max-w-2xl text-[14px] text-ink/60">Click around. Everything here is sample data so you can see how it works; your real system is built around how you actually work.</p></div>
            {p?.command ? <CommandPreview config={p.command} /> : <Pending />}
          </div>
        ) : null}
        {view === "work" ? <div className="page-enter"><PortfolioView items={d?.portfolio || []} /></div> : null}
        {view === "offer" ? <div className="page-enter"><WhatIsInterstellar d={d} onBook={onBook} /></div> : null}
      </main>
    </div>
  );
}

function Pending() {
  return <div className="border border-hair bg-paper px-6 py-16 text-center"><p className="text-[16px] font-semibold">We're putting the finishing touches on it.</p><p className="mt-1 text-[13px] text-ink/55">Check back shortly, or book your walkthrough and we'll show you live.</p></div>;
}

function OfferBand({ d, onBook, booked }) {
  const inc = d?.incentive || { amount: 30, minutes: 30, methods: ["Venmo", "Cash App", "PayPal", "check"] };
  return (
    <section className="grid gap-6 border border-hair bg-paper p-6 md:grid-cols-[1.4fr_1fr] md:p-10">
      <div>
        <p className="label-cross">(Our thank-you)</p>
        <h2 className="mt-3 text-[30px] font-semibold leading-[1.02] tracking-[-0.04em] md:text-[40px]">${inc.amount} for {inc.minutes} minutes of your time.</h2>
        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink/65">Book a {inc.minutes}-minute walkthrough of your website and Command System. We pay you $1 a minute by {inc.methods.join(", ").replace(/, ([^,]*)$/, " or $1")}, paid after the call, whether you sign up or not. No contract, no card.</p>
      </div>
      <div className="flex flex-col justify-center gap-3 border-t border-hair pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
        {booked ? <p className="flex items-center gap-2 text-[14px] font-medium text-green-800"><Check className="h-4 w-4" />Your walkthrough is booked. Check your email for the invite.</p> : null}
        <button type="button" onClick={onBook} className="inline-flex h-12 items-center justify-center gap-2 bg-[#ff3c00] px-6 text-[14.5px] font-medium text-white hover:bg-ink"><CalendarCheck className="h-4 w-4" />{booked ? "Book another time" : "Book your 30-minute walkthrough"}</button>
        <p className="text-[12px] text-ink/50">Weekdays, Pacific time. Pick a slot that works.</p>
      </div>
    </section>
  );
}

function WhatIsInterstellar({ d, onBook }) {
  const offers = d?.offers || [];
  const missions = offers.filter((o) => o.kind === "mission");
  const builds = offers.filter((o) => o.kind === "build");
  const care = offers.filter((o) => o.kind === "subscription");
  const Box = ({ o }) => (
    <div className="border border-hair bg-paper p-5">
      <p className="text-[18px] font-semibold tracking-[-0.03em]">{o.name}</p>
      {o.summary ? <p className="mt-1 text-[13px] text-ink/60">{o.summary}</p> : null}
      {o.includes?.length ? <ul className="mt-3 space-y-1">{o.includes.map((i) => <li key={i} className="flex items-start gap-2 text-[13px]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff3c00]" />{i}</li>)}</ul> : null}
    </div>
  );
  return (
    <div className="space-y-8">
      <section>
        <p className="label-cross">(What Interstellar is)</p>
        <h2 className="mt-3 max-w-3xl text-[34px] font-semibold leading-[1.02] tracking-[-0.045em] md:text-[48px]">We build your business its own operating system, then run it with you every month.</h2>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-ink/65">A website that gets found, a Command System built around how you work, and a team that keeps it all running. You own what we build. Every quote is custom to your business, so we don't list prices here: we'll walk you through it on your call.</p>
      </section>
      {missions.length ? <section><p className="mono-label mb-3 text-[10px] text-ink/50">Full builds</p><div className="grid gap-3 md:grid-cols-2">{missions.map((o) => <Box key={o.key} o={o} />)}</div></section> : null}
      {builds.length ? <section><p className="mono-label mb-3 text-[10px] text-ink/50">Or one piece at a time</p><div className="grid gap-3 md:grid-cols-2">{builds.map((o) => <Box key={o.key} o={o} />)}</div></section> : null}
      {care.length ? <section><p className="mono-label mb-3 text-[10px] text-ink/50">Monthly care</p><div className="grid gap-3 md:grid-cols-2">{care.map((o) => <Box key={o.key} o={o} />)}</div></section> : null}
      <OfferBand d={d} onBook={onBook} booked={d?.booked} />
    </div>
  );
}
