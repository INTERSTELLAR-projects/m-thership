// Campaigns: list + stats, new campaign, editor, results.
import { useMemo, useState } from "react";
import { BarChart3, CalendarClock, Mail, Plus, Send } from "lucide-react";
import CampaignEditor from "./CampaignEditor";
import CampaignResults from "./CampaignResults";
import { Badge, Btn, Empty, Kpi, Notice } from "./ui";
import { errMsg, fmtWhen, num, pct } from "./api";

export default function CampaignsTab({ data, call, refresh, go }) {
  const [open, setOpen] = useState(null); // { mode: edit | results, campaign }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const camps = (data.campaigns || []).filter((c) => c.status !== "cancelled" || c.sent_count);
  const sent = camps.filter((c) => ["sent", "partial", "sending"].includes(c.status));
  const avg = useMemo(() => {
    const w = sent.filter((c) => c.stats?.delivered);
    const tot = w.reduce((n, c) => n + c.stats.delivered, 0);
    if (!tot) return { open: null, click: null };
    return { open: (w.reduce((n, c) => n + c.stats.unique_opens, 0) / tot) * 100, click: (w.reduce((n, c) => n + c.stats.unique_clicks, 0) / tot) * 100 };
  }, [sent]);

  const create = async () => {
    setBusy(true); setErr("");
    try {
      const listId = data.settings?.default_list_id || data.lists?.[0]?.id;
      const r = await call("campaign_save", { name: "", subject: "", blocks: [], audience: { list_ids: listId ? [listId] : [] } });
      setOpen({ mode: "edit", campaign: r.campaign });
      refresh();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const openRow = async (c) => {
    if (c.status === "draft") {
      try { const r = await call("campaign_get", { id: c.id }); setOpen({ mode: "edit", campaign: r.campaign }); } catch (e) { setErr(errMsg(e)); }
    } else setOpen({ mode: "results", campaign: c });
  };
  const duplicate = async (id) => {
    try { const r = await call("campaign_duplicate", { id }); refresh(); setOpen({ mode: "edit", campaign: r.campaign }); } catch (e) { setErr(errMsg(e)); }
  };

  if (open?.mode === "edit") {
    return <CampaignEditor key={open.campaign.id} campaign={open.campaign} data={data} call={call} onClose={() => { setOpen(null); refresh(); }} onSaved={() => {}} onSent={(r) => { refresh(); setOpen({ mode: "results", campaign: r.campaign }); }} />;
  }
  if (open?.mode === "results") {
    return <CampaignResults id={open.campaign.id} call={call} onBack={() => { setOpen(null); refresh(); }} onDuplicate={() => duplicate(open.campaign.id)} onChanged={refresh} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Subscribed contacts" value={num(data.counts?.subscribed)} sub={`${num(data.counts?.total)} total`} />
        <Kpi label="Campaigns sent" value={num(sent.length)} sub={`${num(camps.filter((c) => c.status === "scheduled").length)} scheduled`} />
        <Kpi label="Average open rate" value={pct(avg.open)} sub="estimate" accent />
        <Kpi label="Average click rate" value={pct(avg.click)} sub="of delivered" accent />
      </div>
      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] font-semibold tracking-[-0.03em]">Campaigns</h2>
        <Btn kind="flame" icon={Plus} busy={busy} onClick={create}>New campaign</Btn>
      </div>
      {camps.length ? (
        <div className="overflow-hidden rounded-xl border border-hair bg-white">
          {camps.map((c) => (
            <button key={c.id} type="button" onClick={() => openRow(c)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-b border-hair/70 px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-[#ff3c00]/[0.03]">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.status === "draft" ? "bg-ink/[0.05] text-ink/50" : c.status === "scheduled" ? "bg-blue-50 text-blue-700" : "bg-[#ff3c00]/10 text-[#ff3c00]"}`}>
                {c.status === "scheduled" ? <CalendarClock className="h-4 w-4" /> : c.status === "draft" ? <Mail className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1 basis-48">
                <span className="block truncate text-[14.5px] font-semibold tracking-[-0.01em]">{c.name || c.subject || "Untitled email"}</span>
                <span className="block truncate text-[12.5px] text-ink/50">{c.status === "scheduled" ? `Sends ${fmtWhen(c.send_at)}` : c.status === "draft" ? "Draft" : c.finished_at ? `Sent ${fmtWhen(c.finished_at)}` : fmtWhen(c.created_at || c.created_date)}{c.total ? ` · ${num(c.total)} recipients` : ""}</span>
              </span>
              {c.stats && <span className="hidden text-right text-[12.5px] tabular-nums text-ink/60 sm:block"><span className="font-semibold text-ink">{pct(c.stats.open_rate)}</span> opened<br /><span className="font-semibold text-ink">{pct(c.stats.click_rate)}</span> clicked</span>}
              {!c.stats && ["sent", "partial"].includes(c.status) && <span className="hidden items-center gap-1 text-[12px] text-ink/45 sm:inline-flex"><BarChart3 className="h-3.5 w-3.5" /> View results</span>}
              <Badge tone={c.status}>{c.status}</Badge>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon={Mail} title="Your first campaign is a minute away" action={<div className="flex flex-wrap justify-center gap-2"><Btn kind="flame" icon={Plus} onClick={create}>New campaign</Btn>{!data.counts?.total && <Btn kind="ghost" onClick={() => go("contacts")}>Import contacts first</Btn>}</div>}>
          Describe what you want to say and we&apos;ll draft it in your brand. Send now or schedule it for the perfect time.
        </Empty>
      )}
    </div>
  );
}
