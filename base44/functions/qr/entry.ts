import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Public redirect for dynamic QR codes (Møthership Studio / QR Codes).
//   GET https://m-thership.base44.app/functions/qr?c=<short_code>
// Looks the code up, logs one anonymous scan (time, device class, OS family, referrer host, country header;
// never the IP or full user agent) and 302s to the code's destination. Only http(s) destinations are ever
// redirected to; anything else, unknown codes and paused codes get a small branded page instead.

const CODE_RE = /^[A-Za-z0-9]{4,32}$/;
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|skype|curl|wget|python|httpclient|headless|lighthouse|monitor/i;

function safeDestination(raw: unknown): string | null {
  const s = String(raw || "").trim();
  if (!s || s.length > 2000) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password || !u.hostname) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function classify(ua: string) {
  const device = /ipad|tablet|kindle|silk|playbook/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))
    ? "tablet"
    : /mobi|iphone|ipod|android|windows phone/i.test(ua) ? "mobile"
    : /windows|macintosh|x11|linux|cros/i.test(ua) ? "desktop" : "other";
  const os = /iphone|ipad|ipod|ios/i.test(ua) ? "iOS"
    : /android/i.test(ua) ? "Android"
    : /windows/i.test(ua) ? "Windows"
    : /mac os|macintosh/i.test(ua) ? "macOS"
    : /cros/i.test(ua) ? "ChromeOS"
    : /linux/i.test(ua) ? "Linux" : "Other";
  return { device, os };
}

const refHost = (r: string | null) => {
  try {
    return r ? new URL(r).hostname.slice(0, 120) : "";
  } catch {
    return "";
  }
};

function page(title: string, message: string, status: number) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0d14;color:#f5f3f0;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;padding:24px}
.c{max-width:420px;text-align:center}.r{width:84px;height:84px;margin:0 auto 22px;border-radius:50%;border:3px solid #ff3c00;box-shadow:0 0 0 8px rgba(255,106,0,.18),0 0 40px rgba(255,106,0,.45)}
h1{font-size:24px;letter-spacing:-.03em;margin:0 0 8px}p{color:rgba(245,243,240,.7);font-size:15px;line-height:1.5;margin:0}.b{display:block;height:3px;width:120px;margin:22px auto 0;background:linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00)}</style></head>
<body><div class="c"><div class="r"></div><h1>${title}</h1><p>${message}</p><span class="b"></span></div></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    const url = new URL(req.url);
    const last = url.pathname.split("/").filter(Boolean).pop() || "";
    const code = (url.searchParams.get("c") || url.searchParams.get("code") || (last !== "qr" ? last : "")).trim();
    if (!CODE_RE.test(code)) return page("Lost in space", "This QR link isn't valid. Check the code and try again.", 404);

    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const found = await db.QrCode.filter({ short_code: code }, "-created_date", 1).catch(() => []);
    const qr = (found || [])[0] as Record<string, unknown> | undefined;
    if (!qr || qr.mode !== "dynamic") return page("Lost in space", "We couldn't find this QR code. It may have been removed.", 404);
    if (qr.active === false) return page("Paused", "This QR code is paused right now. Please check back soon.", 410);
    const dest = safeDestination(qr.destination);
    if (!dest) return page("Almost ready", "This QR code doesn't have a destination yet.", 404);

    // The platform proxy replaces user-agent with "Base44-Backend" and forwards the visitor's in x-base44-caller-user-agent.
    const ua = req.headers.get("x-base44-caller-user-agent") || req.headers.get("user-agent") || "";
    const prefetch = /prefetch|prerender/i.test(`${req.headers.get("purpose") || ""} ${req.headers.get("sec-purpose") || ""}`);
    if (req.method === "GET" && !prefetch && !BOT_RE.test(ua)) {
      const { device, os } = classify(ua);
      const at = new Date().toISOString();
      const country = (req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || req.headers.get("x-country-code") || "").toUpperCase();
      const log = Promise.all([
        db.QrScan.create({
          qr_id: qr.id, short_code: code, client_id: qr.client_id || "", at, device, os,
          referrer_host: refHost(req.headers.get("referer")),
          ...(/^[A-Z]{2}$/.test(country) ? { country } : {}),
        }),
        db.QrCode.update(qr.id as string, { scans: (Number(qr.scans) || 0) + 1, last_scan_at: at }),
      ]).catch(() => null);
      // Never hold the visitor for long: log within ~1.5s or redirect anyway.
      await Promise.race([log, new Promise((r) => setTimeout(r, 1500))]);
    }

    return new Response(null, { status: 302, headers: { Location: dest, "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" } });
  } catch {
    return page("Lost in space", "Something went wrong opening this QR code. Please try again.", 500);
  }
});
