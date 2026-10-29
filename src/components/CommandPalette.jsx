import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { ALL_NAV } from "@/lib/nav";

const COMMANDS = ALL_NAV;

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
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-ink/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-[#0f1117] border border-ink/[0.13] rounded-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-ink/[0.13]">
          <Search className="w-4 h-4 text-ink/[0.48] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Go to..."
            className="flex-1 bg-transparent text-ink placeholder:text-ink/[0.43] text-sm outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-ink/[0.38] hover:text-ink/50">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-ink/[0.38] text-[10px] font-mono bg-ink/5 px-1.5 py-0.5 rounded border border-ink/[0.13]">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="text-ink/[0.43] text-sm text-center py-6">No pages found</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.path}
                onClick={() => go(cmd.path)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                  selected === i ? "bg-orange-500/10 text-ink" : "text-ink/50 hover:text-ink/80"
                }`}
              >
                <cmd.icon className={`w-4 h-4 shrink-0 ${selected === i ? "text-orange-500" : "text-ink/[0.43]"}`} />
                <span>{cmd.label}</span>
                {selected === i && (
                  <span className="ml-auto text-[10px] text-ink/[0.38] font-mono bg-ink/5 px-1.5 py-0.5 rounded border border-ink/[0.13]">↵</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-ink/[0.13]">
          <span className="text-ink/[0.38] text-[10px]">↑↓ navigate</span>
          <span className="text-ink/[0.38] text-[10px]">↵ select</span>
          <span className="ml-auto text-ink/[0.38] text-[10px] font-mono">⌘K</span>
        </div>
      </div>
    </div>
  );
}