import { useId } from "react";
import { ROMAN } from "@/lib/prestige";

// Prestige rank emblem: layered metal SVG, one design per tier, escalating in rarity.
//   0 Recruit   gunmetal hex badge
//   1 Prestige I    sharp chevron shield
//   2 Prestige II   winged shield, twin chevrons
//   3 Prestige III  star crest inside a laurel wreath
//   4 Prestige IV   multi-layer crest, crossed blades, ray burst, plasma core
//   5+ Master       crowned planet medallion, wings, ray burst, orbit ring + comet
// `tier` is 1-based (0 = recruit). Below 48px the fine engraving, rivets and sparkles are
// dropped so the silhouette stays crisp. Idle motion (shimmer, comet, pulse, slow spin) is
// CSS-only, off when `animated` is false, when `locked`, and under prefers-reduced-motion.

const CSS = `
.pe-anim .pe-shimmer{animation:pe-shimmer 5.2s cubic-bezier(.45,0,.25,1) infinite}
.pe-anim .pe-spin{transform-box:view-box;transform-origin:80px 72px;animation:pe-spin 90s linear infinite}
.pe-anim .pe-pulse{transform-box:fill-box;transform-origin:center;animation:pe-pulse 2.8s ease-in-out infinite}
.pe-anim .pe-comet{animation:pe-comet 6s linear infinite}
.pe-anim .pe-comet-head{animation:pe-comet-head 6s linear infinite}
.pe-anim .pe-twinkle{transform-box:fill-box;transform-origin:center;animation:pe-twinkle 3.2s ease-in-out infinite}
@keyframes pe-shimmer{0%{transform:translateX(0)}55%,100%{transform:translateX(300px)}}
@keyframes pe-spin{to{transform:rotate(360deg)}}
@keyframes pe-pulse{0%,100%{opacity:.7;transform:scale(.93)}50%{opacity:1;transform:scale(1.07)}}
@keyframes pe-comet{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@keyframes pe-comet-head{from{stroke-dashoffset:87}to{stroke-dashoffset:-13}}
@keyframes pe-twinkle{0%,100%{opacity:.25;transform:scale(.6)}50%{opacity:1;transform:scale(1.1)}}
@media (prefers-reduced-motion:reduce){.pe-anim *{animation:none!important}}
`;

// ---------- geometry helpers ----------
const r2 = (n) => Math.round(n * 100) / 100;
const rad = (a) => (a * Math.PI) / 180;
const poly = (pts) => `M${pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(" L")} Z`;
const inset = (k, cx = 80, cy = 70) => `translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})`;
const MIRROR = "matrix(-1 0 0 1 160 0)";

function starPts(cx, cy, R, r, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rad(rot + (i * 180) / n);
    const d = i % 2 ? r : R;
    pts.push([cx + d * Math.cos(a), cy + d * Math.sin(a)]);
  }
  return pts;
}

function raysPath(cx, cy, n, r0, rLong, rShort, half) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = -90 + (i * 360) / n;
    const R = i % 2 ? rShort : rLong;
    d += poly([
      [cx + r0 * Math.cos(rad(a - half)), cy + r0 * Math.sin(rad(a - half))],
      [cx + R * Math.cos(rad(a)), cy + R * Math.sin(rad(a))],
      [cx + r0 * Math.cos(rad(a + half)), cy + r0 * Math.sin(rad(a + half))],
    ]);
  }
  return d;
}

function ticksPath(cx, cy, n, r0, r1) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = rad((i * 360) / n);
    const len = i % 3 === 0 ? r1 + 1.5 : r1;
    d += `M${r2(cx + r0 * Math.cos(a))} ${r2(cy + r0 * Math.sin(a))} L${r2(cx + len * Math.cos(a))} ${r2(cy + len * Math.sin(a))}`;
  }
  return d;
}

const sparkle = (cx, cy, R, w = R * 0.22) =>
  `M${cx} ${cy - R} L${cx + w} ${cy - w} L${cx + R} ${cy} L${cx + w} ${cy + w} L${cx} ${cy + R} L${cx - w} ${cy + w} L${cx - R} ${cy} L${cx - w} ${cy - w} Z`;

