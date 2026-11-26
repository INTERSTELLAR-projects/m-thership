// Interstellar brand kit template (v2, Nov 2026).
// One structure for every client, themed entirely by the client's own tokens: colors, fonts, corners, grid, logo.
// renderBrandKit(kit) returns a complete, self-contained HTML document (used in the client's Workspace inside an
// iframe, and for previews). The only Interstellar mark is a tiny "Brand kit by Interstellar" line on each page,
// set in the client's own body font.

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const arr = (x) => (Array.isArray(x) ? x : []);
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const okHex = (h) => (HEX.test(String(h || "").trim()) ? normHex(h) : null);
function normHex(h) {
  let x = String(h).trim().replace("#", "");
  if (x.length === 3) x = x.split("").map((c) => c + c).join("");
  return "#" + x.toLowerCase();
}
function rgb(h) { const x = normHex(h).slice(1); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); }
function cmyk(h) {
  const [r, g, b] = rgb(h).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 100];
  return [(1 - r - k) / (1 - k), (1 - g - k) / (1 - k), (1 - b - k) / (1 - k), k].map((v) => Math.round(v * 100));
}
function lum(h) {
  return rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
const onColor = (bg) => (contrast(bg, "#ffffff") >= contrast(bg, "#111111") ? "#ffffff" : "#111111");
function mix(a, b, t) { const A = rgb(a), B = rgb(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); }

function fontStack(f, fb) { return f && f.family ? `"${String(f.family).replace(/"/g, "")}", ${fb || f.fallback || "sans-serif"}` : (fb || "sans-serif"); }
function fontLinks(t) {
  const urls = [t.display, t.body, t.utility].map((f) => f && f.google_css_url).filter((u) => /^https:\/\/fonts\.googleapis\.com\//.test(String(u || "")));
  return [...new Set(urls)].map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join("");
}

// ---- normalise the kit into the tokens the template needs (with safe fallbacks) ----
function tokens(kit) {
  const th = kit.theme || {};
  const dark = th.mode === "dark";
  const bg = okHex(th.bg) || (dark ? "#0d0d0d" : "#f7f6f3");
  const ink = okHex(th.ink) || onColor(bg);
  const accent = okHex(th.accent) || okHex(arr(kit.palette).find((p) => p.role === "accent" || p.role === "primary")?.hex) || "#ff5a1f";
  const accent2 = okHex(th.accent_2) || mix(accent, dark ? "#ffffff" : "#000000", 0.25);
  const surface = okHex(th.surface) || mix(bg, ink, 0.05);
  const muted = okHex(th.muted) || mix(ink, bg, 0.45);
  const hair = th.hairline && String(th.hairline).length < 40 ? th.hairline : mix(ink, bg, 0.84);
  const sh = kit.shape || {};
  const radius = Number.isFinite(+sh.radius_px) ? Math.max(0, Math.min(40, +sh.radius_px)) : 8;
  const ty = kit.typography || {};
  return {
    dark, bg, ink, accent, accent2, surface, muted, hair, radius,
    btnRadius: Number.isFinite(+sh.button_radius_px) ? +sh.button_radius_px : radius,
    cardRadius: Number.isFinite(+sh.card_radius_px) ? +sh.card_radius_px : radius,
    motif: String(sh.motif || "none"),
    gradient: th.gradient && /gradient\(/.test(th.gradient) && !/[<>;{}]/.test(th.gradient) ? th.gradient : `linear-gradient(90deg, ${accent}, ${accent2})`,
    display: fontStack(ty.display, "system-ui, sans-serif"), body: fontStack(ty.body, "system-ui, sans-serif"),
    utility: fontStack(ty.utility || ty.body, "system-ui, sans-serif"),
    displayCase: ty.display?.case === "upper" ? "uppercase" : "none",
    displayTrack: /^-?\d*\.?\d+em$/.test(String(ty.display?.tracking || "")) ? ty.display.tracking : "-0.03em",
    utilCase: (ty.utility?.case || "upper") === "upper" ? "uppercase" : "none",
    wd: Math.max(...(arr(ty.display?.weights).map(Number).filter((n) => n >= 100 && n <= 900)), 0) || 700,
  };
}

function css(T) {
  const grid = T.motif === "grid" || T.motif === "crosshair";
  return `
:root{--bg:${T.bg};--ink:${T.ink};--accent:${T.accent};--accent2:${T.accent2};--surface:${T.surface};--muted:${T.muted};--hair:${T.hair};
--r:${T.radius}px;--rb:${T.btnRadius}px;--rc:${T.cardRadius}px;--fd:${T.display};--wd:${T.wd};--fb:${T.body};--fu:${T.utility};--grad:${T.gradient};color-scheme:${T.dark ? "dark" : "light"}}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--fb);-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
.kit{max-width:1180px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-left,0px)) 60px;display:flex;flex-direction:column;gap:28px}
.page{position:relative;background:var(--bg);border:1px solid var(--hair);border-radius:var(--rc);padding:clamp(22px,4vw,52px);overflow:hidden;display:flex;flex-direction:column;gap:clamp(18px,3vw,32px)}
${grid ? `.page::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(var(--hair) 1px,transparent 1px),linear-gradient(90deg,var(--hair) 1px,transparent 1px);background-size:56px 56px;opacity:.55;mask-image:linear-gradient(180deg,#000 0%,transparent 70%)}` : ""}
${T.motif === "crosshair" ? `.page::after{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,var(--accent) 1.2px,transparent 1.6px);background-size:56px 56px;background-position:-28px -28px;opacity:.35;mask-image:linear-gradient(180deg,#000,transparent 60%)}` : ""}
.page>*{position:relative;z-index:1}
.corners{position:absolute;inset:14px;pointer-events:none;z-index:2}
.corners i{position:absolute;width:16px;height:16px;border-color:var(--accent);border-style:solid;border-width:0}
.corners i:nth-child(1){top:0;left:0;border-top-width:2px;border-left-width:2px}.corners i:nth-child(2){top:0;right:0;border-top-width:2px;border-right-width:2px}
.corners i:nth-child(3){bottom:0;left:0;border-bottom-width:2px;border-left-width:2px}.corners i:nth-child(4){bottom:0;right:0;border-bottom-width:2px;border-right-width:2px}
.ph{display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:var(--fu);font-size:11px;letter-spacing:.14em;text-transform:${T.utilCase};color:var(--muted)}
.ph b{color:var(--accent);font-weight:600}
.pf{margin-top:auto;display:flex;justify-content:space-between;gap:12px;padding-top:18px;border-top:1px solid var(--hair);font-family:var(--fb);font-size:9.5px;letter-spacing:.04em;color:var(--muted);opacity:.8}
h1,h2,h3{font-family:var(--fd);font-weight:var(--wd);text-transform:${T.displayCase};letter-spacing:${T.displayTrack};margin:0;line-height:1;text-wrap:balance}
h2{font-size:clamp(34px,5.4vw,68px)}h3{font-size:clamp(20px,2.2vw,26px);line-height:1.1}
.eyebrow{font-family:var(--fu);font-size:11.5px;letter-spacing:.16em;text-transform:${T.utilCase};color:var(--accent);font-weight:600}
.lede{font-size:clamp(16px,1.7vw,19px);line-height:1.55;color:var(--ink);opacity:.86;max-width:62ch;margin:0}
.muted{color:var(--muted)}.small{font-size:13px;line-height:1.55}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.fit{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:14px}
@media(max-width:820px){.grid3,.grid4{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.grid2,.grid3,.grid4{grid-template-columns:1fr}}
.card{background:var(--surface);border:1px solid var(--hair);border-radius:var(--rc);padding:18px;min-width:0}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border-radius:var(--rb);font-family:var(--fb);font-weight:700;font-size:15px;border:0;white-space:nowrap}
.chip{display:inline-flex;align-items:center;height:30px;padding:0 12px;border:1px solid var(--hair);border-radius:999px;font-size:13px}
.bar{height:6px;border-radius:999px;background:var(--grad)}
/* cover */
.cover{justify-content:space-between;min-height:min(760px,92vh)}
.cover .logo{max-height:120px;max-width:min(420px,80%);object-fit:contain}
.cover h1{font-size:clamp(46px,8.6vw,118px)}
.cover .meta{display:flex;flex-wrap:wrap;gap:10px 26px;font-family:var(--fu);font-size:12px;letter-spacing:.14em;text-transform:${T.utilCase};color:var(--muted)}
/* logo */
.lt{border-radius:var(--rc);border:1px solid var(--hair);display:grid;place-items:center;padding:34px;min-height:200px}
.lt img{max-height:96px;max-width:80%;object-fit:contain}
.clear{position:relative;display:inline-grid;place-items:center;padding:28px;outline:1px dashed var(--accent);outline-offset:0}
.clear span{position:absolute;font-family:var(--fu);font-size:10px;color:var(--accent)}
.dont{position:relative;border:1px solid var(--hair);border-radius:var(--rc);height:130px;display:grid;place-items:center;overflow:hidden;background:var(--surface)}
.dont img{max-height:52px;max-width:70%}
.dont::after{content:"";position:absolute;inset:0;background:linear-gradient(135deg,transparent calc(50% - 1px),#d22 calc(50% - 1px),#d22 calc(50% + 1px),transparent calc(50% + 1px));opacity:.85}
.dont em{position:absolute;bottom:8px;left:10px;font-style:normal;font-size:11.5px;color:var(--muted);z-index:1}
/* color */
.sw{border-radius:var(--rc);overflow:hidden;border:1px solid var(--hair);display:flex;flex-direction:column;min-width:0}
.sw .c{height:150px;padding:14px;display:flex;align-items:flex-end;font-family:var(--fd);font-weight:var(--wd);font-size:20px;text-transform:${T.displayCase};letter-spacing:${T.displayTrack}}
.sw .v{padding:12px 14px;display:grid;gap:3px;font-size:12px;font-variant-numeric:tabular-nums;background:var(--surface)}
.sw .v button{all:unset;cursor:pointer;font-weight:700}.sw .v button:hover{color:var(--accent)}
.prop{display:flex;height:64px;border-radius:var(--rc);overflow:hidden;border:1px solid var(--hair)}
.pair{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:var(--rc);font-weight:700}
/* type */
.aa{font-family:var(--fd);font-weight:var(--wd);font-size:clamp(110px,18vw,220px);line-height:.85;text-transform:none;letter-spacing:${T.displayTrack}}
.scale>div{display:flex;align-items:baseline;gap:16px;padding:10px 0;border-bottom:1px solid var(--hair);min-width:0}
.scale>div span{flex:0 0 74px;font-family:var(--fu);font-size:11px;color:var(--muted);letter-spacing:.1em;text-transform:${T.utilCase}}
/* imagery */
.ph-grid{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:120px;gap:10px}
.ph-grid figure{margin:0;border-radius:var(--rc);overflow:hidden;background:var(--surface)}
.ph-grid img{width:100%;height:100%;object-fit:cover}
.ph-grid figure:nth-child(1){grid-column:span 4;grid-row:span 3}.ph-grid figure:nth-child(2){grid-column:span 2;grid-row:span 2}
.ph-grid figure:nth-child(3){grid-column:span 2}.ph-grid figure{grid-column:span 2;grid-row:span 2}
@media(max-width:560px){.ph-grid{grid-template-columns:repeat(2,1fr)}.ph-grid figure,.ph-grid figure:nth-child(n){grid-column:span 1;grid-row:span 1}.ph-grid figure:nth-child(1){grid-column:span 2;grid-row:span 2}}
/* applications */
.post{aspect-ratio:1/1;border-radius:var(--rc);overflow:hidden;position:relative;display:flex;flex-direction:column;justify-content:flex-end;padding:20px;color:#fff;background:var(--accent)}
.post img.bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.post::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(0,0,0,.72))}
.post>*{position:relative}
.post h3{font-size:clamp(20px,2.4vw,28px);color:#fff}
.bcard{aspect-ratio:1.75/1;border-radius:calc(var(--rc) * .6);padding:18px;display:flex;flex-direction:column;justify-content:space-between;border:1px solid var(--hair)}
.sig{display:flex;gap:14px;align-items:center;padding:16px;border:1px solid var(--hair);border-radius:var(--rc);background:#fff;color:#1a1a1a;font-family:var(--fb)}
.mini{border:1px solid var(--hair);border-radius:var(--rc);overflow:hidden}
.mini .nav{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--hair);background:var(--bg)}
.mini .hero{padding:28px 18px;background:var(--surface)}
code,.tok{font-family:var(--fu);font-size:12px}
table{width:100%;border-collapse:collapse;font-size:13px}td{padding:9px 6px;border-bottom:1px solid var(--hair);vertical-align:top}
.tablewrap{overflow-x:auto}
@media print{.kit{padding:0}.page{break-after:page;min-height:auto;border:0}}
@media(prefers-reduced-motion:no-preference){.page{animation:rise .5s both}@keyframes rise{from{opacity:.001;transform:translateY(8px)}}}
`;
}

// ---- pages ----
function frame(n, label, T, kit, inner, cls = "") {
  const corners = T.motif === "corner-brackets" ? `<div class="corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>` : "";
  const name = kit.identity?.name || kit.business || "";
  return `<section class="page ${cls}" id="p${n}">${corners}
<div class="ph"><span><b>${String(n).padStart(2, "0")}</b> &nbsp;${esc(label)}</span><span>${esc(name)}</span></div>
${inner}
<div class="pf"><span>${esc(name)} Brand Kit</span><span>Brand kit by Interstellar</span></div></section>`;
}

const logoImg = (url, alt, style = "") => (url ? `<img src="${esc(url)}" alt="${esc(alt)}" ${style ? `style="${style}"` : ""} loading="lazy">` : "");

function pCover(T, k) {
  const id = k.identity || {}, L = k.logo || {};
  const logo = L.primary_url || L.on_dark_url || L.on_light_url;
  const year = new Date().getFullYear();
  return frame(0, "Brand kit", T, k, `
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap">${logo ? logoImg(logo, id.name + " logo", "max-height:84px;max-width:min(360px,70%);object-fit:contain") : ""}<span class="eyebrow">Version 1 · ${year}</span></div>
<div style="display:flex;flex-direction:column;gap:20px"><span class="eyebrow">${esc(id.industry || "Brand guidelines")}</span>
<h1>${esc(id.name || k.business)}</h1>${id.tagline ? `<p class="lede" style="font-size:clamp(18px,2.2vw,24px)">${esc(id.tagline)}</p>` : ""}
<div class="bar" style="max-width:280px"></div></div>
<div class="meta">${[id.domain, id.location, id.service_area].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")}</div>`, "cover");
}

function pGlance(T, k) {
  const id = k.identity || {}, m = k.messaging || {}, v = k.voice || {};
  const top = arr(k.palette).slice(0, 5);
  return frame(1, "At a glance", T, k, `
<div class="grid2" style="align-items:start"><div style="display:flex;flex-direction:column;gap:18px"><span class="eyebrow">Who we are</span>
<h2 style="font-size:clamp(28px,3.6vw,46px);line-height:1.05">${esc(id.one_liner || id.tagline || id.name)}</h2>${m.elevator_pitch ? `<p class="lede">${esc(m.elevator_pitch)}</p>` : ""}</div>
<div style="display:flex;flex-direction:column;gap:14px">
<div class="card"><span class="eyebrow">Personality</span><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">${arr(v.traits).map((t) => `<span class="chip">${esc(t.name)}</span>`).join("")}</div></div>
<div class="card"><span class="eyebrow">Core colors</span><div style="display:flex;height:56px;border-radius:var(--r);overflow:hidden;margin-top:12px">${top.map((p) => okHex(p.hex) ? `<div style="flex:1;background:${okHex(p.hex)}" title="${esc(p.name)}"></div>` : "").join("")}</div></div>
<div class="card"><span class="eyebrow">Type</span><div style="font-family:var(--fd);font-weight:var(--wd);font-size:34px;text-transform:${T.displayCase};letter-spacing:${T.displayTrack};margin-top:10px">${esc(k.typography?.display?.family || "")}</div><div class="small muted">${esc(k.typography?.body?.family || "")}${k.typography?.utility?.family && k.typography.utility.family !== k.typography?.body?.family ? " · " + esc(k.typography.utility.family) : ""}</div></div>
</div></div>`);
}

function pLogo(T, k) {
  const L = k.logo || {}, name = k.identity?.name || "";
  const main = L.primary_url || L.on_dark_url || L.on_light_url;
  if (!main) return "";
  const onDark = L.on_dark_url || (L.designed_for === "dark" ? main : "");
  const onLight = L.on_light_url || (L.designed_for !== "dark" ? main : "");
  const darkBg = T.dark ? T.bg : mix(T.ink, "#000000", 0.2), lightBg = T.dark ? mix(T.ink, "#ffffff", 0.6) : T.bg;
  return frame(2, "Logo", T, k, `
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Our mark</span><h2>Logo</h2>
<p class="lede">${esc(L.notes || `Use the ${name} logo as supplied. Give it room, keep it sharp, and never redraw it.`)}</p></div>
<div class="grid3">
<div class="lt" style="background:${T.bg}">${logoImg(main, name + " logo")}</div>
${onDark ? `<div class="lt" style="background:${darkBg}">${logoImg(onDark, name + " logo on dark")}</div>` : ""}
${onLight ? `<div class="lt" style="background:${lightBg}">${logoImg(onLight, name + " logo on light")}</div>` : `<div class="lt" style="background:${T.accent}">${logoImg(main, name + " logo on brand color")}</div>`}
</div>
<div class="grid2" style="align-items:center">
<div class="card" style="display:grid;place-items:center;padding:30px"><div class="clear">${logoImg(main, "", "max-height:64px;max-width:240px")}<span style="top:6px;left:50%">x</span><span style="left:8px;top:50%">x</span></div>
<p class="small muted" style="margin:14px 0 0;text-align:center">Clear space: keep at least <b>x</b> (the height of the mark's tallest letter) empty on every side.</p></div>
<div style="display:flex;flex-direction:column;gap:10px"><span class="eyebrow">Minimum size</span><p class="small" style="margin:0">Print 1 in (25 mm) wide · Screen 120 px wide. Smaller than this, use the icon only.</p>
<span class="eyebrow" style="margin-top:10px">Background</span><p class="small" style="margin:0">Place it on ${T.dark ? "dark brand backgrounds or clean, dark photos" : "light brand backgrounds or clean, bright photos"}. Busy photos need a solid panel behind the logo.</p></div></div>
<div class="grid4">
<div class="dont">${logoImg(main, "", "transform:scaleX(1.5)")}<em>Don't stretch</em></div>
<div class="dont">${logoImg(main, "", "filter:hue-rotate(140deg) saturate(2)")}<em>Don't recolor</em></div>
<div class="dont">${logoImg(main, "", "transform:rotate(-14deg)")}<em>Don't rotate</em></div>
<div class="dont" style="background:repeating-linear-gradient(45deg,${T.accent},${T.accent} 8px,${T.accent2} 8px,${T.accent2} 16px)">${logoImg(main, "")}<em style="color:#fff">Don't place on busy patterns</em></div>
</div>`);
}

function pColor(T, k) {
  const pal = arr(k.palette).filter((p) => okHex(p.hex)).slice(0, 8);
  if (!pal.length) return "";
  const weight = { primary: 30, surface: 40, ink: 18, accent: 10, support: 6, muted: 6 };
  const total = pal.reduce((a, p) => a + (weight[p.role] || 6), 0);
  const pairs = [[T.bg, T.ink, "Text on background"], [T.accent, onColor(T.accent), "Text on accent"], [T.surface, T.ink, "Text on surface"]];
  return frame(3, "Color", T, k, `
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Palette</span><h2>Color</h2>
<p class="lede">Lead with ${esc(pal.find((p) => p.role === "surface" || p.role === "primary")?.name || pal[0].name)}, and save ${esc(pal.find((p) => p.role === "accent")?.name || "the accent")} for the moments that matter: buttons, highlights and calls to action.</p></div>
<div class="fit">${pal.map((p) => {
    const h = okHex(p.hex), [r, g, b] = rgb(h), [c, m, y, kk] = cmyk(h);
    return `<div class="sw"><div class="c" style="background:${h};color:${onColor(h)}">${esc(p.name)}</div><div class="v">
<button type="button" data-copy="${h}" title="Copy">${h.toUpperCase()}</button><span>RGB ${r} ${g} ${b}</span><span>CMYK ${c} ${m} ${y} ${kk}</span>
<span class="muted">${esc(p.role || "")}${p.usage ? " · " + esc(p.usage) : ""}</span></div></div>`;
  }).join("")}</div>
<div><span class="eyebrow">Balance</span><div class="prop" style="margin-top:12px">${pal.map((p) => `<div style="flex:${weight[p.role] || 6};background:${okHex(p.hex)}" title="${esc(p.name)} ~${Math.round(((weight[p.role] || 6) / total) * 100)}%"></div>`).join("")}</div></div>
<div class="grid3">${pairs.map(([bg, fg, l]) => { const r = contrast(bg, fg); return `<div class="pair" style="background:${bg};color:${fg};border:1px solid var(--hair)"><span>${l}</span><span style="font-variant-numeric:tabular-nums">${r.toFixed(1)}:1 ${r >= 4.5 ? "AA" : r >= 3 ? "AA large" : ""}</span></div>`; }).join("")}</div>`);
}

function pType(T, k) {
  const ty = k.typography || {};
  if (!ty.display && !ty.body) return "";
  const d = ty.display || ty.body, b = ty.body || ty.display, u = ty.utility;
  const sample = k.messaging?.headlines?.[0] || k.identity?.tagline || k.identity?.name;
  return frame(4, "Typography", T, k, `
<div class="grid2" style="align-items:end"><div style="min-width:0"><span class="eyebrow">Display</span><div class="aa">Aa</div></div>
<div style="display:flex;flex-direction:column;gap:10px;min-width:0"><h3>${esc(d.family)}</h3><p class="small muted" style="margin:0">Weights ${esc(arr(d.weights).join(" · ") || "—")} · Headlines${d.case === "upper" ? ", set in capitals" : ""}</p>
<div style="font-family:var(--fd);font-weight:var(--wd);font-size:22px;letter-spacing:${T.displayTrack};word-break:break-all">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz 0123456789</div></div></div>
<div class="grid2"><div class="card"><span class="eyebrow">Body · ${esc(b.family)}</span><p style="font-family:var(--fb);font-size:17px;line-height:1.6;margin:12px 0 0">${esc(k.messaging?.elevator_pitch || k.identity?.one_liner || "")}</p></div>
<div class="card"><span class="eyebrow">${u ? "Labels · " + esc(u.family) : "Labels"}</span><div style="display:flex;flex-direction:column;gap:10px;margin-top:12px"><span class="eyebrow" style="color:var(--ink)">Section label</span><span class="eyebrow">Eyebrow in accent</span><span class="small muted">${esc(k.components?.eyebrow?.style || "Small, spaced-out capitals above headlines.")}</span></div></div></div>
<div class="scale">
<div><span>Hero</span><h1 style="font-size:clamp(36px,5vw,64px)">${esc(sample)}</h1></div>
<div><span>Heading</span><h3 style="font-size:32px">${esc(k.messaging?.headlines?.[1] || "Section heading")}</h3></div>
<div><span>Subhead</span><div style="font-family:var(--fb);font-size:20px;font-weight:600">${esc(k.messaging?.services?.[0]?.name || "Subheading")}</div></div>
<div><span>Body</span><div style="font-family:var(--fb);font-size:16px">${esc(k.messaging?.services?.[0]?.line || "Body copy, 16–18 px, comfortable line height.")}</div></div>
<div><span>Caption</span><div class="eyebrow">${esc(k.identity?.location || "Caption · Label")}</div></div></div>`);
}

function pShape(T, k) {
  const c = k.components || {}, sh = k.shape || {};
  const p = c.button_primary || {}, s = c.button_secondary || {};
  const pbg = okHex(p.bg) || T.accent, pfg = okHex(p.fg) || onColor(pbg);
  const caseP = p.case === "upper" ? "uppercase" : "none";
  const cta = arr(k.messaging?.ctas);
  return frame(5, "Shape & elements", T, k, `
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Building blocks</span><h2>Shape &amp; elements</h2>
<p class="lede">${esc(sh.motif_notes || "Consistent corners, borders and buttons make every piece look like it came from the same place.")}</p></div>
<div class="grid3">
<div class="card" style="display:flex;flex-direction:column;gap:14px"><span class="eyebrow">Buttons</span>
<span class="btn" style="background:${pbg};color:${pfg};text-transform:${caseP}">${esc(cta[0] || "Get started")}</span>
<span class="btn" style="background:${okHex(s.bg) || "transparent"};color:${okHex(s.fg) || T.ink};border:1px solid ${okHex(s.border) || T.hair};text-transform:${caseP}">${esc(cta[1] || "Learn more")}</span>
<span class="small muted">Corner radius ${T.btnRadius}px${p.notes ? " · " + esc(p.notes) : ""}</span></div>
<div class="card" style="display:flex;flex-direction:column;gap:14px"><span class="eyebrow">Cards</span>
<div style="border:1px solid var(--hair);border-radius:var(--rc);padding:16px;background:var(--bg)"><div class="eyebrow">${esc(k.messaging?.services?.[0]?.name || "Service")}</div><div style="font-family:var(--fd);font-weight:var(--wd);font-size:22px;margin-top:8px;text-transform:${T.displayCase};letter-spacing:${T.displayTrack}">${esc(k.messaging?.services?.[0]?.line?.slice(0, 60) || "Card title")}</div></div>
<span class="small muted">Radius ${T.cardRadius}px · ${esc(sh.border || "hairline")} border</span></div>
<div class="card" style="display:flex;flex-direction:column;gap:14px"><span class="eyebrow">Signature detail</span>
<div style="position:relative;height:120px;border:1px solid var(--hair);border-radius:var(--rc);overflow:hidden;${T.motif === "grid" || T.motif === "crosshair" ? "background-image:linear-gradient(var(--hair) 1px,transparent 1px),linear-gradient(90deg,var(--hair) 1px,transparent 1px);background-size:20px 20px;" : `background:var(--grad);`}">
${T.motif === "corner-brackets" ? `<div class="corners" style="inset:10px"><i></i><i></i><i></i><i></i></div>` : ""}</div>
<span class="small muted">${esc(sh.motif && sh.motif !== "none" ? sh.motif.replace(/-/g, " ") : "Brand gradient")}${sh.texture ? " · " + esc(sh.texture) : ""}</span></div></div>
<div class="grid4">${[["Corner radius", T.radius + "px"], ["Border", sh.border || "hairline"], ["Accent", T.accent.toUpperCase()], ["Mode", T.dark ? "Dark" : "Light"]].map(([a, b]) => `<div class="card"><div class="eyebrow">${a}</div><div style="font-family:var(--fd);font-weight:var(--wd);font-size:26px;margin-top:8px">${esc(b)}</div></div>`).join("")}</div>`);
}

function pVoice(T, k) {
  const v = k.voice || {};
  if (!arr(v.traits).length) return "";
  return frame(6, "Voice", T, k, `
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">How we sound</span><h2>Voice &amp; tone</h2></div>
<div class="grid3">${arr(v.traits).slice(0, 6).map((t, i) => `<div class="card"><div class="eyebrow">${String(i + 1).padStart(2, "0")}</div><h3 style="margin-top:10px">${esc(t.name)}</h3><p class="small muted" style="margin:8px 0 0">${esc(t.desc || "")}</p></div>`).join("")}</div>
<div class="grid2">
<div class="card" style="border-color:${T.accent}"><span class="eyebrow">We say</span><ul style="margin:12px 0 0;padding-left:18px;display:grid;gap:8px">${arr(v.we_say).slice(0, 6).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
<div class="card"><span class="eyebrow" style="color:var(--muted)">We avoid</span><ul style="margin:12px 0 0;padding-left:18px;display:grid;gap:8px" class="muted">${arr(v.we_avoid).slice(0, 6).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
${arr(v.sample_lines).length ? `<div style="display:grid;gap:12px">${arr(v.sample_lines).slice(0, 3).map((x) => `<blockquote style="margin:0;padding-left:16px;border-left:3px solid var(--accent);font-family:var(--fd);font-weight:var(--wd);font-size:clamp(20px,2.4vw,30px);line-height:1.15;text-transform:${T.displayCase};letter-spacing:${T.displayTrack}">${esc(x)}</blockquote>`).join("")}</div>` : ""}`);
}

function pMessaging(T, k) {
  const m = k.messaging || {}, id = k.identity || {};
  if (!m.elevator_pitch && !arr(m.services).length) return "";
  return frame(7, "Messaging", T, k, `
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">What we say</span><h2>${esc(id.tagline || "Messaging")}</h2>${m.elevator_pitch ? `<p class="lede">${esc(m.elevator_pitch)}</p>` : ""}</div>
${arr(m.services).length ? `<div class="grid3">${arr(m.services).slice(0, 9).map((s) => `<div class="card"><h3>${esc(s.name)}</h3><p class="small muted" style="margin:8px 0 0">${esc(s.line || "")}</p></div>`).join("")}</div>` : ""}
<div class="fit">
${arr(m.ctas).length ? `<div class="card"><span class="eyebrow">Calls to action</span><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px">${arr(m.ctas).slice(0, 6).map((x) => `<span class="chip" style="border-color:var(--accent)">${esc(x)}</span>`).join("")}</div></div>` : ""}
${arr(m.proof).length ? `<div class="card"><span class="eyebrow">Proof points</span><ul style="margin:12px 0 0;padding-left:18px;display:grid;gap:6px">${arr(m.proof).slice(0, 6).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}</div>`);
}

function pImagery(T, k) {
  const im = k.imagery || {}, ph = arr(im.photos).filter((p) => /^https:\/\//.test(String(p.url || ""))).slice(0, 8);
  if (!ph.length) return "";
  return frame(8, "Imagery", T, k, `
<div class="grid2" style="align-items:end"><div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Photography</span><h2>Imagery</h2></div>
<div style="display:flex;flex-wrap:wrap;gap:8px">${arr(im.style).slice(0, 6).map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div></div>
<div class="ph-grid">${ph.map((p) => `<figure>${logoImg(p.url, p.caption || "")}</figure>`).join("")}</div>`);
}

function pApps(T, k) {
  const id = k.identity || {}, L = k.logo || {}, m = k.messaging || {}, ct = k.contact || {};
  const logo = L.primary_url || L.on_dark_url || L.on_light_url;
  const logoDark = L.on_dark_url || (L.designed_for === "dark" ? logo : "");
  const photo = arr(k.imagery?.photos).find((p) => /^https:\/\//.test(String(p.url || "")))?.url;
  const p = k.components?.button_primary || {}, pbg = okHex(p.bg) || T.accent, pfg = okHex(p.fg) || onColor(pbg);
  const head = m.headlines?.[0] || id.tagline || id.name;
  const cardBg = T.dark ? T.bg : T.ink, cardFg = onColor(cardBg);
  return frame(9, "In use", T, k, `
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Applications</span><h2>The brand in use</h2>
<p class="lede">Starting points for social, print, email and the web. Everything uses the same colors, type and corners.</p></div>
<div class="grid3">
<div class="post">${photo ? `<img class="bgimg" src="${esc(photo)}" alt="">` : ""}${logoDark ? `<img src="${esc(logoDark)}" alt="" style="position:absolute;top:18px;left:18px;max-height:30px;max-width:50%">` : ""}<span class="eyebrow" style="color:#fff;opacity:.85">${esc(id.location || id.industry || "")}</span><h3 style="margin-top:8px">${esc(head)}</h3><span class="btn" style="margin-top:14px;align-self:flex-start;height:38px;font-size:13px;background:${pbg};color:${pfg}">${esc(m.ctas?.[0] || "Learn more")}</span></div>
<div style="display:flex;flex-direction:column;gap:14px">
<div class="bcard" style="background:${cardBg};color:${cardFg}">${logoDark || logo ? logoImg(logoDark || logo, "", "max-height:34px;max-width:60%;object-fit:contain") : `<b>${esc(id.name)}</b>`}<div style="font-size:12px;line-height:1.5"><b>Your Name</b><br>${esc(ct.phone || "")}${ct.phone && id.domain ? " · " : ""}${esc(id.domain || "")}</div></div>
<div class="bcard" style="background:${T.accent};color:${onColor(T.accent)};justify-content:center;align-items:center"><div style="font-family:var(--fd);font-weight:var(--wd);font-size:22px;text-align:center;text-transform:${T.displayCase};letter-spacing:${T.displayTrack}">${esc(id.tagline || id.name)}</div></div></div>
<div style="display:flex;flex-direction:column;gap:14px">
<div class="sig">${logo ? logoImg(logo, "", `max-height:40px;max-width:90px;object-fit:contain;${L.designed_for === "dark" ? `background:${T.bg};padding:6px;border-radius:6px` : ""}`) : ""}<div style="font-size:12.5px;line-height:1.45;border-left:2px solid ${T.accent};padding-left:12px"><b>Your Name</b><br>Title · ${esc(id.name)}<br><span style="color:${T.accent}">${esc(id.domain || "")}</span>${ct.phone ? `<br>${esc(ct.phone)}` : ""}</div></div>
<div class="mini"><div class="nav">${logo ? logoImg(logo, "", "max-height:22px;max-width:110px;object-fit:contain") : `<b>${esc(id.name)}</b>`}<span class="btn" style="height:28px;padding:0 10px;font-size:11px;background:${pbg};color:${pfg}">${esc(m.ctas?.[0] || "Contact")}</span></div>
<div class="hero"><div class="eyebrow">${esc(id.location || "")}</div><div style="font-family:var(--fd);font-weight:var(--wd);font-size:24px;line-height:1.05;margin-top:8px;text-transform:${T.displayCase};letter-spacing:${T.displayTrack}">${esc(head)}</div></div></div></div></div>`);
}

function pReference(T, k) {
  const ty = k.typography || {}, ct = k.contact || {}, id = k.identity || {};
  const rows = [["Background", T.bg], ["Text", T.ink], ["Surface", T.surface], ["Muted", T.muted], ["Accent", T.accent], ["Accent 2", T.accent2]];
  const fonts = [["Display", ty.display], ["Body", ty.body], ["Labels", ty.utility]].filter(([, f]) => f && f.family);
  return frame(10, "Quick reference", T, k, `
<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">For designers &amp; developers</span><h2>Quick reference</h2></div>
<div class="grid2">
<div class="card tablewrap"><span class="eyebrow">Color tokens</span><table style="margin-top:10px"><tbody>${rows.map(([n, h]) => `<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${h};border:1px solid var(--hair);vertical-align:-2px"></span> ${n}</td><td><button type="button" data-copy="${h}" style="all:unset;cursor:pointer" class="tok">${h.toUpperCase()}</button></td></tr>`).join("")}</tbody></table></div>
<div class="card tablewrap"><span class="eyebrow">Fonts</span><table style="margin-top:10px"><tbody>${fonts.map(([n, f]) => `<tr><td>${n}</td><td><b>${esc(f.family)}</b><br><span class="small muted">${esc(arr(f.weights).join(", "))}${f.google_css_url ? " · Google Fonts" : ""}</span></td></tr>`).join("")}
<tr><td>Corners</td><td>${T.radius}px cards · ${T.btnRadius}px buttons</td></tr></tbody></table></div></div>
${ct.phone || ct.email || id.domain ? `<div class="card" style="display:flex;flex-wrap:wrap;gap:12px 28px"><span class="eyebrow" style="flex-basis:100%">Contact</span>${[id.domain, ct.phone, ct.email, ct.address].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}`);
}

export function renderBrandKit(kit) {
  const k = kit || {};
  const T = tokens(k);
  const name = k.identity?.name || k.business || "Brand";
  const pages = [pCover, pGlance, pLogo, pColor, pType, pShape, pVoice, pMessaging, pImagery, pApps, pReference].map((f) => f(T, k)).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} Brand Kit</title>${fontLinks(k.typography || {})}<style>${css(T)}</style></head>
<body><main class="kit">${pages}</main>
<script>document.addEventListener("click",function(e){var b=e.target.closest("[data-copy]");if(!b)return;var v=b.getAttribute("data-copy");var t=b.textContent;try{navigator.clipboard.writeText(v).then(function(){b.textContent="Copied";setTimeout(function(){b.textContent=t},1200)},function(){})}catch(_){}});</script>
</body></html>`;
}

export const BRAND_KIT_TEMPLATE = "interstellar-v2";
