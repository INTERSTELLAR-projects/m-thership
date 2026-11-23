// Portal terms gate (docs/portal-terms.md). Shown instead of the portal when the portal function answers
// 428 { code: "terms_required" }. Nothing of the portal is behind it: the server sent no portal data.
// Order: summary points, then the full scrollable terms; accepting needs scrolling to the end, both ticks and the
// person's full legal name. The server stamps the time, IP and device and re-checks the text's fingerprint.
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowDown, CheckCircle2, Download, FileText, Loader2, LogOut, ScrollText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LOGO_URL } from "@/lib/nav";
import { REQUIRED_CHECKS } from "@/lib/terms";

export const needsTerms = (e) => e?.response?.status === 428 && e?.response?.data?.code === "terms_required";

// "Download a copy": the exact text on screen as a PDF (unsigned; the signed copy is emailed after accepting).
export async function downloadTermsCopy(terms, business = "") {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 54;
    let y = M;
    const put = (t, size = 9.5, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
      const safe = String(t).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x00-\xFF]/g, "?");
      for (const line of doc.splitTextToSize(safe, W - M * 2)) { if (y > H - M) { doc.addPage(); y = M; } doc.text(line, M, y); y += size * 1.35; }
      y += 4;
    };
    put(`${terms.title} - version ${terms.version}`, 14, true);
    put(`Copy for ${business || "your records"} · fingerprint ${terms.sha256}`, 7.5);
    String(terms.body_markdown || "").replace(/^#{1,6}\s*/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").split(/\n{2,}/).forEach((p) => put(p.replace(/\n/g, " ")));
    doc.save(`interstellar-terms-${terms.version}.pdf`);
  } catch {
    const blob = new Blob([`${terms.title} (version ${terms.version})\n\n${terms.body_markdown}`], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `interstellar-terms-${terms.version}.txt`; a.click();
  }
}

export function TermsBody({ terms, onReachedEnd, className = "" }) {
  const box = useRef(null);
  const check = useCallback(() => {
    const el = box.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) onReachedEnd?.();
  }, [onReachedEnd]);
  useEffect(() => { check(); }, [check, terms?.body_markdown]);
  return (
    <div ref={box} onScroll={check} tabIndex={0} aria-label="Full terms of service" className={`terms-prose overflow-y-auto border border-hair bg-white/80 px-4 py-4 text-[13.5px] leading-[1.6] text-ink/80 md:px-6 ${className}`}>
      <ReactMarkdown
        components={{
          h1: (p) => <h3 className="mb-2 text-[18px] font-semibold tracking-[-0.02em] text-ink" {...p} />,
          h2: (p) => <h4 className="mb-1.5 mt-5 text-[14.5px] font-semibold text-ink" {...p} />,
          p: (p) => <p className="mb-2.5" {...p} />,
          ul: (p) => <ul className="mb-2.5 list-disc pl-5" {...p} />,
        }}
      >{terms?.body_markdown || ""}</ReactMarkdown>
      <p className="mt-4 border-t border-hair pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">End of terms · version {terms?.version}</p>
    </div>
  );
}

