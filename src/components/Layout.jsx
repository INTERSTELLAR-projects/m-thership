import { Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import TimeZoneBar from "./TimeZoneBar";
import CommandPalette from "./CommandPalette";
import GridTrail from "./GridTrail";
import { LOGO_URL } from "@/lib/nav";

export default function Layout() {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-canvas text-ink">
      <GridTrail />

      {/* Mobile top bar */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-hair bg-canvas/95 px-3 backdrop-blur md:hidden">
        <button onClick={() => setMobileOpen(true)} className="-ml-1 p-2 text-ink/70 hover:text-ink" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src={LOGO_URL} alt="" className="h-6 w-8 object-contain" />
          <span className="text-[13px] font-semibold tracking-[-0.02em]">MØTHERSHIP</span>
        </div>
        <div className="w-9" />
      </header>

      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-ink/40 md:hidden" />}

      <Sidebar onOpenCommand={() => setCmdOpen(true)} open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main data-trail className="grid-canvas relative z-10 flex-1 overflow-y-auto pt-12 md:pt-0">
        <TimeZoneBar />
        <div key={location.pathname} data-trail className="page-enter relative z-10">
          <Outlet />
        </div>
      </main>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
