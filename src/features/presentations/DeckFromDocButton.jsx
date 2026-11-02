import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Presentation, Sparkles, X, Zap } from "lucide-react";
import { PRESENTATIONS_ROUTES } from "@/features/presentations/routes";
import { createDeckFromBrief } from "@/features/presentations/lib/deckFromDocs";

// Inline (no pop-up) "Generate presentation": quick in-app draft or a Claude Queue deck job.
// makeBrief() → { brief, brand, title }. onCreated(presentationId) lets the caller remember the deck.
export default function DeckFromDocButton({ client, makeBrief, source, onCreated, lastDeckId, label = "Generate presentation" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const go = async (mode) => {
    setBusy(mode);
    setError("");
    try {
      const { brief, brand, title } = await makeBrief();
      const id = await createDeckFromBrief({ client, brief, brand, title, mode, source });
      if (onCreated) await Promise.resolve(onCreated(id)).catch(() => null);
      navigate(PRESENTATIONS_ROUTES.deck(id));
    } catch (e) {
      setError(e?.message || "The deck did not come back. Try again or send it to Claude.");
      setBusy("");
    }
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {lastDeckId && (
          <Link to={PRESENTATIONS_ROUTES.deck(lastDeckId)} className="mono-label text-[9px] text-ink/45 hover:text-[#ff3c00]">open last deck</Link>
        )}
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3 py-1.5 text-[12px] text-ink/75 hover:border-[#ff3c00] hover:text-ink">
          <Presentation className="h-3.5 w-3.5" /> {label}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-md border border-[#ff3c00]/40 bg-[#ff3c00]/[0.03] p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-xl text-[12px] text-ink/65">
          Builds a deck from this approved document using the client&apos;s brand kit colours when one is approved (otherwise the Interstellar theme), then opens it in the Presentations studio to edit.
        </p>
        <button type="button" onClick={() => setOpen(false)} disabled={!!busy} className="text-ink/40 hover:text-ink" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
      </div>
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button type="button" disabled={!!busy} onClick={() => go("claude")} className="inline-flex items-center gap-1.5 rounded-sm border border-hair bg-card px-3.5 py-2 text-[12.5px] text-ink/80 hover:border-ink/40 disabled:opacity-50">
          {busy === "claude" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Send to Claude Queue
        </button>
        <button type="button" disabled={!!busy} onClick={() => go("quick")} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[12.5px] font-medium text-white disabled:opacity-60">
          {busy === "quick" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} {busy === "quick" ? "Drafting…" : "Quick draft now"}
        </button>
      </div>
    </div>
  );
}
