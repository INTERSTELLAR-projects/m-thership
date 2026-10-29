import React from "react";

const PARTICLES = Array.from({ length: 46 }, (_, i) => {
  const angle = (i * 137.508) % 360;
  const radius = 40 + ((i * 53) % 72);
  const rad = (angle * Math.PI) / 180;
  return {
    x: 120 + Math.cos(rad) * radius,
    y: 120 + Math.sin(rad) * radius * 0.92,
    r: (i % 3) * 0.4 + 1,
    delay: (i % 12) * 0.42,
    warm: i % 4 === 0
  };
});

const SCANS = [
  { cy: 70, rx: 38 },
  { cy: 88, rx: 44 },
  { cy: 108, rx: 42 },
  { cy: 128, rx: 34 }
];

const BUST_PATH =
  "M120 40 C98 40 82 56 82 80 C82 102 94 118 104 128 L104 150 C72 160 56 186 50 220 C50 224 54 228 60 228 L180 228 C186 228 190 224 190 220 C184 186 168 160 136 150 L136 128 C146 118 158 102 158 80 C158 56 142 40 120 40 Z";

const READOUT = {
  idle: { word: "STANDBY", percent: 8 },
  listening: { word: "LISTENING", percent: 38 },
  processing: { word: "ASSEMBLING", percent: 84 },
  speaking: { word: "RESPONDING", percent: 100 }
};

// Holographic bust drawn on the ink dock panel, flame-toned.
export default function AssistantCore({ state = "idle", size = 176 }) {
  const hot = state === "listening";
  const busy = state === "processing";
  const talking = state === "speaking";
  const readout = READOUT[state] || READOUT.idle;
  const lineColor = hot ? "#ffaa00" : "#ff6a00";

  return (
    <div className="relative flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 240 260" width={size} height={size * 1.08} className="overflow-visible">
        <defs>
          <radialGradient id="tkBustCore" cx="50%" cy="44%" r="50%">
            <stop offset="0%" stopColor="#FFE4C0" />
            <stop offset="40%" stopColor="#FF6A00" />
            <stop offset="100%" stopColor="#FF3C00" stopOpacity="0.08" />
          </radialGradient>
          <filter id="tkBustBlur" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        <circle
          cx="120"
          cy="132"
          r="108"
          fill="none"
          stroke="#ff3c00"
          strokeOpacity={hot ? 0.5 : 0.18}
          strokeWidth="0.7"
          strokeDasharray="2 10"
          className="tk-spin-slow"
          style={{ transformOrigin: "120px 132px" }}
        />

        {[1, 0.93, 0.86, 0.78].map((scale, index) => (
          <path
            key={scale}
            d={BUST_PATH}
            fill="none"
            stroke={lineColor}
            strokeOpacity={hot ? 0.75 - index * 0.14 : 0.45 - index * 0.1}
            strokeWidth="0.85"
            transform={"translate(120 132) scale(" + scale + ") translate(-120 -132)"}
          />
        ))}

        <g stroke={lineColor} strokeWidth="0.7" fill="none" strokeOpacity={hot ? 0.7 : 0.4}>
          {SCANS.map((scan) => (
            <ellipse key={scan.cy} cx="120" cy={scan.cy} rx={scan.rx} ry="4.5" className="tk-dash-flow" />
          ))}
        </g>

        {PARTICLES.map((particle, index) => (
          <circle
            key={index}
            cx={particle.x}
            cy={particle.y}
            r={particle.r}
            fill={particle.warm ? "#ff3c00" : "#f5f3f0"}
            className="tk-breathe"
            style={{ animationDelay: particle.delay + "s" }}
          />
        ))}

        <circle
          cx="120"
          cy="96"
          r={hot ? 30 : talking ? 24 : busy ? 20 : 16}
          fill="url(#tkBustCore)"
          filter="url(#tkBustBlur)"
          opacity="0.88"
          style={{ transition: "r 600ms cubic-bezier(0.22,1,0.36,1)" }}
        />
        <circle cx="120" cy="96" r="4.5" fill="#FFF3E0">
          <animate attributeName="opacity" values="1;0.5;1" dur={busy ? "0.9s" : "3.4s"} repeatCount="indefinite" />
        </circle>
      </svg>

      <div className="mt-1 w-full max-w-[180px]">
        <div className="mono-label flex items-center justify-between text-[8.5px] text-[#f5f3f0]/60">
          <span>{readout.word}</span>
          <span className="text-[#ffaa00]">{readout.percent}%</span>
        </div>
        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[#f5f3f0]/10">
          <div className="flame-bg h-full transition-all duration-700" style={{ width: readout.percent + "%" }} />
        </div>
      </div>
    </div>
  );
}
