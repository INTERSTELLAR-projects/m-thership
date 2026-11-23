// Phone / desktop frame for the website and Command System previews. Phone = a 390px device; desktop = full width.
// `height` caps the frame with its own scroll (Møthership panels); omit it for a full-length page (portal).
import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";

export function DeviceToggle({ device, setDevice }) {
  return (
    <div role="group" aria-label="Preview size" className="inline-flex border border-hair bg-card p-0.5">
      {[["desktop", Monitor, "Desktop"], ["phone", Smartphone, "Phone"]].map(([k, I, l]) => (
        <button key={k} type="button" aria-pressed={device === k} onClick={() => setDevice(k)} className={`inline-flex h-8 items-center gap-1.5 px-2.5 text-[12px] font-medium ${device === k ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}><I className="h-3.5 w-3.5" />{l}</button>
      ))}
    </div>
  );
}

export default function PreviewFrame({ children, height, device: controlled, toolbar = true, label }) {
  const [own, setOwn] = useState("desktop");
  const device = controlled || own;
  return (
    <div>
      {toolbar && !controlled ? <div className="mb-3 flex flex-wrap items-center justify-between gap-2">{label ? <p className="mono-label text-[9.5px] text-ink/50">{label}</p> : <span />}<DeviceToggle device={device} setDevice={setOwn} /></div> : null}
      {device === "phone" ? (
        <div className="mx-auto w-[min(100%,404px)] rounded-[36px] border-[7px] border-ink bg-ink p-0 shadow-[0_30px_60px_-30px_rgba(26,26,26,.55)]">
          <div className="mx-auto mb-1 mt-1 h-1.5 w-20 rounded-full bg-white/20" aria-hidden="true" />
          <div className="overflow-y-auto overflow-x-hidden rounded-[26px] bg-white" style={{ height: height ? Math.min(760, height) : 760 }}>{children}</div>
        </div>
      ) : (
        <div className="overflow-hidden border border-hair bg-white shadow-[0_24px_50px_-34px_rgba(26,26,26,.5)]">
          <div className="flex items-center gap-1.5 border-b border-hair bg-paper px-3 py-2" aria-hidden="true"><i className="h-2 w-2 rounded-full bg-ink/15" /><i className="h-2 w-2 rounded-full bg-ink/15" /><i className="h-2 w-2 rounded-full bg-ink/15" /></div>
          <div className={height ? "overflow-y-auto overflow-x-hidden" : ""} style={height ? { height } : undefined}>{children}</div>
        </div>
      )}
    </div>
  );
}
