import { useEffect, useId } from "react";
import { MARTIAN_PALETTES } from "./martianColors";

// Cute one-eyed Martian. Idle: float, blink, antenna bob. `active` = typing/talking state.
// Props: palette ({body, shade, light, gradient?}), size (px or "xs"|"sm"|"md"|"lg"|"xl"), king (crown), active, title.

const SIZES = { xs: 22, sm: 30, md: 40, lg: 56, xl: 96 };

const CSS = `
@keyframes mtn-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
@keyframes mtn-blink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(0.08) } }
@keyframes mtn-bob-l { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(5deg) } }
@keyframes mtn-bob-r { 0%,100% { transform: rotate(6deg) } 50% { transform: rotate(-5deg) } }
@keyframes mtn-glow { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
@keyframes mtn-talk { 0%,100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }
@keyframes mtn-hop { 0%,100% { transform: translateY(0) } 30% { transform: translateY(-6px) } 60% { transform: translateY(0) } }
@keyframes mtn-look { 0%,40%,100% { transform: translate(0,0) } 50%,70% { transform: translate(3px,-1px) } 80%,90% { transform: translate(-3px,0) } }
.mtn-svg .mtn-body { animation: mtn-float 3.2s ease-in-out infinite; transform-box: fill-box; }
.mtn-svg .mtn-eye { animation: mtn-blink 4.6s infinite; transform-origin: center; transform-box: fill-box; }
.mtn-svg .mtn-iris { animation: mtn-look 7s ease-in-out infinite; transform-box: fill-box; }
.mtn-svg .mtn-ant-l { animation: mtn-bob-l 2.4s ease-in-out infinite; transform-origin: 50% 100%; transform-box: fill-box; }
.mtn-svg .mtn-ant-r { animation: mtn-bob-r 2.4s ease-in-out infinite; transform-origin: 50% 100%; transform-box: fill-box; }
.mtn-svg .mtn-bulb { animation: mtn-glow 2.4s ease-in-out infinite; }
.mtn-svg .mtn-mouth-talk { display: none; }
.mtn-svg.mtn-active .mtn-body { animation: mtn-hop .7s ease-in-out infinite; }
.mtn-svg.mtn-active .mtn-ant-l, .mtn-svg.mtn-active .mtn-ant-r { animation-duration: .6s; }
.mtn-svg.mtn-active .mtn-bulb { animation-duration: .5s; }
.mtn-svg.mtn-active .mtn-mouth-idle { display: none; }
.mtn-svg.mtn-active .mtn-mouth-talk { display: inline; animation: mtn-talk .32s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
@media (prefers-reduced-motion: reduce) {
  .mtn-svg *, .mtn-svg.mtn-active * { animation: none !important; }
}
`;

let injected = false;
function useMartianStyles() {
  useEffect(() => {
    if (injected || typeof document === "undefined") return;
    if (document.getElementById("martian-styles")) { injected = true; return; }
    const el = document.createElement("style");
    el.id = "martian-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
    injected = true;
  }, []);
}

function seedDelay(id) {
  let h = 0;
  for (const c of id) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return (h % 2400) / 1000;
}