export default function TermsGate({ gate, scopeId, onDone, preview = false }) {
  const terms = gate?.terms || {};
  const checks = gate?.checks?.length ? gate.checks : REQUIRED_CHECKS;
  const [scrolled, setScrolled] = useState(false);
  const [ticks, setTicks] = useState({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const allTicked = checks.every((c) => ticks[c.key]);
  const ready = scrolled && allTicked && name.trim().length >= 3 && !busy;
  const reached = useCallback(() => setScrolled(true), []);
  const isNew = !!gate?.previous_version;

  const accept = async () => {
    if (!ready || preview) return;
    setBusy(true); setErr("");
    try {
      const r = await base44.functions.invoke("portal-terms", { action: "accept", client_id: scopeId, version_id: terms.id, sha256: terms.sha256, typed_signature: name, checks: ticks, scrolled_to_end: scrolled });
      if (r?.data?.error) throw new Error(r.data.error);
      setDone(true);
      setTimeout(() => onDone?.(), 900);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Could not save your acceptance. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-canvas text-ink" role="dialog" aria-modal="true" aria-labelledby="terms-title" data-testid="terms-gate">
      <div className="grid-canvas min-h-full">
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />
        <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-6 md:px-6 md:pt-10">
          <header className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img src={LOGO_URL} alt="Interstellar" className="h-8 w-10 shrink-0 object-contain" />
              <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/50">{gate?.client?.business || "Your portal"}</span>
            </div>
            {!preview && <button type="button" onClick={() => base44.auth.logout()} className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-ink/55 hover:text-[#ff3c00]"><LogOut className="h-3.5 w-3.5" />Sign out</button>}
          </header>

          <p className="mt-8 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#ff3c00]">{isNew ? "(Updated terms)" : "(Before you continue)"}</p>
          <h1 id="terms-title" className="mt-2 text-[32px] font-semibold leading-[1] tracking-[-0.045em] md:text-[44px]">{terms.title || "Terms of Service"} <span className="text-[#ff3c00]">/v{terms.version}</span></h1>
          <p className="mt-3 text-[14.5px] leading-[1.55] text-ink/65">
            {isNew ? `We updated our terms since you signed version ${gate.previous_version}. Please review and accept the new version to open your portal.` : "Please review and accept our terms to open your Interstellar portal. It takes about two minutes."}
          </p>

          {isNew && terms.change_note && (
            <div className="mt-5 border border-[#ff6a00]/40 bg-[#ff6a00]/[0.06] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#c24100]">What changed</p>
              <p className="mt-1 whitespace-pre-line text-[13.5px] leading-[1.55] text-ink/80">{terms.change_note}</p>
            </div>
          )}

          <section className="mt-6 border border-hair bg-paper/90" aria-label="Summary">
            <header className="flex items-center gap-2 border-b border-hair px-4 py-2.5"><ScrollText className="h-4 w-4 text-[#ff3c00]" /><h2 className="text-[14.5px] font-semibold">The short version</h2></header>
            <ul className="divide-y divide-hair/70">
              {(terms.summary_points || []).map((p, i) => (
                <li key={i} className="flex gap-3 px-4 py-2.5 text-[13.5px] leading-[1.5] text-ink/80"><span className="mt-[3px] font-mono text-[10.5px] text-[#ff3c00]">{String(i + 1).padStart(2, "0")}</span><span>{p}</span></li>
              ))}
            </ul>
            <p className="border-t border-hair px-4 py-2 text-[11.5px] text-ink/50">The summary helps you read; the full terms below are what you agree to.</p>
          </section>

          <section className="mt-5" aria-label="Full terms">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[14.5px] font-semibold"><FileText className="h-4 w-4 text-ink/50" />Full terms</h2>
              <button type="button" onClick={() => downloadTermsCopy(terms, gate?.client?.business)} className="inline-flex h-9 items-center gap-1.5 border border-hair bg-paper px-3 text-[12.5px] text-ink/75 hover:border-ink"><Download className="h-3.5 w-3.5" />Download a copy</button>
            </div>
            <TermsBody terms={terms} onReachedEnd={reached} className="h-[46vh] min-h-[280px] md:h-[420px]" />
            <p className={`mt-2 flex items-center gap-1.5 text-[12px] ${scrolled ? "text-green-800" : "text-ink/55"}`} role="status">
              {scrolled ? <><CheckCircle2 className="h-3.5 w-3.5" />You reached the end.</> : <><ArrowDown className="h-3.5 w-3.5" />Scroll to the end of the terms to continue.</>}
            </p>
          </section>

          <fieldset className="mt-5 space-y-2" disabled={!scrolled || busy}>
            <legend className="sr-only">Confirmations</legend>
            {checks.map((c) => (
              <label key={c.key} className={`flex min-h-12 cursor-pointer items-start gap-3 border px-3.5 py-3 text-[13.5px] leading-[1.45] ${ticks[c.key] ? "border-ink bg-white" : "border-hair bg-paper/80"} ${!scrolled ? "cursor-not-allowed opacity-55" : ""}`}>
                <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#ff3c00]" checked={!!ticks[c.key]} onChange={(e) => setTicks((t) => ({ ...t, [c.key]: e.target.checked }))} />
                <span>{c.label}</span>
              </label>
            ))}
          </fieldset>

          <label className="mt-5 block">
            <span className="mono-label text-[10px] text-ink/55">Type your full legal name to sign</span>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!scrolled || busy} autoComplete="name" placeholder="Full legal name" className="mt-1.5 h-12 w-full border border-hair bg-white px-3.5 font-serif text-[19px] italic outline-none placeholder:font-sans placeholder:text-[14px] placeholder:not-italic placeholder:text-ink/35 focus:border-[#ff3c00] disabled:opacity-55" />
            <span className="mt-1.5 block text-[11.5px] leading-[1.5] text-ink/50">By selecting “Agree and continue” you sign these terms electronically for {gate?.client?.business || "your business"} and confirm you are authorized to do so. We record the date and time, your login{gate?.user?.email ? ` (${gate.user.email})` : ""}, IP address and device, and email you a signed copy.</span>
          </label>

          {err && <p role="alert" className="mt-4 border border-[#ff3c00]/40 bg-[#ff3c00]/[0.06] px-3.5 py-3 text-[13.5px] text-[#b82b00]">{err}</p>}

          <button type="button" onClick={accept} disabled={!ready || preview} className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 bg-[#ff3c00] text-[15px] font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink/25">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <CheckCircle2 className="h-4 w-4" /> : null}
            {done ? "Signed. Opening your portal…" : "Agree and continue"}
          </button>
          {!ready && !done && <p className="mt-2 text-center text-[11.5px] text-ink/45">{!scrolled ? "Read to the end first." : !allTicked ? "Tick both boxes." : "Type your full name."}</p>}
          <p className="mt-6 text-center text-[11.5px] text-ink/45">Questions about these terms? Message us before you sign, or ask for a paper copy at no charge.</p>
        </div>
      </div>
    </div>
  );
}
