import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function SignaturePreview({ html, templateId }) {
  const [dark, setDark] = useState(false);
  const bg = dark ? "#1a1a1a" : "#ffffff";
  const text = dark ? "#e4e4e4" : "#3a3a3a";
  const line = dark ? "#333" : "#e0e0e0";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/40">
        <span className="text-xs font-medium text-muted-foreground">Live preview · {templateId}</span>
        <button
          onClick={() => setDark((d) => !d)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {dark ? "Light" : "Dark"} background
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-8" style={{ background: bg }}>
        {/* Email compose window mock */}
        <div style={{ background: bg, color: text }} className="max-w-2xl mx-auto">
          <div className="text-sm mb-3">
            <span className="opacity-60">To: </span>john@client.com
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-2.5 rounded w-3/4" style={{ background: line }} />
            <div className="h-2.5 rounded w-full" style={{ background: line }} />
            <div className="h-2.5 rounded w-5/6" style={{ background: line }} />
          </div>
          <div className="text-sm mb-1">Hi John,</div>
          <div className="space-y-2 mb-4 mt-3">
            <div className="h-2.5 rounded w-full" style={{ background: line }} />
            <div className="h-2.5 rounded w-11/12" style={{ background: line }} />
            <div className="h-2.5 rounded w-4/5" style={{ background: line }} />
          </div>
          <div className="text-sm mb-3">Best,</div>
          {/* The actual signature */}
          <div
            className="signature-output"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
