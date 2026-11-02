import { AlertTriangle, Check, Phone, Quote } from "lucide-react";
import Martian from "@/components/comms/Martian";
import { MARTIAN_PALETTES } from "@/components/comms/martianColors";
import {
  CARD, DarkCard, FLAME, HAIR, Headline, INK, MONO, MockWindow, Mono, PostFrame, SampleTag, ScoreRing,
  arr, fit, flameTextStyle, isDark, mockOf,
} from "./kit";

const sub = (dark) => (dark ? "rgba(245,243,240,.62)" : "rgba(26,26,26,.6)");

/* 6 ─ Before / after website ────────────────────────────────────────── */
export function BeforeAfterSite({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const slug = String(m.business || "yourbusiness").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return (
    <PostFrame spec={spec}>
      <div style={{ marginTop: 34 }}>
        <Headline text={spec.headline} accent={spec.accent_word} size={fit(spec.headline, [[34, 84], [50, 72], [70, 60], [999, 52]])} />
        {spec.subhead && <p style={{ margin: "18px 0 0", fontSize: 26, lineHeight: 1.3, color: sub(dark), maxWidth: 820 }}>{spec.subhead}</p>}
      </div>
      <div style={{ marginTop: "auto", marginBottom: 36, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Before */}
        <div>
          <Mono size={14} color={dark ? "rgba(245,243,240,.5)" : "rgba(26,26,26,.5)"} style={{ display: "block", marginBottom: 10 }}>(Before)</Mono>
          <MockWindow dark={dark} url={`${slug}-home.weebly-site.net`} style={{ height: 470, filter: "saturate(.35)" }} bodyStyle={{ background: "#e9e9e9", padding: 18, color: "#555", fontFamily: "Georgia, serif" }}>
            <div style={{ background: "#7a8aa0", color: "#fff", padding: "10px 12px", fontSize: 20, fontFamily: "Georgia, serif" }}>Welcome to {m.business}!!</div>
            <div style={{ display: "flex", gap: 8, margin: "10px 0", fontSize: 12, color: "#3355aa", textDecoration: "underline" }}>
              {["Home", "About Us", "Services", "Gallery", "Links", "Contact"].map((t) => <span key={t}>{t}</span>)}
            </div>
            <div style={{ height: 110, background: "repeating-linear-gradient(45deg,#cfcfcf 0 10px,#dadada 10px 20px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#888" }}>image.jpg</div>
            {[92, 100, 78, 96, 64].map((w, i) => <div key={i} style={{ height: 8, width: `${w}%`, background: "#c9c9c9", marginTop: 9 }} />)}
            <div style={{ marginTop: 18, display: "grid", gap: 8 }}>
              {arr(m.before_issues).slice(0, 3).map((t) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fff", border: "1.5px solid #d83300", fontFamily: '"Geist", sans-serif', fontSize: 15, color: "#d83300", fontWeight: 500 }}>
                  <AlertTriangle size={16} />{t}
                </div>
              ))}
            </div>
          </MockWindow>
        </div>
        {/* After */}
        <div>
          <Mono size={14} color="#ff3c00" style={{ display: "block", marginBottom: 10 }}>(After)</Mono>
          <MockWindow dark={dark} url={`${slug}.com`} style={{ height: 470 }} bodyStyle={{ background: "#121212", color: "#fff", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
              <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.03em" }}>{m.business}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#ff3c00", fontSize: 13, fontWeight: 600 }}><Phone size={13} />{m.after_cta || "Call now"}</span>
            </div>
            <div className="grain" style={{ position: "relative", padding: "22px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ position: "absolute", right: -80, top: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,60,0,.4),transparent 70%)" }} />
              <Mono size={11} color="rgba(255,255,255,.5)">({m.trade})</Mono>
              <p style={{ position: "relative", margin: "10px 0 0", fontSize: 32, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.02 }}>{m.after_headline}</p>
              <span style={{ position: "relative", marginTop: 16, alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 16px", background: "#ff3c00", fontSize: 16, fontWeight: 600 }}><Phone size={16} />{m.after_cta || "Call now"}</span>
              <div style={{ position: "relative", marginTop: 16, display: "grid", gap: 7 }}>
                {arr(m.after_badges).slice(0, 3).map((t) => <span key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "rgba(255,255,255,.8)" }}><Check size={15} color="#ff6a00" strokeWidth={3} />{t}</span>)}
              </div>
              <div style={{ position: "relative", marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <SampleTag dark>Sample</SampleTag>
                <ScoreRing score={m.score ?? 98} size={104} stroke={9} dark />
              </div>
            </div>
          </MockWindow>
        </div>
      </div>
    </PostFrame>
  );
}

/* 7 ─ Checklist ─────────────────────────────────────────────────────── */
export function Checklist({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const items = arr(m.items, example.mock.items).slice(0, 6);
  const checked = Number.isFinite(Number(m.checked)) ? Number(m.checked) : items.length;
  const rowSize = items.length > 5 ? 26 : 29;
  return (
    <PostFrame spec={spec}>
      <div style={{ marginTop: 34 }}>
        <Headline text={spec.headline} accent={spec.accent_word} size={fit(spec.headline, [[36, 96], [52, 80], [999, 64]])} />
      </div>
      <div style={{ marginTop: "auto", marginBottom: 30, borderRadius: 12, overflow: "hidden", border: `1.5px solid ${dark ? "rgba(255,255,255,.12)" : HAIR}`, background: dark ? "rgba(255,255,255,.035)" : CARD }}>
        {items.map((t, i) => {
          const on = i < checked;
          return (
            <div key={t + i} style={{ display: "flex", alignItems: "center", gap: 22, padding: "19px 26px", borderTop: i ? `1.5px solid ${dark ? "rgba(255,255,255,.08)" : HAIR}` : "none" }}>
              <span style={{ fontFamily: MONO, fontSize: 18, color: on ? "#ff3c00" : dark ? "rgba(255,255,255,.35)" : "rgba(26,26,26,.35)", width: 30 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 1, fontSize: rowSize, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{t}</span>
              <span style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: on ? FLAME : "transparent", border: on ? "none" : `2px solid ${dark ? "rgba(255,255,255,.25)" : HAIR}` }}>
                {on && <Check size={24} color="#fff" strokeWidth={3} />}
              </span>
            </div>
          );
        })}
      </div>
      {spec.subhead && <p style={{ margin: "0 0 34px", fontSize: 26, fontWeight: 500, letterSpacing: "-0.015em", color: sub(dark) }}>{spec.subhead}</p>}
    </PostFrame>
  );
}

/* 8 ─ Big stat ──────────────────────────────────────────────────────── */
export function BigStat({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const value = String(m.value || "");
  const valueSize = fit(value, [[3, 380], [4, 330], [5, 290], [6, 250], [8, 200], [999, 160]]);
  return (
    <PostFrame
      spec={spec}
      headerRight={m.hypothetical ? (
        <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.12em", textTransform: "uppercase", padding: "8px 14px", border: "1.5px solid #ff3c00", color: "#ff3c00" }}>Hypothetical example</span>
      ) : null}
    >
      <div style={{ marginTop: 34 }}>
        <Headline text={spec.headline} accent={spec.accent_word} size={fit(spec.headline, [[40, 64], [70, 54], [999, 46]])} maxWidth={860} />
      </div>
      <div style={{ marginTop: "auto", marginBottom: 40 }}>
        <p style={{ margin: 0, fontSize: valueSize, fontWeight: 600, letterSpacing: "-0.07em", lineHeight: 0.86, ...flameTextStyle({ paddingBottom: "0.08em" }) }}>{value}</p>
        <p style={{ margin: "16px 0 0", fontSize: 38, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1.15, maxWidth: 880 }}>{m.label}</p>
        {m.note && <p style={{ margin: "22px 0 0", fontFamily: MONO, fontSize: 17, letterSpacing: "0.04em", color: dark ? "rgba(245,243,240,.5)" : "rgba(26,26,26,.5)" }}>{m.hypothetical ? "* " : "Source: "}{m.note}</p>}
      </div>
    </PostFrame>
  );
}

/* 9 ─ Quote / hook ──────────────────────────────────────────────────── */
export function QuoteHook({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  return (
    <PostFrame spec={spec}>
      <div style={{ marginTop: "auto", marginBottom: "auto", paddingTop: 20 }}>
        <Quote size={64} color="#ff3c00" strokeWidth={2} style={{ display: "block", marginBottom: 18 }} />
        <Headline text={spec.headline} accent={spec.accent_word} size={fit(spec.headline, [[30, 124], [44, 108], [60, 94], [80, 82], [999, 72]])} />
        {(spec.body || spec.subhead) && <p style={{ margin: "32px 0 0", fontSize: 30, lineHeight: 1.35, letterSpacing: "-0.015em", color: sub(dark), maxWidth: 860 }}>{spec.body || spec.subhead}</p>}
        {m.signature && (
          <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 16 }}>
            <Martian palette={MARTIAN_PALETTES.orange} size={60} />
            <span style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em" }}>{m.signature}</span>
          </div>
        )}
      </div>
    </PostFrame>
  );
}

/* 10 ─ Pipeline board ───────────────────────────────────────────────── */
const PIPE_PALETTES = ["blue", "green", "lagoon", "purple", "pink", "cyan", "lime"];
function paletteFor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MARTIAN_PALETTES[PIPE_PALETTES[h % PIPE_PALETTES.length]];
}

export function PipelineBoard({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const cols = arr(m.columns, example.mock.columns).slice(0, 3);
  return (
    <PostFrame spec={spec}>
      <div style={{ marginTop: 34 }}>
        <Headline text={spec.headline} accent={spec.accent_word} size={fit(spec.headline, [[34, 84], [50, 72], [70, 62], [999, 54]])} />
        {spec.subhead && <p style={{ margin: "18px 0 0", fontSize: 26, lineHeight: 1.3, color: sub(dark), maxWidth: 840 }}>{spec.subhead}</p>}
      </div>
      <MockWindow dark={dark} url="app.mothership.io/pipeline" style={{ marginTop: "auto", marginBottom: 36, height: 470 }} bodyStyle={{ background: "#ebe8e4", padding: 18, color: INK }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, height: "100%" }}>
          {cols.map((c, ci) => (
            <div key={c.name + ci} style={{ borderRadius: 10, background: "rgba(26,26,26,.04)", border: `1.5px solid ${HAIR}`, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px" }}>
                <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>{c.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: "rgba(26,26,26,.45)" }}>{arr(c.cards).length}</span>
              </div>
              {arr(c.cards).slice(0, 3).map((card, i) => (
                <div key={card.business + i} style={{ position: "relative", borderRadius: 8, background: CARD, border: `1.5px solid ${card.hot ? "rgba(255,60,0,.55)" : HAIR}`, padding: "12px 12px 12px 14px", boxShadow: card.hot ? "0 12px 26px -18px rgba(255,60,0,.8)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Martian palette={paletteFor(card.business)} size={30} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.business}</span>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em", ...(ci === cols.length - 1 ? flameTextStyle() : {}) }}>{card.value}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 13.5, color: card.hot ? "#d83300" : "rgba(26,26,26,.5)", display: "flex", alignItems: "center", gap: 6 }}>
                    {card.hot && <span style={{ width: 7, height: 7, borderRadius: 7, background: "#ff3c00" }} />}{card.note}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <SampleTag style={{ position: "absolute", right: 22, bottom: 14 }} />
      </MockWindow>
    </PostFrame>
  );
}

export { DarkCard };
