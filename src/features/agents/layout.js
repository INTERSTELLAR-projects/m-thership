// Constellation geometry. Pure functions: registry rows in, positioned nodes + edges out.
// Overview = brain at the center, CEO above it, department trees radiating outward.
// Department view = one tree fanning upward from its root (department name under the root).
import { INTERSTELLAR_DEPTS, CLIENT_DEPTS } from "./defs";

const RAD = Math.PI / 180;
const polar = (r, deg) => ({ x: Math.cos(deg * RAD) * r, y: Math.sin(deg * RAD) * r });

export function nodeRadius(a) {
  if (!a) return 6;
  if (a.status === "planned") return 5.5;
  const runs = Number(a.run_count_30d || a._runs30 || 0);
  return 6 + Math.min(5, Math.log2(1 + runs) * 1.1);
}

export function isRecent(a, hours = 26) {
  return a?.status === "live" && a.last_run_at && Date.now() - new Date(a.last_run_at).getTime() < hours * 3600e3;
}

// Group a department's agents into leaves, keeping branches together (branch order = first appearance by sort).
function groupLeaves(agents) {
  const sorted = [...agents].sort((a, b) => (a.sort ?? 100) - (b.sort ?? 100) || String(a.name).localeCompare(String(b.name)));
  const order = [];
  const by = new Map();
  sorted.forEach((a) => {
    const k = a.branch || "";
    if (!by.has(k)) { by.set(k, []); order.push(k); }
    by.get(k).push(a);
  });
  // Direct (no-branch) agents first, then branches.
  order.sort((x, y) => (x === "" ? -1 : y === "" ? 1 : 0));
  return order.map((k) => ({ branch: k, agents: by.get(k) }));
}

const agentNode = (a, x, y, extra = {}) => ({ id: `a:${a.key}`, type: "agent", label: a.name, x, y, r: nodeRadius(a), status: a.status, agent: a, dept: a.department, ...extra });

// ---------- overview ----------
export function buildOverview({ depts, agents, brain, ceo, keeper, centerLabel = "Company Brain", centerSub = "" }) {
  const nodes = [];
  const edges = [];
  nodes.push({ id: "brain", type: "brain", label: centerLabel, sub: centerSub, x: 0, y: 0, r: 44, brain });
  if (ceo) { nodes.push({ id: `a:${ceo.key}`, type: "ceo", label: ceo.name, x: 0, y: -175, r: 17, status: ceo.status, agent: ceo }); edges.push({ from: "brain", to: `a:${ceo.key}`, kind: "ceo" }); }
  if (keeper) { nodes.push(agentNode(keeper, 0, 165, { type: "agent", showLabel: true })); edges.push({ from: "brain", to: `a:${keeper.key}`, kind: "keeper" }); }

  const present = depts.map((d) => ({ ...d, agents: agents.filter((a) => a.department === d.key) })).filter((d) => d.agents.length || d.always);
  const weights = present.map((d) => d.agents.length + 3);
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const gap = 6;
  // Keep a clear wedge at the top for the CEO so its label never collides with a department.
  const topGap = ceo ? 52 : 0;
  const usable = 360 - gap * present.length - topGap;
  let cursor = -90 + topGap / 2;
  const R = 320;
  present.forEach((d, i) => {
    const span = (weights[i] / total) * usable;
    const mid = cursor + span / 2;
    const root = polar(R, mid);
    const rootId = `d:${d.key}`;
    const counts = countStatus(d.agents);
    nodes.push({ id: rootId, type: "dept", label: d.label, code: d.code, x: root.x, y: root.y, r: 13, dept: d.key, counts, angle: mid });
    edges.push({ from: "brain", to: rootId, kind: "trunk" });
    const groups = groupLeaves(d.agents);
    const leaves = groups.flatMap((g) => g.agents.map((a) => ({ a, g })));
    const n = leaves.length;
    const inner = span * 0.9;
    const step = n > 1 ? inner / (n - 1) : 0;
    const start = mid - (n > 1 ? inner / 2 : 0);
    const branchAngles = new Map();
    leaves.forEach(({ a, g }, idx) => {
      const ang = start + step * idx;
      const ring = g.branch ? 500 + (idx % 3) * 36 : 440 + (idx % 2) * 32;
      const p = polar(ring, ang);
      nodes.push(agentNode(a, p.x, p.y));
      if (g.branch) {
        const list = branchAngles.get(g.branch) || [];
        list.push(ang);
        branchAngles.set(g.branch, list);
        edges.push({ from: `b:${d.key}:${g.branch}`, to: `a:${a.key}` });
      } else edges.push({ from: rootId, to: `a:${a.key}` });
    });
    branchAngles.forEach((angs, b) => {
      const ang = angs.reduce((s, x) => s + x, 0) / angs.length;
      const p = polar(415, ang);
      nodes.push({ id: `b:${d.key}:${b}`, type: "branch", label: b, x: p.x, y: p.y, r: 4, dept: d.key });
      edges.push({ from: rootId, to: `b:${d.key}:${b}` });
    });
    cursor += span + gap;
  });
  return { nodes, edges };
}

