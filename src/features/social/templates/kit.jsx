import { useId } from "react";
import { ArrowUpRight } from "lucide-react";
import BrandLockup from "@/components/brand/BrandLockup";

// Shared building blocks for the 1080x1080 social templates. Everything is sized in real
// pixels for the export canvas; the UI shows it scaled down. Visual language copied from
// Møthership: canvas #ebe8e4 + grid, band-dark grain panels, Geist / JetBrains Mono,
// flame gradient #ff3c00 -> #ff6a00 -> #ffaa00 (never gold).

export const SIZE = 1080;
export const FLAME = "linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00)";
export const INK = "#1a1a1a";
export const CANVAS = "#ebe8e4";
export const CARD = "#f4f2ef";
export const HAIR = "#cfccc7";
export const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
export const SANS = '"Geist", "Inter", system-ui, sans-serif';

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Freeze every idle animation (Martians, emblems, count-ups) so exports are deterministic.
const FREEZE_CSS = ".social-post, .social-post * { animation: none !important; transition: none !important; }";

export const isDark = (spec) => spec?.theme === "dark";

/** Pick a font size from text length: steps = [[maxChars, px], ...] ascending. */
export function fit(text, steps) {
  const n = String(text || "").length;
  for (const [max, px] of steps) if (n <= max) return px;
  return steps[steps.length - 1][1];
}

export function flameTextStyle(extra) {
  return {
    backgroundImage: FLAME,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    WebkitBoxDecorationBreak: "clone",
    boxDecorationBreak: "clone",
    paddingBottom: "0.06em",
    ...extra,
  };
}

/** Headline with the accent phrase in the flame gradient. */
export function Headline({ text, accent, size = 88, color, style, maxWidth }) {
  const t = String(text || "");
  const a = String(accent || "").trim();
  const i = a ? t.toLowerCase().indexOf(a.toLowerCase()) : -1;
  const parts = i >= 0 ? [t.slice(0, i), t.slice(i, i + a.length), t.slice(i + a.length)] : [t, "", ""];
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: SANS,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 0.98,
        letterSpacing: "-0.045em",
        color,
        maxWidth,
        textWrap: "balance",
        ...style,
      }}
    >
      {parts[0]}
      {parts[1] && <span style={flameTextStyle()}>{parts[1]}</span>}
      {parts[2]}
    </h1>
  );
}

export function Mono({ children, size = 18, color, style }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: size, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color, lineHeight: 1.2, ...style }}>
      {children}
    </span>
  );
}

/** "(Label)" with the four-line orange cross, like the website. */
export function LabelCross({ children, dark, size = 20 }) {
  if (!children) return null;
  const text = String(children).replace(/^\(|\)$/g, "");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14, fontFamily: MONO, fontSize: size, letterSpacing: "0.08em", color: dark ? "rgba(245,243,240,.75)" : INK }}>
      <span
        style={{
          width: 14,
          height: 14,
          flexShrink: 0,
          background: "linear-gradient(#ff3c00,#ff3c00) center/100% 2.5px no-repeat, linear-gradient(#ff3c00,#ff3c00) center/2.5px 100% no-repeat",
        }}
      />
      ({text})
    </span>
  );
}

