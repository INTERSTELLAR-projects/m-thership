// PRESENTATION MODE: an admin-only switch for showing Møthership to prospects on a screen share.
// While it is on, src/lib/qa.js swaps the whole data layer for the fictional demo book (src/lib/demoData.js):
// every page keeps working and looks full, but no real revenue, client, invoice, bank or personal record is read,
// and nothing typed is written anywhere (writes stay in memory and vanish on reload).
// It lasts for this browser tab's session (sessionStorage), and AuthContext checks the real login is an admin
// before anything shows. Shortcut: Alt+Shift+P (Option+Shift+P on a Mac), the top bar button, or ⌘K "Presentation mode".
// No imports: qa.js loads this before the SDK client exists.

const KEY = "ms_present";
let on = false;
try { on = typeof window !== "undefined" && window.sessionStorage.getItem(KEY) === "1"; } catch { on = false; }
export const IS_PRESENTING = on;
export const PRESENT_SHORTCUT = "Alt+Shift+P";

// Turning it on or off reloads the app so the data layer is swapped cleanly (no real data left in caches).
export function startPresentation() {
  try { window.sessionStorage.setItem(KEY, "1"); } catch { return; }
  window.location.assign("/");
}
export function endPresentation(reload = true) {
  try { window.sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  if (reload) window.location.reload();
}
export function togglePresentation() {
  if (IS_PRESENTING) endPresentation(); else startPresentation();
}
export const isPresentShortcut = (e) => e.altKey && e.shiftKey && !e.metaKey && !e.ctrlKey && (e.code === "KeyP" || String(e.key).toLowerCase() === "p");
