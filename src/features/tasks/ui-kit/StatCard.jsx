import React from "react";

export default function StatCard({ label, value, hint, accent = "#ff3c00", icon: Icon }) {
  return (
    <div className="card-hover relative overflow-hidden rounded-md border border-hair bg-card px-4 py-3.5">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5" style={{ color: accent }} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
        <p className="mono-label text-[9.5px] text-ink/50">{label}</p>
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.04em] text-ink">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-ink/50">{hint}</p> : null}
    </div>
  );
}
