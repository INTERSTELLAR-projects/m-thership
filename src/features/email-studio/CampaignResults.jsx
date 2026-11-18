// Per-campaign results: delivered, opens (estimates), clicks, CTR, bounces, complaints, unsubscribes, top links,
// opens over time and per-subscriber activity. Scheduled campaigns can be moved or cancelled here.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Copy, Info, Link2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Badge, Btn, Card, ConfirmBtn, Kpi, Label, Notice, Segmented, inputCls } from "./ui";
import { errMsg, fmtWhen, num, pct, ago, TIMEZONES } from "./api";

const FILTERS = [["all", "Everyone"], ["opened", "Opened"], ["clicked", "Clicked"], ["not_opened", "Didn't open"], ["bounced", "Bounced"], ["unsubscribed", "Unsubscribed"]];

function Bars({ data }) {
  const max = Math.max(1, ...data);
  const last = data.reduce((n, v, i) => (v ? i : n), 0);
  const shown = data.slice(0, Math.max(12, Math.min(72, last + 4)));
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]">
        {shown.map((v, i) => <div key={i} title={`Hour ${i + 1}: ${v}`} className="flex-1 rounded-t-sm bg-gradient-to-t from-[#ff3c00] to-[#ffaa00] transition-all" style={{ height: `${Math.max(v ? 6 : 2, (v / max) * 100)}%`, opacity: v ? 1 : 0.18 }} />)}
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-ink/40"><span>Sent</span><span>+{shown.length}h</span></div>
    </div>
  );
}