// Bevelled star: each point split into a lit and a shaded facet.
function FacetStar({ cx, cy, R, r, n = 5, light, dark, edge = "rgba(40,10,0,.55)", hi }) {
  const pts = starPts(cx, cy, R, r, n);
  const faces = [];
  for (let i = 0; i < n; i++) {
    const tip = pts[2 * i];
    const left = pts[(2 * i - 1 + 2 * n) % (2 * n)];
    const right = pts[2 * i + 1];
    faces.push(<path key={`l${i}`} d={poly([[cx, cy], left, tip])} fill={light} />);
    faces.push(<path key={`r${i}`} d={poly([[cx, cy], tip, right])} fill={dark} />);
  }
  return (
    <g>
      {faces}
      <path d={poly(pts)} fill="none" stroke={edge} strokeWidth={hi ? 0.8 : 1.2} strokeLinejoin="round" />
    </g>
  );
}

function Rivets({ pts, u }) {
  return (
    <g>
      {pts.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="2.3" fill="rgba(0,0,0,.55)" />
          <circle cx={x} cy={y - 0.2} r="1.8" fill={u("rv")} />
        </g>
      ))}
    </g>
  );
}

// Bevelled rank chevron (pointing down): left facet lit, right facet shaded.
function Chevron({ y, w = 34, h = 22, t = 14, u, hi }) {
  const L = 80 - w;
  const R = 80 + w;
  return (
    <g>
      <path d={`M${L} ${y} L80 ${y + h} L80 ${y + h + t} L${L} ${y + t} Z`} fill={u("oh")} />
      <path d={`M${R} ${y} L80 ${y + h} L80 ${y + h + t} L${R} ${y + t} Z`} fill={u("od")} />
      <path d={`M${L} ${y} L80 ${y + h} L${R} ${y} L${R} ${y + t} L80 ${y + h + t} L${L} ${y + t} Z`} fill="none" stroke="rgba(40,10,0,.6)" strokeWidth={hi ? 0.8 : 1.2} strokeLinejoin="round" />
      {hi && <polyline points={`${L + 1} ${y + 1.2} 80 ${y + h + 1} ${R - 1} ${y + 1.2}`} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth=".9" />}
    </g>
  );
}

// Roman numeral plate (hex-ended, gunmetal with orange metal border).
function Plate({ u, text, hi, master }) {
  const d = "M46 111 L114 111 L121 120 L114 129 L46 129 L39 120 Z";
  return (
    <g>
      {master && (
        <g fill={u("o")} stroke="rgba(40,10,0,.6)" strokeWidth=".7">
          <path d="M39 120 L30 114 L33 120 L30 126 Z" />
          <path d="M121 120 L130 114 L127 120 L130 126 Z" />
        </g>
      )}
      <path d={d} fill={u("gm")} stroke={u("o")} strokeWidth="2.2" strokeLinejoin="round" />
      {hi && <path d="M47 113.6 L113 113.6" stroke="rgba(255,255,255,.28)" strokeWidth=".8" />}
      {hi && <path d="M46 126.6 L114 126.6" stroke="rgba(0,0,0,.45)" strokeWidth=".8" />}
      <text x="80" y="124.6" textAnchor="middle" fontFamily="JetBrains Mono, ui-monospace, monospace" fontWeight="800" fontSize="13" letterSpacing="2" fill={u("oh")}>
        {text}
      </text>
    </g>
  );
}

// Wing: feathers drawn on the left, mirrored to the right. Optional gunmetal under-layer.
function Wings({ feathers, spines = [], u, hi, under = true, dx = -3, dy = 5 }) {
  const side = (
    <g>
      {under && hi && (
        <g transform={`translate(${dx} ${dy})`} fill={u("gm")} stroke="rgba(0,0,0,.6)" strokeWidth=".8">
          {feathers.map((d) => <path key={d} d={d} />)}
        </g>
      )}
      <g stroke="#1b0b04" strokeWidth={hi ? 0.9 : 1.3} strokeLinejoin="round">
        {feathers.map((d, i) => <path key={d} d={d} fill={i % 2 ? u("od") : u("o")} />)}
      </g>
      {hi && (
        <g stroke="rgba(255,255,255,.35)" strokeWidth=".7" strokeLinecap="round">
          {spines.map(([x1, y1, x2, y2]) => <path key={`${x1}-${y1}`} d={`M${x1} ${y1} L${r2(x1 + (x2 - x1) * 0.82)} ${r2(y1 + (y2 - y1) * 0.82)}`} />)}
        </g>
      )}
    </g>
  );
  return (
    <g>
      {side}
      <g transform={MIRROR}>{side}</g>
    </g>
  );
}

