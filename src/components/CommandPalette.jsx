import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Users, FolderKanban, CornerDownLeft, Sparkles, RefreshCw, Zap, Brain, Headphones, Orbit, Sun, LayoutDashboard, ListPlus, Receipt, Mail, Rocket, Presentation } from "lucide-react";
import { IS_PRESENTING, togglePresentation } from "@/lib/presentation";
import { base44 } from "@/api/base44Client";
import { ALL_NAV } from "@/lib/nav";
import { usePins } from "@/components/navPrefs";

// ⌘K / "Jump to…" palette: pages, clients and projects in one list.
// Light paper styling to match the app (the old dark panel hid its dark text).

import { itemsOf } from "@/features/tasks/lib/clients";

let cache = null; // { clients, projects } kept for the session so reopening is instant

// Møthership Command actions: the palette is the primary navigation, so it also does things, not just opens pages.
const askWith = (text, send = false) => window.dispatchEvent(new CustomEvent("command:ask", { detail: { text, send } }));
const ACTIONS = [
  { key: "a:today", label: "Today (Command home)", hint: "G T", icon: Sun, path: "/" },
  { key: "a:launchweek", label: "Launch Week · 7 sites", hint: "Answer the launch questions per client", icon: Rocket, path: "/command/launch-week" },
  { key: "a:replan", label: "Re-plan my day", hint: "Rebuild today's plan now", icon: RefreshCw, path: "/", after: () => window.dispatchEvent(new Event("command:replan")) },
  { key: "a:cameup", label: "Something came up…", hint: "Re-plan around an interruption", icon: Zap, run: () => askWith("Something came up: ") },
  { key: "a:task", label: "New task…", hint: "Say or type it", icon: ListPlus, run: () => askWith("Add task: ") },
  { key: "a:email", label: "Draft an email…", hint: "Waits for your OK before sending", icon: Mail, run: () => askWith("Draft an email to ") },
  { key: "a:expense", label: "Log an expense…", hint: "Waits for your OK", icon: Receipt, run: () => askWith("Log an expense: ") },
  { key: "a:brain", label: "Teach the Brain", hint: "G B", icon: Brain, path: "/brain" },
  { key: "a:pillars", label: "Pillars compass", hint: "G P", icon: Orbit, path: "/pillars" },
  { key: "a:walk", label: "Walk mode", hint: "G W · hands-free brief", icon: Headphones, path: "/walk" },
  { key: "a:classic", label: "Classic dashboard", hint: "G C · Mission Control", icon: LayoutDashboard, path: "/classic" },
  { key: "a:present", label: IS_PRESENTING ? "Leave Presentation mode" : "Presentation mode (sample data for screen shares)", hint: "Alt+Shift+P", icon: Presentation, run: togglePresentation },
].map((a) => ({ ...a, group: "Actions" }));

async function loadRecords() {
  if (cache) return cache;
  const [clients, projects] = await Promise.all([
    base44.entities.CRMClient.list({ sort: "business", limit: 300 }).then(itemsOf).catch(() => []),
    base44.entities.Project.list({ sort: "-updated_date", limit: 300 }).then(itemsOf).catch(() => []),
  ]);
  cache = { clients, projects };
  setTimeout(() => { cache = null; }, 5 * 60 * 1000);
  return cache;
}

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [records, setRecords] = useState({ clients: [], projects: [] });
  const navigate = useNavigate();
  const [pins] = usePins();
  const inputRef = useRef();
  const listRef = useRef();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    setTimeout(() => inputRef.current?.focus(), 50);
    loadRecords().then(setRecords);
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s) => !q || String(s || "").toLowerCase().includes(q);
    // Pages match on their name or their section ("studios", "finance"…); pinned pages lead when nothing is typed.
    const pinned = (pins || []).map((k) => ALL_NAV.find((c) => c.key === k)).filter(Boolean);
    const actions = ACTIONS.filter((a) => match(a.label) || match(a.hint));
    const askItem = q ? [{ key: "a:ask", group: "Actions", label: `Ask Møthership: “${query.trim()}”`, hint: "Enter", icon: Sparkles, run: () => askWith(query.trim(), true) }] : [];
    const pages = ALL_NAV.filter((c) => match(c.label) || match(c.group)).map((c) => ({
      key: "p:" + c.key, group: "Pages", label: c.label, hint: c.group, icon: c.icon, path: c.path,
    }));
    if (!q) {
      const pin = pinned.map((c) => ({ key: "pin:" + c.key, group: "Pinned", label: c.label, hint: c.group, icon: c.icon, path: c.path }));
      return [...ACTIONS.slice(0, 3), ...pin, ...pages.filter((p) => !pinned.some((c) => "p:" + c.key === p.key)), ...ACTIONS.slice(3)];
    }
    const clients = records.clients
      .filter((c) => match(c.business) || match(c.contact))
      .slice(0, 8)
      .map((c) => ({
        key: "c:" + c.id, group: "Clients", label: c.business || c.contact || "Client",
        hint: c.status || "", icon: Users, path: "/clients/" + c.id,
      }));
    const projects = records.projects
      .filter((p) => match(p.name || p.title) || match(p.client_name))
      .slice(0, 8)
      .map((p) => ({
        key: "j:" + p.id, group: "Projects", label: p.name || p.title || "Project",
        hint: p.client_name || "", icon: FolderKanban, path: "/projects/" + p.id,
      }));
    const found = [...actions, ...pages, ...clients, ...projects];
    return found.length ? [...found, ...askItem] : askItem;
  }, [query, records, pins]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const go = (r) => {
    const item = typeof r === "string" ? { path: r } : r;
    onClose();
    if (item.path) navigate(item.path);
    if (item.run) setTimeout(item.run, 30);
    if (item.after) setTimeout(item.after, 400);
  };

  const handleKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      if (results[selected]) go(results[selected]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  let lastGroup = null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-lg overflow-hidden rounded-md border border-black/10 bg-[#f6f4f1] text-[#1a1a1a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-black/45" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Jump anywhere, or ask Møthership…"
            className="flex-1 bg-transparent text-sm text-[#1a1a1a] outline-none placeholder:text-black/40"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-black/40 hover:text-black/70" aria-label="Clear">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="rounded border border-black/10 bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-black/45">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-black/45">Type something to search or ask</p>
          ) : (
            results.map((r, i) => {
              const header = r.group !== lastGroup && (query.trim() || r.group === "Pinned" || r.group === "Actions" || lastGroup === "Pinned" || lastGroup === "Actions") ? r.group : null;
              lastGroup = r.group;
              const Icon = r.icon;
              const active = selected === i;
              return (
                <div key={r.key}>
                  {header && (
                    <p className="px-4 pb-1 pt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-black/40">{header}</p>
                  )}
                  <button
                    data-index={i}
                    onClick={() => go(r)}
                    onMouseEnter={() => setSelected(i)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      active ? "bg-[#ff3c00]/10 text-[#1a1a1a]" : "text-black/70 hover:text-black"
                    }`}
                  >
                    {Icon ? <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#ff3c00]" : "text-black/40"}`} /> : null}
                    <span className="truncate">{r.label}</span>
                    {r.hint ? <span className="truncate text-[11px] text-black/40">{r.hint}</span> : null}
                    {active && <CornerDownLeft className="ml-auto h-3.5 w-3.5 shrink-0 text-black/40" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-black/10 px-4 py-2.5 text-[10px] text-black/45">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto font-mono">⌘K</span>
        </div>
      </div>
    </div>
  );
}
