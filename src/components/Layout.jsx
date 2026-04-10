import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import SpaceBackground from "./SpaceBackground";
import PageBackground from "./PageBackground";
import TimeZoneBar from "./TimeZoneBar";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden">
      <SpaceBackground />
      {/* Mobile toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-white/10 text-white/60 hover:text-white"
      >
        <Menu className="w-5 h-5" />
      </button>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex-1 overflow-y-auto relative z-10">
        <TimeZoneBar />
        <PageBackground />
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}