export default function Martian({ palette = MARTIAN_PALETTES.orange, size = "md", king = false, active = false, title, className = "" }) {
  useMartianStyles();
  const uid = useId().replace(/:/g, "");
  const px = typeof size === "number" ? size : SIZES[size] || SIZES.md;
  const delay = `-${seedDelay(uid)}s`;
  const g = palette.gradient || [palette.light, palette.body];
  const anim = { animationDelay: delay };

  return (
    <svg
      viewBox="0 0 100 112"
      width={px}
      height={px * 1.12}
      role="img"
      aria-label={title || (king ? "King Martian" : "Martian")}
      className={`mtn-svg shrink-0 overflow-visible ${active ? "mtn-active" : ""} ${className}`}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`mb-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={g[0]} />
          <stop offset="1" stopColor={g[1]} />
        </linearGradient>
        <radialGradient id={`mg-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.5" stopColor={palette.light} stopOpacity="0.9" />
          <stop offset="1" stopColor={palette.light} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="50" cy="106" rx="24" ry="4" fill="#000" opacity="0.12" />

      <g className="mtn-body" style={anim}>
        {/* antennae */}
        <g className="mtn-ant-l" style={anim}>
          <path d="M38 26 Q32 14 26 8" stroke={palette.shade} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <circle cx="26" cy="8" r="9" fill={`url(#mg-${uid})`} className="mtn-bulb" style={anim} />
          <circle cx="26" cy="8" r="4.5" fill={palette.light} stroke={palette.shade} strokeWidth="1.5" />
        </g>
        <g className="mtn-ant-r" style={anim}>
          <path d="M62 26 Q68 14 74 8" stroke={palette.shade} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <circle cx="74" cy="8" r="9" fill={`url(#mg-${uid})`} className="mtn-bulb" style={anim} />
          <circle cx="74" cy="8" r="4.5" fill={palette.light} stroke={palette.shade} strokeWidth="1.5" />
        </g>

        {/* arms */}
        <path d="M18 66 Q8 70 10 80" stroke={palette.shade} strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M82 66 Q92 70 90 80" stroke={palette.shade} strokeWidth="6" fill="none" strokeLinecap="round" />
        {/* feet */}
        <ellipse cx="37" cy="99" rx="9" ry="5" fill={palette.shade} />
        <ellipse cx="63" cy="99" rx="9" ry="5" fill={palette.shade} />

        {/* body */}
        <path d="M18 60 C18 32 32 22 50 22 C68 22 82 32 82 60 L82 84 Q82 97 69 97 L31 97 Q18 97 18 84 Z" fill={`url(#mb-${uid})`} stroke={palette.shade} strokeWidth="2" />
        <ellipse cx="50" cy="82" rx="18" ry="10" fill="#fff" opacity="0.18" />
        <ellipse cx="34" cy="38" rx="6" ry="9" fill="#fff" opacity="0.25" transform="rotate(-25 34 38)" />
        {/* cheeks */}
        <ellipse cx="29" cy="68" rx="5" ry="3" fill="#ff7aa2" opacity="0.45" />
        <ellipse cx="71" cy="68" rx="5" ry="3" fill="#ff7aa2" opacity="0.45" />

        {/* the one eye */}
        <g className="mtn-eye" style={anim}>
          <ellipse cx="50" cy="52" rx="17" ry="17" fill="#fff" stroke={palette.shade} strokeWidth="2" />
          <g className="mtn-iris" style={anim}>
            <circle cx="50" cy="53" r="9" fill="#1d1b2b" />
            <circle cx="50" cy="53" r="9" fill={palette.shade} opacity="0.35" />
            <circle cx="54" cy="49" r="3.2" fill="#fff" />
            <circle cx="46.5" cy="56.5" r="1.4" fill="#fff" opacity="0.8" />
          </g>
        </g>

        {/* mouth */}
        <path className="mtn-mouth-idle" d="M42 75 Q50 82 58 75" stroke="#1d1b2b" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <ellipse className="mtn-mouth-talk" cx="50" cy="77" rx="5" ry="4" fill="#1d1b2b" />

        {/* crown for the King Martian */}
        {king && (
          <g transform="translate(0 -2)">
            <path d="M34 26 L36 12 L43 20 L50 8 L57 20 L64 12 L66 26 Z" fill="#ffc531" stroke="#c97a00" strokeWidth="1.6" strokeLinejoin="round" />
            <rect x="34" y="23.5" width="32" height="4.5" rx="1.5" fill="#ffb000" stroke="#c97a00" strokeWidth="1.2" />
            <circle cx="50" cy="17" r="2.4" fill="#ff3c00" />
            <circle cx="41" cy="22" r="1.6" fill="#3b82f6" />
            <circle cx="59" cy="22" r="1.6" fill="#22c55e" />
          </g>
        )}
      </g>
    </svg>
  );
}
