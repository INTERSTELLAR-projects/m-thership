// Constellation v2 model: pure functions shared by the map and Present mode.
// Everything here is derived from real registry rows (department, branch, reads/writes, status, runs) and real
// scores (DailyBrief pillar_scores, LaunchItem). Nothing is invented: when a step has no agent, it says "planned".

// ---------------------------------------------------------------- departments <-> pillars
// Which business pillar each department mostly serves (pillars = src/features/command/engine.js PILLARS).
export const DEPT_PILLAR = {
  command: "owner",
  research: "marketing",
  sales: "sales",
  marketing: "marketing",
  delivery: "delivery",
  success: "clients",
  backoffice: "finance",
  systems: "systems",
};
export const PILLAR_NAMES = {
  sales: "Sales", marketing: "Marketing", delivery: "Delivery & Ops", finance: "Finance",
  clients: "Clients & Retention", team: "Team", systems: "Systems & Tech", owner: "Owner & Strategy",
};
export function pillarOfAgent(a) {
  if (!a) return null;
  if (a.department === "backoffice" && /hiring|training|team/i.test(String(a.branch || ""))) return "team";
  return DEPT_PILLAR[a.department] || null;
}
export function deptsForPillar(p) {
  return Object.entries(DEPT_PILLAR).filter(([, v]) => v === p).map(([k]) => k).concat(p === "team" ? ["backoffice"] : []);
}