export default function CampaignResults({ id, call, onBack, onDuplicate, onChanged }) {
  const [filter, setFilter] = useState("all");
  const [skip, setSkip] = useState(0);
  const q = useQuery({ queryKey: ["email-results", id, filter, skip], queryFn: () => call("campaign_results", { id, filter, skip }), refetchInterval: (d) => (["sending", "queued", "scheduled"].includes(d?.state?.data?.campaign?.status) ? 15000 : false) });
  const [move, setMove] = useState(false);
  const [when, setWhen] = useState("");
  const [tz, setTz] = useState("");
  const [msg, setMsg] = useState(null);
  const d = q.data;
  const c = d?.campaign;
  useEffect(() => { if (c?.send_local && !when) { setWhen(c.send_local); setTz(c.send_tz || "America/Los_Angeles"); } }, [c, when]);
  if (q.isLoading) return <p className="py-16 text-center text-ink/50"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></p>;
  if (q.isError) return <Notice tone="error">{errMsg(q.error)}</Notice>;
  const s = d.stats;
  const scheduled = c.status === "scheduled";
  const resched = async () => {
    try { await call("campaign_reschedule", { id, send_local: when, send_tz: tz }); setMsg({ tone: "ok", text: "Moved." }); setMove(false); q.refetch(); onChanged?.(); }
    catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
  };
  return (
    <div className="space-y-5" data-campaign-results>
      <div className="flex flex-wrap items-start gap-3">
        <button type="button" onClick={onBack} className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-ink/60 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Campaigns</button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-[22px] font-semibold tracking-[-0.03em]">{c.name || c.subject}</h2><Badge tone={c.status}>{c.status}</Badge>{c.dry_run && <Badge tone="test">Test mode</Badge>}</div>
          <p className="mt-0.5 truncate text-[13px] text-ink/55">“{c.subject}” · {scheduled ? `Scheduled ${fmtWhen(c.send_at)}${c.tz_mode === "subscriber" ? " (each subscriber's time zone, first batch)" : ""}` : c.finished_at ? `Sent ${fmtWhen(c.finished_at)}` : c.started_at ? `Started ${fmtWhen(c.started_at)}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Btn kind="ghost" size="sm" icon={RefreshCw} onClick={() => q.refetch()}>Refresh</Btn>
          <Btn kind="ghost" size="sm" icon={Copy} onClick={onDuplicate}>Duplicate</Btn>
        </div>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {c.last_error && <Notice tone="error">{c.last_error}</Notice>}

      {scheduled && (
        <Card className="border-blue-200 bg-blue-50/50">
          <div className="flex flex-wrap items-center gap-3">
            <CalendarClock className="h-5 w-5 text-blue-700" />
            <p className="flex-1 text-[14px]"><span className="font-semibold">Goes out {fmtWhen(c.send_at)}</span> to {num(c.total)} people. Nothing has been sent yet.</p>
            <Btn kind="ghost" size="sm" onClick={() => setMove((x) => !x)}>Change time</Btn>
            <ConfirmBtn icon={XCircle} confirmLabel="Yes, cancel it" onConfirm={async () => { try { await call("campaign_cancel", { id }); onChanged?.(); onBack(); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); } }}>Cancel send</ConfirmBtn>
          </div>
          {move && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div><Label>New date and time</Label><input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} /></div>
              <div><Label>Time zone</Label><select className={inputCls} value={tz} onChange={(e) => setTz(e.target.value)}>{TIMEZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</select></div>
              <Btn kind="ink" onClick={resched}>Move it</Btn>
            </div>
          )}
          <p className="mt-3 text-[12px] text-ink/50">Cancelling keeps a draft copy so you can edit and schedule it again.</p>
        </Card>
      )}

      {!scheduled && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Delivered" value={num(s.delivered)} sub={`${num(s.sent)} sent${c.skipped_count ? ` · ${num(c.skipped_count)} skipped` : ""}`} />
            <Kpi label="Opened (estimate)" value={pct(s.open_rate)} sub={`${num(s.unique_opens)} people · ${num(s.opens)} opens`} accent />
            <Kpi label="Clicked" value={pct(s.click_rate)} sub={`${num(s.unique_clicks)} people · ${pct(s.click_to_open)} of openers`} accent />
            <Kpi label="Unsubscribed" value={num(s.unsubscribes)} sub={`${num(s.bounces)} bounced · ${num(s.complaints)} spam reports`} />
          </div>
          <p className="flex items-start gap-2 text-[12px] leading-snug text-ink/50"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Opens are estimates: Apple Mail Privacy Protection and some inbox security tools load images automatically, which can count an open that didn&apos;t happen. Clicks are the stronger signal (link scanners are filtered out).</p>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] [&>*]:min-w-0">
            <Card>
              <p className="text-[13px] font-semibold">Opens and clicks over time</p>
              <div className="mt-3"><Bars data={d.timeline || []} /></div>
            </Card>
            <Card>
              <p className="text-[13px] font-semibold">Top links</p>
              {s.top_links?.length ? (
                <ul className="mt-3 space-y-2.5">
                  {s.top_links.map((l) => (
                    <li key={l.url} className="flex items-center gap-3 text-[13px]">
                      <Link2 className="h-4 w-4 shrink-0 text-[#ff3c00]" />
                      <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-ink/80 hover:underline">{l.url.replace(/^https?:\/\//, "")}</a>
                      <span className="tabular-nums text-ink/55">{num(l.unique)} people</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-3 text-[13px] text-ink/50">No clicks yet.</p>}
            </Card>
          </div>
        </>
      )}

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-hair px-4 py-3">
          <p className="text-[14px] font-semibold">Who did what</p>
          <div className="ml-auto max-w-full overflow-x-auto"><Segmented size="sm" value={filter} onChange={(v) => { setFilter(v); setSkip(0); }} options={FILTERS} /></div>
        </div>
        {d.people?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead><tr className="border-b border-hair text-left text-[11.5px] text-ink/50"><th className="px-4 py-2 font-medium">Contact</th><th className="font-medium">Opens</th><th className="font-medium">Clicks</th><th className="font-medium">Status</th><th className="pr-4 text-right font-medium">Last activity</th></tr></thead>
              <tbody>
                {d.people.map((p) => (
                  <tr key={p.email} className="border-b border-hair/60 last:border-0">
                    <td className="px-4 py-2.5"><p className="font-medium">{p.name || p.email}</p>{p.name && <p className="text-[11.5px] text-ink/50">{p.email}</p>}</td>
                    <td className="tabular-nums">{p.opens || "–"}</td>
                    <td className="tabular-nums">{p.clicks || "–"}</td>
                    <td>{p.bounced ? <Badge tone="cleaned">Bounced</Badge> : p.unsubscribed ? <Badge tone="unsubscribed">Unsubscribed</Badge> : p.clicks ? <Badge tone="sent">Clicked</Badge> : p.opens ? <Badge tone="active">Opened</Badge> : <Badge tone="draft">Delivered</Badge>}</td>
                    <td className="pr-4 text-right text-ink/55">{p.last_at ? ago(p.last_at) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-4 py-8 text-center text-[13px] text-ink/50">{scheduled ? "Activity shows up here once it sends." : "Nobody here yet."}</p>}
        {d.people_total > 50 && (
          <div className="flex items-center justify-between border-t border-hair px-4 py-2.5 text-[12.5px] text-ink/55">
            <span>{skip + 1}–{Math.min(skip + 50, d.people_total)} of {num(d.people_total)}</span>
            <div className="flex gap-2"><Btn size="sm" kind="ghost" disabled={!skip} onClick={() => setSkip(Math.max(0, skip - 50))}>Previous</Btn><Btn size="sm" kind="ghost" disabled={skip + 50 >= d.people_total} onClick={() => setSkip(skip + 50)}>Next</Btn></div>
          </div>
        )}
      </Card>
    </div>
  );
}
