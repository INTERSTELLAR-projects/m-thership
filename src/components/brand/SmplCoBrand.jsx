// INTERSTELLAR™ × SMPL. co-brand: the locked "SMPL. Studio" (SMPL Social) card and its preview page.
// SMPL brand (Nov 2026, from the SMPL marketing site): petals cyan #35BAEC, orange #FF9810 (logo #E68E09),
// magenta #CF41C1; gradient cyan → magenta → orange on near-black #0f0f11 with white type; Inter Tight / Inter /
// JetBrains Mono; tagline "Content made SMPL.". The logo files are SMPL's own (logo-light / logo-dark from their
// /brand page), copied byte-for-byte into public/partners/smpl/. Never redraw the SMPL logo.
import { useEffect } from "react";
import { Check, Image as ImageIcon, Clapperboard, AudioLines, Scissors, Lock, Send, Loader2, Sparkles } from "lucide-react";
import { BrandWordmark } from "@/components/brand/BrandLockup";
import "./smpl.css";

export const SMPL = {
  cyan: "#35BAEC",
  orange: "#FF9810",
  orangeLogo: "#E68E09",
  magenta: "#CF41C1",
  base: "#0f0f11",
  gradient: "linear-gradient(90deg, #35BAEC 0%, #CF41C1 52%, #FF9810 100%)",
  logoLight: "/partners/smpl/smpl-logo-light.png", // white wordmark, for dark backgrounds
  logoDark: "/partners/smpl/smpl-logo-dark.png", // dark wordmark, for light backgrounds
  tagline: "Content made SMPL.",
};

const MARK_URL = "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/536102fbf_interstellar-mark-v2.webp";
const FONT_HREF = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap";

// SMPL's fonts load only where the co-brand renders.
function useSmplFonts() {
  useEffect(() => {
    if (typeof document === "undefined" || document.querySelector("link[data-smpl-fonts]")) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = FONT_HREF; l.setAttribute("data-smpl-fonts", "");
    document.head.appendChild(l);
  }, []);
}

/* INTERSTELLAR™ × SMPL. lockup. tone "dark" = on a dark background (white type, SMPL light logo). */
export function SmplLockup({ tone = "dark", size = 18, className = "" }) {
  useSmplFonts();
  const dark = tone === "dark";
  return (
    <span className={`smpl-lockup ${className}`} aria-label="Interstellar × SMPL.">
      <span className="smpl-lockup__is" aria-hidden="true">
        <img src={MARK_URL} alt="" draggable="false" style={{ height: Math.round(size * 1.3), width: Math.round(size * 1.66) }} className="object-contain" />
        <BrandWordmark tone={dark ? "dark" : "light"} size={size} />
      </span>
      <span className={`smpl-lockup__x ${dark ? "text-white/45" : "text-ink/40"}`} aria-hidden="true" style={{ fontSize: Math.round(size * 0.95) }}>×</span>
      <img
        src={dark ? SMPL.logoLight : SMPL.logoDark} alt="SMPL." draggable="false" decoding="async"
        width={420} height={165} style={{ height: Math.round(size * 1.9), width: "auto" }} className="smpl-lockup__logo"
      />
    </span>
  );
}

const CAPS = [
  { icon: ImageIcon, h: "Image", p: "Photoreal product shots, ads and graphics from a prompt or a real photo, in your brand colors.", c: SMPL.cyan },
  { icon: Clapperboard, h: "Video", p: "Short clips, reels and ad cuts sized for TikTok, Reels and Shorts.", c: "#8f7ef0" },
  { icon: AudioLines, h: "Voice", p: "Natural voiceovers for ads, reels and explainers.", c: SMPL.magenta },
  { icon: Scissors, h: "Clipping", p: "Turn long videos into ready-to-post clips with captions, in 37 languages.", c: SMPL.orange },
];

