// @ts-nocheck
// Portfolio helpers (server): public-safe item shape, matching items to a lead's industry, og:image lookup,
// auto-add on launch, and the public server-rendered gallery (/functions/portfolio).
import { seedTemplates } from "./leadEngine.js";

export const BUILT_LABEL: Record<string, string> = { website: "Website", command_system: "Command System", seo_map_pack: "SEO & map pack", automations: "Automations" };
const FAMILY: Record<string, string> = Object.fromEntries(seedTemplates().map((t) => [t.industry_key, t.family]));
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const safeUrl = (u: unknown) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "")) ? String(u) : "");
export const slugify = (s: string) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

// Public facts only. Results only when verified. Client name only when show_client_name.
export function safeItem(i: any) {
  const name = i.show_client_name === false ? `${i.industry || "Local business"} website` : i.client_name;
  return {
    id: i.id, slug: i.slug || slugify(i.client_name || i.domain), name, industry: i.industry || "", industry_key: i.industry_key || "",
    url: safeUrl(i.url), domain: i.domain || "", launched_at: i.launched_at || null, description: i.description || "", objective: i.objective || "",
    built: (i.built || []).filter((b: string) => BUILT_LABEL[b]), highlights: (i.highlights || []).filter(Boolean).slice(0, 4),
    results: (i.results || []).filter((r: any) => r && r.text && r.verified_by).map((r: any) => ({ text: r.text, source: r.source || "" })),
    image_desktop: safeUrl(i.image_desktop), image_phone: safeUrl(i.image_phone), og_image: safeUrl(i.og_image),
  };
}

// 2-3 published items most relevant to a lead: same industry first, then same family, then newest.
export function relevantFor(items: any[], industryKey: string, n = 3) {
  const fam = FAMILY[industryKey];
  const score = (i: any) => (i.industry_key === industryKey ? 0 : FAMILY[i.industry_key] === fam ? 1 : 2);
  return [...items].sort((a, b) => score(a) - score(b) || String(b.launched_at || "").localeCompare(String(a.launched_at || ""))).slice(0, n);
}

