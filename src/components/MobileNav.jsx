import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, KeyRound, FileText, DollarSign, 
  Scale, Users, BarChart3, MessageSquare, Globe, 
  Wrench, Flame, TrendingUp, Settings, LogOut, ClipboardList, Lightbulb, ListTodo,
  Menu, X
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

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    base44.auth.logout();
  };

  const NavItem = ({ item, onClick }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group
          ${isActive 
            ? "text-orange-500 bg-orange-500/10" 
            : "text-white/50 hover:text-white/80 hover:bg-white/5"
          }`}
      >
        <item.icon className={`w-5 h-5 transition-colors ${isActive ? "text-orange-500" : "text-white/40 group-hover:text-white/60"}`} />
        <span>{item.label}</span>
        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />}
      </Link>
    );
  };

  return (
    <>
      {/* Hamburger Button - Mobile Only */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-white/10 text-white/70 hover:text-white"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/95 backdrop-blur-sm">
          <div className="flex flex-col h-full p-4 pt-16">
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 pb-6 border-b border-white/5">
              <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center overflow-hidden border border-white/10">
                <img src="https://framerusercontent.com/images/lYN9zTgbln1GtT6KOSpG27mq3Q.png?scale-down-to=512&width=1563&height=1563" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="font-orbitron text-white font-bold text-sm tracking-wide leading-none">ZERØ GRAVITY</h1>
                <p className="font-orbitron text-white/30 text-[10px] tracking-widest uppercase">Portal</p>
              </div>
            </div>

            {/* Main Nav */}
            <nav className="flex-1 overflow-y-auto py-4 space-y-0.5">
              <p className="font-orbitron px-4 pb-2 text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">Command Center</p>
              {mainNav.map((item) => (
                <NavItem key={item.path} item={item} onClick={() => setIsOpen(false)} />
              ))}

              <div className="py-3">
                <div className="border-t border-white/5" />
              </div>

              <p className="font-orbitron px-4 pb-2 text-[10px] font-semibold tracking-[0.2em] text-white/25 uppercase">Portal</p>
              {portalNav.map((item) => (
                <NavItem key={item.path} item={item} onClick={() => setIsOpen(false)} />
              ))}
            </nav>

            {/* Bottom */}
            <div className="border-t border-white/5 pt-4 space-y-2">
              <Link
                to="/settings"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </Link>
              <button
                onClick={() => { handleLogout(); setIsOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-white/40 hover:text-red-400 hover:bg-white/5 transition-all w-full"
              >
                <LogOut className="w-5 h-5" />
                <span>Log Out</span>
              </button>
              
              {/* Profile */}
              <div className="mt-2 px-4 py-3 rounded-lg bg-white/[0.02] border border-white/5">
                <p className="text-white/70 text-xs font-medium truncate">justin@interstellar...</p>
                <p className="text-orange-500/70 text-[10px] font-semibold tracking-wider uppercase">Admin</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}