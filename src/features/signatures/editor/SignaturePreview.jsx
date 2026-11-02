import React, { useState } from "react";
import { Sun, Moon, Monitor, Tablet, Smartphone } from "lucide-react";

// Approximate reading widths of a message body in each mail app.
const DEVICES = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: 680 },
  { id: "tablet", label: "Tablet", icon: Tablet, width: 520 },
  { id: "mobile", label: "Phone", icon: Smartphone, width: 340 },
];

export default function SignaturePreview({ html, templateId }) {
  const [dark, setDark] = useState(false);
  const [device, setDevice] = useState("desktop");
  const bg = dark ? "#1a1a1a" : "#ffffff";
  const text = dark ? "#e4e4e4" : "#3a3a3a";
  const line = dark ? "#333" : "#e6e6e6";
  const d = DEVICES.find((x) => x.id === device);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-border bg-muted/40">
        <span className="text-xs font-medium text-muted-foreground">Live preview · {templateId}</span>
        <div className="flex items-center rounded-sm border border-border bg-background ml-auto">
          {DEVICES.map((x) => (
            <button
              key={x.id}
              onClick={() => setDevice(x.id)}
              title={`${x.label} width`}
              className={`inline-flex items-center gap-1 px-2.5 h-7 text-xs ${device === x.id ? "bg-[#fff1ea] text-[#ff3c00]" : "text-muted-foreground hover:text-foreground"}`}
            >
              <x.icon className="w-3.5 h-3.5" /> {x.label}
            </button>
          ))}
        </div>
        <button onClick={() => setDark((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
          {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {dark ? "Light" : "Dark"} inbox
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-8 bg-muted/30">
        <div
          className={`mx-auto transition-all duration-300 ${device === "desktop" ? "rounded-md" : "rounded-[22px] border-[6px] border-neutral-800"} shadow-sm`}
          style={{ background: bg, color: text, width: "100%", maxWidth: d.width, padding: device === "mobile" ? 14 : 24 }}
        >
          <div className="text-sm mb-3">
            <span className="opacity-60">To: </span>john@client.com
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-2.5 rounded w-3/4" style={{ background: line }} />
            <div className="h-2.5 rounded w-full" style={{ background: line }} />
            <div className="h-2.5 rounded w-5/6" style={{ background: line }} />
          </div>
          <div className="text-sm mb-3">Best,</div>
          <div className="signature-output overflow-hidden" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <p className="text-center text-[11px] text-muted-foreground mt-3">
          {d.label} ≈ {d.width}px reading width. Blocks stack and chips wrap on their own — no CSS media queries (Gmail strips them).
        </p>
      </div>
    </div>
  );
}