// og:image from the live homepage (public HTML only, 6s timeout, https only).
export async function fetchOgImage(url: string) {
  if (!/^https:\/\//i.test(url)) return "";
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; PortfolioCheck/1.0)", accept: "text/html" } });
    const html = (await res.text()).slice(0, 300000);
    const m = html.match(/<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["']/i);
    if (!m) return "";
    const abs = new URL(m[1], res.url || url).toString();
    return /^https:\/\//i.test(abs) ? abs : "";
  } catch { return ""; } finally { clearTimeout(t); }
}

// A site launched (own domain verified): create its draft portfolio card once. Never publishes.
export async function addLaunched(db: any, client: any, opts: { url?: string; launched_at?: string; source?: string } = {}) {
  if (!client) return { created: false, reason: "no client" };
  const domain = String(client.website_domain || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!client.website_live_at && !opts.url) return { created: false, reason: "not live" };
  const existing = ((await db.PortfolioItem.filter({ client_id: client.id }, "-created_date", 5).catch(() => [])) || []) as any[];
  if (existing.length) return { created: false, reason: "exists", id: existing[0].id };
  const url = opts.url || (domain ? `https://${domain}` : "");
  if (!url) return { created: false, reason: "no domain" };
  const built = ["website", ...(client.command_app_id ? ["command_system"] : []), ...((client.services_managed || []).includes("orbit_seo") ? ["seo_map_pack"] : [])];
  const og = await fetchOgImage(url).catch(() => "");
  const row = await db.PortfolioItem.create({
    client_id: client.id, client_name: client.business, show_client_name: true, slug: slugify(client.business), industry: String(client.industry || "").split("·").pop()?.trim() || "",
    industry_key: client.industry_key || "", domain: url.replace(/^https?:\/\//, "").replace(/\/$/, ""), url, launched_at: opts.launched_at || client.website_live_at || new Date().toISOString(),
    description: "", objective: "", built, highlights: [], results: [], og_image: og, og_checked_at: new Date().toISOString(), status: "draft", source: opts.source || "auto", sort: 100,
  });
  await db.AgentAuditLog.create({ at: new Date().toISOString(), ok: true, actor: "automation:portfolio", action: "portfolio_draft", entity: "PortfolioItem", record_id: row.id, summary: `${client.business}: portfolio card drafted on launch (${url}). Publish it in Portfolio.` }).catch(() => null);
  return { created: true, id: row.id };
}

/* ---------------- public server-rendered gallery ---------------- */

const BASE_CSS = `*{box-sizing:border-box}html,body{margin:0;overflow-x:clip}body{background:#ebe8e4;color:#1a1a1a;font-family:Geist,Inter,system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
body:before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(26,26,26,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(26,26,26,.05) 1px,transparent 1px);background-size:56px 56px;z-index:0}
a{color:inherit}.wrap{position:relative;z-index:1;max-width:1240px;margin:0 auto;padding:0 20px}
.bar{height:4px;background:linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00)}
header{padding:28px 0 8px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.lock{font:700 13px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.18em}.lock sup{color:#ff3c00;font-size:9px}
.k{font:500 11px "JetBrains Mono",ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:rgba(26,26,26,.55)}.k b{color:#ff3c00}
h1{font-size:clamp(40px,7vw,84px);line-height:.95;letter-spacing:-.045em;margin:24px 0 14px;font-weight:600;text-wrap:balance}h1 span{background:linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00);-webkit-background-clip:text;background-clip:text;color:transparent}
.lede{max-width:620px;font-size:17px;line-height:1.55;color:rgba(26,26,26,.65)}
.filters{display:flex;flex-wrap:wrap;gap:6px;margin:30px 0 18px}.filters button{font:500 12.5px Geist,Inter,sans-serif;border:1px solid #cfccc7;background:#f5f3f0;padding:8px 12px;cursor:pointer}.filters button[aria-pressed=true]{background:#1a1a1a;color:#fff;border-color:#1a1a1a}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));padding-bottom:80px}
.card{display:block;text-decoration:none;background:#f5f3f0;border:1px solid #cfccc7;transition:transform .35s cubic-bezier(.22,1,.36,1),border-color .25s,box-shadow .35s;opacity:0;transform:translateY(18px)}
.card.in{opacity:1;transform:none}.card:hover{transform:translateY(-3px);border-color:rgba(255,60,0,.5);box-shadow:0 22px 40px -28px rgba(26,26,26,.55)}
.shot{aspect-ratio:16/10;overflow:hidden;background:#1a1a1a;position:relative}.shot img{width:100%;height:100%;object-fit:cover;object-position:top;display:block;transition:transform .8s cubic-bezier(.22,1,.36,1)}.card:hover .shot img{transform:scale(1.03)}
.ph{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font:500 11px "JetBrains Mono",monospace;letter-spacing:.16em;text-transform:uppercase;background:linear-gradient(135deg,#1a1a1a,#3a1a10)}
.meta{padding:16px}.meta h2{margin:0;font-size:20px;letter-spacing:-.03em}.meta p{margin:6px 0 0;font-size:13.5px;color:rgba(26,26,26,.6)}
.tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}.tags span{font:500 10px "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;background:rgba(26,26,26,.06);padding:3px 6px}
.cs{display:grid;gap:28px;padding-bottom:80px}.cs .imgs{display:grid;gap:14px;grid-template-columns:1fr}.cs .imgs img{width:100%;border:1px solid #cfccc7;display:block}
.sec h3{font:500 11px "JetBrains Mono",monospace;letter-spacing:.16em;text-transform:uppercase;color:#ff3c00;margin:0 0 8px}.sec p,.sec li{font-size:16px;line-height:1.6}
.btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(90deg,#ff3c00,#ff6a00);color:#fff;padding:13px 20px;text-decoration:none;font-weight:600;font-size:14px}.btn:focus-visible,.filters button:focus-visible,.card:focus-visible{outline:2px solid #1a1a1a;outline-offset:2px}
footer{position:relative;z-index:1;border-top:1px solid #cfccc7;padding:22px 0 40px;font:500 11px "JetBrains Mono",monospace;letter-spacing:.14em;color:rgba(26,26,26,.5)}
@media (min-width:860px){.cs{grid-template-columns:1.3fr 1fr}.cs .imgs{grid-template-columns:3fr 1fr;align-items:start}}
@media (prefers-reduced-motion:reduce){.card{opacity:1;transform:none;transition:none}.shot img{transition:none}}`;

function shell(title: string, body: string, noindex: boolean) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${noindex ? '<meta name="robots" content="noindex">' : ""}<title>${esc(title)}</title><meta name="description" content="Websites and Command Systems built by Interstellar Strategies for local businesses."><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"><style>${BASE_CSS}</style></head><body><div class="bar"></div><div class="wrap"><header><a href="?" class="lock" style="text-decoration:none">INTERSTELLAR<sup>&trade;</sup></a><span class="k"><b>+</b> The Future of Business</span></header>${body}</div><footer><div class="wrap">INTERSTELLAR&trade; STRATEGIES &middot; <a href="https://interstellar-strategies.com">interstellar-strategies.com</a></div></footer>
<script>(function(){var c=[].slice.call(document.querySelectorAll('.card'));if(!('IntersectionObserver' in window)){c.forEach(function(x){x.classList.add('in')});}else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1});c.forEach(function(x,i){x.style.transitionDelay=(i%6)*60+'ms';io.observe(x)});setTimeout(function(){c.forEach(function(x){x.classList.add('in')})},2500);}
var fb=[].slice.call(document.querySelectorAll('.filters button'));fb.forEach(function(b){b.addEventListener('click',function(){var g=b.getAttribute('data-group'),v=b.getAttribute('data-v');fb.filter(function(x){return x.getAttribute('data-group')===g}).forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});var on={};fb.forEach(function(x){if(x.getAttribute('aria-pressed')==='true')on[x.getAttribute('data-group')]=x.getAttribute('data-v')});c.forEach(function(card){var okI=!on.i||on.i==='all'||card.getAttribute('data-i')===on.i;var okB=!on.b||on.b==='all'||(' '+card.getAttribute('data-b')+' ').indexOf(' '+on.b+' ')>=0;card.style.display=okI&&okB?'':'none'})})})})();</script></body></html>`;
}

export function galleryHtml(items: any[], noindex: boolean) {
  const inds = [...new Set(items.map((i) => i.industry).filter(Boolean))].sort();
  const builts = [...new Set(items.flatMap((i) => i.built))];
  const img = (i: any) => i.image_desktop || i.og_image;
  const cards = items.map((i) => `<a class="card" href="?item=${encodeURIComponent(i.slug)}" data-i="${esc(i.industry)}" data-b="${esc(i.built.join(" "))}"><div class="shot">${img(i) ? `<img src="${esc(img(i))}" alt="${esc(i.name)} website" loading="lazy">` : `<div class="ph">${esc(i.domain)}</div>`}</div><div class="meta"><span class="k">${esc(i.industry || "Local business")}</span><h2>${esc(i.name)}</h2>${i.description ? `<p>${esc(i.description)}</p>` : ""}<div class="tags">${i.built.map((b: string) => `<span>${esc(BUILT_LABEL[b])}</span>`).join("")}</div></div></a>`).join("");
  const f = (g: string, list: string[], label: (x: string) => string) => list.length > 1 ? `<button type="button" data-group="${g}" data-v="all" aria-pressed="true">All</button>${list.map((x) => `<button type="button" data-group="${g}" data-v="${esc(x)}" aria-pressed="false">${esc(label(x))}</button>`).join("")}` : "";
  const body = `<p class="k" style="margin-top:28px"><b>+</b> Our work</p><h1>Built by <span>Interstellar</span>.</h1><p class="lede">Websites and the systems behind them, live on our clients' own domains. Every one built around how the business actually runs.</p><div class="filters" role="group" aria-label="Filter">${f("i", inds, (x) => x)}${builts.length > 1 ? '<span style="width:12px"></span>' : ""}${f("b", builts, (x) => BUILT_LABEL[x])}</div>${items.length ? `<div class="grid">${cards}</div>` : `<p class="lede" style="padding:60px 0">New work is on its way.</p>`}`;
  return shell("Our work | Interstellar Strategies", body, noindex);
}

