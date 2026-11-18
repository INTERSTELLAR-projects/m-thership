// Merge-tag fill for the portal preview (same rules as base44/shared/emailCore.ts personalize).
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const RAW = new Set(["unsubscribe_url", "review_link", "confirm_url"]);
export function personalize(tpl, vars, html) {
  return String(tpl ?? "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, k) => {
    const key = k.toLowerCase();
    let v = vars?.[key];
    if (v === undefined || v === null || String(v).trim() === "") v = key === "first_name" ? "there" : "";
    return html && !RAW.has(key) ? esc(v) : String(v);
  });
}

// Robust CSV -> { headers, rows } (RFC 4180 quotes, CRLF, BOM, ; or tab separated files too).
export function parseCsvRows(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const firstLine = s.split(/\r?\n/, 1)[0] || "";
  const sep = [",", ";", "\t"].map((c) => [c, firstLine.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => String(c).trim()));
  return { headers: (clean[0] || []).map((h) => String(h).trim()), rows: clean.slice(1) };
}
