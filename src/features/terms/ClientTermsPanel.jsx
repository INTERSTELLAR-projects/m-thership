// Client page › Setup & billing › Terms & agreements: every acceptance on file for this client (append-only),
// which portal logins have signed the active version, and the status chip. docs/portal-terms.md.
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import { useClientTerms, openAcceptancePdf, fmtWhen } from "./termsApi";

const TONE = { signed: "bg-green-100 text-green-800", signed_old: "bg-amber-100 text-amber-800", not_signed: "bg-red-100 text-red-700", none: "bg-ink/[0.07] text-ink/55" };

export function TermsChip({ status, className = "" }) {
  if (!status) return null;
  return <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${TONE[status.state] || TONE.none} ${className}`} data-testid="terms-chip"><ShieldCheck className="h-3 w-3" />{status.label}</span>;
}

export function useTermsChip(clientId) {
  const q = useClientTerms(clientId);
  return q.data?.status || null;
}

export default function ClientTermsPanel({ client }) {
  const q = useClientTerms(client.id);
  const d = q.data || {};
  const acc = d.acceptances || [];
  const active = d.active;
  const logins = (client.portal_emails || []).map((e) => String(e).toLowerCase());
  const signedActive = new Set(acc.filter((a) => active && a.version === active.version && a.terms_sha256 === active.sha256).map((a) => a.user_email));
  return (
    <section className="border border-hair bg-paper/80" aria-label="Terms and agreements" data-testid="client-terms-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-4 py-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Terms &amp; agreements</h2>
        {q.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-ink/35" /> : <TermsChip status={d.status} />}
      </header>
      {q.isError ? <p className="px-4 py-4 text-[13px] text-red-700">Couldn&apos;t load: {String(q.error?.message || q.error)}</p> : (
        <div className="space-y-4 p-4">
          <p className="text-[12.5px] text-ink/60">
            {active ? <>Active terms: <span className="font-mono">v{active.version}</span>. Each portal login accepts once per version; the record is tied to this client.</> : "No terms version is active yet, so the portal gate is off. Publish one in Legal › Client Terms of Service."}
          </p>
          {logins.length > 0 && active && (
            <div>
              <p className="mono-label mb-1.5 text-[9.5px] text-ink/50">Portal logins</p>
              <ul className="flex flex-wrap gap-1.5">
                {logins.map((e) => <li key={e} className={`rounded-sm border px-2 py-1 font-mono text-[11px] ${signedActive.has(e) ? "border-green-700/30 bg-green-50 text-green-900" : "border-hair text-ink/60"}`}>{e} · {signedActive.has(e) ? "signed" : "not signed"}</li>)}
              </ul>
            </div>
          )}
          {acc.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead><tr className="border-b border-hair font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/45"><th className="py-2 pr-3">Signed by</th><th className="py-2 pr-3">Version</th><th className="py-2 pr-3">Date &amp; time</th><th className="py-2 pr-3">IP</th><th className="py-2 pr-3">Login</th><th className="py-2">PDF</th></tr></thead>
                <tbody className="divide-y divide-hair/70">
                  {acc.map((a) => (
                    <tr key={a.id} className="align-top">
                      <td className="py-2 pr-3"><span className="font-serif text-[14px] italic">{a.typed_signature}</span>{a.is_test && <span className="ml-1 font-mono text-[9.5px] text-[#ff3c00]">[TEST]</span>}<span className="block text-[11px] text-ink/45">{a.user_name || ""}</span></td>
                      <td className="py-2 pr-3 font-mono">v{a.version}<span className="block text-[10px] text-ink/40" title={a.terms_sha256}>{String(a.terms_sha256 || "").slice(0, 10)}…</span></td>
                      <td className="py-2 pr-3">{fmtWhen(a.accepted_at)}</td>
                      <td className="py-2 pr-3 font-mono text-[11.5px]">{a.ip}<span className="block max-w-[180px] truncate text-[10px] text-ink/40" title={a.user_agent}>{a.user_agent}</span></td>
                      <td className="py-2 pr-3 font-mono text-[11.5px]">{a.user_email}</td>
                      <td className="py-2">{a.pdf_url ? <button type="button" onClick={() => openAcceptancePdf(a.id).catch(() => {})} className="inline-flex items-center gap-1 text-[12px] text-ink/70 hover:text-[#ff3c00]"><FileText className="h-3.5 w-3.5" />Open</button> : <span className="text-ink/35">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !q.isLoading && <p className="text-[13px] text-ink/55">No acceptances on file.</p>}
          <p className="text-[11px] text-ink/45">Records are append-only: nobody can edit or delete them. Time is the server&apos;s clock (shown in Pacific time); IP and device come from the signing request.</p>
        </div>
      )}
    </section>
  );
}
