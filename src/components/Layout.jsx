import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import SpaceBackground from "./SpaceBackground";
import PageBackground from "./PageBackground";
import TimeZoneBar from "./TimeZoneBar";
import CommandPalette from "./CommandPalette";

export default function Layout() {
  const [cmdOpen, setCmdOpen] = useState(false);

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

  return (
    <div className="relative flex h-screen overflow-hidden">
      <SpaceBackground />
      <Sidebar onOpenCommand={() => setCmdOpen(true)} />
      <main className="flex-1 overflow-y-auto relative z-10">
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