// Tiny CSV helpers for subscriber import / export (RFC 4180 quoting, header row required).

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  const s = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => String(c).trim()));
  if (!clean.length) return [];
  const head = clean[0].map((h) => String(h).trim().toLowerCase().replace(/[^a-z_]/g, "_"));
  const col = (names) => head.findIndex((h) => names.includes(h));
  const idx = {
    email: col(["email", "email_address", "e_mail"]),
    name: col(["name", "full_name", "first_name"]),
    business: col(["business", "company", "business_name"]),
    tags: col(["tags", "tag"]),
    status: col(["status"]),
  };
  if (idx.email < 0) throw new Error("The CSV needs an \"email\" column.");
  return clean.slice(1).map((r) => Object.fromEntries(Object.entries(idx).map(([k, i]) => [k, i >= 0 ? String(r[i] || "").trim() : ""])));
}

const q = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows, cols) {
  return [cols.join(","), ...rows.map((r) => cols.map((c) => q(Array.isArray(r[c]) ? r[c].join("; ") : r[c])).join(","))].join("\n");
}

export function downloadText(name, text, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