// ---------- one department ----------
export function buildDeptView({ dept, agents }) {
  const nodes = [];
  const edges = [];
  const rootId = `d:${dept.key}`;
  nodes.push({ id: rootId, type: "dept", label: dept.label, code: dept.code, x: 0, y: 0, r: 18, dept: dept.key, counts: countStatus(agents), big: true });
  const groups = groupLeaves(agents);
  const leaves = groups.flatMap((g) => g.agents.map((a) => ({ a, g })));
  const n = leaves.length;
  const tiers = n > 14 ? 3 : n > 6 ? 2 : 1;
  const arc = n <= 3 ? 70 : n <= 8 ? 120 : 156;
  const start = -90 - arc / 2;
  const step = n > 1 ? arc / (n - 1) : 0;
  const base = Math.max(300, Math.min(520, 220 + n * 9));
  const branchAngles = new Map();
  leaves.forEach(({ a, g }, idx) => {
    const ang = n > 1 ? start + step * idx : -90;
    const r = base + (idx % tiers) * 92;
    const p = polar(r, ang);
    nodes.push(agentNode(a, p.x, p.y, { showLabel: true }));
    if (g.branch) {
      const list = branchAngles.get(g.branch) || [];
      list.push(ang);
      branchAngles.set(g.branch, list);
      edges.push({ from: `b:${dept.key}:${g.branch}`, to: `a:${a.key}` });
    } else edges.push({ from: rootId, to: `a:${a.key}` });
  });
  branchAngles.forEach((angs, b) => {
    const ang = angs.reduce((s, x) => s + x, 0) / angs.length;
    const p = polar(base * 0.52, ang);
    nodes.push({ id: `b:${dept.key}:${b}`, type: "branch", label: b, x: p.x, y: p.y, r: 5, dept: dept.key, showLabel: true });
    edges.push({ from: rootId, to: `b:${dept.key}:${b}` });
  });
  return { nodes, edges };
}

// ---------- clients overview ----------
export function buildClientsOverview({ clients, instances, brains }) {
  const nodes = [{ id: "hub", type: "brain", label: "Interstellar", sub: `${clients.length} clients`, x: 0, y: 0, r: 40 }];
  const edges = [];
  const n = clients.length || 1;
  const R = n > 10 ? 340 : 280;
  clients.forEach((c, i) => {
    const ang = -90 + (360 / n) * i;
    const p = polar(R, ang);
    const mine = instances.filter((a) => a.client_id === c.id);
    const counts = countStatus(mine);
    const brain = brains.find((b) => b.client_id === c.id);
    const id = `c:${c.id}`;
    nodes.push({ id, type: "client", label: c.business, x: p.x, y: p.y, r: 11 + Math.min(8, counts.live * 0.9), client: c, counts, brain, angle: ang, accent: c.accent });
    edges.push({ from: "hub", to: id, kind: "trunk" });
    const sats = [...mine].sort((a, b) => order(a.status) - order(b.status));
    const m = sats.length;
    sats.forEach((a, k) => {
      const sa = (360 / Math.max(m, 1)) * k + ang;
      const sp = polar(30 + (k % 2) * 7, sa);
      nodes.push({ id: `s:${a.key}`, type: "sat", x: p.x + sp.x, y: p.y + sp.y, r: 2.2, status: a.status, agent: a, parentId: id });
    });
  });
  return { nodes, edges };
}
const order = (s) => ({ live: 0, broken: 1, paused: 2, planned: 3 }[s] ?? 4);

export function countStatus(list) {
  const c = { live: 0, paused: 0, planned: 0, broken: 0, total: list.length };
  list.forEach((a) => { c[a.status] = (c[a.status] || 0) + 1; });
  return c;
}

export function bbox(nodes, pad = 80) {
  if (!nodes.length) return { x: -100, y: -100, w: 200, h: 200 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  nodes.forEach((n) => {
    const extra = n.showLabel || n.type === "dept" || n.type === "client" ? 70 : 20;
    x0 = Math.min(x0, n.x - n.r - extra); x1 = Math.max(x1, n.x + n.r + extra);
    y0 = Math.min(y0, n.y - n.r - 20); y1 = Math.max(y1, n.y + n.r + (n.showLabel || n.type !== "agent" ? 48 : 20));
  });
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

export function deptsFor(web) {
  return web === "clients" ? CLIENT_DEPTS : INTERSTELLAR_DEPTS;
}
