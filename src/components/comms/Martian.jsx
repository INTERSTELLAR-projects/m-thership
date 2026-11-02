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
@keyframes mtn-orbit { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
@keyframes mtn-cape { 0%,100% { transform: skewX(0deg) } 50% { transform: skewX(-4deg) } }
@keyframes mtn-pulse { 0%,100% { opacity: .55; transform: scale(.92) } 50% { opacity: 1; transform: scale(1.08) } }
@keyframes mtn-twinkle { 0%,100% { opacity: 0; transform: scale(.4) } 50% { opacity: 1; transform: scale(1) } }
.mtn-svg .mtn-orbit { animation: mtn-orbit 9s linear infinite; transform-origin: 50px 58px; }
.mtn-svg .mtn-cape { animation: mtn-cape 3.2s ease-in-out infinite; transform-origin: 50% 0%; transform-box: fill-box; }
.mtn-svg .mtn-orb { animation: mtn-pulse 1.8s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
.mtn-svg .mtn-spark { animation: mtn-twinkle 2.6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
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
      viewBox={king ? "-14 -14 128 132" : "0 0 100 112"}
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

      {king && (
        <defs>
          <linearGradient id={`kc-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1d6" />
            <stop offset="0.35" stopColor="#ffaa00" />
            <stop offset="1" stopColor="#ff3c00" />
          </linearGradient>
          <linearGradient id={`kp-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a1208" />
            <stop offset="1" stopColor="#140a06" />
          </linearGradient>
          <linearGradient id={`kl-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff3c00" />
            <stop offset="0.5" stopColor="#ff6a00" />
            <stop offset="1" stopColor="#ffaa00" />
          </linearGradient>
          <radialGradient id={`ka-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ff6a00" stopOpacity="0.38" />
            <stop offset="0.6" stopColor="#ff3c00" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ff3c00" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`ko-${uid}`} cx="0.4" cy="0.35" r="0.65">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#ffaa00" />
            <stop offset="1" stopColor="#ff3c00" />
          </radialGradient>
        </defs>
      )}

      {/* King Martian: command aura, orbit ring (back half) and royal cape behind the body */}
      {king && (
        <g>
          <circle cx="50" cy="58" r="62" fill={`url(#ka-${uid})`} />
          <g className="mtn-orbit" style={anim}>
            <ellipse cx="50" cy="58" rx="60" ry="18" fill="none" stroke={`url(#kl-${uid})`} strokeWidth="1.6" strokeDasharray="3 5" opacity="0.7" transform="rotate(-18 50 58)" />
            <circle cx="107" cy="40" r="3.2" fill="#ffaa00" />
            <circle cx="107" cy="40" r="6" fill="#ff6a00" opacity="0.25" />
          </g>
          <path className="mtn-spark" style={{ animationDelay: "-0.4s" }} d="M-4 24 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 Z" fill="#ffaa00" />
          <path className="mtn-spark" style={{ animationDelay: "-1.6s" }} d="M104 92 l1.5 -4.5 l1.5 4.5 l4.5 1.5 l-4.5 1.5 l-1.5 4.5 l-1.5 -4.5 l-4.5 -1.5 Z" fill="#ff6a00" />
          <path className="mtn-spark" style={{ animationDelay: "-2.2s" }} d="M96 4 l1.2 -3.6 l1.2 3.6 l3.6 1.2 l-3.6 1.2 l-1.2 3.6 l-1.2 -3.6 l-3.6 -1.2 Z" fill="#fff1d6" />
        </g>
      )}

      <ellipse cx="50" cy="106" rx="24" ry="4" fill="#000" opacity="0.12" />

      <g className="mtn-body" style={anim}>
        {king && (
          <g className="mtn-cape" style={anim}>
            <path d="M24 46 Q8 80 10 102 Q30 96 50 104 Q70 96 90 102 Q92 80 76 46 Z" fill={`url(#kp-${uid})`} />
            <path d="M10 102 Q30 96 50 104 Q70 96 90 102" fill="none" stroke={`url(#kl-${uid})`} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M28 44 L50 54 L72 44" fill="none" stroke="#ffaa00" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
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

        {/* King Martian: chest emblem, star scepter and a tall commander's crown */}
        {king && (
          <g>
            {/* chest emblem */}
            <circle cx="50" cy="90" r="5.2" fill="#1d1b2b" stroke={`url(#kl-${uid})`} strokeWidth="1.6" />
            <path d="M50 86.2 l1.2 2.6 l2.8 .3 l-2.1 1.9 l.6 2.8 l-2.5 -1.4 l-2.5 1.4 l.6 -2.8 l-2.1 -1.9 l2.8 -.3 Z" fill="#ffaa00" />
            {/* scepter in the right hand */}
            <line x1="90" y1="84" x2="98" y2="34" stroke="#3a2a20" strokeWidth="3.4" strokeLinecap="round" />
            <line x1="90" y1="84" x2="98" y2="34" stroke={`url(#kl-${uid})`} strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="98.5" cy="30" r="9" fill="#ff6a00" opacity="0.25" className="mtn-orb" style={anim} />
            <circle cx="98.5" cy="30" r="5.5" fill={`url(#ko-${uid})`} stroke="#ff3c00" strokeWidth="1" />
            <ellipse cx="98.5" cy="30" rx="9" ry="2.6" fill="none" stroke="#ffaa00" strokeWidth="1.1" transform="rotate(-20 98.5 30)" />
            {/* crown */}
            <g transform="translate(0 -5)">
              <path d="M30 30 L32 10 L41 20 L50 0 L59 20 L68 10 L70 30 Z" fill={`url(#kc-${uid})`} stroke="#8a2e00" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M36 26 L37.5 15 L43 21 L50 8 L57 21 L62.5 15 L64 26" fill="none" stroke="#fff1d6" strokeWidth="0.9" opacity="0.7" />
              <rect x="29" y="26.5" width="42" height="6" rx="2" fill={`url(#kl-${uid})`} stroke="#8a2e00" strokeWidth="1.2" />
              <circle cx="50" cy="0" r="3" fill="#fff" stroke="#ff3c00" strokeWidth="1.2" />
              <circle cx="32" cy="10" r="2.2" fill="#fff1d6" stroke="#ff3c00" strokeWidth="1" />
              <circle cx="68" cy="10" r="2.2" fill="#fff1d6" stroke="#ff3c00" strokeWidth="1" />
              <circle cx="50" cy="18" r="3.4" fill={`url(#ko-${uid})`} stroke="#8a2e00" strokeWidth="1" className="mtn-orb" style={anim} />
              <circle cx="38" cy="29.5" r="1.5" fill="#fff" />
              <circle cx="50" cy="29.5" r="1.5" fill="#fff" />
              <circle cx="62" cy="29.5" r="1.5" fill="#fff" />
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}
