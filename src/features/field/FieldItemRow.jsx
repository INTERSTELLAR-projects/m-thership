// One field inbox item: where it came from, its status, what it became (link).
import { Link } from "react-router-dom";
import { ArrowUpRight, Film, MessageCircle, Zap } from "lucide-react";
import { INTENT_LABEL, STATUS_TONE } from "./fieldClient";

const SOURCE_ICON = { whatsapp: MessageCircle, upload: Film, web: Zap };

function ago(iso) {
  const t = Date.parse(iso || "");
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FieldItemRow({ item }) {
  const Icon = SOURCE_ICON[item.source] || Zap;
  const r = item.routed_to || {};
  const text = item.text || (item.media?.length ? `${item.media.length} ${item.media[0].type || "file"}${item.media.length > 1 ? "s" : ""}` : item.error || "(empty)");
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" aria-label={item.source} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13.5px] leading-snug">{item.is_test ? <span className="mr-1 font-mono text-[10px] text-[#ff3c00]">[TEST]</span> : null}{text}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink/50">
          <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${STATUS_TONE[item.status] || STATUS_TONE.new}`}>{item.status || "new"}</span>
          {item.intent && <span>{INTENT_LABEL[item.intent] || item.intent}</span>}
          {(item.client_name || item.lead_business?.name) && <span>· {item.client_name || `${item.lead_business.name} (new)`}</span>}
          <span>· {ago(item.created_at || item.created_date)}</span>
        </p>
        {item.ai_summary && <p className="mt-1 text-[12px] text-ink/60">{item.ai_summary}</p>}
      </div>
      {r.path && (
        <Link to={r.path} className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-[12px] text-ink/60 hover:text-[#ff3c00]" aria-label={`Open ${r.entity}`}>
          {r.entity === "ClaudeJob" ? "Job" : r.entity === "CRMClient" ? "Client" : r.entity === "BusinessBrain" ? "Brain" : r.entity}<ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </li>
  );
}

