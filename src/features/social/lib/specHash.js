// Stable hash of what a post image is rendered from (template + spec). No imports on purpose.
// Must stay identical to specHash() in base44/shared/social.ts: the publisher refuses an image whose
// stored image_spec_hash doesn't match the post's current template + spec.

export function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
}

export function specHash(template, spec) {
  const s = stableStringify({ template: template || "", spec: spec || {} });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
