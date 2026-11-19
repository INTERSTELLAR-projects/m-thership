// Universe layout: a top-down tidy tree over the OPEN part of the hierarchy only. When a node has many closed children
// of the same kind (clients, industry groups) they are packed into a grid "shelf" instead of one very long row, so the
// view stays readable at 100+ clients. Open children are laid out as their own subtrees next to the shelf.
export const GAP_X = 30;
export const GAP_Y = 104;
export const CELL_GAP = 16;
export const SHELF_HEAD = 34;
export const SHELF_MIN = 7;
const GRIDDABLE = new Set(["client", "group", "dept", "out"]);

export function layoutTree(nodes, rootId, open, { maxCols = 6 } = {}) {
  const isOpen = (id) => open.has(id) && nodes[id] && nodes[id].children.length > 0;
  const memo = {};

  const unitsOf = (id) => {
    const kids = nodes[id].children.filter((k) => nodes[k]);
    const closed = kids.filter((k) => !isOpen(k) && GRIDDABLE.has(nodes[k].type));
    const shelf = closed.length >= SHELF_MIN ? closed : [];
    const inShelf = new Set(shelf);
    const units = [];
    let shelfAdded = false;
    kids.forEach((k) => {
      if (inShelf.has(k)) {
        if (shelfAdded) return;
        shelfAdded = true;
        const lanes = nodes[shelf[0]].type === "dept" || nodes[shelf[0]].type === "out";
        const want = lanes ? Math.min(5, Math.max(4, Math.ceil(shelf.length / 2))) : Math.min(6, Math.max(3, Math.ceil(Math.sqrt(shelf.length * 1.7))));
        const cols = Math.max(1, Math.min(want, maxCols));
        const cw = Math.max(...shelf.map((x) => nodes[x].w));
        const rows = [];
        for (let i = 0; i < shelf.length; i += cols) rows.push(shelf.slice(i, i + cols));
        const rowH = rows.map((r) => Math.max(...r.map((x) => nodes[x].h)));
        const w = cols * cw + (cols - 1) * CELL_GAP + 2 * CELL_GAP;
        const h = SHELF_HEAD + rowH.reduce((t, x) => t + x, 0) + (rows.length - 1) * CELL_GAP + CELL_GAP;
        units.push({ kind: "shelf", id: `shelf:${id}`, ids: shelf, cols, cw, rows, rowH, w, h, lanes });
      } else units.push({ kind: "node", id: k, w: measure(k) });
    });
    return units;
  };

  function measure(id) {
    const n = nodes[id];
    if (!isOpen(id)) { memo[id] = { w: n.w, units: [] }; return n.w; }
    const units = unitsOf(id);
    const total = units.reduce((t, u) => t + u.w, 0) + GAP_X * Math.max(0, units.length - 1);
    memo[id] = { w: Math.max(n.w, total), units, total };
    return memo[id].w;
  }

  const pos = {};
  const links = [];
  const shelves = [];
  function place(id, left, top) {
    const n = nodes[id];
    const m = memo[id];
    const x = left + (m.w - n.w) / 2;
    pos[id] = { x, y: top, w: n.w, h: n.h };
    if (!m.units.length) return;
    const childTop = top + n.h + GAP_Y;
    let cx = left + (m.w - m.total) / 2;
    m.units.forEach((u) => {
      if (u.kind === "node") {
        place(u.id, cx, childTop);
        links.push({ id: `${id}>${u.id}`, from: id, to: u.id });
      } else {
        const sh = { id: u.id, parent: id, x: cx, y: childTop, w: u.w, h: u.h, count: u.ids.length, of: nodes[u.ids[0]].type };
        shelves.push(sh);
        links.push({ id: `${id}>${u.id}`, from: id, to: u.id, shelf: true });
        let yy = childTop + SHELF_HEAD;
        u.rows.forEach((r, ri) => {
          r.forEach((k, ci) => { pos[k] = { x: cx + CELL_GAP + ci * (u.cw + CELL_GAP), y: yy, w: nodes[k].w, h: nodes[k].h, shelf: u.id }; });
          yy += u.rowH[ri] + CELL_GAP;
        });
      }
      cx += u.w + GAP_X;
    });
  }

  measure(rootId);
  place(rootId, 0, 0);
  const all = [...Object.values(pos), ...shelves];
  const W = Math.max(...all.map((p) => p.x + p.w));
  const H = Math.max(...all.map((p) => p.y + p.h));
  const shelfBy = Object.fromEntries(shelves.map((s) => [s.id, s]));
  return { pos, links, shelves, shelfBy, W, H };
}

// The box that frames a node and everything open beneath it (for "fly to").
export function subtreeBox(nodes, lay, id) {
  const ids = [id];
  const out = [];
  while (ids.length) {
    const k = ids.pop();
    const p = lay.pos[k];
    if (!p) continue;
    out.push(p);
    nodes[k].children.forEach((c) => { if (lay.pos[c]) ids.push(c); });
  }
  lay.shelves.filter((s) => s.parent === id).forEach((s) => out.push(s));
  if (!out.length) return null;
  const x = Math.min(...out.map((p) => p.x));
  const y = Math.min(...out.map((p) => p.y));
  return { x, y, w: Math.max(...out.map((p) => p.x + p.w)) - x, h: Math.max(...out.map((p) => p.y + p.h)) - y };
}

// Elbow curve from the bottom of a parent to the top of a child.
export function linkPath(a, b) {
  const x1 = a.x + a.w / 2;
  const y1 = a.y + a.h;
  const x2 = b.x + b.w / 2;
  const y2 = b.y;
  const my = y1 + (y2 - y1) * 0.5;
  return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
}