// ---------------------------------------------------------------- hand-offs (who passes work to whom)
// A hand-off exists when agent A writes a record type that agent B reads (from the registry's writes_knowledge /
// reads_knowledge). The first word of each entry is the record type; plain-English aliases are folded in.
const ALIAS = { brains: "businessbrain", brain: "businessbrain", runs: "automationrun", learnings: "agentlearning", research_notes: "researchnote", researchnotes: "researchnote", registry: "agentregistry", tasks: "task", ceo_brief: "ceobrief" };
const SKIP = new Set(["drafts", "email", "alert", "advice", "chat", "report", "website", "live", "client", "form", "public", "web", "social", "invite", "sends", "approved", "platform", "lead", "job", "project", "skills", "health", "review", "proposal", "ai_suggestion", "command", "list_triggers", "workflow", "gmail", "the", "connectors", "listings", "requests", "jobs", "invoices", "call", "portal", "recommendations", "results"]);
export function recordToken(s) {
  const w = String(s || "").trim().split(/[\s(/]/)[0].replace(/[^A-Za-z0-9_.]/g, "");
  const l = w.toLowerCase().replace(/\.js$/, "");
  if (!l) return null;
  const a = ALIAS[l] || l;
  return SKIP.has(a) ? null : a;
}
export function buildHandoffs(agents) {
  const W = new Map(), R = new Map();
  const push = (m, t, a) => { if (!m.has(t)) m.set(t, []); if (!m.get(t).includes(a)) m.get(t).push(a); };
  agents.forEach((a) => {
    (a.writes_knowledge || []).forEach((s) => { const t = recordToken(s); if (t) push(W, t, a); });
    (a.reads_knowledge || []).forEach((s) => { const t = recordToken(s); if (t) push(R, t, a); });
  });
  const out = new Map();
  W.forEach((writers, t) => (R.get(t) || []).forEach((r) => writers.forEach((w) => {
    if (w.key === r.key) return;
    const k = `${w.key}>${r.key}`;
    if (!out.has(k)) out.set(k, { id: k, from: w.key, to: r.key, fromDept: w.department, toDept: r.department, via: [] });
    out.get(k).via.push(t);
  })));
  return [...out.values()];
}
export function linksOf(key, handoffs) {
  return handoffs.filter((h) => h.from === key || h.to === key);
}

// ---------------------------------------------------------------- node size
// Size follows real 30-day runs but is capped so a busy agent never hides its neighbours (spacing is 46).
export function runs30(a) {
  return Number(a?.run_count_30d ?? a?._runs30 ?? 0) || 0;
}
export function agentRadius(a) {
  if (!a || a.status === "planned") return 4.6;
  return 5 + Math.min(4.2, Math.log2(1 + runs30(a)) * 0.62);
}

// ---------------------------------------------------------------- layout: one ring-sunburst per department
const RAD = Math.PI / 180;
export const SPACING = 46;
const RING0 = 54;

function sortForRing(agents) {
  const order = { live: 0, broken: 1, paused: 2, planned: 3 };
  const sorted = [...agents].sort((a, b) => (a.sort ?? 100) - (b.sort ?? 100) || String(a.name).localeCompare(String(b.name)));
  const branchOrder = [];
  sorted.forEach((a) => { const b = a.branch || ""; if (!branchOrder.includes(b)) branchOrder.push(b); });
  branchOrder.sort((x, y) => (x === "" ? -1 : y === "" ? 1 : 0));
  return branchOrder.flatMap((b) => sorted.filter((a) => (a.branch || "") === b).sort((x, y) => (order[x.status] ?? 4) - (order[y.status] ?? 4) || runs30(y) - runs30(x)));
}

// Concentric rings with even spacing; branches stay contiguous around each ring. Returns local offsets + radius.
export function clusterLayout(agents, start = -90) {
  const list = sortForRing(agents);
  const pts = [];
  let i = 0, ring = 0, outer = RING0 * 0.5;
  while (i < list.length) {
    const r = RING0 + ring * SPACING;
    const cap = Math.max(1, Math.floor((2 * Math.PI * r) / SPACING));
    const n = Math.min(cap, list.length - i);
    const step = 360 / n;
    const off = start + (ring % 2 ? step / 2 : 0);
    for (let j = 0; j < n; j++) {
      const ang = off + step * j;
      pts.push({ a: list[i + j], x: Math.cos(ang * RAD) * r, y: Math.sin(ang * RAD) * r, ring, ang });
    }
    outer = r;
    i += n; ring++;
  }
  return { pts, radius: outer + 22 };
}

// Overview: brain at the center, the CEO above it, each department a sunburst cluster around a ring.
export function buildClusterOverview({ depts, agents, brain, ceo, keeper, centerLabel = "Company Brain", centerSub = "" }) {
  const nodes = [];
  const edges = [];
  nodes.push({ id: "brain", type: "brain", label: centerLabel, sub: centerSub, x: 0, y: 0, r: 40, brain });
  const present = depts.map((d) => ({ ...d, agents: agents.filter((a) => a.department === d.key) })).filter((d) => d.agents.length || d.always);
  const layouts = present.map((d) => clusterLayout(d.agents));
  const gap = 70;
  const maxR = Math.max(60, ...layouts.map((l) => l.radius));
  // Ring radius: big enough for every cluster side by side, and for the CEO between the brain and the ring.
  const need = layouts.reduce((s, l) => s + l.radius * 2 + gap, 0);
  const R = Math.max(need / (2 * Math.PI), maxR + 250, 300);
  const spans = layouts.map((l) => 2 * Math.asin(Math.min(1, (l.radius + gap / 2) / R)) / RAD);
  const used = spans.reduce((s, x) => s + x, 0);
  const extra = Math.max(0, 360 - used) / Math.max(1, present.length);
  let cursor = -90 + (spans[0] || 0) / 2 + extra / 2 + 22;
  if (ceo) {
    nodes.push({ id: `a:${ceo.key}`, type: "ceo", label: ceo.name, x: 0, y: -(R - maxR) * 0.62, r: 15, status: ceo.status, agent: ceo });
    edges.push({ from: "brain", to: `a:${ceo.key}`, kind: "ceo" });
  }
  if (keeper) {
    nodes.push({ id: `a:${keeper.key}`, type: "agent", label: keeper.name, x: 0, y: (R - maxR) * 0.55, r: agentRadius(keeper), status: keeper.status, agent: keeper, dept: "brain" });
    edges.push({ from: "brain", to: `a:${keeper.key}`, kind: "keeper" });
  }
  const clusters = [];
  present.forEach((d, i) => {
    const mid = cursor;
    const cx = Math.cos(mid * RAD) * R, cy = Math.sin(mid * RAD) * R;
    const rootId = `d:${d.key}`;
    const { pts, radius } = clusterLayout(d.agents, mid);
    const counts = countStatus(d.agents);
    nodes.push({ id: rootId, type: "dept", label: d.label, code: d.code, x: cx, y: cy, r: 13, dept: d.key, counts, angle: mid, clusterR: radius });
    edges.push({ from: "brain", to: rootId, kind: "trunk" });
    pts.forEach((p) => {
      nodes.push({ id: `a:${p.a.key}`, type: "agent", label: p.a.name, x: cx + p.x, y: cy + p.y, r: agentRadius(p.a), status: p.a.status, agent: p.a, dept: d.key });
      edges.push({ from: rootId, to: `a:${p.a.key}`, kind: "spoke" });
    });
    clusters.push({ key: d.key, label: d.label, x: cx, y: cy, r: radius, angle: mid });
    cursor += spans[i] / 2 + (spans[i + 1] || 0) / 2 + extra;
  });
  return { nodes, edges, clusters, R };
}

export function countStatus(list) {
  const c = { live: 0, paused: 0, planned: 0, broken: 0, total: list.length };
  list.forEach((a) => { c[a.status] = (c[a.status] || 0) + 1; });
  return c;
}

export function boxOf(nodes, pad = 0) {
  if (!nodes.length) return { x: -200, y: -200, w: 400, h: 400 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  nodes.forEach((n) => {
    const r = n.clusterR && n.type === "dept" ? n.clusterR : n.r || 6;
    x0 = Math.min(x0, n.x - r); x1 = Math.max(x1, n.x + r); y0 = Math.min(y0, n.y - r); y1 = Math.max(y1, n.y + r);
  });
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

// ---------------------------------------------------------------- label placement (screen space)
// Greedy, collision-free: labels in priority order try 8 spots next to their node, then farther spots with a leader
// line. A label is only drawn where it overlaps no other label and no node. Sizes are screen pixels.
let _ctx = null;
const _w = new Map();
export function textWidth(text, font) {
  const k = `${font}|${text}`;
  if (_w.has(k)) return _w.get(k);
  if (!_ctx && typeof document !== "undefined") _ctx = document.createElement("canvas").getContext("2d");
  let w = String(text).length * 6.6;
  if (_ctx) { _ctx.font = font; w = _ctx.measureText(String(text)).width; }
  _w.set(k, w);
  return w;
}
export function clearTextCache() { _w.clear(); }

export function truncate(s, n) {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > n * 0.55 ? cut.slice(0, sp) : cut).replace(/[\s—–\-·,:;]+$/, "")}…`;
}

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// items: [{ id, sx, sy, sr, w, h, prio, mode: "side" | "below" | "title", dir?: {x,y}, leader?: false }]
// obstacles: node discs [{ sx, sy, sr }]; bounds: { x0, y0, x1, y1 } visible screen rect.
export function placeLabels(items, discs, bounds, { gap = 5, maxPlaced = 400 } = {}) {
  const placed = [];
  const boxes = [];
  // Grid buckets keep this fast at 60 fps with a few hundred labels.
  const G = 96;
  const grid = new Map();
  const cellKeys = (b) => { const out = []; for (let gx = Math.floor(b.x / G); gx <= Math.floor((b.x + b.w) / G); gx++) for (let gy = Math.floor(b.y / G); gy <= Math.floor((b.y + b.h) / G); gy++) out.push(`${gx},${gy}`); return out; };
  const addBox = (b) => { boxes.push(b); cellKeys(b).forEach((k) => { if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); }); };
  discs.forEach((d) => addBox({ x: d.sx - d.sr - 1, y: d.sy - d.sr - 1, w: d.sr * 2 + 2, h: d.sr * 2 + 2, disc: d.id }));
  const free = (b, selfId) => {
    if (b.x < bounds.x0 || b.y < bounds.y0 || b.x + b.w > bounds.x1 || b.y + b.h > bounds.y1) return false;
    for (const k of cellKeys(b)) for (const o of grid.get(k) || []) if (o.disc !== selfId && hit(b, o)) return false;
    return true;
  };
  const sorted = [...items].sort((a, b) => b.prio - a.prio);
  for (const it of sorted) {
    if (placed.length >= maxPlaced) break;
    const { sx, sy, sr, w, h } = it;
    const g = gap + sr;
    const near = it.mode === "title"
      ? [[-w / 2, -g - h], [-w / 2, g], [g, -h / 2], [-g - w, -h / 2]]
      : it.mode === "below"
        ? [[-w / 2, g], [-w / 2, -g - h], [g, -h / 2], [-g - w, -h / 2]]
        : [[g, -h / 2], [-g - w, -h / 2], [-w / 2, g], [-w / 2, -g - h], [g * 0.8, g * 0.5], [-g * 0.8 - w, g * 0.5], [g * 0.8, -g * 0.5 - h], [-g * 0.8 - w, -g * 0.5 - h]];
    // A preferred direction (department titles sit on the outer side of their cluster).
    const first = it.dir ? [[it.dir.x > 0.35 ? 0 : it.dir.x < -0.35 ? -w : -w / 2, it.dir.y > 0.35 ? 0 : it.dir.y < -0.35 ? -h : -h / 2]] : [];
    let spot = null;
    for (const [dx, dy] of [...first, ...near]) { const b = { x: sx + dx, y: sy + dy, w, h }; if (free(b, it.id)) { spot = b; break; } }
    let leader = null;
    if (!spot && it.leader !== false) {
      // Farther out, with a leader line back to the node.
      outer: for (const dist of [18, 30, 44]) {
        for (let k = 0; k < 12; k++) {
          const ang = (k * 30 + 15) * RAD;
          const cx = sx + Math.cos(ang) * (sr + dist), cy = sy + Math.sin(ang) * (sr + dist);
          const bx = Math.cos(ang) >= 0 ? cx : cx - w;
          const b = { x: bx, y: cy - h / 2, w, h };
          if (free(b, it.id)) { spot = b; leader = { x1: sx + Math.cos(ang) * (sr + 1.5), y1: sy + Math.sin(ang) * (sr + 1.5), x2: Math.cos(ang) >= 0 ? b.x : b.x + w, y2: cy }; break outer; }
        }
      }
    }
    if (!spot) continue;
    addBox(spot);
    placed.push({ ...it, x: spot.x, y: spot.y, leader });
  }
  return placed;
}

// ---------------------------------------------------------------- investor copy
// Plain English for a room of investors: no product names of the build platform, no record-type jargon, ™ not ®.
const KEEP_CASE = new Set(["YouTube", "LinkedIn", "QuickBooks", "PageSpeed", "TikTok", "GoDaddy", "WordPress", "HyperCare", "OpenAI", "ChatGPT", "SoundCloud", "GitHub", "MailChimp", "HubSpot", "PowerLift", "MowMasters", "DreamSpace"]);
export function investorize(text) {
  let t = String(text || "");
  t = t.replace(/\bthe Base44 (site|website|app)\b/gi, "the new $1");
  t = t.replace(/\bBase44\s+(systems?|sites?|apps?|websites?|workflows?)\b/g, "$1");
  t = t.replace(/\bBase44\b/g, "our platform");
  t = t.replace(/\bCRMClient\b/g, "client record");
  t = t.replace(/\bGBP\b/g, "Google Business Profile");
  t = t.replace(/\s*\((debounced|deterministic)[^)]*\)/gi, "");
  t = t.replace(/®/g, "™");
  t = t.replace(/,?\s*(and\s+)?open approval tasks/gi, "");
  t = t.replace(/,\s*what needs his approval and (what)/gi, " and $1");
  t = t.replace(/what needs his approval(,| and)?\s*/gi, "");
  t = t.replace(/\b(the whole )?registry\b/gi, (m) => (/whole/i.test(m) ? "every agent's record" : "agent roster"));
  t = t.replace(/\(([a-zA-Z]+[A-Z][a-zA-Z]*|[a-z]+-[a-z-]+)\)/g, "");
  t = t.replace(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)(s?)\b/g, (m, w, s) => (KEEP_CASE.has(w) ? m : w.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase() + s));
  t = t.replace(/\bai_snapshot|aiSnapshot\b/gi, "a finance snapshot");
  t = t.replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();
  return t;
}
export function firstSentence(text, max = 150) {
  const t = investorize(text);
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  const s = (m ? m[1] : t).trim();
  return truncate(s, max);
}

// ---------------------------------------------------------------- end-to-end flow
// The client journey, step by step, with the real agents that exist for each step. Matching is by registry key or
// name; anything not live is marked planned.
export const FLOW_STEPS = [
  { key: "lead", label: "Lead", line: "A new lead comes in", match: [/^fn:lead-intake$/, /^wf:leads-stage-triggers$/, /^plan:speed_to_lead$/] },
  { key: "sale", label: "Sale", line: "The deal is written and closed", match: [/^plan:proposal_writer$/, /^plan:deal_debriefs$/, /^fn:stripe-webhook$/] },
  { key: "build", label: "Build", line: "The website and systems get built", match: [/^fn:start-service$/, /^job:enrich-profile$/, /^inapp:brand-playbook$/, /^fn:task-patterns$/] },
  { key: "launch", label: "Launch", line: "The client goes live", match: [/^wf:portal-invites$/, /^wf:launch-grid-monthly$/, /^fn:site-audit$/] },
  { key: "seo", label: "SEO", line: "Search and AI visibility grow every week", match: [/search console watch/i, /^claude:trig_01EwtNWe3E7BBEewuFG2Qi8u$/, /^inapp:map-pack-planner$/, /^wf:content-pipeline-drain$/, /^inapp:orbit-strategy$/] },
  { key: "report", label: "Reporting", line: "Results come back to the client", match: [/^wf:client-instagram-sync$/, /^fn:reviews$/, /^plan:live_client_dashboards$/, /^wf:agents-nightly$/] },
];
export function flowAgents(agents) {
  return FLOW_STEPS.map((s) => {
    const found = agents.filter((a) => s.match.some((re) => re.test(a.key) || re.test(String(a.name))));
    const ordered = found.sort((a, b) => s.match.findIndex((re) => re.test(a.key) || re.test(a.name)) - s.match.findIndex((re) => re.test(b.key) || re.test(b.name)));
    const live = ordered.filter((a) => a.status === "live");
    return { ...s, agents: ordered, live, planned: !live.length };
  });
}

// ---------------------------------------------------------------- what to strengthen next
const launchPillar = (i) => {
  const w = String(i.workstream || "");
  if (/^Client|Client apps|Portal/i.test(w)) return "delivery";
  if (/Billing|Accounts/i.test(w)) return "finance";
  if (/Security|Automations|Agents|M.thership/i.test(w)) return "systems";
  if (/Website|Brand/i.test(w)) return "marketing";
  return "owner";
};
const SENSITIVE = /card|password|secret|credential|exposed|leak|api[_ ]?key/i;
export function weakestPillars(scores, n = 3) {
  const list = Object.values(scores || {}).filter((p) => p && Number.isFinite(p.score)).sort((a, b) => a.score - b.score);
  return list.slice(0, n);
}
export function nextActions({ scores, agents, launchItems, n = 3, limit = 7, perPillar = 3 }) {
  const weak = weakestPillars(scores, n);
  const out = [];
  weak.forEach((p) => {
    const gap = (100 - p.score) / 50;
    agents.filter((a) => a.scope === "interstellar" && a.key !== "commander" && pillarOfAgent(a) === p.id && ["planned", "paused", "broken"].includes(a.status)).forEach((a) => {
      if (/one-time/i.test(a.name)) return;
      const base = a.status === "broken" ? 3 : a.status === "planned" ? 2 + ({ high: 1, medium: 0.5 }[a.build_priority] || 0) : 1 + (runs30(a) > 0 ? 0.3 : 0);
      out.push({ id: `a:${a.key}`, kind: a.status, pillar: p.id, pillarName: p.name || PILLAR_NAMES[p.id], score: base * gap, agentKey: a.key,
        title: `${a.status === "broken" ? "Repair" : a.status === "planned" ? "Bring online:" : "Restart"} ${investorize(a.name)}`,
        why: firstSentence(a.role, 120) });
    });
    (launchItems || []).filter((i) => i.blocking_launch && i.status !== "done" && i.status !== "deferred" && launchPillar(i) === p.id).forEach((i) => {
      if (/^Security$/i.test(i.workstream || "") || i.kind === "question" || SENSITIVE.test(i.title || "")) return;
      const base = 2 + (Number(i.priority) === 1 ? 1 : 0) + Math.min(1, (Number(i.unblocks) || 0) / 4);
      const title = investorize(String(i.title || "").replace(/^Approve,?\s+(and\s+)?/i, "").replace(/^\w/, (c) => c.toUpperCase()));
      out.push({ id: `l:${i.id}`, kind: "launch", pillar: p.id, pillarName: p.name || PILLAR_NAMES[p.id], score: base * gap, title: truncate(title, 96), why: i.unblocks ? `Clears the way for ${i.unblocks} more launch item${Number(i.unblocks) === 1 ? "" : "s"}.` : "Open item on the launch plan." });
    });
  });
  // Highest impact first, but every weak pillar keeps its top few so one pillar cannot crowd out the rest.
  const kept = weak.flatMap((p) => out.filter((x) => x.pillar === p.id).sort((a, b) => b.score - a.score).slice(0, perPillar));
  return { weak, actions: kept.sort((a, b) => b.score - a.score).slice(0, limit) };
}
