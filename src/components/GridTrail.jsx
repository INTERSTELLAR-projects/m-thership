import { useEffect, useRef } from "react";

// Same hover trail as interstellar-strategies.com: 50px cells light up behind the cursor and fade.
const TRAIL = ["255,60,0", "255,106,0", "255,170,0"];

export default function GridTrail() {
  const ref = useRef(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const cv = ref.current;
    const ctx = cv.getContext("2d");
    const CELL = 50, FADE = 5, START = 150;
    let w = 0, h = 0, rows = 0, cols = 0, row = -2, col = -2, cells = [], raf = 0, running = false;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rows = Math.ceil(h / CELL) + 1; cols = Math.ceil(w / CELL);
    };
    // Only trail over empty canvas, never over cards, inputs or controls.
    const blocked = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return !el || !el.closest("[data-trail]") || !!el.closest("[data-no-trail], a, button, input, textarea, select, label, aside, [role=dialog], .bg-card, .game-panel");
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const c of cells) {
        c.o = Math.max(0, c.o - FADE);
        const a = c.o / 255;
        ctx.fillStyle = `rgba(${c.k},${a * 0.07})`;
        ctx.fillRect(c.c * CELL, c.r * CELL, CELL, CELL);
        ctx.strokeStyle = `rgba(${c.k},${a * 0.8})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(c.c * CELL + 0.5, c.r * CELL + 0.5, CELL - 1, CELL - 1);
      }
      cells = cells.filter((c) => c.o > 0);
      if (cells.length) raf = requestAnimationFrame(draw);
      else { running = false; ctx.clearRect(0, 0, w, h); }
    };
    const move = (e) => {
      const r = Math.floor(e.clientY / CELL), c = Math.floor(e.clientX / CELL);
      if (r === row && c === col) return;
      row = r; col = c;
      if (blocked(e.clientX, e.clientY)) return;
      cells.push({ r, c, o: START, k: TRAIL[0] });
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        const rr = r + dr, cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < rows && cc >= 0 && cc < cols && Math.random() < 0.35)
          cells.push({ r: rr, c: cc, o: START * 0.7, k: TRAIL[(Math.random() * TRAIL.length) | 0] });
      }
      if (!running) { running = true; raf = requestAnimationFrame(draw); }
    };
    size();
    window.addEventListener("resize", size);
    window.addEventListener("pointermove", move, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size); window.removeEventListener("pointermove", move); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" />;
}
