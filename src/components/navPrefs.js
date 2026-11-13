// Per-browser sidebar preferences: pinned pages.
// Conveniences only: every read and write is guarded (private windows, blocked storage) and the nav works without them.
import { useEffect, useState } from "react";

const KEYS = { pins: "ms.nav.pins", sidebarPinned: "ms.nav.sidebarPinned" };
const EVT = "ms-nav-prefs";

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: keep it in memory only */ }
  try { window.dispatchEvent(new CustomEvent(EVT, { detail: key })); } catch { /* ignore */ }
}

function usePref(name, fallback) {
  const key = KEYS[name];
  const [value, setValue] = useState(() => read(key, fallback));
  useEffect(() => {
    const on = (e) => { if (!e.detail || e.detail === key) setValue(read(key, fallback)); };
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, [key]);
  const set = (next) => {
    const v = typeof next === "function" ? next(read(key, fallback)) : next;
    setValue(v);
    write(key, v);
  };
  return [value, set];
}

export const usePins = () => usePref("pins", []);
// Møthership Command: the sidebar is an "All pages" drawer by default; pin it to keep it open on desktop.
export const useSidebarPinned = () => usePref("sidebarPinned", false);
