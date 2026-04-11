import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, KeyRound, FileText, DollarSign, 
  Scale, Users, BarChart3, MessageSquare, Globe, 
  Wrench, Flame, TrendingUp, Settings, LogOut, ClipboardList, Lightbulb, ListTodo, FolderKanban, Crown, Search
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

const mainNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Logins", icon: KeyRound, path: "/logins" },
  { label: "Documents", icon: FileText, path: "/documents" },
  { label: "Financial", icon: DollarSign, path: "/financial" },
  { label: "Legal", icon: Scale, path: "/legal" },
  { label: "CRM", icon: Users, path: "/crm" },
  { label: "Idea Vault", icon: Lightbulb, path: "/idea-vault" },
  { label: "To-Do", icon: ListTodo, path: "/todo" },
  { label: "Comms", icon: MessageSquare, path: "/comms" },
];

const portalNav = [
  { label: "Client Projects", icon: FolderKanban, path: "/client-projects" },
  { label: "Requests", icon: ClipboardList, path: "/requests" },
  { label: "Ørbit SEO", icon: Globe, path: "/orbit-seo" },
  { label: "Web Øps", icon: Wrench, path: "/web-ops" },
  { label: "Førge", icon: Flame, path: "/forge" },
  { label: "Performance", icon: TrendingUp, path: "/performance" },
  { label: "Prestige", icon: Crown, path: "/prestige" },
];

export default function Sidebar({ onOpenCommand }) {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const handleLogout = () => {
    base44.auth.logout();
  };

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        className={`relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
          ${
            isActive
              ? "text-orange-500 bg-orange-500/10"
              : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-orange-500 rounded-r-full" />
        )}
        <item.icon className={`w-[18px] h-[18px] transition-colors shrink-0 ${
          isActive ? "text-orange-500" : "text-white/40 group-hover:text-white/60"
        }`} />
        <span className="truncate">{item.label}</span>
        {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-orange-500" />}
      </Link>
    );
  };

  return (
    <aside className="w-[220px] min-w-[220px] h-screen bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center overflow-hidden border border-white/10">
            <img src="https://framerusercontent.com/images/lYN9zTgbln1GtT6KOSpG27mq3Q.png?scale-down-to=512&width=1563&height=1563" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-orbitron text-white font-bold text-sm tracking-wide leading-none">ZERØ GRAVITY</h1>
            <p className="font-orbitron text-white/30 text-[10px] tracking-widest uppercase">Portal</p>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {/* Command palette trigger */}
        <button
          onClick={onOpenCommand}
          className="w-full flex items-center gap-2.5 px-4 py-2 mb-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-white/25 hover:text-white/50 hover:bg-white/[0.04] hover:border-white/[0.10] transition-all text-xs"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Quick navigate...</span>
          <kbd className="ml-auto font-mono text-[10px] bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">⌘K</kbd>
        </button>

        {isAdmin && (
          <>
            <p className="font-orbitron px-4 pb-1 text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">Command Center</p>
            {mainNav.map((item) => (
              <NavItem key={item.path} item={item} />
            ))}
          </>
        )}

        {/* Divider */}
        <div className="py-3">
          <div className="border-t border-white/5" />
        </div>

        {/* Portal Label */}
        <p className="font-orbitron px-4 pb-1 text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">Portal</p>

        {portalNav.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-white/5 space-y-1">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
        >
          <Settings className="w-[18px] h-[18px]" />
          <span>Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-white/40 hover:text-red-400 hover:bg-white/5 transition-all w-full"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span>Log Out</span>
        </button>
        
        {/* Profile */}
        <div className="mt-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-orange-500/[0.06] to-transparent border border-orange-500/10 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-[10px] font-bold text-orange-400 shrink-0">J</div>
          <div className="min-w-0">
            <p className="text-white/70 text-xs font-medium truncate">justin@interstellar...</p>
            <p className="text-orange-500/70 text-[10px] font-semibold tracking-wider uppercase">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}