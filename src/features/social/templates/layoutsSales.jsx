import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { ArrowRight, BadgeCheck, CalendarCheck, CircleDollarSign, ListTodo, MessageSquare, Star, UserPlus } from "lucide-react";
import {
  CARD, DarkCard, FLAME, HAIR, Headline, INK, MONO, Mono, PostFrame, SANS, SampleTag,
  arr, fit, flameTextStyle, isDark, mockOf,
} from "./kit";

const subColor = (dark) => (dark ? "rgba(245,243,240,.62)" : "rgba(26,26,26,.6)");
const LOGO_MARK = "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/536102fbf_interstellar-mark-v2.webp";

function QrSvg({ value, size = 240, color = INK }) {
  const path = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(String(value || "https://interstellar-strategies.com"));
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, n };
  }, [value]);
  return (
    <svg viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`} width={size} height={size} shapeRendering="crispEdges" style={{ display: "block" }}>
      <rect x="-2" y="-2" width={path.n + 4} height={path.n + 4} fill="#fff" />
      <path d={path.d} fill={color} />
    </svg>
  );
}

/* 11 ─ Review / QR ──────────────────────────────────────────────────── */
export function ReviewQr({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const tiles = arr(m.tiles).slice(0, 2);
  return (
    <PostFrame spec={spec}>
      <div style={{ marginTop: 34 }}>
        <Headline text={spec.headline} accent={spec.accent_word} size={fit(spec.headline, [[34, 84], [50, 72], [70, 62], [999, 54]])} />
        {spec.subhead && <p style={{ margin: "18px 0 0", fontSize: 26, lineHeight: 1.3, color: subColor(dark), maxWidth: 860 }}>{spec.subhead}</p>}
      </div>
      <div style={{ marginTop: "auto", marginBottom: 36, display: "grid", gridTemplateColumns: "380px 1fr", gap: 26, alignItems: "end" }}>
        {/* Phone */}
        <div style={{ height: 500, borderRadius: 52, background: "#0d0d0d", padding: 12, boxShadow: "0 40px 80px -40px rgba(0,0,0,.8)", position: "relative" }}>
          <div style={{ height: "100%", borderRadius: 42, background: "#f5f3f0", overflow: "hidden", display: "flex", flexDirection: "column", color: INK }}>
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}><span style={{ width: 110, height: 30, borderRadius: 20, background: "#0d0d0d" }} /></div>
            <div style={{ textAlign: "center", padding: "14px 0 12px", borderBottom: `1.5px solid ${HAIR}` }}>
              <div style={{ width: 46, height: 46, borderRadius: 46, margin: "0 auto", background: FLAME, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20 }}>{String(m.business || "B").charAt(0)}</div>
              <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 600 }}>{m.business}</p>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <Mono size={11} color="rgba(26,26,26,.4)" style={{ textAlign: "center" }}>Today 4:12 PM · automatic</Mono>
              <div style={{ alignSelf: "flex-start", maxWidth: "88%", padding: "12px 14px", borderRadius: "18px 18px 18px 6px", background: "#e4e1dc", fontSize: 16, lineHeight: 1.35 }}>{m.request_text}</div>
              <div style={{ alignSelf: "flex-start", maxWidth: "88%", borderRadius: 14, overflow: "hidden", border: `1.5px solid ${HAIR}`, background: "#fff" }}>
                <div style={{ padding: "12px 14px" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Leave a review on Google</p>
                  <div style={{ marginTop: 6, display: "flex", gap: 3 }}>{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={20} fill="#ff6a00" color="#ff6a00" />)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* QR card + tiles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <DarkCard padding={28}>
            <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
              <div style={{ padding: 12, background: "#fff", borderRadius: 12, position: "relative" }}>
                <QrSvg value={m.qr_url} size={200} />
                <img src={LOGO_MARK} alt="" crossOrigin="anonymous" style={{ position: "absolute", left: "50%", top: "50%", width: 50, height: 40, transform: "translate(-50%,-50%)", objectFit: "contain", background: "#fff", padding: 4, borderRadius: 8 }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <Mono size={12} color="rgba(255,255,255,.5)">For the counter + the truck</Mono>
                <p style={{ margin: "10px 0 0", fontSize: 34, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05 }}>Scan to <span style={flameTextStyle()}>review</span></p>
                <p style={{ margin: "10px 0 0", fontSize: 16, color: "rgba(255,255,255,.55)" }}>{m.business}</p>
              </div>
            </div>
          </DarkCard>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {tiles.map((t, i) => (
              <div key={t.label + i} style={{ borderRadius: 10, border: `1.5px solid ${HAIR}`, background: CARD, padding: "16px 18px", color: INK }}>
                <Mono size={12} color="rgba(26,26,26,.5)">{t.label}</Mono>
                <p style={{ margin: "8px 0 0", fontSize: 44, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, ...(i === 1 ? flameTextStyle() : {}) }}>{t.value}</p>
              </div>
            ))}
          </div>
          <SampleTag dark={dark} />
        </div>
      </div>
    </PostFrame>
  );
}

/* 12 ─ Offer stack ──────────────────────────────────────────────────── */
export function OfferStack({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const items = arr(m.items, example.mock.items).slice(0, 7);
  const line = dark ? "rgba(255,255,255,.1)" : HAIR;
  const roomy = items.length <= 4;
  return (
    <PostFrame spec={spec}>
      <div style={{ marginTop: 30 }}>
        <Headline text={spec.headline} accent={spec.accent_word} size={fit(spec.headline, [[34, 76], [50, 66], [70, 58], [999, 50]])} />
        {spec.subhead && <p style={{ margin: "18px 0 0", fontSize: 26, lineHeight: 1.3, color: subColor(dark), maxWidth: 840 }}>{spec.subhead}</p>}
      </div>
      <div style={{ marginTop: "auto", marginBottom: 32, display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 18, alignItems: "stretch" }}>
        <div style={{ borderRadius: 12, border: `1.5px solid ${line}`, background: dark ? "rgba(255,255,255,.035)" : CARD, padding: "8px 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {items.map((it, i) => (
            <div key={it.name + i} style={{ display: "flex", alignItems: "center", gap: 14, padding: roomy ? "26px 0" : "13px 0", borderTop: i ? `1.5px solid ${line}` : "none" }}>
              <BadgeCheck size={roomy ? 28 : 22} color="#ff3c00" />
              <span style={{ flex: 1, fontSize: roomy ? 30 : 23, fontWeight: 500, letterSpacing: "-0.02em" }}>{it.name}</span>
              <span style={{ fontFamily: MONO, fontSize: roomy ? 20 : 17, color: /free/i.test(it.value) ? "#ff6a00" : dark ? "rgba(245,243,240,.5)" : "rgba(26,26,26,.5)" }}>{it.value}</span>
            </div>
          ))}
        </div>
        <DarkCard padding={30}>
          <Mono size={13} color="rgba(255,255,255,.5)">{m.offer_name}</Mono>
          <p style={{ margin: "16px 0 0", fontSize: 21, color: "rgba(255,255,255,.55)", textDecoration: "line-through", textDecorationColor: "rgba(255,60,0,.7)", textDecorationThickness: 2 }}>{m.total_label}</p>
          <p style={{ margin: "10px 0 0", fontSize: 96, fontWeight: 600, letterSpacing: "-0.06em", lineHeight: 0.95, ...flameTextStyle() }}>{m.price}</p>
          {m.price_note && <p style={{ margin: "14px 0 0", fontSize: 18, lineHeight: 1.35, color: "rgba(255,255,255,.65)" }}>{m.price_note}</p>}
          <span style={{ marginTop: "auto", paddingTop: 16, display: "inline-flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>
            Quoted on a free call <ArrowRight size={16} />
          </span>
        </DarkCard>
      </div>
    </PostFrame>
  );
}

/* 13 ─ Carousel cover ───────────────────────────────────────────────── */
export function CarouselCover({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const total = Number(m.slides) || 6;
  return (
    <PostFrame
      spec={spec}
      backdrop={(
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 460, pointerEvents: "none", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: dark ? "linear-gradient(180deg, rgba(18,18,18,0) 0%, rgba(120,40,10,.5) 62%, rgba(255,74,16,.7) 100%)" : "linear-gradient(180deg, rgba(235,232,228,0) 0%, rgba(255,106,0,.16) 70%, rgba(255,60,0,.3) 100%)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, textAlign: "center", fontFamily: SANS, fontSize: 150, fontWeight: 600, letterSpacing: "-0.06em", lineHeight: 0.8, color: dark ? "rgba(255,255,255,.08)" : "rgba(26,26,26,.06)", whiteSpace: "nowrap" }}>INTERSTELLAR</div>
        </div>
      )}
      headerRight={<Mono size={18} color={dark ? "rgba(245,243,240,.55)" : "rgba(26,26,26,.55)"}>01 / {String(total).padStart(2, "0")}</Mono>}>
      <div style={{ marginTop: "auto", marginBottom: "auto", position: "relative" }}>
        <Headline text={spec.headline} accent={spec.accent_word} size={fit(spec.headline, [[24, 136], [36, 118], [50, 104], [70, 90], [999, 78]])} />
        {spec.subhead && <p style={{ margin: "30px 0 0", fontSize: 32, lineHeight: 1.3, letterSpacing: "-0.015em", color: subColor(dark), maxWidth: 820 }}>{spec.subhead}</p>}
        <span style={{ marginTop: 44, display: "inline-flex", alignItems: "center", gap: 16, height: 66, padding: "0 12px 0 30px", border: `2px solid ${dark ? "rgba(255,255,255,.3)" : "rgba(26,26,26,.3)"}`, fontSize: 26, fontWeight: 500 }}>
          {m.swipe_label || "Swipe"}
          <span style={{ width: 46, height: 46, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#ff3c00", color: "#fff" }}><ArrowRight size={26} strokeWidth={2.4} /></span>
        </span>
      </div>
      <div style={{ position: "relative", display: "flex", gap: 8, marginBottom: 30 }}>
        {Array.from({ length: Math.min(total, 12) }).map((_, i) => <span key={i} style={{ width: i === 0 ? 46 : 14, height: 6, background: i === 0 ? FLAME : dark ? "rgba(255,255,255,.2)" : "rgba(26,26,26,.18)" }} />)}
      </div>
    </PostFrame>
  );
}

/* 14 ─ Notification stack ───────────────────────────────────────────── */
const TOAST_ICONS = { lead: UserPlus, paid: CircleDollarSign, booked: CalendarCheck, review: Star, task: ListTodo, message: MessageSquare };

export function ToastStack({ spec, example }) {
  const m = mockOf(spec, example.mock);
  const dark = isDark(spec);
  const toasts = arr(m.toasts, example.mock.toasts).slice(0, 5);
  return (
    <PostFrame spec={spec}>
      <div style={{ marginTop: 34 }}>
        <Headline text={spec.headline} accent={spec.accent_word} size={fit(spec.headline, [[34, 84], [50, 72], [70, 62], [999, 54]])} maxWidth={880} />
        {spec.subhead && <p style={{ margin: "18px 0 0", fontSize: 26, lineHeight: 1.3, color: subColor(dark), maxWidth: 840 }}>{spec.subhead}</p>}
      </div>
      <div style={{ marginTop: "auto", marginBottom: 34, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-end" }}>
        {toasts.map((t, i) => {
          const Icon = TOAST_ICONS[t.icon] || MessageSquare;
          const first = i === 0;
          return (
            <div
              key={t.title + i}
              style={{
                width: 760 - i * 22,
                marginRight: i * 11,
                opacity: 1 - i * 0.12,
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "18px 22px",
                borderRadius: 22,
                background: first ? INK : dark ? "rgba(40,40,40,.92)" : "rgba(250,249,247,.95)",
                color: first || dark ? "#f5f3f0" : INK,
                border: `1.5px solid ${first ? INK : dark ? "rgba(255,255,255,.1)" : HAIR}`,
                boxShadow: "0 24px 50px -28px rgba(0,0,0,.55)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {first && <span style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: FLAME }} />}
              <span style={{ width: 54, height: 54, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: first ? FLAME : "rgba(255,60,0,.12)", color: first ? "#fff" : "#ff3c00" }}>
                <Icon size={28} strokeWidth={2} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Mono size={12} color={first || dark ? "rgba(255,255,255,.5)" : "rgba(26,26,26,.45)"}>{m.app_name || "Møthership"}</Mono>
                  <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 13, color: first || dark ? "rgba(255,255,255,.45)" : "rgba(26,26,26,.45)" }}>{t.time}</span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 23, fontWeight: 600, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: 17, color: first || dark ? "rgba(255,255,255,.6)" : "rgba(26,26,26,.55)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.body}</p>
              </div>
            </div>
          );
        })}
        <SampleTag dark={dark} style={{ marginTop: 4 }} />
      </div>
    </PostFrame>
  );
}