function Backdrop({ dark }) {
  const grid = dark ? "rgba(255,255,255,.035)" : "rgba(26,26,26,.05)";
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${grid} 1.5px, transparent 1.5px), linear-gradient(90deg, ${grid} 1.5px, transparent 1.5px)`,
          backgroundSize: "90px 90px",
          backgroundPosition: "-1px -1px",
        }}
      />
      {dark ? (
        <>
          <div style={{ position: "absolute", right: -260, top: -300, width: 820, height: 820, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,60,0,.32), rgba(255,106,0,.08) 45%, transparent 70%)" }} />
          <div style={{ position: "absolute", left: -300, bottom: -420, width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,106,0,.12), transparent 65%)" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.22, mixBlendMode: "overlay", backgroundImage: NOISE }} />
        </>
      ) : (
        <>
          <div style={{ position: "absolute", right: -320, bottom: -360, width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,106,0,.16), rgba(255,170,0,.05) 45%, transparent 70%)" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.1, mixBlendMode: "multiply", backgroundImage: NOISE }} />
        </>
      )}
    </>
  );
}

export function CtaPill({ children, dark }) {
  if (!children) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 16, height: 64, padding: "0 10px 0 28px", background: "#ff3c00", color: "#fff", fontFamily: SANS, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em", boxShadow: dark ? "0 18px 40px -18px rgba(255,60,0,.7)" : "0 18px 40px -22px rgba(255,60,0,.8)" }}>
      {children}
      <span style={{ display: "inline-flex", width: 44, height: 44, alignItems: "center", justifyContent: "center", background: "#fff", color: "#ff3c00" }}>
        <ArrowUpRight size={24} strokeWidth={2.2} />
      </span>
    </span>
  );
}

function Footer({ spec }) {
  const dark = isDark(spec);
  const lockup = spec.lockup || "interstellar";
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, minHeight: 64 }}>
      {lockup === "none" ? (
        <Mono size={16} color={dark ? "rgba(245,243,240,.55)" : "rgba(26,26,26,.55)"}>The Future of Business</Mono>
      ) : (
        <span style={{ display: "inline-flex", fontSize: 0 }}>
          <BrandLockup
            word={lockup === "mothership" ? "MØTHERSHIP" : "INTERSTELLAR"}
            sub={lockup === "mothership" ? "by Interstellar · The Future of Business" : "The Future of Business"}
            tone={dark ? "dark" : "light"}
            size={34}
            className="social-lockup"
          />
        </span>
      )}
      <CtaPill dark={dark}>{spec.cta}</CtaPill>
    </div>
  );
}

/** The 1080x1080 post frame every template renders into. */
export function PostFrame({ spec, children, padding = 72, hideHeader = false, headerRight }) {
  const dark = isDark(spec);
  return (
    <div
      className="social-post"
      style={{
        width: SIZE,
        height: SIZE,
        position: "relative",
        overflow: "hidden",
        background: dark ? "#121212" : CANVAS,
        color: dark ? "#f5f3f0" : INK,
        fontFamily: SANS,
        letterSpacing: "-0.005em",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style>{FREEZE_CSS + ".social-lockup .is-sub{font-size:13px;margin-top:10px}"}</style>
      <Backdrop dark={dark} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 8, background: FLAME }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding, paddingTop: padding + 4 }}>
        {!hideHeader && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, minHeight: 28 }}>
            <LabelCross dark={dark}>{spec.eyebrow}</LabelCross>
            {headerRight}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>{children}</div>
        <Footer spec={spec} />
      </div>
    </div>
  );
}

/** Tiny mono tag shown on mock UI so sample numbers are never mistaken for real ones. */
export function SampleTag({ dark, children = "Sample data · fictional business", style }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: dark ? "rgba(245,243,240,.5)" : "rgba(26,26,26,.45)", ...style }}>
      <span style={{ width: 7, height: 7, borderRadius: 9, background: "#ff6a00" }} />
      {children}
    </span>
  );
}

/** Browser window chrome used for app / site mockups. */
export function MockWindow({ url = "app.mothership.io", dark, children, style, bodyStyle }) {
  return (
    <div
      style={{
        borderRadius: 18,
        overflow: "hidden",
        border: `1.5px solid ${dark ? "rgba(255,255,255,.12)" : HAIR}`,
        background: dark ? "#181818" : CANVAS,
        boxShadow: dark ? "0 40px 90px -40px rgba(0,0,0,.9)" : "0 40px 80px -40px rgba(26,26,26,.45)",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, height: 46, padding: "0 18px", borderBottom: `1.5px solid ${dark ? "rgba(255,255,255,.08)" : HAIR}`, background: dark ? "#1d1d1d" : "#f1efeb", flexShrink: 0 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: 13, background: c, opacity: 0.9 }} />)}
        <span style={{ marginLeft: 16, flex: 1, maxWidth: 420, height: 28, borderRadius: 8, background: dark ? "rgba(255,255,255,.06)" : "rgba(26,26,26,.06)", display: "flex", alignItems: "center", padding: "0 14px", fontFamily: MONO, fontSize: 13, color: dark ? "rgba(255,255,255,.5)" : "rgba(26,26,26,.5)", letterSpacing: "0.02em" }}>
          {url}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: "relative", ...bodyStyle }}>{children}</div>
    </div>
  );
}

/** Light KPI tile, like Mission Control's (KpiTile in components/financial/finance/ui.jsx), at post scale. */
export function AppTile({ label, value, sub, hot, flame, icon: Icon, scale = 1, style }) {
  const s = (n) => Math.round(n * scale);
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", borderRadius: 10, border: `1.5px solid ${HAIR}`, background: CARD, padding: `${s(18)}px ${s(20)}px`, minWidth: 0, color: INK, ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Mono size={s(13)} color="rgba(26,26,26,.5)" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</Mono>
        {Icon && <Icon size={s(18)} color="rgba(26,26,26,.3)" />}
      </div>
      <p style={{ margin: `${s(10)}px 0 0`, fontSize: s(40), fontWeight: 600, lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", ...(flame ? flameTextStyle() : {}) }}>{value}</p>
      {sub && <p style={{ margin: `${s(8)}px 0 0`, fontSize: s(15), color: hot ? "#d83300" : "rgba(26,26,26,.5)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</p>}
    </div>
  );
}

/** band-dark grain hero card with the flame top line and glow (Command Briefing / MRR card). */
export function DarkCard({ children, style, glow = true, padding = 28 }) {
  return (
    <div className="band-dark grain" style={{ position: "relative", overflow: "hidden", borderRadius: 10, border: `1.5px solid ${INK}`, background: INK, color: "#f5f3f0", ...style }}>
      <span style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: FLAME }} />
      {glow && <div style={{ position: "absolute", right: -120, top: -140, width: 380, height: 380, borderRadius: "50%", opacity: 0.3, background: "radial-gradient(circle,#ff3c00,transparent 70%)" }} />}
      <div style={{ position: "relative", padding, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

export function Sparkline({ data = [], width = 300, height = 70 }) {
  const id = useId().replace(/:/g, "");
  const vals = data.map(Number).filter(Number.isFinite);
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const span = Math.max(...vals) - min || 1;
  const step = width / (vals.length - 1);
  const pts = vals.map((v, i) => [i * step, height - 4 - ((v - min) / span) * (height - 10)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff3c00" stopOpacity="0.32" /><stop offset="100%" stopColor="#ff3c00" stopOpacity="0" /></linearGradient>
        <linearGradient id={`l${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ff3c00" /><stop offset="55%" stopColor="#ff6a00" /><stop offset="100%" stopColor="#ffaa00" /></linearGradient>
      </defs>
      <path d={area} fill={`url(#a${id})`} />
      <path d={line} fill="none" stroke={`url(#l${id})`} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="6" fill="#ff3c00" />
      <circle cx={last[0]} cy={last[1]} r="12" fill="#ff3c00" opacity="0.2" />
    </svg>
  );
}

