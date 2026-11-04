// Chrome Workspace (Ops Command deliverable): turns a client's tools list into
//   1) an importable bookmarks file (Netscape HTML) with one bookmark-bar folder per tab group, and
//   2) a tiny unpacked Chrome extension (Manifest V3, chrome.tabGroups) that opens the named, colored
//      tab groups in one click.
// Pure functions; the page (ChromeWorkspacePage.jsx) handles editing and downloads.
import JSZip from "jszip";

export const CHROME_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
export const COLOR_HEX = { grey: "#5f6368", blue: "#1a73e8", red: "#d93025", yellow: "#f9ab00", green: "#188038", pink: "#d01884", purple: "#a142f4", cyan: "#007b83", orange: "#fa903e" };

// Starting point: the Interstellar team's own groups. Swap the links for the client's tools.
export const TEMPLATE_TEXT = `# Claude (orange)
Claude | https://claude.ai
Claude Projects | https://claude.ai/projects
ChatGPT | https://chatgpt.com

# Apps (blue)
Gmail | https://mail.google.com
Calendar | https://calendar.google.com
Drive | https://drive.google.com
Command System | https://example.com/app

# SEO (green)
Search Console | https://search.google.com/search-console
Business Profile | https://business.google.com
Bing Webmaster | https://www.bing.com/webmasters
Analytics | https://analytics.google.com

# Web Design (purple)
Live site | https://example.com
Site editor | https://example.com/editor
PageSpeed | https://pagespeed.web.dev

# Design (pink)
Canva | https://www.canva.com
Figma | https://www.figma.com
Brand kit | https://example.com/brand

# Finance (yellow)
Stripe | https://dashboard.stripe.com
QuickBooks | https://qbo.intuit.com
Bank | https://example.com/bank

# Social (cyan)
Instagram | https://www.instagram.com
Facebook | https://www.facebook.com
LinkedIn | https://www.linkedin.com
TikTok | https://www.tiktok.com
`;

const cleanUrl = (u) => {
  let s = String(u || "").trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
  try { const x = new URL(s); return /^https?:$/.test(x.protocol) ? x.toString() : null; } catch { return null; }
};

// "# Group (color)" starts a group; each following line is "Title | url" or just a url.
export function parseTools(text) {
  const groups = [];
  const errors = [];
  let cur = null;
  String(text || "").split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("//")) return;
    const h = line.match(/^#+\s*(.+?)\s*(?:\((\w+)\))?\s*$/);
    if (h) {
      const color = CHROME_COLORS.includes((h[2] || "").toLowerCase()) ? h[2].toLowerCase() : CHROME_COLORS[(groups.length + 1) % CHROME_COLORS.length];
      cur = { name: h[1].slice(0, 40), color, links: [] };
      groups.push(cur);
      return;
    }
    const [a, b] = line.includes("|") ? line.split("|").map((s) => s.trim()) : [null, line];
    const url = cleanUrl(b);
    if (!url) { errors.push(`Line ${i + 1}: "${line.slice(0, 60)}" is not a web link`); return; }
    if (!cur) { cur = { name: "Workspace", color: "grey", links: [] }; groups.push(cur); }
    cur.links.push({ title: (a || new URL(url).hostname.replace(/^www\./, "")).slice(0, 80), url });
  });
  return { groups: groups.filter((g) => g.links.length), errors };
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Netscape bookmark file. Chrome: Bookmarks > Import bookmarks and settings > "Bookmarks HTML file".
export function bookmarksHtml(business, groups) {
  const now = Math.floor(Date.now() / 1000);
  const folder = (g) => [
    `        <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}">${esc(g.name)}</H3>`,
    "        <DL><p>",
    ...g.links.map((l) => `            <DT><A HREF="${esc(l.url)}" ADD_DATE="${now}">${esc(l.title)}</A>`),
    "        </DL><p>",
  ].join("\n");
  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- This is an automatically generated file. It will be read and overwritten. DO NOT EDIT! -->",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    `<TITLE>${esc(business)} Workspace</TITLE>`,
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    `    <DT><H3 ADD_DATE="${now}" LAST_MODIFIED="${now}" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>`,
    "    <DL><p>",
    groups.map(folder).join("\n"),
    "    </DL><p>",
    "</DL><p>",
    "",
  ].join("\n");
}

const slugOf = (s) => String(s || "workspace").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";

