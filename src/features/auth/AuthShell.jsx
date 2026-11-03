import "./auth.css";
import BrandLockup from "@/components/brand/BrandLockup";

// Fixed star positions (no random on render, so the layout never jumps).
const STARS = [
  [8, 12, 0], [22, 30, 1.2], [14, 58, 2.1], [35, 18, 0.6], [48, 9, 3.1], [62, 26, 1.7], [41, 44, 2.6], [9, 78, 0.9],
  [28, 70, 3.4], [55, 62, 1.1], [70, 12, 2.4], [83, 34, 0.3], [91, 58, 1.9], [76, 80, 2.9], [60, 88, 0.7], [18, 92, 1.5],
];

function Orbits() {
  return (
    <div className="ms-orbits" aria-hidden="true">
      <div className="ms-ring" />
      <div className="ms-ring ms-ring--2" />
      <div className="ms-ring ms-ring--3" />
      <div className="ms-spin"><span className="ms-sat" /></div>
      <div className="ms-spin ms-spin--2"><span className="ms-sat ms-sat--sm" /></div>
      <div className="ms-spin ms-spin--3"><span className="ms-sat ms-sat--w" /></div>
      <div className="ms-core" />
    </div>
  );
}

const VALUES = [
  ["01", "Every blog, Google post and site fix we ship, the moment it goes live."],
  ["02", "Results, reviews and requests in one place, on any device."],
  ["03", "A direct line to Justin and Nøva, our assistant."],
];

// Full-page sign-in layout: dark grainy brand panel (left, or a header on phones) + light canvas with the form.
export default function AuthShell({ eyebrow, children, footer }) {
  return (
    <div className="ms-auth">
      <aside className="ms-brand ms-grain">
        <div className="ms-glow" />
        <Orbits />
        {STARS.map(([x, y, d], i) => (
          <span key={i} className="ms-star" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} aria-hidden="true" />
        ))}

        <div className="ms-layer flex items-center justify-between gap-4">
          <BrandLockup word="MØTHERSHIP" sub="by Interstellar" tone="dark" size={22} />
          <span className="mono-label hidden text-[10px] text-white/45 sm:inline">Client portal</span>
        </div>

        <div className="ms-layer mt-8 max-w-[560px] lg:mt-0">
          <p className="mono-label text-[10.5px] text-white/55"><span className="text-[#ff3c00]">+</span>&nbsp; The Future of Business</p>
          <h1 className="mt-4 text-[32px] font-semibold leading-[1.02] tracking-[-0.05em] text-[#f2f2f0] sm:text-[40px] lg:text-[64px]">
            Your business, <span className="ms-flame-text whitespace-nowrap">/in orbit</span>
          </h1>
          <ul className="mt-8 hidden space-y-4 lg:block">
            {VALUES.map(([n, t]) => (
              <li key={n} className="flex items-start gap-4">
                <span className="mt-[3px] font-mono text-[11px] font-medium tracking-[0.14em] text-[#ff6a00]">{n}</span>
                <span className="text-[15px] leading-[1.5] text-white/70">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ms-layer hidden items-center justify-between lg:flex">
          <span className="mono-label text-[10px] text-white/40">Interstellar Strategies</span>
          <span className="mono-label text-[10px] text-white/40">Secure sign-in</span>
        </div>
      </aside>

      <main className="ms-canvas">
        <div className="flex items-center justify-between">
          <span className="mono-label text-[10.5px] text-ink/50">{eyebrow}</span>
          <a href="mailto:justin@interstellar-strategies.com" className="text-[12.5px] text-ink/55 hover:text-[#ff3c00]">Need help?</a>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-ink/45">
          <span>© {new Date().getFullYear()} Interstellar Strategies</span>
          {footer || <span className="font-mono tracking-[0.08em]">MØTHERSHIP®</span>}
        </div>
      </main>
    </div>
  );
}
