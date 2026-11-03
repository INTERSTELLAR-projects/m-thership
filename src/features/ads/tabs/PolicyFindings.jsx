import { ExternalLink } from "lucide-react";
import { Pill } from "../ui";

const ORDER = { hard: 0, soft: 1, info: 2 };

export default function PolicyFindings({ check }) {
  const findings = [...(check?.findings || [])].sort((a, b) => (ORDER[a.severity] ?? 3) - (ORDER[b.severity] ?? 3));
  const l = check?.landing || {};
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={check.result}>{check.result === "fail" ? "blocked" : check.result}</Pill>
        <span className="text-[12px] text-ink/60">{findings.filter((f) => f.severity === "hard").length} hard · {findings.filter((f) => f.severity === "soft").length} warnings · {findings.filter((f) => f.severity === "info").length} notes</span>
        {l.url && <span className="text-[11.5px] text-ink/50">Landing: {l.ok ? `loaded (${l.status})` : `failed (${l.status || l.error || "no response"})`}</span>}
      </div>
      {!findings.length && <p className="text-[12.5px] text-green-800">No issues found by the rule set. Meta and Google still review every ad themselves.</p>}
      {findings.map((f, i) => (
        <div key={`${f.rule_key}-${i}`} className={`border-l-2 bg-paper px-3 py-2 ${f.severity === "hard" ? "border-[#ff3c00]" : f.severity === "soft" ? "border-[#ff6a00]" : "border-hair"}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={f.severity}>{f.severity === "hard" ? "blocks" : f.severity === "soft" ? "warning" : "note"}</Pill>
            <span className="text-[12.5px] font-semibold">{f.title}</span>
            {f.matched && f.matched !== "template" && <code className="bg-[#ff3c00]/[0.08] px-1 text-[11px] text-[#a32d00]">{String(f.matched).slice(0, 80)}</code>}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-ink/70">{f.message}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-ink/45">
            {f.source_url && /^https?:/.test(f.source_url) ? <a href={f.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-[#ff3c00]">Source <ExternalLink className="h-2.5 w-2.5" /></a> : <span>Source: Agency Knowledge / Justin</span>}
            <span>{f.verified ? "verified" : "unverified"}</span>
            {f.verified_note && <span className="truncate" title={f.verified_note}>· {f.verified_note.slice(0, 120)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
