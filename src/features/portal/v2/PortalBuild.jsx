// Portal live build (Build Engine): the client-friendly checklist items light up as Claude and the team tick them,
// and the first time the website or Command System goes live the client sees a one-time launch moment.
import { useEffect, useState } from "react";
import { Check, Rocket } from "lucide-react";

// Brain unlocks as progress (Build Engine, Nov 19 2026): one line each, e.g. "Your social engine unlocks when we have
// your brand colors." Lit when on. Lines come from ClientUnlock.portal (written by the brain-unlocks function).
export function PortalUnlocksBand({ unlocks }) {
  const list = Array.isArray(unlocks) ? unlocks : [];
  if (!list.length) return null;
  const on = list.filter((u) => u.on).length;
  return (
    <section className="rounded-md border border-hair bg-card p-5" aria-labelledby="unlocks-h" data-testid="portal-unlocks">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ms-kicker">(What unlocks next)</p>
          <h2 id="unlocks-h" className="mt-1 text-[22px] font-semibold tracking-[-0.035em]">Your engines <span className="text-[#ff3c00]">/unlocking</span></h2>
        </div>
        <p className="font-mono text-[12px] text-ink/55">{on} of {list.length} unlocked</p>
      </div>
      <ul className="mt-4 grid gap-2 md:grid-cols-2">
        {list.map((u) => (
          <li key={u.key} className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px] ${u.on ? "border-[#ff3c00]/35 bg-[#ff3c00]/[0.05] text-ink" : "border-hair text-ink/60"}`}>
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${u.on ? "bg-[#ff3c00] text-white" : "border border-ink/20"}`}>{u.on ? <Check className="h-3 w-3" /> : null}</span>
            <span><b className="block font-semibold">{u.label}</b>{u.portal}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PortalBuildBand({ build }) {
  const v = build?.view;
  if (!v || !v.total) return null;
  return (
    <section className="rounded-md border border-hair bg-card p-5" aria-labelledby="build-h" data-testid="portal-build">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ms-kicker">(Your build, live)</p>
          <h2 id="build-h" className="mt-1 text-[22px] font-semibold tracking-[-0.035em]">What we&apos;re building <span className="text-[#ff3c00]">/right now</span></h2>
        </div>
        <p className="font-mono text-[12px] text-ink/55">{v.done} of {v.total} done · {v.pct}%</p>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-ink/[0.08]"><div className="h-full rounded-full bg-[#ff3c00] transition-[width] duration-700" style={{ width: `${v.pct}%` }} /></div>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {v.tracks.map((t) => (
          <div key={t.key}>
            <p className="mb-2 text-[13px] font-semibold">{t.label}</p>
            <ul className="grid gap-1.5">
              {t.items.map((i) => (
                <li key={i.label} className={`flex items-center gap-2 text-[13px] transition-colors ${i.done ? "text-ink" : "text-ink/45"}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${i.done ? "bg-[#ff3c00] text-white shadow-[0_0_10px_rgba(255,60,0,0.45)]" : "border border-ink/20"}`}>{i.done ? <Check className="h-3 w-3" /> : null}</span>
                  {i.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const SEEN = (cid, kind) => `portal.launch_seen.${cid}.${kind}`;
const RECENT_DAYS = 30;

// One-time launch moment: shown once per browser for each of website / Command System, within 30 days of going live.
export function LaunchMoment({ clientId, build, business }) {
  const [show, setShow] = useState(null);
  useEffect(() => {
    const kinds = [["website", build?.website_live_at, "Your website is live"], ["command", build?.command_live_at, "Your Command System is live"]];
    for (const [k, at, title] of kinds) {
      if (!at || Date.now() - Date.parse(at) > RECENT_DAYS * 864e5) continue;
      let seen = false;
      try { seen = !!localStorage.getItem(SEEN(clientId, k)); } catch { seen = false; }
      if (!seen) { setShow({ k, title }); return; }
    }
  }, [clientId, build?.website_live_at, build?.command_live_at]);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(SEEN(clientId, show.k), "1"); } catch { /* storage blocked */ } setShow(null); };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="launch-h" className="fixed inset-0 z-[80] grid place-items-center bg-[#07080d]/85 px-6" data-testid="launch-moment" onClick={close}>
      <style>{`@keyframes pv2-lift{0%{transform:translateY(40px) scale(.9);opacity:0}60%{opacity:1}100%{transform:translateY(-8px) scale(1);opacity:1}}@keyframes pv2-trail{0%{height:0;opacity:0}100%{height:120px;opacity:.9}}@media (prefers-reduced-motion: reduce){.pv2-lift,.pv2-trail{animation:none!important}}`}</style>
      <div className="relative max-w-md text-center text-white" onClick={(e) => e.stopPropagation()}>
        <div className="relative mx-auto mb-6 h-40 w-16">
          <span className="pv2-trail absolute bottom-0 left-1/2 w-1 -translate-x-1/2 rounded-full" style={{ background: "linear-gradient(to top, transparent, #ff6a00, #ffaa00)", animation: "pv2-trail 1.4s ease-out forwards" }} />
          <span className="pv2-lift absolute bottom-6 left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full" style={{ background: "linear-gradient(135deg,#ff3c00,#ff6a00,#ffaa00)", animation: "pv2-lift 1.4s cubic-bezier(.2,.8,.2,1) forwards", boxShadow: "0 0 40px rgba(255,106,0,.6)" }}><Rocket className="h-7 w-7" /></span>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/60">Liftoff</p>
        <h2 id="launch-h" className="mt-2 text-[34px] font-semibold leading-tight tracking-[-0.04em]">{show.title}</h2>
        <p className="mt-2 text-[14px] text-white/70">{business ? `${business} is officially in orbit.` : "You're officially in orbit."} Everything we built is now working for you.</p>
        <button type="button" onClick={close} className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-5 text-[13.5px] font-medium text-[#07080d]">Take a look <X className="h-3.5 w-3.5 opacity-0" aria-hidden="true" /></button>
      </div>
    </div>
  );
}