function Laurel({ u, hi, cy = 70, R = 56 }) {
  const leaves = [];
  const step = hi ? 13 : 22;
  const rx = hi ? 7.5 : 8.5;
  const ry = hi ? 2.8 : 3.6;
  for (let t = 200; t <= 326; t += step) {
    const s = Math.sin(rad(t));
    const c = Math.cos(rad(t));
    const bx = 80 + R * s;
    const by = cy - R * c;
    [1, -1].forEach((side) => {
      const x = bx + s * side * 3.8;
      const y = by - c * side * 3.8;
      leaves.push(
        <ellipse key={`${t}${side}`} cx={r2(x)} cy={r2(y)} rx={rx} ry={ry} transform={`rotate(${r2(t - side * 28)} ${r2(x)} ${r2(y)})`} fill={side > 0 ? u("oh") : u("od")} stroke="rgba(40,10,0,.55)" strokeWidth=".6" />
      );
    });
  }
  const p = (t) => `${r2(80 + R * Math.sin(rad(t)))} ${r2(cy - R * Math.cos(rad(t)))}`;
  const tip = 334;
  const side = (
    <g>
      <path d={`M${p(196)} A${R} ${R} 0 0 1 ${p(330)}`} fill="none" stroke={u("od")} strokeWidth="1.8" strokeLinecap="round" />
      {leaves}
      <ellipse cx={r2(80 + R * Math.sin(rad(tip)))} cy={r2(cy - R * Math.cos(rad(tip)))} rx={rx} ry={ry} transform={`rotate(${tip} ${p(tip)})`} fill={u("oh")} stroke="rgba(40,10,0,.55)" strokeWidth=".6" />
    </g>
  );
  return (
    <g>
      {side}
      <g transform={MIRROR}>{side}</g>
    </g>
  );
}

// Shimmer band swept across the clip silhouette.
function Shimmer({ u }) {
  return (
    <g clipPath={u("clip")} style={{ mixBlendMode: "screen" }}>
      <g transform="skewX(-20)">
        <rect className="pe-shimmer" x="-90" y="-20" width="44" height="190" fill={u("shim")} />
      </g>
    </g>
  );
}

// ---------- tier silhouettes ----------
const HEX = "M80 14 L124 38 L124 98 L80 122 L36 98 L36 38 Z";
const SHIELD1 = "M80 8 L126 22 L120 30 L126 38 L126 74 L80 140 L34 74 L34 38 L40 30 L34 22 Z";
const SHIELD2 = "M80 12 L120 24 L120 68 C120 96 102 116 80 132 C58 116 40 96 40 68 L40 24 Z";
const SHIELD4 = "M80 12 L116 22 L128 40 L120 84 L80 136 L40 84 L32 40 L44 22 Z";
const CROWN = "M56 32 L51 10 L65 20 L72 4 L80 15 L88 4 L95 20 L109 10 L104 32 Z";

const FEATHERS2 = [
  "M44 34 C30 30 14 30 2 38 C14 42 28 46 44 50 Z",
  "M44 48 C30 48 16 52 6 62 C18 64 30 64 44 64 Z",
  "M44 62 C32 66 22 72 14 84 C24 82 34 80 44 76 Z",
  "M44 74 C36 80 30 88 26 98 C34 94 40 90 46 86 Z",
];
const SPINES2 = [[44, 42, 2, 38], [44, 56, 6, 62], [44, 69, 14, 84], [45, 80, 26, 98]];
const SPINES5 = [[50, 48, 0, 30], [50, 60, 2, 52], [50, 71, 6, 76], [51, 81, 14, 98], [54, 90, 28, 112]];
const FEATHERS5 = [
  "M50 42 C34 30 14 26 0 30 C12 38 30 48 50 54 Z",
  "M50 54 C32 46 14 46 2 52 C14 58 30 64 50 66 Z",
  "M50 66 C34 62 18 66 6 76 C20 78 34 78 50 76 Z",
  "M50 76 C36 78 24 86 14 98 C28 94 40 90 52 86 Z",
  "M52 86 C42 90 34 100 28 112 C40 106 48 100 56 94 Z",
];

const CLIPS = {
  0: <path d={HEX} />,
  1: <path d={SHIELD1} />,
  2: <path d={SHIELD2} />,
  3: <circle cx="80" cy="70" r="44" />,
  4: <path d={SHIELD4} />,
  5: (
    <>
      <path d={poly(starPts(80, 72, 47, 40.5, 8, -90))} />
      <path d={CROWN} />
    </>
  ),
};

