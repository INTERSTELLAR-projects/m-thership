import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { HeartPulse, Inbox, Star, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { timeAgo } from "@/lib/useData";
import { Tile, TileEmpty, TileLoading, TileError, Bar, asArray } from "./shell";

const scoreTone = (s) => (s < 40 ? "#ff3c00" : s < 70 ? "#ff6a00" : "#1a1a1a");

/* ─── Client health (Constellations score) ─────────────────────────────── */
export function ClientHealthWidget() {
  const q = useQuery({
    queryKey: ["ClientDossier", "mission-health"],
    queryFn: async () => asArray(await base44.entities.ClientDossier.list("health_score", 200)),
  });
  const scored = (q.data || []).filter((d) => typeof d.health_score === "number").sort((a, b) => a.health_score - b.health_score);
  const unscored = (q.data || []).length - scored.length;
  const avg = scored.length ? Math.round(scored.reduce((n, d) => n + d.health_score, 0) / scored.length) : null;
  return (
    <Tile kicker={avg == null ? "Constellations" : `Avg ${avg} · lowest first`} title="Client health" icon={HeartPulse} to="/crm" linkLabel="Clients" stat={q.isLoading || avg == null ? null : avg}>
      {q.isLoading ? <TileLoading /> : q.isError ? <TileError /> : scored.length === 0 ? (
        <TileEmpty>No client has a Constellations score yet. Open a client&apos;s ✧ Constellations tab and fill the pillars to score them.</TileEmpty>
      ) : (
        <ul className="divide-y divide-hair">
          {scored.slice(0, 10).map((d) => (
            <li key={d.id}>
              <Link to={`/clients/${d.client_id}?tab=constellations`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink/[0.03]">
                <span className="w-8 shrink-0 text-right text-[17px] font-semibold tabular-nums tracking-[-0.03em]" style={{ color: scoreTone(d.health_score) }}>{Math.round(d.health_score)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{d.client_name || "Client"}</p>
                  <div className="mt-1"><Bar value={d.health_score} tone={scoreTone(d.health_score)} /></div>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-ink/40">{d.scored_at ? timeAgo(d.scored_at) : ""}</span>
              </Link>
            </li>
          ))}
          {unscored > 0 && <li className="px-4 py-2 text-[11px] text-ink/45">{unscored} dossier{unscored > 1 ? "s" : ""} not scored yet</li>}
        </ul>
      )}
    </Tile>
  );
}

/* ─── Client requests (open) ───────────────────────────────────────────── */
const OPEN_REQ = ["received", "in_progress", "needs_info"];
const REQ_TONE = { received: "bg-[#ff3c00] text-white", in_progress: "bg-ink text-white", needs_info: "bg-ink/[0.07] text-ink/70" };
export function ClientRequestsWidget() {
  const q = useQuery({
    queryKey: ["ClientRequest", "mission-open"],
    queryFn: async () => asArray(await base44.entities.ClientRequest.filter({ status: { $in: OPEN_REQ } }, "-created_date", 100)),
  });
  const rows = [...(q.data || [])].sort((a, b) => (b.priority === "urgent") - (a.priority === "urgent"));
  const counts = OPEN_REQ.map((s) => [s, rows.filter((r) => r.status === s).length]);
  return (
    <Tile kicker={counts.map(([s, n]) => `${n} ${s.replace("_", " ")}`).join(" · ")} title="Client requests" icon={Inbox} to="/requests" linkLabel="All" stat={q.isLoading ? null : rows.length}>
      {q.isLoading ? <TileLoading /> : q.isError ? <TileError /> : rows.length === 0 ? (
        <TileEmpty>Inbox zero. Site edits and submissions from client portals and public forms queue here.</TileEmpty>
      ) : (
        <ul className="divide-y divide-hair">
          {rows.slice(0, 9).map((r) => (
            <li key={r.id}>
              <Link to={`/clients/${r.client_id}?tab=requests`} className="block px-4 py-2.5 hover:bg-ink/[0.03]">
                <div className="flex items-center gap-2">
                  <span className={`mono-label px-1.5 py-0.5 text-[8.5px] ${REQ_TONE[r.status] || ""}`}>{r.status.replace("_", " ")}</span>
                  {r.priority === "urgent" && <span className="mono-label inline-flex items-center gap-0.5 text-[8.5px] text-[#ff3c00]"><AlertTriangle className="h-3 w-3" />urgent</span>}
                  <span className="ml-auto font-mono text-[10px] text-ink/40">{timeAgo(r.created_date)}</span>
                </div>
                <p className="mt-1 truncate text-[13px] font-medium">{r.title}</p>
                <p className="truncate text-[11.5px] text-ink/55">{r.client_name}{r.kind ? ` · ${r.kind.replace("_", " ")}` : ""}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

/* ─── Stärboard: Google ratings per client ─────────────────────────────── */
export function StarboardWidget() {
  const q = useQuery({
    queryKey: ["ReviewClient", "mission-stars"],
    queryFn: async () => asArray(await base44.entities.ReviewClient.list("name", 100)).filter((r) => r.active !== false),
  });
  const rows = (q.data || []).sort((a, b) => (Number(a.cache?.rating) || 9) - (Number(b.cache?.rating) || 9));
  const rated = rows.filter((r) => typeof r.cache?.rating === "number");
  const totalReviews = rated.reduce((n, r) => n + (Number(r.cache.total) || 0), 0);
  const weighted = totalReviews ? rated.reduce((n, r) => n + r.cache.rating * (Number(r.cache.total) || 0), 0) / totalReviews : null;
  return (
    <Tile kicker={totalReviews ? `${totalReviews.toLocaleString()} Google reviews` : "Stärboard"} title="Stärboard" icon={Star} to="/reviews" linkLabel="Reviews" stat={weighted == null ? null : weighted.toFixed(2)}>
      {q.isLoading ? <TileLoading /> : q.isError ? <TileError /> : rows.length === 0 ? (
        <TileEmpty>No businesses on Stärboard yet. Add a client&apos;s Google Place ID on Reviews to start serving their reviews.</TileEmpty>
      ) : (
        <ul className="divide-y divide-hair">
          {rows.map((r) => {
            const rating = r.cache?.rating;
            return (
              <li key={r.id}>
                <Link to={r.crm_client_id ? `/clients/${r.crm_client_id}` : "/reviews"} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink/[0.03]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{r.name}</p>
                    <p className={`truncate text-[11px] ${r.last_error ? "text-[#ff3c00]" : "text-ink/45"}`}>
                      {r.last_error ? `Fetch failing: ${r.last_error}` : r.cached_at ? `Synced ${timeAgo(r.cached_at)}` : "Never synced"}
                    </p>
                  </div>
                  {typeof rating === "number" ? (
                    <div className="shrink-0 text-right">
                      <p className="flex items-center justify-end gap-1 text-[15px] font-semibold tabular-nums">
                        <Star className="h-3.5 w-3.5 fill-[#ffaa00] text-[#ffaa00]" />{rating.toFixed(1)}
                      </p>
                      <p className="font-mono text-[10px] tabular-nums text-ink/45">{Number(r.cache.total) || 0} reviews</p>
                    </div>
                  ) : (
                    <span className="mono-label text-[8.5px] text-ink/40">no rating</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Tile>
  );
}