export function caseHtml(i: any, noindex: boolean) {
  const sec = (t: string, inner: string) => (inner ? `<div class="sec"><h3>${t}</h3>${inner}</div>` : "");
  const body = `<p class="k" style="margin-top:28px"><a href="?" style="text-decoration:none">&larr; All work</a> &middot; ${esc(i.industry)}</p><h1>${esc(i.name)}</h1>${i.description ? `<p class="lede">${esc(i.description)}</p>` : ""}
<p style="margin:24px 0 36px">${i.url ? `<a class="btn" href="${esc(i.url)}" target="_blank" rel="noopener">Visit the live site &rarr;</a>` : ""}</p>
<div class="cs"><div class="imgs">${i.image_desktop || i.og_image ? `<img src="${esc(i.image_desktop || i.og_image)}" alt="${esc(i.name)} on desktop">` : `<div class="shot"><div class="ph">${esc(i.domain)}</div></div>`}${i.image_phone ? `<img src="${esc(i.image_phone)}" alt="${esc(i.name)} on a phone">` : ""}</div>
<div>${sec("The objective", i.objective ? `<p>${esc(i.objective)}</p>` : "")}${sec("What we built", `<div class="tags">${i.built.map((b: string) => `<span>${esc(BUILT_LABEL[b])}</span>`).join("")}</div>`)}${sec("Approach", i.highlights.length ? `<ul>${i.highlights.map((h: string) => `<li>${esc(h)}</li>`).join("")}</ul>` : "")}${sec("Results", i.results.length ? `<ul>${i.results.map((r: any) => `<li>${esc(r.text)}${r.source ? ` <span class="k">(${esc(r.source)})</span>` : ""}</li>`).join("")}</ul>` : "")}${i.launched_at ? `<p class="k" style="margin-top:20px">Launched ${esc(new Date(i.launched_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }))}</p>` : ""}</div></div>`;
  return shell(`${i.name} | Interstellar Strategies`, body, noindex);
}