// Metal body with rim (outer fill), inset gunmetal field, highlight and inner shadow lines.
function Body({ d, u, hi, rim = "o", k = 0.85, cy = 70, engrave = 0.76 }) {
  return (
    <g>
      <path d={d} fill={u(rim)} stroke="rgba(30,8,0,.7)" strokeWidth={hi ? 0.8 : 1.2} strokeLinejoin="round" />
      <path d={d} fill={u("g")} transform={inset(k, 80, cy)} />
      <path d={d} fill="none" stroke="rgba(0,0,0,.65)" strokeWidth="1.6" transform={inset(k, 80, cy)} />
      <path d={d} fill="none" stroke={u("hl")} strokeWidth={hi ? 1.2 : 1.6} />
      {hi && <path d={d} fill="none" stroke="rgba(255,140,60,.38)" strokeWidth=".8" strokeDasharray="5 2.5" transform={inset(engrave, 80, cy)} />}
    </g>
  );
}

function Recruit({ u, hi }) {
  return (
    <g>
      <path d={HEX} fill={u("st")} stroke="rgba(0,0,0,.5)" strokeWidth=".8" strokeLinejoin="round" />
      <path d={HEX} fill={u("g")} transform={inset(0.86, 80, 68)} />
      <path d={HEX} fill="none" stroke="rgba(0,0,0,.6)" strokeWidth="1.4" transform={inset(0.86, 80, 68)} />
      <path d={HEX} fill="none" stroke={u("hl")} strokeWidth="1.2" />
      {hi && <path d={HEX} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth=".8" transform={inset(0.74, 80, 68)} />}
      <path d="M56 54 L80 70 L104 54 L104 66 L80 82 L56 66 Z" fill={u("st")} stroke="rgba(0,0,0,.55)" strokeWidth=".8" strokeLinejoin="round" />
      {hi && <Rivets u={u} pts={[[80, 26], [80, 110]]} />}
    </g>
  );
}

function Tier1({ u, hi }) {
  return (
    <g>
      <Body d={SHIELD1} u={u} hi={hi} k={0.84} cy={70} />
      {hi && (
        <g stroke={u("o")} strokeWidth="1.4" strokeLinecap="round">
          <path d="M37 30 L33 30" />
          <path d="M123 30 L127 30" />
        </g>
      )}
      <path d={sparkle(80, 40, 12, 3)} fill={u("oh")} stroke="rgba(40,10,0,.5)" strokeWidth=".6" />
      <Chevron y={56} w={34} h={22} t={17} u={u} hi={hi} />
      {hi && <Rivets u={u} pts={[[49, 32], [111, 32], [47, 64], [113, 64]]} />}
    </g>
  );
}

function Tier2({ u, hi }) {
  return (
    <g>
      <Wings feathers={FEATHERS2} spines={SPINES2} u={u} hi={hi} />
      <Body d={SHIELD2} u={u} hi={hi} k={0.86} cy={70} />
      {hi && (
        <g fill={u("o")}>
          <rect x="66" y="16.5" width="2" height="4" />
          <rect x="79" y="14.5" width="2" height="4" />
          <rect x="92" y="16.5" width="2" height="4" />
        </g>
      )}
      <FacetStar cx={80} cy={35} R={10} r={4.2} light={u("oh")} dark={u("od")} hi={hi} />
      <Chevron y={50} w={28} h={18} t={13} u={u} hi={hi} />
      <Chevron y={72} w={28} h={18} t={13} u={u} hi={hi} />
      {hi && <Rivets u={u} pts={[[52, 30], [108, 30]]} />}
    </g>
  );
}

