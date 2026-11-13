// Deep links: /launch?item=<id>, /tasks?task=<id>, /pipeline?lead=<id> … land on the exact record.
// Pages tag each record's element with data-record-id; this waits for it to render (data loads async), scrolls it to
// the centre, focuses it and highlights it (.deeplink-hit). If the same record renders twice (table + cards), the
// visible one wins.
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export function useDeepLinkParam(name) {
  const [p] = useSearchParams();
  return p.get(name) || "";
}

export function findRecordEl(id) {
  if (!id || typeof document === "undefined") return null;
  const sel = `[data-record-id="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id}"]`;
  const all = [...document.querySelectorAll(sel)];
  return all.find((el) => el.offsetParent !== null || el.getClientRects().length) || null;
}

export function useDeepLinkFocus(id, deps = []) {
  useEffect(() => {
    if (!id) return undefined;
    let tries = 0;
    let dead = false;
    let timer = null;
    const tick = () => {
      if (dead) return;
      const el = findRecordEl(id);
      if (el) {
        const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
        try { el.focus({ preventScroll: true }); } catch { el.focus(); }
        el.classList.add("deeplink-hit");
        el.setAttribute("data-deeplink", "hit");
        return;
      }
      if (++tries < 75) timer = setTimeout(tick, 200);
    };
    timer = setTimeout(tick, 60);
    return () => { dead = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ...deps]);
}
