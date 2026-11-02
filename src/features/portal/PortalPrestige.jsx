import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Check, MessageSquare, Mail, PhoneCall, Trophy, Play } from "lucide-react";
import { Panel, Empty, Tag } from "@/features/clients/ui";
import { mergeOffer, progressFor, tierLabel, unlockProps, money, smsHref, mailHref } from "@/lib/prestige";
import PrestigeEmblem from "@/components/prestige/PrestigeEmblem";
import TierLadderCard from "@/components/prestige/TierLadderCard";
import PrestigeUnlock from "@/components/prestige/PrestigeUnlock";

// Client-portal view of the Prestige referral program. Data comes only from the `portal`
// backend function (scoped to this client): their rank, link, referrals and rewards. Read-only,
// except "Get my link" (enrolls them) and marking an unlock animation as seen.

const CLIENT_STATUS = { Pending: "Lead sent", Booked: "Call booked", Confirmed: "Signed", "Paid Out": "Signed", Lost: "Didn't move forward" };
const fmtDay = (d) => (d ? new Date(d.length <= 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export default function PortalPrestige({ call, previewId }) {
  const qc = useQueryClient();
  const key = ["portal", previewId, "prestige"];
  const q = useQuery({ queryKey: key, queryFn: () => call("prestige"), retry: false });
  const [unlock, setUnlock] = useState(null);
  const [copied, setCopied] = useState("");
  const [joining, setJoining] = useState(false);
  const d = q.data;
  const offer = useMemo(() => (d?.offer ? mergeOffer(d.offer) : null), [d]);
  const me = d?.member;

  // First visit after crossing a tier: play the unlock once (not in admin preview).
  useEffect(() => {
    if (!me || !offer || previewId) return;
    if (me.tier > (me.celebrated || 0)) setUnlock({ ...unlockProps(me.tier, offer, me.name), sound: false, key: Date.now() });
  }, [me, offer, previewId]);

  const closeUnlock = async () => {
    const tier = unlock?.tierIndex;
    setUnlock(null);
    if (!previewId && tier) {
      try { await call("prestige_seen", { tier }); } catch { /* non-critical */ }
      qc.invalidateQueries({ queryKey: key });
    }
  };

  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1800); } catch { setCopied(""); }
  };

  const join = async () => {
    setJoining(true);
    try { await call("prestige_join"); await qc.invalidateQueries({ queryKey: key }); } finally { setJoining(false); }
  };

  if (q.isLoading) return <p className="py-20 text-center text-ink/50">Loading…</p>;
  if (q.isError || !offer) return <Panel><Empty>The referral program isn&apos;t available right now. Message us and we&apos;ll sort it out.</Empty></Panel>;

  const pr = me ? progressFor(me.signed, offer) : null;

  return (
    <div className="space-y-8">
      <section className="band-dark grain relative overflow-hidden rounded-md">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,.35),transparent_65%)]" />
        <div className="relative grid gap-6 p-5 md:p-7 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="mono-label text-[10px] text-white/50">(Prestige referrals)</p>
            <h1 className="mt-3 text-[30px] font-semibold leading-[0.98] tracking-[-0.045em] md:text-[44px]">
              Send a friend.<br /><span className="bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00] bg-clip-text text-transparent">Get rewarded every time.</span>
            </h1>
            {me ? (
              <div className="mt-6 flex items-center gap-4">
                <button type="button" onClick={() => me.tier && setUnlock({ ...unlockProps(me.tier, offer, me.name), sound: true, key: Date.now() })} title={me.tier ? "Replay your unlock" : ""}>
                  <PrestigeEmblem tier={me.tier || 1} locked={!me.tier} size={76} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="mono-label text-[10px] text-white/50">Your rank</p>
                  <p className="text-[22px] font-semibold tracking-[-0.03em]">{tierLabel(me.tier, offer)}</p>
                  <p className="font-mono text-[11px] text-white/55">{me.signed} signed · {me.booked} booked · {me.sent} sent</p>
                  <div className="mt-2 h-1.5 overflow-hidden bg-white/10"><div className="h-full flame-bg transition-[width] duration-700" style={{ width: `${pr.pct}%` }} /></div>
                  <p className="mt-1.5 text-[12px] text-white/60">{pr.maxed ? "You're at the top of the ladder." : `${pr.remaining} more signed referral${pr.remaining === 1 ? "" : "s"} to ${pr.next.name}${pr.next.unlock ? `: ${pr.next.unlock}` : ""}.`}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/65">Get your personal link, send it to anyone who needs a better website or more customers, and you earn a reward when they book a call and again when they sign.</p>
            )}
          </div>

          <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
            {me ? (
              <>
                <p className="mono-label text-[10px] text-white/55">Your referral link</p>
                <p className="mt-2 break-all border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-[12px] text-white/85">{d.link}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button type="button" onClick={() => copy(d.link, "link")} className="inline-flex h-10 items-center justify-center gap-1.5 bg-[#ff3c00] text-[12.5px] font-medium text-white hover:bg-[#ff6a00]">{copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied === "link" ? "Copied" : "Copy link"}</button>
                  <a href={smsHref(d.share_text)} className="inline-flex h-10 items-center justify-center gap-1.5 border border-white/25 text-[12.5px] text-white hover:bg-white hover:text-ink"><MessageSquare className="h-3.5 w-3.5" />Text</a>
                  <a href={mailHref(d.share_text)} className="inline-flex h-10 items-center justify-center gap-1.5 border border-white/25 text-[12.5px] text-white hover:bg-white hover:text-ink"><Mail className="h-3.5 w-3.5" />Email</a>
                  <button type="button" onClick={() => copy(d.share_text, "msg")} className="inline-flex h-10 items-center justify-center gap-1.5 border border-white/25 text-[12.5px] text-white hover:bg-white hover:text-ink">{copied === "msg" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied === "msg" ? "Copied" : "Message"}</button>
                </div>
                <p className="mt-3 text-[11.5px] leading-snug text-white/50">&ldquo;Text&rdquo; opens a ready-to-send message with your link in it. Just pick who to send it to.</p>
              </>
            ) : (
              <div className="flex h-full flex-col items-start justify-center gap-3">
                <p className="text-[15px] font-semibold">Your link takes one click.</p>
                <button type="button" onClick={join} disabled={joining} className="btn-roll is-flame disabled:opacity-60"><span className="roll"><span>{joining ? "Setting up…" : "Get my referral link"}</span><span>{joining ? "Setting up…" : "Get my referral link"}</span></span><span className="box"><Trophy className="h-3.5 w-3.5" /></span></button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {[["When they book a call", offer.booked, PhoneCall], ["When they sign", offer.signed, Trophy]].map(([when, r, Icon]) => (
          <div key={when} className="flex gap-3 rounded-md border border-hair bg-card p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center flame-bg text-white"><Icon className="h-4 w-4" /></span>
            <div>
              <p className="mono-label text-[9.5px] text-ink/50">{when}</p>
              <p className="text-[16px] font-semibold tracking-[-0.02em]">{r.title}</p>
              <p className="text-[12.5px] leading-snug text-ink/55">{r.detail}</p>
              {r.value ? <p className="mt-1 font-mono text-[11px] text-[#ff3c00]">{money(r.value)} value</p> : null}
            </div>
          </div>
        ))}
      </section>

      <section>
        <p className="label-cross">(The ladder)</p>
        <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.04em]">Unlocks by signed referrals</h2>
        <div className="no-scrollbar mt-4 flex snap-x gap-3 overflow-x-auto pb-1 md:grid md:overflow-visible" style={{ gridTemplateColumns: `repeat(${offer.tiers.length}, minmax(0, 1fr))` }}>
          {offer.tiers.map((t, i) => {
            const idx = i + 1;
            const tier = me?.tier || 0;
            const state = tier >= idx ? "unlocked" : tier + 1 === idx ? "next" : "locked";
            return <div key={i} className="snap-start"><TierLadderCard tier={t} index={idx} state={state} pct={state === "next" && pr ? pr.pct : 0} /></div>;
          })}
        </div>
      </section>

      {me && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel label="Your referrals" title={`${d.referrals.length} sent`}>
            {d.referrals.length === 0 ? <Empty>Share your link. Everyone you send shows up here.</Empty> : (
              <ul className="divide-y divide-hair">
                {d.referrals.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{r.referredClientName}</span>
                    <span className="font-mono text-[10.5px] text-ink/45">{fmtDay(r.date)}</span>
                    <Tag tone={r.status === "Confirmed" || r.status === "Paid Out" ? "flame" : r.status === "Booked" ? "amber" : "muted"}>{CLIENT_STATUS[r.status] || r.status}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel label="Your rewards" title={`${d.rewards.length} earned`}>
            {d.rewards.length === 0 ? <Empty>Your first reward lands the moment someone you sent books a call.</Empty> : (
              <ul className="divide-y divide-hair">
                {d.rewards.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{r.title}</p>
                      <p className="text-[11.5px] text-ink/50">{r.referredClientName ? `For ${r.referredClientName} · ` : ""}{fmtDay(r.earned_at)}</p>
                    </div>
                    <Tag tone={r.status === "delivered" ? "green" : "flame"}>{r.status === "delivered" ? "Delivered" : "On its way"}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {previewId && me?.tier > 0 && (
        <button type="button" onClick={() => setUnlock({ ...unlockProps(me.tier, offer, me.name), sound: true, key: Date.now() })} className="inline-flex items-center gap-1.5 text-[12px] text-ink/55 hover:text-[#ff3c00]"><Play className="h-3 w-3" />Preview what they see on unlock</button>
      )}

      <p className="text-[11.5px] leading-relaxed text-ink/45">{offer.terms}</p>

      <PrestigeUnlock
        key={unlock?.key}
        open={!!unlock}
        tierIndex={unlock?.tierIndex}
        title={unlock?.title}
        subtitle={unlock?.subtitle}
        memberName={unlock?.memberName}
        rewards={unlock?.rewards || []}
        sound={unlock?.sound}
        onClose={closeUnlock}
      />
    </div>
  );
}
