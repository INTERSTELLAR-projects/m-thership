import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Heart, Instagram, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Instagram panel for the client portal's Results tab. Renders nothing until there is data
// (synced from the client's own Instagram, or filled in by Interstellar) or Interstellar has
// invited this client to connect. Data comes only from the social-instagram function.

const call = async (action, previewId) => (await base44.functions.invoke("social-instagram", { action, ...(previewId ? { client_id: previewId } : {}) })).data;
const n = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));

// previewId: the client to load (admin preview, or the business a package-deal owner picked); admin: Justin previewing.
export default function PortalInstagram({ previewId, admin = !!previewId }) {
  const qc = useQueryClient();
  const key = ["portal", previewId, "instagram"];
  const q = useQuery({ queryKey: key, queryFn: () => call("portal", previewId), retry: false, staleTime: 5 * 60000 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const timer = useRef(null);

  const sync = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await call("portal_sync", previewId);
      qc.setQueryData(key, (old) => ({ ...(old || {}), visible: true, account: r.account }));
    } catch (e) {
      const code = e?.response?.data?.error;
      if (code !== "not_connected") setErr(code || "Couldn't reach Instagram. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setErr("");
    try {
      const url = await base44.connectors.connectAppUser(q.data.connector_id);
      const popup = window.open(url, "_blank");
      clearInterval(timer.current);
      timer.current = setInterval(() => {
        if (!popup || popup.closed) { clearInterval(timer.current); sync(); }
      }, 600);
    } catch (e) {
      setErr(String(e?.message || "Couldn't start the Instagram connection."));
    }
  };

  const d = q.data;
  if (!d?.visible) return null;
  const a = d.account;

  return (
    <section className="border border-hair bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-hair px-4 py-3">
        {a?.profile_picture_url ? <img src={a.profile_picture_url} alt="" className="h-10 w-10 border border-hair object-cover" /> : <span className="flex h-10 w-10 items-center justify-center border border-hair"><Instagram className="h-5 w-5 text-ink/50" /></span>}
        <div className="min-w-0 flex-1">
          <p className="mono-label text-[9px] text-ink/45">Instagram</p>
          <h3 className="text-[18px] font-semibold tracking-[-0.03em]">{a?.handle ? <>@{a.handle}</> : <>Your <span className="text-[#ff3c00]">/Instagram</span></>}</h3>
        </div>
        {a && d.can_connect && a.source === "app_user_connector" && !admin && (
          <button type="button" onClick={sync} disabled={busy} className="inline-flex h-8 items-center gap-1.5 border border-hair px-2.5 text-[12px] text-ink/65 hover:border-[#ff3c00] hover:text-[#ff3c00] disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />Refresh
          </button>
        )}
      </header>

      {!a ? (
        <div className="flex flex-col items-start gap-3 px-4 py-5 sm:flex-row sm:items-center">
          <p className="flex-1 text-[13.5px] leading-snug text-ink/65">Connect your Instagram business account and your followers, recent posts and engagement show up here next to your other results. Read-only: we can&apos;t post or message from this connection.</p>
          <button type="button" onClick={connect} disabled={busy || admin} title={admin ? "The client connects from their own login" : undefined}
            className="inline-flex h-10 shrink-0 items-center gap-2 bg-[#ff3c00] px-4 text-[13px] font-medium text-white transition-colors hover:bg-ink disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}Connect your Instagram
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px bg-hair sm:grid-cols-4">
            {(a.insights_30d?.reach != null
              ? [["Followers", a.followers_count], ["Reached · 30 days", a.insights_30d.reach], ["Views · 30 days", a.insights_30d.views], ["Engaged · 30 days", a.insights_30d.accounts_engaged]]
              : [["Followers", a.followers_count], ["Posts", a.media_count], [`Likes · last ${a.totals?.posts || (a.recent_media || []).length || 12}`, a.totals?.likes], ["Comments", a.totals?.comments]]
            ).map(([l, v]) => (
              <div key={l} className="bg-card px-4 py-3">
                <p className="mono-label text-[8.5px] text-ink/45">{l}</p>
                <p className="mt-0.5 text-[24px] font-semibold tabular-nums tracking-[-0.04em]">{n(v)}</p>
              </div>
            ))}
          </div>
          {(a.recent_media || []).length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 p-3 sm:grid-cols-6">
              {a.recent_media.slice(0, 6).map((m) => (
                <a key={m.id} href={m.permalink} target="_blank" rel="noreferrer" className="group relative block aspect-square overflow-hidden border border-hair bg-paper">
                  {m.image_url ? <img src={m.image_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Instagram className="m-auto h-5 w-5 text-ink/30" />}
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-ink/80 px-1.5 py-1 font-mono text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <Heart className="h-3 w-3" />{n(m.like_count)}<MessageCircle className="h-3 w-3" />{n(m.comments_count)}<ExternalLink className="ml-auto h-3 w-3" />
                  </span>
                </a>
              ))}
            </div>
          )}
          <p className="border-t border-hair px-4 py-2 font-mono text-[10px] text-ink/40">
            {a.synced_at ? `Updated ${new Date(a.synced_at).toLocaleDateString()}` : "Updated by Interstellar"}
          </p>
        </>
      )}
      {err && <p className="border-t border-hair px-4 py-2 text-[12px] text-[#b42318]">{err}</p>}
    </section>
  );
}