function Tier3({ u, hi }) {
  return (
    <g>
      <Laurel u={u} hi={hi} />
      <circle cx="80" cy="70" r="44" fill={u("o")} stroke="rgba(30,8,0,.7)" strokeWidth={hi ? 0.8 : 1.2} />
      <circle cx="80" cy="70" r="38" fill={u("g")} stroke="rgba(0,0,0,.65)" strokeWidth="1.6" />
      <circle cx="80" cy="70" r="44" fill="none" stroke={u("hl")} strokeWidth="1.2" />
      {hi && <path d={ticksPath(80, 70, 48, 33, 35.5)} stroke="rgba(255,140,60,.45)" strokeWidth=".7" />}
      {hi && <circle cx="80" cy="70" r="31.5" fill="none" stroke="rgba(255,140,60,.3)" strokeWidth=".6" />}
      <circle cx="80" cy="71" r="16" fill={u("halo")} className="pe-pulse" />
      <FacetStar cx={80} cy={71} R={32} r={13} light={u("oh")} dark={u("od")} hi={hi} />
      <circle cx="80" cy="71" r={hi ? 4 : 5} fill={u("core")} />
      <FacetStar cx={80} cy={14} R={8} r={3.4} light={u("oh")} dark={u("od")} hi={hi} />
      {hi && <FacetStar cx={63} cy={19} R={5} r={2.1} light={u("oh")} dark={u("od")} hi={hi} />}
      {hi && <FacetStar cx={97} cy={19} R={5} r={2.1} light={u("oh")} dark={u("od")} hi={hi} />}
    </g>
  );
}

function Blade({ rot, u, hi }) {
  return (
    <g transform={`translate(80 72) rotate(${rot})`}>
      <path d="M0 -72 L5.5 -58 L5 40 L-5 40 L-5.5 -58 Z" fill={u("st")} stroke="rgba(0,0,0,.55)" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M0 -72 L5.5 -58 L5 40 L0 40 Z" fill="rgba(0,0,0,.28)" />
      {hi && <path d="M0 -66 L0 38" stroke="rgba(255,255,255,.7)" strokeWidth=".6" />}
      <path d="M-13 40 L13 40 L11 45 L-11 45 Z" fill={u("o")} stroke="rgba(40,10,0,.6)" strokeWidth=".7" />
      <rect x="-2.6" y="45" width="5.2" height="14" fill={u("gm")} />
      <circle cx="0" cy="62" r="3.6" fill={u("o")} stroke="rgba(40,10,0,.6)" strokeWidth=".7" />
    </g>
  );
}

function Tier4({ u, hi }) {
  return (
    <g>
      <path d={raysPath(80, 68, 16, 26, 66, 50, 6)} fill={u("gm")} stroke="#ff6a00" strokeOpacity=".75" strokeWidth=".8" strokeLinejoin="round" />
      {hi && <path d={raysPath(80, 68, 8, 24, 62, 62, 2.6)} fill={u("ray")} />}
      <Blade rot={-40} u={u} hi={hi} />
      <Blade rot={40} u={u} hi={hi} />
      <path d={SHIELD4} fill={u("gm")} stroke="rgba(0,0,0,.7)" strokeWidth={hi ? 0.8 : 1.2} strokeLinejoin="round" />
      <path d={SHIELD4} fill="none" stroke={u("hl")} strokeWidth="1.2" />
      <path d={SHIELD4} fill={u("o")} transform={inset(0.9, 80, 70)} stroke="rgba(30,8,0,.7)" strokeWidth=".8" />
      <path d={SHIELD4} fill={u("g")} transform={inset(0.79, 80, 70)} />
      <path d={SHIELD4} fill="none" stroke="rgba(0,0,0,.65)" strokeWidth="1.6" transform={inset(0.79, 80, 70)} />
      {hi && <path d={SHIELD4} fill="none" stroke="rgba(255,140,60,.4)" strokeWidth=".8" strokeDasharray="5 2.5" transform={inset(0.71, 80, 70)} />}
      {hi && <Rivets u={u} pts={[[80, 15.5], [113, 24.5], [124, 41], [36, 41], [47, 24.5], [117, 83], [43, 83]]} />}
      <circle cx="80" cy="62" r="24" fill={u("halo")} className="pe-pulse" />
      <FacetStar cx={80} cy={62} R={27} r={11} light={u("oh")} dark={u("od")} hi={hi} />
      <circle cx="80" cy="62" r={hi ? 5.5 : 6} fill={u("core")} className="pe-pulse" />
      <g fill="none" stroke={u("o")} strokeWidth={hi ? 3.6 : 4.4} strokeLinejoin="round" strokeLinecap="round">
        <polyline points="62,86 80,96 98,86" />
        {hi && <polyline points="68,95 80,102 92,95" />}
      </g>
    </g>
  );
}

const ORBIT = "M-74 0 A74 21 0 1 0 74 0 A74 21 0 1 0 -74 0";
const ORBIT_FRONT = "M-74 0 A74 21 0 0 0 74 0";

