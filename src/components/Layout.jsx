import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import SpaceBackground from "./SpaceBackground";
import PageBackground from "./PageBackground";

export default function Layout() {
  return (
    <div className="relative flex h-screen overflow-hidden">
      <SpaceBackground />
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative z-10">
        <PageBackground />
        <div className="relative z-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}