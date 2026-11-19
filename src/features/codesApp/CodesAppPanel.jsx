import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

/*
 * Interstellar Codes panel (interstellarcodes.com, Base44 app 6a841edd2b09f3c766e82dd2).
 * Shown at /qr?tab=codes-app (More → Interstellar Codes). Reads the codes-app function, which calls the Codes app's
 * growthStats feed with the shared CODES_STATS_KEY secret. Three parts: app growth, SEO status, SEO work log.
 * Self-contained on purpose: no shared styles or components are changed.
 */
const BLUE = "#0057ff";

function Bars({ series, k }) {
  const max = Math.max(1, ...series.map((s) => s[k]));
  return (
    <svg viewBox={`0 0 ${series.length * 10} 60`} preserveAspectRatio="none" className="mt-3 block h-16 w-full" role="img" aria-label={`${k} per day, last ${series.length} days`}>
      {series.map((s, i) => {
        const h = (s[k] / max) * 56;
        return <rect key={s.date} x={i * 10 + 1.5} y={60 - h} width="7" height={Math.max(h, s[k] ? 1.5 : 0)} fill={BLUE} opacity={i === series.length - 1 ? 1 : 0.5}><title>{`${s.date}: ${s[k]}`}</title></rect>;
      })}
    </svg>
  );
}

function Tile({ label, value, children }) {
  return (
    <div className="rounded-md border border-hair bg-white/60 p-4">
      <p className="mono-label text-[10.5px] text-ink/55">{label}</p>
      <p className="mt-1.5 text-[30px] font-semibold leading-none tracking-[-0.04em] text-ink">{value}</p>
      {children}
    </div>
  );
}

const STATUS = { done: ["Done", BLUE], justin: ["Justin", "#c24100"] };

export default function CodesAppPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    base44.functions.invoke("codes-app", {})
      .then((r) => setData(r?.data || { ok: false, error: "No response" }))
      .catch((e) => setData({ ok: false, error: e?.response?.data?.error || "Could not load" }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const g = data?.growth;
  const seo = data?.seo;
  return (
    <div className="px-5 py-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-ink/60">
          <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: BLUE }} />
          Interstellar Codes: free QR codes for life at interstellarcodes.com. Growth and SEO, read live from the app.
        </p>
        <div className="flex items-center gap-2">
          <a href="https://interstellarcodes.com/admin" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded border border-hair bg-white/60 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-ink/40">Codes admin <ExternalLink className="h-3.5 w-3.5" /></a>
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded border border-hair bg-white/60 px-3 py-1.5 text-[12.5px] font-medium text-ink hover:border-ink/40"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
      </div>

      {data && !data.ok && (
        <div className="mb-6 rounded-md border border-[#f0c36d] bg-[#fff8e6] p-4 text-[13.5px] text-[#6b4a00]">
          <p className="font-semibold">{data.setup ? "One step to connect" : "Codes app unavailable"}</p>
          <p className="mt-1">{data.error}</p>
          {data.setup && <p className="mt-1">Create one long random value and save it as the secret <code className="font-mono">CODES_STATS_KEY</code> in both apps (Base44 → app → Settings → Secrets).</p>}
        </div>
      )}

      {g && (
        <section aria-labelledby="codes-growth">
          <h2 id="codes-growth" className="ms-kicker">App growth</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Users" value={g.users}><Bars series={g.series} k="users" /></Tile>
            <Tile label="Active 7 days" value={g.active_7d} />
            <Tile label="Codes" value={g.codes}><Bars series={g.series} k="codes" /></Tile>
            <Tile label="Dynamic codes" value={g.dynamic_codes} />
            <Tile label="Scans 30 days" value={g.scans_30d}><Bars series={g.series} k="scans" /><p className="mt-1 text-[11.5px] text-ink/50">{g.scans_all_time} all-time</p></Tile>
          </div>
        </section>
      )}

      {seo && (
        <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section aria-labelledby="codes-pages">
            <h2 id="codes-pages" className="ms-kicker">SEO · pages shipped ({seo.pages.length})</h2>
            <div className="mt-3 overflow-x-auto rounded-md border border-hair bg-white/60">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead><tr className="border-b border-hair text-ink/55"><th className="mono-label px-3 py-2 text-[10px] font-medium">Page</th><th className="mono-label px-3 py-2 text-[10px] font-medium">Title</th><th className="mono-label px-3 py-2 text-[10px] font-medium">Schema</th></tr></thead>
                <tbody>
                  {seo.pages.map((p) => (
                    <tr key={p.path} className="border-b border-hair/60 last:border-0">
                      <td className="px-3 py-2"><a className="font-mono text-[12px] hover:underline" style={{ color: "#0049db" }} href={`https://interstellarcodes.com${p.path}`} target="_blank" rel="noopener">{p.path}</a></td>
                      <td className="px-3 py-2 text-ink/80">{p.title}</td>
                      <td className="px-3 py-2 text-[11.5px] text-ink/55">{p.schema.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="grid gap-6">
            <section aria-labelledby="codes-check">
              <h2 id="codes-check" className="ms-kicker">Indexing checklist</h2>
              <ul className="mt-3 grid gap-1.5">
                {seo.checklist.map((c) => {
                  const [label, color] = STATUS[c.status] || [c.status, "#888"];
                  return (
                    <li key={c.item} className="flex items-start gap-2.5 rounded border border-hair bg-white/60 px-3 py-2 text-[13px] text-ink/80">
                      <span className="mt-0.5 shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-white" style={{ background: color }}>{label}</span>
                      {c.item}
                    </li>
                  );
                })}
              </ul>
            </section>
            <section aria-labelledby="codes-log">
              <h2 id="codes-log" className="ms-kicker">SEO work log</h2>
              <ol className="mt-3 grid gap-1.5">
                {seo.log.map((l, i) => (
                  <li key={i} className="rounded border border-hair bg-white/60 px-3 py-2 text-[13px] text-ink/80"><span className="mr-2 font-mono text-[11px] text-ink/45">{l.date}</span>{l.work}</li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}
      {data?.generated_at && <p className="mt-6 font-mono text-[11px] text-ink/40">Read {new Date(data.generated_at).toLocaleString()} from {data.site}</p>}
    </div>
  );
}
