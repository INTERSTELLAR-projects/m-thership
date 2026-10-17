import { Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";
import SpaceBackground from "./SpaceBackground";
import PageBackground from "./PageBackground";
import TimeZoneBar from "./TimeZoneBar";
import CommandPalette from "./CommandPalette";

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

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="relative flex h-screen overflow-hidden">
      <SpaceBackground />

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 flex items-center justify-between px-3 bg-black/70 backdrop-blur-sm border-b border-white/[0.06]">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-1 text-white/70 hover:text-white transition-colors" aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-black flex items-center justify-center overflow-hidden border border-white/10">
            <img src="https://framerusercontent.com/images/lYN9zTgbln1GtT6KOSpG27mq3Q.png?scale-down-to-512&width=1563&height=1563" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-orbitron text-white font-bold text-xs tracking-wide leading-none">ZERØ GRAVITY</h1>
        </div>
        <div className="w-9" />
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]" />
      )}

      <Sidebar onOpenCommand={() => setCmdOpen(true)} open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="flex-1 overflow-y-auto relative z-10 pt-12 md:pt-0">
        <TimeZoneBar />
        <PageBackground />
        <div className="relative z-10 page-enter">
          <Outlet />
        </div>
      </main>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}