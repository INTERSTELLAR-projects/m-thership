// Brand filter for Møthership: "all" (default), "direct" (Interstellar direct = no brand_id) or a Brand id.
// Kept per browser (localStorage) and broadcast with a window event so every page that lists clients updates at once.
import { useEffect, useState } from "react";

const KEY = "ms_brand_filter";
const EVT = "ms-brand-filter";

export function getBrandFilter() {
  try { return localStorage.getItem(KEY) || "all"; } catch { return "all"; }
}
export function setBrandFilter(v) {
  try { if (!v || v === "all") localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new CustomEvent(EVT, { detail: v || "all" })); } catch { /* no window */ }
}
export function useBrandFilter() {
  const [v, setV] = useState(getBrandFilter);
  useEffect(() => {
    const on = (e) => setV((e && e.detail) || getBrandFilter());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return [v, setBrandFilter];
}

// rootId: the Interstellar root brand id; a client with brand_id = root counts as direct too.
export function matchesBrand(client, filter, rootId) {
  if (!filter || filter === "all") return true;
  const b = (client && client.brand_id) || "";
  if (filter === "direct") return !b || b === rootId;
  if (filter === rootId) return !b || b === rootId;
  return b === filter;
}
