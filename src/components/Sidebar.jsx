import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, KeyRound, FileText, DollarSign, 
  Scale, Users, BarChart3, MessageSquare, Globe, 
  Wrench, Flame, TrendingUp, Settings, LogOut, ClipboardList
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const mainNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Logins", icon: KeyRound, path: "/logins" },
  { label: "Documents", icon: FileText, path: "/documents" },
  { label: "Financial", icon: DollarSign, path: "/financial" },
  { label: "Legal", icon: Scale, path: "/legal" },
  { label: "CRM", icon: Users, path: "/crm" },
  { label: "Analytics", icon: BarChart3, path: "/analytics" },
];

const portalNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/portal-dashboard" },
  { label: "Form Submissions", icon: ClipboardList, path: "/form-submissions" },
  { label: "Comms", icon: MessageSquare, path: "/comms" },
  { label: "Ørbit SEO", icon: Globe, path: "/orbit-seo" },
  { label: "Web Øps", icon: Wrench, path: "/web-ops" },
  { label: "Førge", icon: Flame, path: "/forge" },
  { label: "Performance", icon: TrendingUp, path: "/performance" },
];

export default function Sidebar() {
  const location = useLocation();

  const handleLogout = () => {
    base44.auth.logout();
  };

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
          ${isActive 
            ? "text-orange-500 bg-orange-500/10" 
            : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
      >
        <item.icon className={`w-[18px] h-[18px] transition-colors ${isActive ? "text-orange-500" : "text-white/40 group-hover:text-white/60"}`} />
        <span>{item.label}</span>
        {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-orange-500" />}
      </Link>
    );
  };

  return (
    <aside className="w-[220px] min-w-[220px] h-screen bg-sidebar flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center">
            <span className="text-white font-bold text-sm">IC</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-sm tracking-wide leading-none">INTERSTELLAR</h1>
            <p className="text-white/30 text-[10px] tracking-widest uppercase">Command</p>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {mainNav.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}

        {/* Divider */}
        <div className="py-3">
          <div className="border-t border-white/5" />
        </div>

        {/* Portal Label */}
        <p className="px-4 pb-1 text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">Portal</p>

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
        <div className="mt-2 px-4 py-2 rounded-lg bg-white/[0.02] border border-white/5">
          <p className="text-white/70 text-xs font-medium truncate">justin@interstellar...</p>
          <p className="text-orange-500/70 text-[10px] font-semibold tracking-wider uppercase">Admin</p>
        </div>
      </div>
    </aside>
  );
}