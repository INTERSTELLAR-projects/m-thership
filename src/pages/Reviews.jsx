import { useMemo, useState } from "react";
import { Plus, RefreshCw, Copy, Check, ExternalLink, Star, ChevronDown } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { base44 } from "@/api/base44Client";
import { useList, useInvalidate, timeAgo } from "@/lib/useData";
import { Btn, SmallBtn, Panel, Empty, Tag, Stat, FormDialog } from "@/features/clients/ui";

// Stärboard: Google reviews for every client site, served from one cached endpoint.
const PUBLIC_ENDPOINT = "https://interstellar-mothership.com/functions/reviews?client=";

const FIELDS = [
  { name: "name", label: "Business name", required: true, placeholder: "MowMasters of Ascension" },
  { name: "slug", label: "Slug", required: true, placeholder: "mowmasters", help: "Short id the client website asks for. Lowercase, no spaces." },
  { name: "place_id", label: "Google Place ID", required: true, placeholder: "ChIJ…", help: "Use the Google Business Profile listing, not the street address." },
  { name: "website", label: "Website", placeholder: "https://…" },
  { name: "active", label: "Active", type: "checkbox", hint: "Serve reviews to the website" },
];

function stars(n) {
  const r = Math.round(n || 0);
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= r ? "fill-[#ff3c00] text-[#ff3c00]" : "text-ink/20"}`} />)}
    </span>
  );
}

function statusOf(c) {
  if (c.active === false) return ["Paused", "muted"];
  if (c.last_error) return ["Error", "red"];
  if (!c.cache) return ["No data yet", "amber"];
  return ["Live", "green"];
}

export default function Reviews() {
  const list = useList("ReviewClient", { sort: "name", limit: 200 });
  const invalidate = useInvalidate();
  const [edit, setEdit] = useState(null); // null | {} | record
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [copied, setCopied] = useState(null);
  const [msg, setMsg] = useState("");

  const rows = list.data || [];
  const stats = useMemo(() => ({
    total: rows.length,
    live: rows.filter((c) => statusOf(c)[0] === "Live").length,
    errors: rows.filter((c) => c.active !== false && c.last_error).length,
    reviews: rows.reduce((s, c) => s + (c.cache?.reviews?.length || 0), 0),
  }), [rows]);

  const save = async (v) => {
    const data = { ...v, slug: String(v.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, ""), active: v.active !== false };
    delete data.id;
    if (edit?.id) await base44.entities.ReviewClient.update(edit.id, data);
    else await base44.entities.ReviewClient.create(data);
    invalidate("ReviewClient");
  };

  const refresh = async (c) => {
    setBusy(c.id); setMsg("");
    try {
      const res = await base44.functions.invoke("reviews", { client: c.slug, force: true });
      const d = res?.data || res;
      setMsg(d?.stale ? `${c.name}: Google refused the refresh, still serving the last good copy.` : `${c.name}: refreshed, ${d?.reviews?.length ?? 0} reviews.`);
    } catch (e) {
      setMsg(`${c.name}: ${e.message || "refresh failed"}`);
    } finally {
      setBusy(null); invalidate("ReviewClient");
    }
  };

  const copy = (c) => {
    navigator.clipboard?.writeText(PUBLIC_ENDPOINT + c.slug);
    setCopied(c.id); setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Command / Stärboard" rightText="Google reviews on every client site" title="Google Stärboard">
        <Btn icon={Plus} onClick={() => setEdit({ active: true })}>Add client</Btn>
      </PageHeader>

      <div className="px-5 pt-6 md:px-8">
        <div className="grid grid-cols-2 rounded-md border border-hair bg-card md:grid-cols-4">
          <Stat value={stats.total} label="Clients" />
          <Stat value={stats.live} label="Live" accent />
          <Stat value={stats.errors} label="Errors" />
          <Stat value={stats.reviews} label="Reviews cached" />
        </div>
        {msg && <p className="mt-3 border border-hair bg-paper px-3 py-2 text-[12.5px] text-ink/70">{msg}</p>}
      </div>

      <div className="px-5 pt-5 md:px-8">
        <Panel label="Endpoint" title="Every site reads from one cached URL" bodyClass="px-4 py-3">
          <p className="font-mono text-[12px] text-ink/70 break-all">{PUBLIC_ENDPOINT}<span className="text-[#ff3c00]">&lt;slug&gt;</span></p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink/55">Google is asked at most once a day per client; a failed refresh retries every 6 hours and visitors always get the last good copy. Only 4★ and 5★ reviews with text are shown.</p>
        </Panel>
      </div>

      <div className="space-y-3 px-5 pt-5 md:px-8">
        {list.isLoading && <p className="text-[13px] text-ink/50">Loading…</p>}
        {!list.isLoading && rows.length === 0 && (
          <Panel><Empty action={<Btn icon={Plus} onClick={() => setEdit({ active: true })}>Add client</Btn>}>No review clients yet.</Empty></Panel>
        )}
        {rows.map((c) => {
          const [label, tone] = statusOf(c);
          const cache = c.cache || {};
          const expanded = open === c.id;
          return (
            <section key={c.id} className="rounded-md border border-hair bg-card">
              <div className="flex flex-wrap items-center gap-4 px-4 py-4">
                <div className="min-w-[220px] flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold tracking-[-0.02em]">{c.name}</p>
                    <Tag tone={tone}>{label}</Tag>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-ink/45">{c.slug} · {c.website ? c.website.replace(/^https?:\/\/(www\.)?/, "") : "no site"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[24px] font-semibold tabular-nums tracking-[-0.04em]">{cache.rating ?? "—"}</span>
                  <div>
                    {stars(cache.rating)}
                    <p className="mono-label text-[9px] text-ink/45">{cache.total ?? 0} on Google · {cache.reviews?.length || 0} shown</p>
                  </div>
                </div>
                <p className="w-[110px] text-right text-[11.5px] text-ink/50">{c.cached_at ? `Updated ${timeAgo(c.cached_at)}` : "Never fetched"}</p>
                <div className="flex flex-wrap gap-1.5">
                  <SmallBtn onClick={() => refresh(c)} title="Ask Google now">
                    <RefreshCw className={`h-3 w-3 ${busy === c.id ? "animate-spin" : ""}`} /> Refresh
                  </SmallBtn>
                  <SmallBtn onClick={() => copy(c)} title="Copy endpoint">
                    {copied === c.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} URL
                  </SmallBtn>
                  <SmallBtn onClick={() => setEdit(c)}>Edit</SmallBtn>
                  <SmallBtn onClick={() => setOpen(expanded ? null : c.id)} active={expanded}>
                    Reviews <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </SmallBtn>
                </div>
              </div>
              {c.last_error && c.active !== false && (
                <p className="border-t border-hair bg-red-600/5 px-4 py-2 text-[12px] text-red-700">{c.last_error}</p>
              )}
              {c.active === false && c.last_error && (
                <p className="border-t border-hair px-4 py-2 text-[12px] text-ink/55">{c.last_error}</p>
              )}
              {expanded && (
                <div className="border-t border-hair p-4">
                  <div className="mb-3 flex flex-wrap gap-3 text-[12px]">
                    {cache.mapsUrl && <a href={cache.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#ff3c00] hover:underline">Google listing <ExternalLink className="h-3 w-3" /></a>}
                    {cache.reviewUrl && <a href={cache.reviewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#ff3c00] hover:underline">Leave-a-review link <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                  {(cache.reviews || []).length === 0 ? (
                    <p className="text-[13px] text-ink/50">No reviews cached yet.</p>
                  ) : (
                    <ul className="grid gap-3 md:grid-cols-2">
                      {cache.reviews.map((r, i) => (
                        <li key={i} className="border border-hair bg-paper p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13px] font-semibold">{r.author}</p>
                            {stars(r.rating)}
                          </div>
                          <p className="mono-label mt-0.5 text-[9px] text-ink/40">{r.relative || timeAgo(r.time)}</p>
                          <p className="mt-2 line-clamp-5 text-[12.5px] leading-relaxed text-ink/70">{r.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <FormDialog
        open={!!edit}
        title={edit?.id ? `Edit ${edit.name}` : "Add review client"}
        fields={FIELDS}
        initial={edit}
        onClose={() => setEdit(null)}
        onSubmit={save}
        onDelete={edit?.id ? async () => { await base44.entities.ReviewClient.delete(edit.id); invalidate("ReviewClient"); } : undefined}
      />
    </div>
  );
}