/** Static version of the Performance score ring. */
export function ScoreRing({ score = 98, size = 150, stroke = 13, label = "Performance", dark }) {
  const id = useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, Number(score) || 0)) / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <defs><linearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff3c00" /><stop offset="55%" stopColor="#ff6a00" /><stop offset="100%" stopColor="#ffaa00" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dark ? "rgba(255,255,255,.08)" : "rgba(26,26,26,.08)"} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#r${id})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${c}`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.3, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1 }}>{score}</span>
        <Mono size={Math.max(10, size * 0.075)} color={dark ? "rgba(245,243,240,.5)" : "rgba(26,26,26,.5)"} style={{ marginTop: 6 }}>{label}</Mono>
      </div>
    </div>
  );
}

export function Chip({ children, hot, dark = true, size = 17 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, borderRadius: 999, border: `1.5px solid ${dark ? "rgba(255,255,255,.16)" : HAIR}`, padding: "8px 16px", fontSize: size, color: dark ? "rgba(255,255,255,.8)" : "rgba(26,26,26,.75)", whiteSpace: "nowrap" }}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: hot ? "#ff3c00" : dark ? "rgba(255,255,255,.35)" : "rgba(26,26,26,.3)" }} />
      {children}
    </span>
  );
}

export const mockOf = (spec, fallback) => ({ ...(fallback || {}), ...(spec?.mock || {}) });
export const arr = (v, fb = []) => (Array.isArray(v) && v.length ? v : fb);
