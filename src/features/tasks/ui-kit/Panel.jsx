import React from "react";
import { cn } from "@/lib/utils";

export default function Panel({ title, kicker, action, className, bodyClassName, children }) {
  const hasHeader = Boolean(title || kicker || action);
  return (
    <section className={cn("relative overflow-hidden rounded-md border border-hair bg-card", className)}>
      {hasHeader ? (
        <header className="flex items-start justify-between gap-3 border-b border-hair px-5 py-3.5">
          <div className="min-w-0">
            {kicker ? <p className="label-cross text-[10.5px] text-ink/60">({kicker})</p> : null}
            {title ? <h3 className="mt-1 truncate text-[15px] font-semibold tracking-[-0.02em] text-ink">{title}</h3> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
