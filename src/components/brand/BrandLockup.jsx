import "./brand.css";

// Interstellar 3D mark (frosted orange swoosh) — same asset as interstellar-strategies.com.
const MARK_URL = "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/536102fbf_interstellar-mark-v2.webp";

/* Wordmark: ink headline type with the ignition-orange ™ mark (matches the website header). */
export function BrandWordmark({ word = "INTERSTELLAR", tone = "light", size, className = "" }) {
  return (
    <span className={`is-wordmark${tone === "dark" ? " is-wordmark--dark" : ""} ${className}`} style={size ? { fontSize: size } : undefined}>
      {word}
      <span className="is-reg">™</span>
    </span>
  );
}

/* Mark + wordmark lockup, with an optional small subtext line under the wordmark.
   size = wordmark font size in px; the mark scales with it (website: 21px text, 28x36 mark). */
export default function BrandLockup({ word = "INTERSTELLAR", sub, tone = "light", size = 21, className = "" }) {
  return (
    <span className={`is-lockup ${className}`}>
      <img
        src={MARK_URL}
        alt=""
        aria-hidden="true"
        draggable="false"
        decoding="async"
        className="is-lockup__mark"
        style={{ height: Math.round(size * 1.34), width: Math.round(size * 1.72) }}
      />
      <span className="is-lockup__text">
        <BrandWordmark word={word} tone={tone} size={size} />
        {sub ? <span className={`is-sub${tone === "dark" ? " is-sub--dark" : ""}`}>{sub}</span> : null}
      </span>
    </span>
  );
}
