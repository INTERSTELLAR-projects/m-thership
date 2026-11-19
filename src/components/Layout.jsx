import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { enableUsageLog, logPageView } from "@/lib/usageLog";
import { useAuth } from "@/lib/AuthContext";
import { Menu, Search } from "lucide-react";
import Sidebar from "./Sidebar";
import TimeZoneBar from "./TimeZoneBar";
import HubTabs from "./HubTabs";
import CommandPalette from "./CommandPalette";
import NavGuide, { NavGuideButton } from "./NavGuide";
import GridTrail from "./GridTrail";
import BrandLockup from "@/components/brand/BrandLockup";
import AccountingNotices from "@/features/accounting/AccountingNotices";
import ErrorBoundary from "@/components/ErrorBoundary";
import { usePolicySweep } from "@/features/launch/usePolicySweep";
import { useSidebarPinned } from "@/components/navPrefs";
import AskBar from "@/features/command/AskBar";
import { PresentationButton, PresentationHidden } from "@/components/PresentationMode";
import { IS_PRESENTING } from "@/lib/presentation";
import { isPresentHidden } from "@/lib/nav";

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
// "G then …" jumps (Møthership Command): T Today · P Pillars · B Brain · W Walk · C Classic.
const G_JUMPS = { t: "/", p: "/pillars", b: "/brain", w: "/walk", c: "/classic" };

export default function Layout() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinned, setPinned] = useSidebarPinned();
  const location = useLocation();
  const navigate = useNavigate();
  const gAt = useRef(0);
  // Applies Justin's approval policy in the background (auto/notify gates; logged to Live Ops).
  usePolicySweep();

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (k === "g") { gAt.current = Date.now(); return; }
      if (gAt.current && Date.now() - gAt.current < 1200 && G_JUMPS[k]) { e.preventDefault(); gAt.current = 0; navigate(G_JUMPS[k]); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  // Private usage log (Justin's own sessions only; off in Presentation mode and QA previews).
  const { user: me } = useAuth();
  useEffect(() => { enableUsageLog(me); }, [me]);
  useEffect(() => { logPageView(location, document.title); }, [location.pathname, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex h-screen overflow-hidden bg-canvas text-ink">
      <GridTrail />

      {/* Top bar: always on phones; on desktop whenever the sidebar is not pinned open. */}
      <header className={`fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between gap-2 border-b border-hair bg-canvas/95 px-3 backdrop-blur ${pinned ? "md:hidden" : ""}`}>
        <button onClick={() => setMobileOpen(true)} className="-ml-1 flex items-center gap-2 p-2 text-ink/70 hover:text-ink" aria-label="Open all pages">
          <Menu className="h-5 w-5" />
          <span className="hidden text-[12.5px] md:inline">All pages</span>
        </button>
        <Link to="/" aria-label="Møthership Command, Today"><BrandLockup word="MØTHERSHIP" sub="by Interstellar" size={16} /></Link>
        <div className="flex items-center">
          <PresentationButton />
          <NavGuideButton />
          <button onClick={() => setCmdOpen(true)} className="flex items-center gap-2 p-2 text-ink/60 hover:text-ink" aria-label="Search pages, clients and actions">
            <Search className="h-4 w-4" />
            <kbd className="hidden font-mono text-[10px] text-ink/40 md:inline">⌘K</kbd>
          </button>
        </div>
      </header>

      {mobileOpen && <div onClick={() => setMobileOpen(false)} className={`fixed inset-0 z-40 bg-ink/40 ${pinned ? "md:hidden" : ""}`} />}

      <Sidebar onOpenCommand={() => { setMobileOpen(false); setCmdOpen(true); }} open={mobileOpen} onClose={() => setMobileOpen(false)} pinned={pinned} onTogglePin={() => setPinned((p) => !p)} />
      <main data-trail className={`grid-canvas relative z-10 flex-1 overflow-y-auto pt-12 ${pinned ? "md:pt-0" : ""}`}>
        <TimeZoneBar />
        <ErrorBoundary compact where="hub tabs"><HubTabs /></ErrorBoundary>
        <div key={location.pathname} data-trail className="page-enter relative z-10 pb-24">
          <ErrorBoundary where="admin route" resetKey={location.pathname}>
            {IS_PRESENTING && isPresentHidden(location.pathname) ? <PresentationHidden /> : <Outlet />}
          </ErrorBoundary>
        </div>
      </main>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <NavGuide />
      <ErrorBoundary compact where="ask bar"><AskBar /></ErrorBoundary>
      <ErrorBoundary compact where="accounting notices"><AccountingNotices /></ErrorBoundary>
    </div>
  );
}