function Comet({ u }) {
  return (
    <g>
      <path d={ORBIT} pathLength="100" fill="none" stroke="#ffaa00" strokeOpacity=".85" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="13 87" strokeDashoffset="70" className="pe-comet" />
      <path d={ORBIT} pathLength="100" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeDasharray="0.6 99.4" strokeDashoffset="57" className="pe-comet-head" />
    </g>
  );
}

function Master({ u, hi, animated }) {
  const bezel = poly(starPts(80, 72, 47, 40.5, 8, -90));
  return (
    <g>
      <g className="pe-spin">
        <path d={raysPath(80, 72, hi ? 24 : 12, 30, 74, 58, hi ? 3.4 : 5)} fill={u("ray")} />
      </g>
      <circle cx="80" cy="72" r="50" fill={u("halo")} opacity=".75" className="pe-pulse" />
      {/* orbit, back half (body covers the middle) */}
      <g transform="translate(80 76) rotate(-14)">
        <path d={ORBIT} fill="none" stroke={u("o")} strokeWidth={hi ? 2 : 2.6} opacity=".85" />
        {animated && <Comet u={u} />}
      </g>
      <Wings feathers={FEATHERS5} spines={SPINES5} u={u} hi={hi} />
      <path d={bezel} fill={u("gm")} stroke="#ff6a00" strokeWidth=".9" strokeLinejoin="round" />
      <path d={bezel} fill="none" stroke={u("hl")} strokeWidth="1" />
      <circle cx="80" cy="72" r="39" fill={u("o")} stroke="rgba(30,8,0,.7)" strokeWidth=".8" />
      <circle cx="80" cy="72" r="33" fill={u("g")} stroke="rgba(0,0,0,.65)" strokeWidth="1.6" />
      {hi && <path d={ticksPath(80, 72, 60, 29, 31.5)} stroke="rgba(255,140,60,.5)" strokeWidth=".7" />}
      <circle cx="80" cy="72" r="28" fill={u("halo")} className="pe-pulse" />
      <circle cx="80" cy="72" r="21" fill={u("core")} />
      {hi && (
        <g fill="none" stroke="rgba(160,30,0,.45)" strokeWidth="1.1">
          <path d="M60 66 C70 62 90 62 100 66" />
          <path d="M59.5 77 C70 81 90 81 100.5 77" />
        </g>
      )}
      <g className="pe-pulse">
        <path d={sparkle(80, 72, 30, 2.2)} fill="#fff" opacity=".9" />
        <circle cx="80" cy="72" r="5" fill="#fff" />
      </g>
      {/* orbit, front half */}
      <g transform="translate(80 76) rotate(-14)">
        <path d={ORBIT_FRONT} fill="none" stroke={u("o")} strokeWidth={hi ? 2.2 : 2.8} />
        {hi && <path d={ORBIT_FRONT} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".6" transform="translate(0 -0.8)" />}
        {animated && (
          <g clipPath={u("front")}>
            <Comet u={u} />
          </g>
        )}
        <circle cx="-52" cy="15" r={hi ? 4 : 5} fill={u("core")} stroke="rgba(40,10,0,.5)" strokeWidth=".5" />
      </g>
      {/* crown */}
      <path d={CROWN} fill={u("o")} stroke="rgba(40,10,0,.7)" strokeWidth=".9" strokeLinejoin="round" />
      {hi && <path d="M58 26 L54 13 M72 8 L76 22 M88 8 L84 22 M106 13 L102 26" stroke="rgba(255,255,255,.45)" strokeWidth=".7" />}
      <path d="M55 27 L105 27 L105 35 L55 35 Z" fill={u("gm")} stroke={u("o")} strokeWidth="1.2" />
      {[[51, 10], [72, 4], [88, 4], [109, 10]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={hi ? 2.8 : 3.4} fill={u("core")} stroke="rgba(40,10,0,.5)" strokeWidth=".5" />
      ))}
      {hi && [66, 80, 94].map((x) => <circle key={x} cx={x} cy="31" r="1.9" fill={u("core")} />)}
      {hi && (
        <g fill="#fff">
          {[[20, 14, 0], [140, 16, 1.1], [10, 128, 2.1], [150, 126, 0.6], [128, 44, 1.6]].map(([x, y, delay]) => (
            <path key={x} d={sparkle(x, y, 5.5, 1.2)} className="pe-twinkle" style={{ animationDelay: `${delay}s` }} />
          ))}
        </g>
      )}
    </g>
  );
}

