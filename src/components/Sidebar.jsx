import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, KeyRound, FileText, DollarSign, 
  Scale, Users, BarChart3, MessageSquare, Globe, 
  Wrench, Flame, TrendingUp, Settings, LogOut, ClipboardList, Lightbulb, ListTodo, ChevronLeft, ChevronRight
} from "lucide-react";
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

export default function Sidebar({ collapsed, onToggle }) {
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
          } ${collapsed ? "justify-center" : ""}`}
      >
        <item.icon className={`w-[18px] h-[18px] transition-colors ${isActive ? "text-orange-500" : "text-white/40 group-hover:text-white/60"}`} />
        {!collapsed && <span>{item.label}</span>}
        {!collapsed && isActive && <div className="ml-auto w-1 h-1 rounded-full bg-orange-500" />}
      </Link>
    );
  };

  return (
    <aside className={`${collapsed ? "w-[60px] min-w-[60px]" : "w-[220px] min-w-[220px]"} h-screen bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300`}>
      {/* Logo & Toggle */}
      <div className="px-5 pt-6 pb-4">
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
          <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
            <img src="https://framerusercontent.com/images/lYN9zTgbln1GtT6KOSpG27mq3Q.png?scale-down-to=512&width=1563&height=1563" alt="Logo" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-orbitron text-white font-bold text-sm tracking-wide leading-none">ZERØ GRAVITY</h1>
              <p className="font-orbitron text-white/30 text-[10px] tracking-widest uppercase">Portal</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {!collapsed && <p className="font-orbitron px-4 pb-1 text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">Command Center</p>}
        {collapsed && <div className="h-2" />}

        {mainNav.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}

        {/* Divider */}
        <div className="py-3">
          <div className="border-t border-white/5" />
        </div>

        {/* Portal Label */}
        {!collapsed && <p className="font-orbitron px-4 pb-1 text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">Portal</p>}
        {collapsed && <div className="h-2" />}

        {portalNav.map((item) => (
          <NavItem key={item.path} item={item} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-white/5 space-y-1">
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all ${collapsed ? "justify-center" : ""}`}
        >
          <Settings className="w-[18px] h-[18px]" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-white/40 hover:text-red-400 hover:bg-white/5 transition-all ${collapsed ? "justify-center w-auto" : "w-full"}`}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Log Out</span>}
        </button>
        
        {/* Profile */}
        {!collapsed && (
          <div className="mt-2 px-4 py-2 rounded-lg bg-white/[0.02] border border-white/5">
            <p className="text-white/70 text-xs font-medium truncate">justin@interstellar...</p>
            <p className="text-orange-500/70 text-[10px] font-semibold tracking-wider uppercase">Admin</p>
          </div>
        )}
      </div>
    </aside>
  );
}