import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/tasks", label: "Matrix" },
  { to: "/tasks/inbox", label: "Inbox" },
  { to: "/tasks/patterns", label: "Patterns" },
  { to: "/tasks/sops", label: "SOPs" },
  { to: "/projects", label: "Projects" }
];

export default function TasksNav() {
  const { pathname } = useLocation();
  const isActive = (to) =>
    to === "/tasks" ? pathname === "/tasks" || pathname === "/tasks/" : pathname === to || pathname.startsWith(to + "/");
  return (
    <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-hair px-5 md:px-8">
      {TABS.map((tab) => {
        const active = isActive(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "mono-label relative shrink-0 px-3 py-3 text-[10.5px] transition-colors",
              active ? "text-ink" : "text-ink/45 hover:text-ink"
            )}
          >
            {tab.label}
            {active ? <span className="absolute inset-x-3 bottom-[-1px] h-[2px] bg-[#ff3c00]" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
