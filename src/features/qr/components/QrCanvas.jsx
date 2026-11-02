import { useEffect, useRef, useState } from "react";
import { drawCanvas } from "../lib/render";
import { buildLayout } from "../lib/draw";

// Loads a logo for the live preview. Tries CORS first (keeps the canvas exportable), then plain.
export function useLogoImage(url) {
  const [img, setImg] = useState(null);
  useEffect(() => {
    if (!url) {
      setImg(null);
      return undefined;
    }
    let alive = true;
    const load = (cors) => {
      const i = new Image();
      if (cors) i.crossOrigin = "anonymous";
      i.onload = () => alive && setImg(i);
      i.onerror = () => {
        if (cors) load(false);
        else if (alive) setImg(null);
      };
      i.src = url;
    };
    load(!url.startsWith("data:"));
    return () => {
      alive = false;
    };
  }, [url]);
  return img;
}

// Live QR preview. Redraws synchronously on every style/content change, so edits feel instant.
export default function QrCanvas({ value, style, pixelWidth = 720, className = "", showError = true }) {
  const ref = useRef(null);
  const logo = useLogoImage(style?.logo_url);
  const [err, setErr] = useState("");

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const text = String(value || "").trim();
    if (!text) {
      c.width = pixelWidth;
      c.height = pixelWidth;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#f5f3f0";
      ctx.fillRect(0, 0, pixelWidth, pixelWidth);
      ctx.strokeStyle = "rgba(26,26,26,0.18)";
      ctx.setLineDash([pixelWidth / 60, pixelWidth / 60]);
      ctx.lineWidth = pixelWidth / 240;
      ctx.strokeRect(pixelWidth * 0.12, pixelWidth * 0.12, pixelWidth * 0.76, pixelWidth * 0.76);
      setErr("");
      return;
    }
    try {
      drawCanvas(c, buildLayout(text, style), { pixelWidth, logoImg: logo });
      setErr("");
    } catch (e) {
      setErr(e.message || "Couldn't draw this code.");
    }
  }, [value, style, logo, pixelWidth]);

  return (
    <div className={className}>
      <canvas ref={ref} className="block h-auto w-full" />
      {showError && err && <p className="mt-2 text-center text-[12px] text-red-700">{err}</p>}
    </div>
  );
}
