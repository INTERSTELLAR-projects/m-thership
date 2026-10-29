import { Link, useLocation } from "react-router-dom";
import { LogOut, Search, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { NAV_GROUPS, SETTINGS_ITEM, LOGO_URL } from "@/lib/nav";

function NavItem({ item, onClose }) {
  const location = useLocation();
  const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
  return (
    <Link
      to={item.path}
      onClick={onClose}
      className={`group relative flex items-center gap-3 px-3 py-[9px] text-[13.5px] transition-colors duration-200 ${
        active ? "bg-ink text-white" : "text-ink/70 hover:text-ink hover:bg-ink/[0.05]"
      }`}
    >
      {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#ff3c00]" />}
      <item.icon className={`h-[16px] w-[16px] shrink-0 transition-colors ${active ? "text-[#ff3c00]" : "text-ink/45 group-hover:text-[#ff3c00]"}`} strokeWidth={1.75} />
      <span className="truncate font-medium tracking-[-0.01em]">{item.label}</span>
    </Link>
  );
}

export default function Sidebar({ onOpenCommand, open, onClose }) {
  const { user } = useAuth();
  const email = user?.email || "";
  const initial = (user?.full_name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-hair bg-canvas transition-transform duration-300 ${
        open ? "translate-x-0" : "-translate-x-full"
      } md:static md:w-[232px] md:min-w-[232px] md:translate-x-0`}
    >
      {/* Brand */}
      <div className="flex h-[60px] items-center justify-between border-b border-hair px-4">
        <Link to="/" onClick={onClose} className="flex items-center gap-2.5">
          <img src={LOGO_URL} alt="" className="h-7 w-9 object-contain" />
          <div className="leading-none">
            <p className="text-[15px] font-semibold tracking-[-0.03em] text-ink">
              MØTHERSHIP<span className="align-super text-[8px] text-[#ff3c00]">®</span>
            </p>
            <p className="mono-label mt-1 text-[9px] text-ink/45">Interstellar</p>
          </div>
        </Link>
        <button onClick={onClose} className="p-1.5 text-ink/50 hover:text-ink md:hidden" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick navigate */}
      <div className="border-b border-hair p-3">
        <button
          onClick={onOpenCommand}
          className="flex w-full items-center gap-2.5 border border-hair bg-paper px-3 py-2 text-xs text-ink/50 transition-colors hover:border-ink/40 hover:text-ink"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Jump to…</span>
          <kbd className="ml-auto font-mono text-[10px] text-ink/40">⌘K</kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="mb-4">
            <p className="label-cross px-4 pb-2 text-[10.5px] text-ink/55">({g.label})</p>
            <div className="space-y-px">
              {g.items.map((item) => (
                <NavItem key={item.path} item={item} onClose={onClose} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-hair">
        <NavItem item={SETTINGS_ITEM} onClose={onClose} />
        <div className="flex items-center gap-3 border-t border-hair px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#ff3c00] text-[12px] font-semibold text-white">{initial}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-ink">{email}</p>
            <p className="mono-label text-[9px] text-[#ff3c00]">{user?.role === "admin" ? "Admin" : "Client"}</p>
          </div>
          <button onClick={() => base44.auth.logout()} className="p-1.5 text-ink/45 transition-colors hover:text-[#ff3c00]" aria-label="Log out" title="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
