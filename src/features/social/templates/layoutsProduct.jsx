import { ArrowRight, CalendarCheck, Check, FileText, Inbox, Repeat, Target, Users, X, Zap } from "lucide-react";
import BrandLockup from "@/components/brand/BrandLockup";
import {
  AppTile, CARD, Chip, DarkCard, FLAME, HAIR, Headline, INK, MONO, MockWindow, Mono, PostFrame, SampleTag, Sparkline,
  arr, fit, flameTextStyle, isDark, mockOf,
} from "./kit";

const HEAD_STEPS = [[34, 92], [48, 80], [62, 70], [80, 62], [999, 56]];

function Head({ spec, steps = HEAD_STEPS, sub = true, mt = 34, maxWidth = 900 }) {
  const dark = isDark(spec);
  return (
    <div style={{ marginTop: mt }}>
      <Headline text={spec.headline} accent={spec.accent_word} size={fit(spec.headline, steps)} maxWidth={maxWidth} />
      {sub && spec.subhead && (
        <p style={{ margin: "22px 0 0", fontSize: 28, lineHeight: 1.3, letterSpacing: "-0.015em", color: dark ? "rgba(245,243,240,.62)" : "rgba(26,26,26,.6)", maxWidth: 820 }}>{spec.subhead}</p>
      )}
    </div>
  );
}