export default function PrestigeEmblem({ tier = 1, size = 64, locked = false, showNumeral = true, animated = true, className = "" }) {
  const id = `pe${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const u = (k) => `url(#${id}-${k})`;
  const t = Math.max(0, Math.floor(Number(tier) || 0));
  const design = Math.min(5, t);
  const hi = size >= 48;
  const anim = animated && !locked;
  const Design = [Recruit, Tier1, Tier2, Tier3, Tier4, Master][design];

  return (
    <svg viewBox="0 0 160 150" width={size} height={(size * 150) / 160} className={`${className} ${anim ? "pe-anim" : ""}`.trim()} aria-hidden="true" overflow="visible">
      {anim && <style>{CSS}</style>}
      <defs>
        {/* polished orange metal: hot highlight, brand ramp, dark band, rim light */}
        <linearGradient id={`${id}-o`} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor="#ffe3c8" />
          <stop offset=".14" stopColor="#ffaa00" />
          <stop offset=".42" stopColor="#ff6a00" />
          <stop offset=".68" stopColor="#ff3c00" />
          <stop offset=".86" stopColor="#7e1c00" />
          <stop offset="1" stopColor="#ff6a00" />
        </linearGradient>
        <linearGradient id={`${id}-oh`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe0c2" />
          <stop offset=".35" stopColor="#ffaa00" />
          <stop offset="1" stopColor="#ff6a00" />
        </linearGradient>
        <linearGradient id={`${id}-od`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff6a00" />
          <stop offset=".55" stopColor="#ff3c00" />
          <stop offset="1" stopColor="#6e1700" />
        </linearGradient>
        <radialGradient id={`${id}-g`} cx=".5" cy=".28" r=".85">
          <stop offset="0" stopColor="#45403c" />
          <stop offset=".5" stopColor="#222121" />
          <stop offset="1" stopColor="#0b0b0c" />
        </radialGradient>
        <linearGradient id={`${id}-gm`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#70757c" />
          <stop offset=".3" stopColor="#3a3d42" />
          <stop offset=".65" stopColor="#1c1e21" />
          <stop offset="1" stopColor="#4b4f55" />
        </linearGradient>
        <linearGradient id={`${id}-st`} x1="0" y1="0" x2=".3" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".25" stopColor="#d6dade" />
          <stop offset=".55" stopColor="#868d95" />
          <stop offset=".8" stopColor="#454a50" />
          <stop offset="1" stopColor="#b9bec4" />
        </linearGradient>
        <linearGradient id={`${id}-hl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset=".4" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-rv`} cx=".35" cy=".3" r=".75">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".35" stopColor="#c9ccd0" />
          <stop offset="1" stopColor="#33363a" />
        </radialGradient>
        <radialGradient id={`${id}-core`} cx=".4" cy=".36" r=".7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".2" stopColor="#fff1e2" />
          <stop offset=".45" stopColor="#ffaa00" />
          <stop offset=".7" stopColor="#ff6a00" />
          <stop offset=".88" stopColor="#ff3c00" />
          <stop offset="1" stopColor="#5a1300" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="#ffaa00" stopOpacity=".95" />
          <stop offset=".45" stopColor="#ff6a00" stopOpacity=".45" />
          <stop offset="1" stopColor="#ff3c00" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-ray`} gradientUnits="userSpaceOnUse" cx="80" cy="70" r="76">
          <stop offset=".3" stopColor="#ffaa00" stopOpacity=".95" />
          <stop offset=".65" stopColor="#ff6a00" stopOpacity=".55" />
          <stop offset="1" stopColor="#ff3c00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-shim`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>{CLIPS[design]}</clipPath>
        <clipPath id={`${id}-front`}>
          <rect x="-90" y="0" width="180" height="40" />
        </clipPath>
        <filter id={`${id}-ds`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#000" floodOpacity=".45" />
        </filter>
        <filter id={`${id}-gray`}>
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      <g filter={locked ? u("gray") : hi ? u("ds") : undefined} opacity={locked ? 0.45 : 1}>
        <Design u={u} hi={hi} animated={anim} />
        {showNumeral && t > 0 && <Plate u={u} text={ROMAN[t] || t} hi={hi} master={design === 5} />}
      </g>
      {anim && <Shimmer u={u} />}
    </svg>
  );
}
