import React from "react";
import { CircleDashed } from "lucide-react";

export default function EmptyState({ icon: Icon = CircleDashed, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-hair bg-card/60 px-6 py-10 text-center">
      <Icon className="h-5 w-5 text-ink/30" />
      <div>
        <p className="text-[14px] font-semibold tracking-[-0.02em] text-ink">{title}</p>
        {hint ? <p className="mt-1 max-w-md text-[12px] text-ink/50">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
