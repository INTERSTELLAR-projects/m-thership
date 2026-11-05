// Portal > Upgrades: the client's Upgrade Store. A grid of add-ons offered to this client, a detail view with demo
// media, what it does, price, "Try it" / "Start trial", "Buy" (Stripe Checkout or Justin's Payment Link), and a
// paywall that keeps their work once the free try is used. All state comes from the `addons` function; the trial is
// metered server-side. Also exports UpgradeSpotlight (inline upsell on Home) and AddonPaywall (locked-feature card).
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Box, Check, Loader2, Lock, Play, Sparkles, ShieldCheck, X } from "lucide-react";
import { Panel, Empty, Tag } from "@/features/clients/ui";
import { addonsCall, useAddonStore, errText, priceLine, trialLine, stateLabel, usd, rememberOpen, takeOpen } from "./api";

const paragraphs = (s) => String(s || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

// Media: first image/video, or a branded visual when none is uploaded yet.
export function AddonVisual({ addon, large = false }) {
  const m = (addon.media || [])[0];
  const h = large ? "aspect-[16/9]" : "aspect-[16/8]";
  if (m?.type === "video") return <video src={m.url} className={`${h} w-full bg-ink object-cover`} controls={large} muted playsInline preload="metadata" />;
  if (m?.url) return <img src={m.url} alt={m.caption || addon.name} className={`${h} w-full bg-ink object-cover`} loading="lazy" />;
  return (
    <div className={`band-dark grain relative ${h} w-full overflow-hidden`} aria-hidden="true">
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,#ff6a00_0%,rgba(255,60,0,.25)_45%,transparent_70%)] blur-xl" />
      <div className="absolute inset-0 flex flex-col justify-end p-5">
        <span className="flex h-11 w-11 items-center justify-center flame-bg text-white"><Box className="h-5 w-5" /></span>
        {large && <p className="mt-3 max-w-md text-[13px] text-white/70">{addon.tagline}</p>}
      </div>
    </div>
  );
}

function StateTag({ addon }) {
  const s = stateLabel(addon);
  return <Tag tone={s.tone}>{s.text}</Tag>;
}

export default function PortalUpgrades({ scopeId, preview, call }) {
  const { addons, loading, refetch, store } = useAddonStore(scopeId);
  const [open, setOpen] = useState(() => takeOpen() || new URLSearchParams(window.location.search).get("addon") || "");
  const [returned, setReturned] = useState("");
  // Back from Stripe: the webhook activates the add-on a moment later, so re-read a few times.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get("upgrades");
    if (!r && !p.get("addon")) return undefined;
    if (r) setReturned(r);
    const timers = r === "success" ? [0, 3000, 8000, 15000, 30000].map((ms) => setTimeout(() => refetch(), ms)) : [];
    ["upgrades", "addon", "session_id", "tab"].forEach((k) => p.delete(k));
    window.history.replaceState(null, "", `${window.location.pathname}${p.toString() ? `?${p}` : ""}`);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const current = addons.find((a) => a.key === open);
  // The server says whether this is Justin's admin preview (QA fixtures play the client's own login).
  const isPreview = store ? !!store.admin_preview : preview;

  return (
    <div className="space-y-6" data-upgrades>
      {returned === "success" && (
        <div className="flex items-start gap-3 border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900" role="status">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">Payment received. Your upgrade unlocks in a few seconds. You&apos;ll get a receipt from Stripe by email.</span>
          <button type="button" onClick={() => setReturned("")} aria-label="Dismiss" className="text-green-900/60 hover:text-green-900"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {returned === "cancelled" && (
        <div className="flex items-start gap-3 border border-hair bg-card px-4 py-3 text-[13px] text-ink/70" role="status">
          <span className="flex-1">Checkout was canceled. Nothing was charged.</span>
          <button type="button" onClick={() => setReturned("")} aria-label="Dismiss" className="text-ink/45 hover:text-ink"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {current ? (
        <AddonDetail addon={current} scopeId={scopeId} preview={isPreview} call={call} onBack={() => setOpen("")} onChanged={refetch} />
      ) : (
        <>
          <div>
            <p className="label-cross">(Upgrades)</p>
            <h2 className="mt-2 text-[32px] font-semibold leading-[1.05] tracking-[-0.04em] md:text-[40px]">Power-ups for <span className="text-[#ff3c00]">{store?.client?.business || "your business"}</span></h2>
            <p className="mt-2 max-w-2xl text-[14.5px] text-ink/60">Add new features to your app and portal. Try one free first, see what it does for you, then unlock it right here.</p>
          </div>
          {loading ? <p className="flex items-center gap-2 py-10 text-[13px] text-ink/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading upgrades…</p>
            : !addons.length ? <Panel><Empty>No upgrades are available for your account right now. New features show up here as we build them.</Empty></Panel>
              : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-store-grid>
                  {addons.map((a) => (
                    <button key={a.key} type="button" data-addon={a.key} onClick={() => { setOpen(a.key); if (!isPreview) addonsCall("view", { key: a.key, client_id: scopeId }).catch(() => null); }} className="card-hover flex flex-col overflow-hidden rounded-md border border-hair bg-card text-left">
                      <AddonVisual addon={a} />
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          {a.category && <span className="mono-label text-[9.5px] text-[#ff3c00]">{a.category}</span>}
                          <StateTag addon={a} />
                          {a.draft && <Tag tone="amber">Draft · only you see this</Tag>}
                        </div>
                        <p className="mt-2 text-[19px] font-semibold tracking-[-0.03em]">{a.name}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-ink/60">{a.tagline}</p>
                        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                          <div>
                            <p className="text-[13.5px] font-semibold tabular-nums">{a.state === "active" ? "Unlocked" : priceLine(a)}</p>
                            {a.state !== "active" && trialLine(a.trial) && a.trial.available && <p className="text-[11.5px] text-ink/50">{trialLine(a.trial)}</p>}
                          </div>
                          <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#ff3c00]">{a.state === "active" ? "Open" : "See it in action"} <ArrowUpRight className="h-3.5 w-3.5" /></span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink/45"><ShieldCheck className="h-3.5 w-3.5" /> Secure checkout by Stripe. Monthly upgrades can be canceled anytime from this page.</p>
        </>
      )}
    </div>
  );
}

function TrialMeter({ t }) {
  if (t.uses_total) {
    const used = Math.max(0, t.uses_total - (t.uses_left ?? 0));
    return (
      <div data-trial-meter>
        <div className="flex items-center justify-between text-[12px]"><span className="font-medium">Free tries</span><span className="tabular-nums text-ink/55">{t.uses_left ?? 0} of {t.uses_total} left</span></div>
        <div className="mt-1.5 flex gap-1">{Array.from({ length: t.uses_total }).map((_, i) => <span key={i} className={`h-1.5 flex-1 ${i < used ? "bg-ink/15" : "flame-bg"}`} />)}</div>
      </div>
    );
  }
  if (t.days_total) {
    const pct = Math.max(0, Math.min(100, ((t.days_left ?? 0) / t.days_total) * 100));
    return (
      <div data-trial-meter>
        <div className="flex items-center justify-between text-[12px]"><span className="font-medium">Free trial</span><span className="tabular-nums text-ink/55">{t.days_left} {t.days_left === 1 ? "day" : "days"} left</span></div>
        <div className="mt-1.5 h-1.5 bg-ink/[0.08]"><div className="h-full flame-bg" style={{ width: `${pct}%` }} /></div>
      </div>
    );
  }
  return null;
}

function PlanPicker({ plans, value, onChange }) {
  if (plans.length < 2) return null;
  return (
    <div className="grid gap-2" role="radiogroup" aria-label="Choose a plan">
      {plans.map((p) => (
        <button key={p.plan} type="button" role="radio" aria-checked={value === p.plan} onClick={() => onChange(p.plan)} className={`flex items-center justify-between border px-3 py-2 text-left text-[13px] ${value === p.plan ? "border-[#ff3c00] bg-[#ff3c00]/5" : "border-hair hover:border-ink/30"}`}>
          <span className="font-medium">{p.label}</span>
          <span className="tabular-nums text-ink/65">{p.plan === "one_time" ? usd(p.one_time) : p.plan === "monthly" ? `${usd(p.monthly)}/mo` : `${usd(p.one_time)} + ${usd(p.monthly)}/mo`}</span>
        </button>
      ))}
    </div>
  );
}

function AddonDetail({ addon: a, scopeId, preview, call, onBack, onChanged }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState(a.plans[0]?.plan || "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [mediaIdx, setMediaIdx] = useState(0);
  const top = useRef(null);
  useEffect(() => { top.current?.scrollIntoView({ block: "start" }); }, []);

  const run = async (label, fn) => {
    setBusy(label); setErr(""); setNote("");
    try { await fn(); } catch (e) { setErr(errText(e)); } finally { setBusy(""); }
  };
  const tryIt = () => run("trial", async () => {
    const r = await addonsCall("start_trial", { key: a.key, client_id: scopeId });
    if (r?.error) throw new Error(r.error);
    await onChanged();
    setNote(a.open_url || r?.addon?.open_url ? "Your free try is ready. Open it below." : "Your free try has started.");
  });
  const buy = () => run("buy", async () => {
    const r = await addonsCall("checkout", { key: a.key, plan, client_id: scopeId });
    if (r?.error) throw new Error(r.error);
    if (r?.url) { window.location.assign(r.url); return; }
    await onChanged();
  });
  const cancel = () => run("cancel", async () => {
    const r = await addonsCall("cancel", { key: a.key, client_id: scopeId });
    if (r?.error) throw new Error(r.error);
    setConfirmCancel(false);
    setNote(`Canceled. You keep access until ${r.cancel_at ? new Date(r.cancel_at).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "the end of this billing period"}.`);
    await onChanged();
  });
  const ask = () => run("ask", async () => {
    if (!call) throw new Error("Message us and we'll set it up.");
    await call("create_request", { kind: "billing", title: `Interested in ${a.name}`, priority: "normal", details: `Asked about ${a.name} from the Upgrades page.`, fields: { topic: "Upgrade", addon: a.key } });
    setNote("Sent. We'll reach out with pricing.");
  });

  const t = a.trial || {};
  const media = a.media || [];
  const active = a.state === "active", inTrial = a.state === "trial", ended = a.state === "trial_ended" || a.state === "canceled";
  const BuyBtn = ({ big }) => (a.priced ? (
    <button type="button" data-buy onClick={buy} disabled={!!busy || preview} title={preview ? "Admin preview: only the client's own login can buy" : undefined} className={`flame-bg flex w-full items-center justify-center gap-2 ${big ? "h-12 text-[14.5px]" : "h-11 text-[13.5px]"} font-semibold text-white disabled:opacity-60`}>
      {busy === "buy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Unlock {a.name} · {priceLine(a)}
    </button>
  ) : (
    <button type="button" onClick={ask} disabled={!!busy || preview} className="flex h-11 w-full items-center justify-center gap-2 border border-ink text-[13.5px] font-semibold hover:bg-ink hover:text-white disabled:opacity-50">
      {busy === "ask" && <Loader2 className="h-4 w-4 animate-spin" />} Pricing coming soon · Ask about it
    </button>
  ));

  return (
    <div ref={top} className="scroll-mt-24 space-y-5" data-addon-detail={a.key}>
      <button type="button" onClick={onBack} className="mono-label inline-flex items-center gap-1.5 text-[10px] text-ink/50 hover:text-[#ff3c00]"><ArrowLeft className="h-3 w-3" /> All upgrades</button>
      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] [&>*]:min-w-0">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-md border border-hair bg-card">
            <AddonVisual addon={{ ...a, media: media.length ? [media[mediaIdx] || media[0]] : [] }} large />
            {media.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-t border-hair p-2">
                {media.map((m, i) => (
                  <button key={i} type="button" onClick={() => setMediaIdx(i)} aria-label={`Show ${m.caption || `media ${i + 1}`}`} className={`relative h-14 w-24 shrink-0 overflow-hidden border ${i === mediaIdx ? "border-[#ff3c00]" : "border-hair"}`}>
                    {m.type === "video" ? <span className="flex h-full w-full items-center justify-center bg-ink text-white"><Play className="h-4 w-4" /></span> : <img src={m.url} alt="" className="h-full w-full object-cover" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {a.category && <span className="mono-label text-[10px] text-[#ff3c00]">{a.category}</span>}
              <StateTag addon={a} />
              {a.draft && <Tag tone="amber">Draft · only you see this</Tag>}
            </div>
            <h2 className="mt-2 text-[34px] font-semibold leading-[1.02] tracking-[-0.045em] md:text-[44px]">{a.name}</h2>
            <p className="mt-2 text-[16px] leading-snug text-ink/70">{a.tagline}</p>
          </div>
          <div className="space-y-3 text-[14.5px] leading-relaxed text-ink/75">{paragraphs(a.description).map((p, i) => <p key={i}>{p}</p>)}</div>
          {a.highlights?.length > 0 && (
            <Panel label="What you get" title="Inside the upgrade">
              <ul className="grid gap-x-6 gap-y-2 px-4 py-4 sm:grid-cols-2">
                {a.highlights.map((h) => <li key={h} className="flex items-start gap-2 text-[13.5px]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff3c00]" />{h}</li>)}
              </ul>
            </Panel>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-md border border-hair bg-card" data-buy-card>
            <div className="h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" />
            <div className="space-y-4 p-5">
              {ended ? (
                <AddonPaywall addon={a} compact />
              ) : active ? (
                <div>
                  <p className="mono-label text-[9.5px] text-green-700">Unlocked</p>
                  <p className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">{a.name} is yours.</p>
                  <p className="mt-1 text-[12.5px] text-ink/55">Active since {a.activated_at ? new Date(a.activated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "today"}{a.cancel_at ? `, ends ${new Date(a.cancel_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""}.</p>
                </div>
              ) : (
                <div>
                  <p className="text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{priceLine(a)}</p>
                  {a.price_model === "both" && a.priced && <p className="mt-1 text-[12px] text-ink/55">One-time setup, then a monthly license. Cancel the monthly anytime.</p>}
                  {a.price_model === "monthly" && a.priced && <p className="mt-1 text-[12px] text-ink/55">Billed monthly. Cancel anytime.</p>}
                </div>
              )}

              {inTrial && <TrialMeter t={t} />}
              {inTrial && t.uses_total && <p className="text-[12px] text-ink/55">Each finished project render uses one try. Your designs are saved either way.</p>}

              {(a.open_url && (active || inTrial)) && (
                <a href={a.open_url} target="_blank" rel="noreferrer" data-open className="flex h-11 w-full items-center justify-center gap-2 bg-ink text-[13.5px] font-semibold text-white hover:bg-[#ff3c00]">Open {a.name} <ArrowUpRight className="h-4 w-4" /></a>
              )}

              {a.state === "preview" && t.available && (
                <button type="button" data-try onClick={tryIt} disabled={!!busy || preview} title={preview ? "Admin preview: the client starts their own free try" : undefined} className="flex h-11 w-full items-center justify-center gap-2 border border-ink text-[13.5px] font-semibold hover:bg-ink hover:text-white disabled:opacity-50">
                  {busy === "trial" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[#ff3c00]" />}
                  {t.mode === "one_use" ? "Try it once, free" : t.mode === "uses" ? `Try it free (${t.uses_total} tries)` : `Start ${t.days_total}-day free trial`}
                </button>
              )}

              {!active && !ended && (
                <>
                  <PlanPicker plans={a.plans} value={plan} onChange={setPlan} />
                  <BuyBtn />
                </>
              )}
              {ended && (<><PlanPicker plans={a.plans} value={plan} onChange={setPlan} /><BuyBtn big /></>)}

              {active && a.can_cancel && (
                confirmCancel ? (
                  <div className="border border-hair bg-paper p-3 text-[12.5px]" data-cancel-confirm>
                    <p>Cancel the monthly license? You keep access until the end of this billing period and nothing you made is deleted.</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={cancel} disabled={!!busy} className="h-9 bg-ink px-3 font-medium text-white disabled:opacity-50">{busy === "cancel" ? "Canceling…" : "Yes, cancel"}</button>
                      <button type="button" onClick={() => setConfirmCancel(false)} className="h-9 border border-hair px-3">Keep it</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmCancel(true)} disabled={preview} className="text-[12px] text-ink/50 underline hover:text-ink disabled:opacity-50">Cancel subscription</button>
                )
              )}

              {a.demo_url && !active && (
                <a href={a.demo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#ff3c00] hover:underline">Open the live demo <ArrowUpRight className="h-3.5 w-3.5" /></a>
              )}
              {note && <p role="status" className="border-l-2 border-[#ff3c00] bg-paper px-3 py-2 text-[12.5px]">{note}</p>}
              {err && <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">{err}</p>}
              {preview && <p className="text-[11.5px] text-ink/45">Admin preview: trials and checkout run from the client&apos;s own login. Use Grant in the Upgrade Store to unlock it for them.</p>}
              <p className="flex items-center gap-1.5 text-[11px] text-ink/45"><ShieldCheck className="h-3.5 w-3.5" /> Secure checkout by Stripe</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// The tasteful paywall: free try used (or plan ended). Keeps their work, offers Buy. Used inline and in client apps.
export function AddonPaywall({ addon: a, compact = false, onOpen }) {
  const canceled = a.state === "canceled";
  return (
    <div data-paywall className={compact ? "" : "overflow-hidden rounded-md border border-hair bg-card"}>
      {!compact && <div className="h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" />}
      <div className={compact ? "" : "p-5"}>
        <span className="flex h-10 w-10 items-center justify-center flame-bg text-white"><Lock className="h-5 w-5" /></span>
        <p className="mt-3 text-[20px] font-semibold leading-tight tracking-[-0.03em]">{canceled ? `Your ${a.name} access has ended.` : "That was your free try."}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink/65">Everything you made is saved and waiting. Unlock {a.name} to keep designing and pick up right where you left off.</p>
        <p className="mt-3 text-[15px] font-semibold tabular-nums">{priceLine(a)}</p>
        {onOpen && <button type="button" onClick={onOpen} className="flame-bg mt-3 flex h-11 w-full items-center justify-center gap-2 text-[13.5px] font-semibold text-white"><Lock className="h-4 w-4" /> See unlock options</button>}
      </div>
    </div>
  );
}

// Inline upsell for Home: the client's top upgrades they don't own yet. Renders nothing when there are none.
export function UpgradeSpotlight({ scopeId, go }) {
  const { addons } = useAddonStore(scopeId);
  const list = useMemo(() => addons.filter((a) => a.state !== "active").slice(0, 2), [addons]);
  if (!list.length) return null;
  return (
    <section className="overflow-hidden rounded-md border border-hair bg-card" data-upgrade-spotlight>
      <div className="h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" />
      <header className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <p className="mono-label text-[9.5px] text-ink/50">Upgrades for you</p>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Try it free, keep it if it works</h3>
        </div>
        <Sparkles className="h-4 w-4 text-[#ff3c00]" />
      </header>
      <ul className="divide-y divide-hair">
        {list.map((a) => (
          <li key={a.key}>
            <button type="button" onClick={() => { rememberOpen(a.key); go("upgrades"); }} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center flame-bg text-white"><Box className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{a.name}</span>
                <span className="block truncate text-[11.5px] text-ink/55">{a.state === "trial_ended" ? "Free try used · your work is saved" : a.trial?.available ? trialLine(a.trial) : a.tagline}</span>
              </span>
              <StateTag addon={a} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
