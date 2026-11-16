import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Rocket } from "lucide-react";
import { lwProgress } from "./core";
import { loadBoard } from "./api";

// The prominent Command-home entry to the Launch Week board.
export default function LaunchWeekCard() {
  const [b, setB] = useState(null);
  useEffect(() => { let live = true; loadBoard().then((r) => live && setB(r)).catch(() => {}); return () => { live = false; }; }, []);
  const p = lwProgress(b?.questions || []);
  const sites = b?.clients?.length || 7;
  const left = p.blocking_total - p.blocking_answered;
  return (
    <Link to="/command/launch-week" className="group relative mb-4 block overflow-hidden bg-[#ff3c00] text-white" aria-label={`Launch Week, ${sites} sites`}>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00] opacity-90" />
      <span className="relative flex items-center gap-4 px-4 py-4 md:px-6 md:py-5">
        <Rocket className="h-6 w-6 shrink-0" strokeWidth={1.8} />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/80">Mon–Tue · answer, then the agents build</span>
          <span className="mt-0.5 block text-[20px] font-semibold leading-tight tracking-[-0.03em] md:text-[24px]">Launch Week · {sites} sites</span>
          <span className="mt-1 block text-[13px] text-white/90">
            {!b ? "Loading the questions…" : p.total ? `${p.answered}/${p.total} answered · ${left} blocking left${p.ask_client ? ` · ${p.ask_client} for clients` : ""}` : "Questions land here as each site audit finishes."}
          </span>
          {p.total > 0 && <span className="mt-2 block h-1 bg-white/25"><span className="block h-full bg-white" style={{ width: `${Math.round((p.answered / p.total) * 100)}%` }} /></span>}
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
      </span>
    </Link>
  );
}