/* Static, non-interactive picture of a SMPL Social generation screen. Labelled "Sample". */
function SmplMock({ business }) {
  const biz = business || "Your business";
  const tiles = [
    ["Image", "Hero shot · 4:5", "smpl-art-a"],
    ["Video", "15s reel · 9:16", "smpl-art-b"],
    ["Image", "Promo · story", "smpl-art-c"],
    ["Image", "Product · 1:1", "smpl-art-d"],
  ];
  const wave = [6, 10, 15, 9, 19, 13, 23, 17, 11, 21, 14, 8, 18, 12, 20, 10, 15, 7, 13, 17, 9, 22, 14, 10, 16, 8, 12, 18];
  return (
    <figure className="smpl-mock" aria-label="Sample screen from SMPL. Studio">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-white/15" /><span className="h-2 w-2 rounded-full bg-white/15" /><span className="h-2 w-2 rounded-full bg-white/15" />
        <span className="ml-2 truncate font-mono text-[10px] text-white/40">SMPL. Studio · {biz}</span>
        <span className="smpl-grad-bg ml-auto px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-white">Sample</span>
      </div>
      <div className="pointer-events-none select-none p-3.5 sm:p-4" aria-hidden="true">
        <div className="smpl-prompt flex items-center gap-2 px-3 py-2.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: SMPL.cyan }} />
          <p className="truncate text-[11.5px] text-white/75">A sunlit hero shot of our newest product on marble, brand colors, for Instagram</p>
          <span className="smpl-grad-bg ml-auto shrink-0 px-2.5 py-1 text-[10px] font-semibold text-white">Generate</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {tiles.map(([kind, label, art]) => (
            <div key={label} className={`smpl-tile ${art}`}>
              <span className="absolute left-1.5 top-1.5 rounded-sm bg-black/35 px-1 py-[1px] font-mono text-[7.5px] uppercase text-white/90 backdrop-blur-sm">{kind}</span>
              {kind === "Video" && <span className="absolute left-1/2 top-1/2 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90"><span className="ml-[2px] h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-[#0f0f11]" /></span>}
              <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[7.5px] font-medium leading-tight text-white">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-[1.15fr_1fr] gap-2">
          <div className="smpl-panel p-2.5">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-white/45">Voice · 0:14</p>
            <div className="mt-1.5 flex h-6 items-end gap-[2px]">
              {wave.map((h, i) => <span key={i} className="w-[3px] rounded-full" style={{ height: h, background: i < 17 ? `linear-gradient(180deg, ${SMPL.cyan}, ${SMPL.magenta})` : "rgba(255,255,255,.16)" }} />)}
            </div>
          </div>
          <div className="smpl-panel p-2.5">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-white/45">Clipping · 6 clips</p>
            <div className="mt-2 flex h-5 gap-[3px]">
              {[22, 14, 30, 18, 10, 26].map((w, i) => <span key={i} className="h-full rounded-[2px]" style={{ flex: w, background: i % 2 ? "rgba(255,255,255,.14)" : SMPL.gradient, opacity: i % 2 ? 1 : 0.9 }} />)}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="border-t border-white/10 px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-white/35">Sample data · for illustration</figcaption>
    </figure>
  );
}

/*
 * The locked SMPL. Studio card + preview page. Same component for the client portal and the admin view.
 * Actions are passed in so this file stays presentational:
 *   onAsk / sent / busy / err  -> "Ask about early access" (a ClientRequest, sent by PortalStudios)
 *   upgrade                    -> node shown instead when the client's plan has no Studios (HyperCare+ upsell)
 */
export default function SmplStudioPreview({ business, preview, onAsk, sent, busy, err, upgrade, replaces, note }) {
  useSmplFonts();
  return (
    <div className="space-y-6" data-studio="smpl" data-studio-state="preview">
      <section className="smpl-card" aria-labelledby="smpl-studio-title">
        <span className="smpl-card__bar" aria-hidden="true" />
        <span className="smpl-glow smpl-glow--c" aria-hidden="true" />
        <span className="smpl-glow smpl-glow--m" aria-hidden="true" />
        <span className="smpl-glow smpl-glow--o" aria-hidden="true" />
        <span className="smpl-grid" aria-hidden="true" />

        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-white/10 px-5 py-4 sm:px-8">
          <SmplLockup size={16} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/80 backdrop-blur">
            <Lock className="h-3 w-3" style={{ color: SMPL.orange }} aria-hidden="true" /> Coming soon
          </span>
        </div>

        <div className="relative grid gap-8 px-5 pb-7 pt-7 sm:px-8 sm:pb-9 lg:grid-cols-[1.02fr_1fr] lg:items-center lg:gap-10 [&>*]:min-w-0">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/50">SMPL. Studio · SMPL Social · AI generation</p>
            <h1 id="smpl-studio-title" className="smpl-display mt-3 text-[34px] leading-[0.98] text-white sm:text-[46px] xl:text-[54px]">
              Image, video and voice. <span className="smpl-grad-text">Plus clipping.</span>
            </h1>
            <p className="smpl-tagline mt-3 text-[18px] text-white sm:text-[20px]">{SMPL.tagline}</p>
            <p className="smpl-body mt-4 max-w-xl text-[14.5px] leading-relaxed text-white/70">
              SMPL Social is AI generation for image, video and voice, plus clipping, built by our partners at SMPL. and wired into
              your Interstellar portal, so everything starts from your brand kit and lands straight in Social Studio.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="What it makes">
              {CAPS.map((c) => (
                <li key={c.h} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[12.5px] font-medium text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.c }} aria-hidden="true" /> {c.h}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <p className="smpl-display text-[15px] text-white">Coming soon to your portal.</p>
            </div>
            {!upgrade && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {sent ? (
                  <span className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 text-[13.5px] font-medium text-white"><Check className="h-4 w-4" style={{ color: SMPL.cyan }} /> Request sent. We&apos;ll be in touch.</span>
                ) : (
                  <button
                    type="button" onClick={onAsk} disabled={preview || busy}
                    className="smpl-cta inline-flex h-11 items-center gap-2 rounded-full px-6 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    title={preview ? "Admin preview: only the client's own login can send this" : undefined}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Get early access
                  </button>
                )}
                {preview && !sent && <span className="text-[11.5px] text-white/45">Admin preview: the button works from the client&apos;s login.</span>}
              </div>
            )}
            {err && <p role="alert" className="mt-2 text-[12px] text-[#ff9a9a]">{err}</p>}
          </div>
          <SmplMock business={business} />
        </div>

        <div className="relative grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {CAPS.map(({ icon: Icon, h, p, c }) => (
            <div key={h} className="bg-[#0f0f11]/95 p-5 sm:p-6">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04]" style={{ color: c }}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
              <p className="smpl-display mt-3 text-[16px] text-white">{h}</p>
              <p className="smpl-body mt-1 text-[12.5px] leading-relaxed text-white/60">{p}</p>
            </div>
          ))}
        </div>

        <div className="relative flex flex-col gap-2 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="smpl-body text-[12.5px] text-white/55">A partnership between Interstellar Strategies and SMPL.</p>
          {replaces && <p className="smpl-body text-[12.5px] text-white/75"><span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/40">Replaces </span>{replaces}</p>}
        </div>
      </section>
      {upgrade}
      {note && <p className="text-[11.5px] text-ink/45">{note}</p>}
    </div>
  );
}

/* Small SMPL-palette icon tile for menus (gradient, not the logo). */
export function SmplNavIcon({ className = "h-8 w-8" }) {
  return (
    <span className={`smpl-grad-bg flex shrink-0 items-center justify-center text-white ${className}`}>
      <Sparkles className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}
