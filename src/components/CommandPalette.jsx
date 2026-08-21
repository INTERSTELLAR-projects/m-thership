import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, KeyRound, FileText, DollarSign, Scale, Users,
  Lightbulb, ListTodo, MessageSquare, Globe,
  TrendingUp, Settings, ClipboardList, Crown, Search, X
} from "lucide-react";

const COMMANDS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Logins", icon: KeyRound, path: "/logins" },
  { label: "Documents", icon: FileText, path: "/documents" },
  { label: "Financial", icon: DollarSign, path: "/financial" },
  { label: "Legal", icon: Scale, path: "/legal" },
  { label: "CRM", icon: Users, path: "/crm" },
  { label: "Idea Vault", icon: Lightbulb, path: "/idea-vault" },
  { label: "To-Do", icon: ListTodo, path: "/todo" },
  { label: "Comms", icon: MessageSquare, path: "/comms" },
  { label: "Requests", icon: ClipboardList, path: "/requests" },
  { label: "Ørbit SEO", icon: Globe, path: "/orbit-seo" },
  { label: "Performance", icon: TrendingUp, path: "/performance" },
  { label: "Prestige", icon: Crown, path: "/prestige" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export default function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef();

  const filtered = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const go = (path) => {
    navigate(path);
    onClose();
  };

  const handleKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      if (filtered[selected]) go(filtered[selected].path);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-[#0f1117] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
          <Search className="w-4 h-4 text-white/30 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Go to..."
            className="flex-1 bg-transparent text-white placeholder:text-white/25 text-sm outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-white/20 hover:text-white/50">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-white/20 text-[10px] font-mono bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.08]">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="text-white/25 text-sm text-center py-6">No pages found</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.path}
                onClick={() => go(cmd.path)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                  selected === i ? "bg-orange-500/10 text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                <cmd.icon className={`w-4 h-4 shrink-0 ${selected === i ? "text-orange-500" : "text-white/25"}`} />
                <span>{cmd.label}</span>
                {selected === i && (
                  <span className="ml-auto text-[10px] text-white/20 font-mono bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.06]">↵</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.07]">
          <span className="text-white/20 text-[10px]">↑↓ navigate</span>
          <span className="text-white/20 text-[10px]">↵ select</span>
          <span className="ml-auto text-white/20 text-[10px] font-mono">⌘K</span>
        </div>
      </div>
    </div>
  );
}