function extensionFiles(business, groups) {
  const name = `${business} Workspace`.slice(0, 45);
  const data = groups.map((g) => ({ name: g.name, color: g.color, urls: g.links.map((l) => l.url) }));
  const manifest = {
    manifest_version: 3,
    name,
    version: "1.0.0",
    description: `Opens ${business}'s tab groups (${groups.map((g) => g.name).join(", ")}) in one click.`.slice(0, 132),
    permissions: ["tabs", "tabGroups"],
    action: { default_title: `Open ${name}`, default_popup: "popup.html" },
    background: { service_worker: "background.js" },
  };
  const background = `// ${name}: opens the team's tab groups. Generated by Interstellar (Ops Command · Chrome Workspace).
const GROUPS = ${JSON.stringify(data, null, 2)};

async function openGroup(g, windowId) {
  // Already open in this window? Just expand it instead of opening duplicates.
  const existing = await chrome.tabGroups.query({ windowId, title: g.name });
  if (existing.length) { await chrome.tabGroups.update(existing[0].id, { collapsed: false }); return; }
  const tabIds = [];
  for (const url of g.urls) {
    const tab = await chrome.tabs.create({ url, windowId, active: false });
    tabIds.push(tab.id);
  }
  if (!tabIds.length) return;
  const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
  await chrome.tabGroups.update(groupId, { title: g.name, color: g.color, collapsed: true });
}

async function openAll() {
  const win = await chrome.windows.getLastFocused();
  for (const g of GROUPS) await openGroup(g, win.id);
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    const win = await chrome.windows.getLastFocused();
    if (msg && msg.type === "all") await openAll();
    else if (msg && Number.isInteger(msg.index) && GROUPS[msg.index]) await openGroup(GROUPS[msg.index], win.id);
    reply({ ok: true });
  })().catch((e) => reply({ ok: false, error: String(e && e.message || e) }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => chrome.action.setBadgeText({ text: String(GROUPS.length) }));
`;
  const dot = (c) => ({ grey: "#5f6368", blue: "#1a73e8", red: "#d93025", yellow: "#f9ab00", green: "#188038", pink: "#d01884", purple: "#a142f4", cyan: "#007b83", orange: "#fa903e" }[c] || "#5f6368");
  const popup = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(name)}</title>
<style>
  body{margin:0;width:260px;font:13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;background:#111;color:#f7f5f2}
  header{padding:12px 14px 10px;border-bottom:1px solid #2a2a2a}
  header b{display:block;font-size:14px}
  header span{font-size:11px;color:#9a948d}
  .bar{height:3px;background:linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)}
  button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:9px;width:100%;padding:9px 14px;cursor:pointer}
  button:hover{background:#1d1d1d}
  .all{margin:10px 14px;width:calc(100% - 28px);justify-content:center;background:linear-gradient(90deg,#ff3c00,#ff6a00);color:#fff;font-weight:600;border-radius:2px}
  .all:hover{filter:brightness(1.08);background:linear-gradient(90deg,#ff3c00,#ff6a00)}
  i{width:10px;height:10px;border-radius:50%;flex:none}
  small{margin-left:auto;color:#6f6a64}
</style></head>
<body><div class="bar"></div>
<header><b>${esc(name)}</b><span>Open your tab groups in one click</span></header>
<button class="all" data-all="1">Open everything</button>
${groups.map((g, i) => `<button data-i="${i}"><i style="background:${dot(g.color)}"></i>${esc(g.name)}<small>${g.links.length} tabs</small></button>`).join("\n")}
<script src="popup.js"></script>
</body></html>
`;
  const popupJs = `document.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
  chrome.runtime.sendMessage(b.dataset.all ? { type: "all" } : { type: "group", index: Number(b.dataset.i) });
  window.close();
}));
`;
  const readme = `${name}
${"=".repeat(name.length)}

Built by Interstellar as part of Ops Command (Chrome Workspace).

1) Tab groups extension (this folder)
   - Unzip this file somewhere permanent (for example Documents/${slugOf(business)}-workspace).
   - In Chrome, open chrome://extensions and switch on "Developer mode" (top right).
   - Click "Load unpacked" and choose the unzipped folder.
   - Pin it from the puzzle-piece menu. Click it and choose "Open everything" or a single group.

2) Bookmarks bar
   - In Chrome, open chrome://settings/importData
   - Choose "Bookmarks HTML file", then pick ${slugOf(business)}-bookmarks.html (downloaded separately).
   - The folders (${groups.map((g) => g.name).join(", ")}) land in your bookmarks bar.

Groups in this build:
${groups.map((g) => `   - ${g.name} (${g.color}): ${g.links.length} tabs`).join("\n")}
`;
  return { manifest, background, popup, popupJs, readme };
}

export async function extensionZip(business, groups) {
  const f = extensionFiles(business, groups);
  const zip = new JSZip();
  const dir = zip.folder(`${slugOf(business)}-workspace`);
  dir.file("manifest.json", JSON.stringify(f.manifest, null, 2));
  dir.file("background.js", f.background);
  dir.file("popup.html", f.popup);
  dir.file("popup.js", f.popupJs);
  dir.file("README.txt", f.readme);
  return zip.generateAsync({ type: "blob" });
}

export function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { slugOf };
