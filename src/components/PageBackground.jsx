import { useEffect, useRef } from "react";

export default function PageBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animFrame;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const GRID = 52;
    let t = 0;

    // Scan line positions (horizontal pulses)
    const scanLines = Array.from({ length: 3 }, (_, i) => ({
      y: Math.random(),
      speed: 0.00018 + i * 0.00008,
      opacity: 0.06 + Math.random() * 0.06,
      width: 80 + Math.random() * 120,
    }));

    // Glowing nodes at grid intersections (sparse, randomized)
    const nodes = [];
    for (let x = GRID; x < 2000; x += GRID) {
      for (let y = GRID; y < 2000; y += GRID) {
        if (Math.random() < 0.07) {
          nodes.push({
            gx: x, gy: y,
            phase: Math.random() * Math.PI * 2,
            speed: 0.008 + Math.random() * 0.012,
            maxOpacity: 0.18 + Math.random() * 0.25,
          });
        }
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Subtle grid lines
      ctx.strokeStyle = "rgba(255,106,0,0.028)";
      ctx.lineWidth = 1;
      for (let x = GRID; x < canvas.width; x += GRID) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = GRID; y < canvas.height; y += GRID) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Glowing nodes
      nodes.forEach((n) => {
        if (n.gx > canvas.width || n.gy > canvas.height) return;
        const pulse = (Math.sin(t * n.speed + n.phase) + 1) / 2;
        const op = pulse * n.maxOpacity;
        ctx.beginPath();
        ctx.arc(n.gx, n.gy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,130,0,${op})`;
        ctx.fill();

        // Small halo
        const grd = ctx.createRadialGradient(n.gx, n.gy, 0, n.gx, n.gy, 10);
        grd.addColorStop(0, `rgba(255,106,0,${op * 0.5})`);
        grd.addColorStop(1, `rgba(255,106,0,0)`);
        ctx.beginPath();
        ctx.arc(n.gx, n.gy, 10, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });

      // Horizontal scan lines drifting down
      scanLines.forEach((s) => {
        s.y += s.speed;
        if (s.y > 1.05) s.y = -0.05;
        const cy = s.y * canvas.height;
        const grd = ctx.createLinearGradient(0, cy - s.width, 0, cy + s.width);
        grd.addColorStop(0, `rgba(255,106,0,0)`);
        grd.addColorStop(0.5, `rgba(255,106,0,${s.opacity})`);
        grd.addColorStop(1, `rgba(255,106,0,0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, cy - s.width, canvas.width, s.width * 2);
      });

      // Corner vignette accent (top-right orange glow)
      const corner = ctx.createRadialGradient(
        canvas.width, 0, 0,
        canvas.width, 0, canvas.width * 0.55
      );
      corner.addColorStop(0, `rgba(255,90,0,${0.04 + Math.sin(t * 0.005) * 0.01})`);
      corner.addColorStop(1, "rgba(255,90,0,0)");
      ctx.fillStyle = corner;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      t++;
      animFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(animFrame); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}