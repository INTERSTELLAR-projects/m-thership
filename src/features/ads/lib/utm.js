// UTM builder. Keeps any query already on the destination, overwrites only the utm_* keys we set.
export const UTM_FIELDS = [
  { key: "source", label: "utm_source", hint: "facebook / instagram / google" },
  { key: "medium", label: "utm_medium", hint: "paid_social / cpc" },
  { key: "campaign", label: "utm_campaign", hint: "campaign slug" },
  { key: "content", label: "utm_content", hint: "creative / variant" },
  { key: "term", label: "utm_term", hint: "audience or keyword" },
];

export const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export function buildUrl(dest, utm = {}) {
  if (!dest) return "";
  try {
    const u = new URL(dest);
    for (const f of UTM_FIELDS) {
      const v = String(utm[f.key] || "").trim();
      if (v) u.searchParams.set(`utm_${f.key}`, v);
      else u.searchParams.delete(`utm_${f.key}`);
    }
    return u.toString();
  } catch {
    return dest;
  }
}

export const isHttps = (u) => /^https:\/\/[^\s]+\.[^\s]+/i.test(String(u || ""));