/* 1 ─ Pain point vs fix ─────────────────────────────────────────────── */
export function PainFix({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const before = arr(m.before_items).slice(0, 5);
  const after = arr(m.after_items).slice(0, 5);
  return (
    <PostFrame spec={spec}>
      <Head spec={spec} />
      <div style={{ marginTop: "auto", marginBottom: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, position: "relative" }}>
        <div style={{ borderRadius: 12, border: `1.5px solid ${dark ? "rgba(255,255,255,.14)" : HAIR}`, background: dark ? "rgba(255,255,255,.04)" : CARD, padding: 34 }}>
          <Mono size={15} color={dark ? "rgba(245,243,240,.5)" : "rgba(26,26,26,.5)"}>({m.before_label || "Before"})</Mono>
          <ul style={{ listStyle: "none", margin: "24px 0 0", padding: 0, display: "grid", gap: 20 }}>
            {before.map((t) => (
              <li key={t} style={{ display: "flex", gap: 14, alignItems: "flex-start", fontSize: 28, lineHeight: 1.22, letterSpacing: "-0.02em", color: dark ? "rgba(245,243,240,.7)" : "rgba(26,26,26,.7)" }}>
                <span style={{ marginTop: 3, flexShrink: 0, display: "inline-flex", width: 26, height: 26, borderRadius: 26, alignItems: "center", justifyContent: "center", background: "rgba(216,51,0,.12)", color: "#d83300" }}><X size={16} strokeWidth={2.6} /></span>
                <span style={{ textDecoration: "line-through", textDecorationColor: "rgba(216,51,0,.35)", textDecorationThickness: 2 }}>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <DarkCard padding={34}>
          <Mono size={15} color="rgba(255,255,255,.55)">({m.after_label || "After"})</Mono>
          <ul style={{ listStyle: "none", margin: "24px 0 0", padding: 0, display: "grid", gap: 20 }}>
            {after.map((t) => (
              <li key={t} style={{ display: "flex", gap: 14, alignItems: "flex-start", fontSize: 28, lineHeight: 1.22, letterSpacing: "-0.02em", color: "#fff" }}>
                <span style={{ marginTop: 3, flexShrink: 0, display: "inline-flex", width: 26, height: 26, borderRadius: 26, alignItems: "center", justifyContent: "center", background: FLAME, color: "#fff" }}><Check size={16} strokeWidth={2.8} /></span>
                {t}
              </li>
            ))}
          </ul>
        </DarkCard>
        <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 58, height: 58, borderRadius: 58, background: "#ff3c00", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 8px ${dark ? "#121212" : "#ebe8e4"}` }}>
          <ArrowRight size={28} strokeWidth={2.4} />
        </span>
      </div>
    </PostFrame>
  );
}

/* 2 ─ Dashboard mock ────────────────────────────────────────────────── */
export function Dashboard({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const hero = { ...example.mock.hero, ...(m.hero || {}) };
  const kpis = arr(m.kpis, example.mock.kpis).slice(0, 4);
  const icons = [CalendarCheck, FileText, Users, Target];
  const slug = String(m.business || "business").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return (
    <PostFrame spec={spec}>
      <Head spec={spec} steps={[[34, 84], [50, 72], [70, 62], [999, 54]]} />
      <MockWindow dark={dark} url={`${slug}.com/command/${String(m.screen || "financial").toLowerCase()}`} style={{ marginTop: "auto", marginBottom: 36, height: 500 }} bodyStyle={{ padding: 24, background: "#ebe8e4" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.04em", color: INK }}>{m.business}</span>
            <Mono size={13} color="rgba(26,26,26,.5)">({m.screen || "Financial"})</Mono>
          </span>
          <SampleTag />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 14, height: 350 }}>
          <DarkCard style={{ gridRow: "1 / span 2" }} padding={24}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Mono size={13} color="rgba(255,255,255,.55)">{hero.label}</Mono>
              <Repeat size={18} color="#ff6a00" />
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 58, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, ...flameTextStyle() }}>{hero.value}</p>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
              {hero.delta && <span style={{ fontSize: 15, fontWeight: 600, padding: "3px 9px", borderRadius: 5, background: "rgba(255,60,0,.18)", color: "#ff8a4c" }}>{hero.delta}</span>}
              <span style={{ fontSize: 15, color: "rgba(255,255,255,.5)" }}>{hero.sub}</span>
            </div>
            <div style={{ marginTop: "auto" }}><Sparkline data={arr(hero.spark, example.mock.hero.spark)} height={90} /></div>
          </DarkCard>
          {kpis.map((k, i) => <AppTile key={k.label + i} icon={icons[i % icons.length]} label={k.label} value={k.value} sub={k.sub} hot={k.hot} />)}
        </div>
      </MockWindow>
    </PostFrame>
  );
}

/* 3 ─ Command Briefing ──────────────────────────────────────────────── */
export function CommandBriefing({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const tiles = arr(m.tiles, example.mock.tiles).slice(0, 3);
  const icons = [CalendarCheck, Users, Repeat];
  return (
    <PostFrame spec={spec}>
      <Head spec={spec} steps={[[34, 80], [52, 70], [70, 60], [999, 52]]} sub={String(spec.headline || "").length < 56} />
      <div style={{ marginTop: "auto", marginBottom: 36 }}>
        <DarkCard padding={34}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Mono size={14} color="rgba(255,255,255,.5)">(Command briefing) · MØTHERSHIP®</Mono>
            <SampleTag dark />
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 52, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05, color: "#fff" }}>{m.greeting || "Good morning"}, {m.name}.</p>
          <p style={{ margin: "8px 0 0", fontFamily: MONO, fontSize: 15, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,.45)" }}>{m.date_line}</p>
          <Mono size={13} color="rgba(255,255,255,.45)" style={{ display: "block", marginTop: 26 }}>The one thing</Mono>
          <p style={{ margin: "8px 0 0", fontSize: 34, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.18, ...flameTextStyle() }}>{m.one_thing}</p>
          <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {arr(m.chips).slice(0, 4).map((c) => <Chip key={c.label} hot={c.hot}>{c.label}</Chip>)}
          </div>
        </DarkCard>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {tiles.map((t, i) => <AppTile key={t.label + i} icon={icons[i]} label={t.label} value={t.value} sub={t.sub} flame={t.flame} />)}
        </div>
      </div>
    </PostFrame>
  );
}

/* 4 ─ Portal preview ────────────────────────────────────────────────── */
export function PortalPreview({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const counters = arr(m.counters, example.mock.counters).slice(0, 4);
  const feed = arr(m.feed).slice(0, 3);
  return (
    <PostFrame spec={spec}>
      <Head spec={spec} steps={[[34, 80], [52, 68], [72, 58], [999, 50]]} sub={String(spec.headline || "").length < 66} />
      <MockWindow dark={dark} url="portal.interstellar-strategies.com" style={{ marginTop: "auto", marginBottom: 36, height: 520 }} bodyStyle={{ background: "#ebe8e4", color: INK }}>
        <div style={{ height: 66, display: "flex", alignItems: "center", gap: 18, padding: "0 26px", borderBottom: `1.5px solid ${HAIR}` }}>
          <span style={{ display: "inline-flex", fontSize: 0 }}><BrandLockup word="MØTHERSHIP" sub="by Interstellar" size={20} /></span>
          <span style={{ width: 1.5, height: 30, background: HAIR }} />
          <span style={{ fontSize: 17, fontWeight: 500, color: "rgba(26,26,26,.7)", letterSpacing: "-0.02em" }}>{m.business}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {["Home", "Work", "Requests", "Messages"].map((t, i) => (
              <span key={t} style={{ position: "relative", padding: "8px 12px", fontSize: 16, fontWeight: 500, color: i === 0 ? INK : "rgba(26,26,26,.5)" }}>
                {t}
                {i === 0 && <span style={{ position: "absolute", left: 12, right: 12, bottom: -14, height: 3, background: "#ff3c00" }} />}
              </span>
            ))}
          </span>
        </div>
        <div style={{ padding: "26px 28px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 14, letterSpacing: "0.08em" }}>
            <span style={{ width: 10, height: 10, background: "linear-gradient(#ff3c00,#ff3c00) center/100% 2px no-repeat, linear-gradient(#ff3c00,#ff3c00) center/2px 100% no-repeat" }} />(Your {m.month})
          </span>
          <p style={{ margin: "12px 0 0", fontSize: 40, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1 }}>
            Here&apos;s what we did for <span style={{ color: "#ff3c00" }}>{m.business}</span>.
          </p>
          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: `repeat(${counters.length}, 1fr)`, border: `1.5px solid ${HAIR}`, borderRadius: 8, background: CARD, overflow: "hidden" }}>
            {counters.map((c, i) => (
              <div key={c.label + i} style={{ padding: "18px 20px", borderLeft: i ? `1.5px solid ${HAIR}` : "none" }}>
                <p style={{ margin: 0, fontSize: 46, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1 }}>{c.value}</p>
                <Mono size={12} color="rgba(26,26,26,.55)" style={{ display: "block", marginTop: 10 }}>{c.label}</Mono>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, border: `1.5px solid ${HAIR}`, borderRadius: 8, background: CARD }}>
            {feed.map((f, i) => (
              <div key={f.title + i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderTop: i ? `1.5px solid ${HAIR}` : "none" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 8px", background: "rgba(255,60,0,.1)", color: "#ff3c00" }}>{f.tag}</span>
                <span style={{ flex: 1, fontSize: 17, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.title}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: "rgba(26,26,26,.45)" }}>{f.date}</span>
              </div>
            ))}
          </div>
          <SampleTag style={{ position: "absolute", right: 28, bottom: 18 }} />
        </div>
      </MockWindow>
    </PostFrame>
  );
}

/* 5 ─ Stack collapse ────────────────────────────────────────────────── */
export function StackCollapse({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const apps = arr(m.apps, example.mock.apps).slice(0, 8);
  const total = apps.reduce((s, a) => s + (Number(a.cost) || 0), 0);
  const tilt = [-3, 2, -1.5, 2.5, -2, 1.5, -2.5, 1];
  return (
    <PostFrame spec={spec}>
      <Head spec={spec} steps={[[34, 84], [50, 72], [70, 62], [999, 54]]} />
      <div style={{ marginTop: "auto", marginBottom: 36, display: "grid", gridTemplateColumns: "1fr 76px 1fr", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {apps.map((a, i) => (
              <div key={a.name + i} style={{ transform: `rotate(${tilt[i % tilt.length]}deg)`, display: "flex", alignItems: "center", gap: 12, padding: "16px 16px", borderRadius: 10, border: `1.5px solid ${dark ? "rgba(255,255,255,.14)" : HAIR}`, background: dark ? "#1e1e1e" : CARD, boxShadow: "0 10px 24px -16px rgba(0,0,0,.5)" }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: dark ? "rgba(255,255,255,.1)" : "rgba(26,26,26,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 13, fontWeight: 600, color: dark ? "rgba(255,255,255,.6)" : "rgba(26,26,26,.55)" }}>{String(a.name || "?").charAt(0)}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 21, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: dark ? "rgba(255,255,255,.5)" : "rgba(26,26,26,.5)" }}>${Number(a.cost) || 0}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.04em", color: "#d83300", textDecoration: "line-through", textDecorationThickness: 3 }}>${total.toLocaleString()}/mo</span>
            <span style={{ fontSize: 18, color: dark ? "rgba(245,243,240,.55)" : "rgba(26,26,26,.55)" }}>{apps.length} logins</span>
          </div>
          <Mono size={12} color={dark ? "rgba(245,243,240,.45)" : "rgba(26,26,26,.45)"} style={{ display: "block", marginTop: 6 }}>{m.total_note || "Hypothetical stack"}</Mono>
        </div>
        <span style={{ justifySelf: "center", width: 64, height: 64, borderRadius: 64, background: "#ff3c00", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><ArrowRight size={30} strokeWidth={2.4} /></span>
        <DarkCard padding={30} style={{ alignSelf: "stretch" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 10, background: FLAME, display: "flex", alignItems: "center", justifyContent: "center" }}><Zap size={24} color="#fff" /></span>
            <Mono size={13} color="rgba(255,255,255,.55)">Command System · Ørigin 1.0</Mono>
          </div>
          <p style={{ margin: "18px 0 0", fontSize: 36, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05 }}>{m.system_name || "One Command System"}</p>
          <ul style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "grid", gap: 11 }}>
            {arr(m.system_items).slice(0, 5).map((t) => (
              <li key={t} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 20, color: "rgba(255,255,255,.85)" }}><Check size={20} color="#ff6a00" strokeWidth={2.6} />{t}</li>
            ))}
          </ul>
          <div style={{ marginTop: "auto", paddingTop: 18, display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.04em", ...flameTextStyle() }}>1 login</span>
            <Inbox size={20} color="rgba(255,255,255,.4)" />
          </div>
        </DarkCard>
      </div>
    </PostFrame>
  );
}
