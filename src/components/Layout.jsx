import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import SpaceBackground from "./SpaceBackground";
import PageBackground from "./PageBackground";
import TimeZoneBar from "./TimeZoneBar";

export default function Layout() {
  return (
    <div className="relative flex h-screen overflow-hidden">
      <SpaceBackground />
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <MobileNav />
      <main className="flex-1 overflow-y-auto relative z-10 w-full">
        <TimeZoneBar />
        <PageBackground />
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}