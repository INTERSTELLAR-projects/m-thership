// Client portal Studios: Social, Email, Ads, Accounting & Taxes, Hiring plan, Presentations, and the co-branded
// INTERSTELLAR™ × SMPL. "SMPL. Studio" (SMPL Social, coming soon; rendered by components/brand/SmplCoBrand.jsx).
// PLAN GATING (2026-11-04): Studios unlock only on HyperCare+. GravïtyCare and Website-only clients see every Studio
// as a locked preview with "Upgrade to HyperCare+" (a call or a request, never a self-serve plan change). The plan
// decision comes from the `fuel` function (fuel.studios_unlocked). Signatures + QR Codes stay free for life.
// Within HyperCare+, each Studio has a per-client state set by Justin in Møthership > Client usage:
//   off     -> no tab, no nav entry
//   preview -> visible, LOCKED preview page (default for every client): what it does, what it replaces, a static
//              sample of the real admin UI. The only action is "Ask about early access" (a ClientRequest).
//   on      -> unlocked (the server functions accept this client's calls, under fair-use caps)
// Nothing on a preview page can run a real action; the backend refuses portal calls unless the Studio is "on".
import { useState } from "react";
import { Lock, Check, Sparkles, ArrowUpRight, Loader2, Send } from "lucide-react";
import { studioState } from "@/features/usage/plans";
import { WalletPanel, UpgradeCta } from "@/features/fuel/FuelPrompts";
import { ScheduleCallModal } from "@/features/portal/PortalNav";
import SmplStudioPreview from "@/components/brand/SmplCoBrand";

export const STUDIOS = [
  {
    key: "social", tab: "studio_social", label: "Social Studio", eyebrow: "Social media",
    title: "A month of on-brand posts,", accent: "planned in an afternoon.",
    lead: "Plan, design, caption and publish your Instagram and Facebook posts from one place, built from your brand kit and written in your voice.",
    features: [
      ["On-brand designs", "Post templates pull your logo, colors and fonts from your brand kit automatically."],
      ["Captions in your voice", "AI drafts captions and hashtags from your services and recent work. You edit, approve, done."],
      ["Content calendar", "See the whole month at a glance, drag posts to new days, and approve in one pass."],
      ["Auto-publish + insights", "Approved posts go out on schedule, and reach and engagement come back to the same screen."],
    ],
    replaces: "Hootsuite (from $99/mo) + a social media manager ($100–$1,000/mo)",
  },
  {
    key: "email", tab: "studio_email", label: "Email Studio", eyebrow: "Email marketing",
    title: "Newsletters and promos", accent: "that look like you.",
    lead: "Write, design and send email campaigns to your customer list from your own domain, with unsubscribes and bounces handled for you.",
    features: [
      ["AI first drafts", "Describe the promo or update and get a ready-to-edit email in your brand's look."],
      ["Lists that stay clean", "Import contacts from a spreadsheet. Unsubscribes, bounces and complaints are suppressed automatically."],
      ["Sent from your domain", "Mail comes from your own address, so it lands in inboxes and looks like you."],
      ["Monthly sends included", "Your plan includes a monthly sending allowance. No per-contact pricing tiers."],
    ],
    replaces: "Mailchimp ($60/mo at 2,500 contacts)",
  },
  {
    // Portal v2 (Nov 2026): Ads is locked "coming soon" for every client until it launches (Justin's brief).
    key: "ads", tab: "studio_ads", label: "Ads Studio", eyebrow: "Coming soon · Paid ads", comingSoon: true,
    title: "An ads agent that", accent: "watches every dollar.",
    lead: "Your Meta ad account read in plain English: what's working, what's burning money, and exactly what to change next, with you approving every move.",
    features: [
      ["Plain-English performance", "Spend, cost per lead and what changed, explained without the dashboard jargon."],
      ["Recommendations with dollar impact", "Budget, audience and creative changes, each with the expected effect on cost per lead."],
      ["Ad copy + policy check", "New ad copy in your voice, checked against ad policies before anything goes live."],
      ["You approve every change", "Nothing is changed in your ad account until you say yes."],
    ],
    replaces: "Ad agencies (10–20% of ad spend, or from $750/mo)",
  },
  {
    key: "accounting", tab: "studio_accounting", label: "Accounting & Taxes", eyebrow: "Books & taxes",
    title: "Books, receipts and", accent: "quarterly taxes, sorted.",
    lead: "Bring in your bank and card activity, keep it categorized, and always know what to set aside for taxes before the deadline arrives.",
    features: [
      ["Import and auto-categorize", "Upload bank and card statements; transactions are categorized and flagged for review."],
      ["Quarterly tax plan", "Estimated federal and state payments with reminders two weeks before each due date."],
      ["Receipts and mileage", "Attach receipts and log business miles as you go, not in April."],
      ["Filing pack for your CPA", "A clean year-end package your accountant can file from."],
    ],
    replaces: "QuickBooks ($85/mo) + bookkeeping (~$300/mo)",
    note: "Organizes your books and estimates; it doesn't file returns or move money. Your CPA files.",
  },
  {
    key: "hiring", tab: "studio_hiring", label: "Hiring plan", eyebrow: "Growing the team",
    title: "Know when you can", accent: "afford your next hire.",
    lead: "A hiring timeline built from your revenue, with role scorecards, job posts, interview questions and onboarding ready when it's time.",
    features: [
      ["Hiring timeline", "See which role comes next and the revenue that makes it affordable."],
      ["Role scorecards + job posts", "Clear outcomes for each role and a job post ready to publish."],
      ["Interview kit", "Questions and a scoring guide for every role, so interviews compare fairly."],
      ["Onboarding checklist", "The first 30 days for every new hire, step by step."],
    ],
    replaces: "Recruiting spend (median cost per hire: $1,200)",
  },
  {
    // People pillar. Unlocked: the real Training workspace (src/features/training/PortalTraining.jsx).
    key: "training", tab: "studio_training", label: "Training", eyebrow: "People · onboarding",
    title: "Train new people", accent: "your way, fast.",
    lead: "Turn your processes into step-by-step training a new hire finishes on their phone: a short lesson, hands-on tasks, a quick check, then the next step.",
    features: [
      ["Built from your SOPs", "Lessons, hands-on checklists and quiz questions drafted from your own processes. Anything missing is flagged for you."],
      ["Role templates", "Start from new office hire, crew member, crew lead, sales or manager, then make it yours."],
      ["Phone-first player", "Trainees open a private link, pick up where they left off and ask you questions as they go. English or Spanish."],
      ["Manager view + sign-off", "See who's on track, who's stuck or overdue, quiz results, and sign them off when they're ready."],
    ],
    replaces: "Training binders, slide decks and hours of shadowing for every new hire",
  },
  {
    key: "presentations", tab: "studio_presentations", label: "Presentations", eyebrow: "Decks & proposals",
    title: "Pitch decks and proposals,", accent: "on brand in minutes.",
    lead: "Turn a prompt or a document into a polished, on-brand deck you can present, share by link or export as a PDF.",
    features: [
      ["Deck from a prompt or doc", "Describe the pitch or drop in notes; get a structured deck back."],
      ["Always on brand", "Your colors, fonts and logo on every slide, every time."],
      ["Edit with AI", "Ask for a tighter slide, a new chart or a different angle in plain words."],
      ["Share or export", "Present from the browser, share a link, or export a PDF."],
    ],
    replaces: "Deck design tools and freelance deck designers",
  },
  {
    // Always shown, always locked: not switchable per client until it launches.
    // Co-branded with our partner SMPL. (brand "SMPL.", product "SMPL Social"). Never write "Simple Social".
    key: "smpl", tab: "studio_smpl", label: "SMPL. Studio", eyebrow: "Coming soon · AI generation", comingSoon: true, cobrand: "smpl",
    title: "Image, video and voice.", accent: "Plus clipping.",
    lead: "SMPL Social is AI generation for image, video and voice, plus clipping, from our partners at SMPL., built into your portal. Content made SMPL.",
    features: [
      ["Image", "Product shots, ads and graphics from a prompt or a real photo."],
      ["Video", "Short clips, reels and ad cuts for TikTok, Reels and Shorts."],
      ["Voice", "Natural voiceovers for ads, reels and explainers."],
      ["Clipping", "Long videos turned into ready-to-post clips with captions."],
    ],
    replaces: "Separate image, video and voice AI subscriptions",
    note: "Coming soon. SMPL Social image, video and voice generation will use Media credits, separate from your AI actions.",
  },
];

export const STUDIO_BY_TAB = Object.fromEntries(STUDIOS.map((s) => [s.tab, s]));

// Tabs this client can see: everything not switched off. `locked` = tabs still in preview, or every Studio when the
// client's plan doesn't include Studios (fuel.studios_unlocked false: shown as previews, never hidden).
// The server's answer (fuel.studios) wins over the client record when it has one.
const stateOf = (client, fuel, key) => (fuel?.studios?.[key] && fuel.studios[key] !== "locked" ? fuel.studios[key] : studioState(client, key));
export function studioTabs(client, fuel) {
  const planLocked = !!fuel && fuel.studios_unlocked === false;
  const visible = STUDIOS.filter((s) => s.comingSoon || planLocked || stateOf(client, fuel, s.key) !== "off");
  return {
    tabs: visible.map((s) => [s.tab, s.label]),
    locked: new Set(visible.filter((s) => s.comingSoon || planLocked || stateOf(client, fuel, s.key) === "preview").map((s) => s.tab)),
    planLocked,
  };
}

function LockBadge({ on, soon, plan }) {
  if (plan) return <span className="inline-flex items-center gap-1.5 bg-ink px-3 py-1.5 text-[12px] font-medium text-white"><Lock className="h-3.5 w-3.5 text-[#ffaa00]" /> Included with HyperCare+</span>;
  if (soon) return <span className="inline-flex items-center gap-1.5 bg-ink px-3 py-1.5 text-[12px] font-medium text-white"><Lock className="h-3.5 w-3.5 text-[#ffaa00]" /> Coming soon · Included with your plan</span>;
  if (on) return <span className="inline-flex items-center gap-1.5 bg-green-700 px-3 py-1.5 text-[12px] font-medium text-white"><Check className="h-3.5 w-3.5" /> Included with your plan · Switched on</span>;
  return <span className="inline-flex items-center gap-1.5 bg-ink px-3 py-1.5 text-[12px] font-medium text-white"><Lock className="h-3.5 w-3.5 text-[#ffaa00]" /> Included with your plan · Unlocking soon</span>;
}

export default function StudioPreview({ tab, client, call, preview, previewId, scopeId, fuel, onRefuel, onFuelChanged }) {
  const s = STUDIO_BY_TAB[tab];
  const planLocked = !!fuel && fuel.studios_unlocked === false;
  const state = planLocked ? "locked" : s?.comingSoon ? "preview" : stateOf(client, fuel, s?.key);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sched, setSched] = useState(false);
  if (!s) return null;
  const on = state === "on";

  const ask = async () => {
    if (preview || busy || sent) return;
    setBusy(true); setErr("");
    try {
      await call("create_request", {
        kind: "studio_access", title: `Early access: ${s.label}`, priority: "normal",
        details: `${client?.business || "This client"} asked about early access to ${s.label} from the portal preview.`,
        fields: { topic: "Studio early access", studio: s.key },
      });
      setSent(true);
    } catch (e) {
      setErr(e?.response?.data?.error || "Couldn't send that. Try again or message us.");
    } finally { setBusy(false); }
  };

  if (s.cobrand === "smpl") {
    return (
      <SmplStudioPreview
        business={client?.business} preview={preview} onAsk={ask} sent={sent} busy={busy} err={err}
        replaces={s.replaces} note={s.note}
        upgrade={planLocked ? (
          <div>
            <UpgradeCta call={call} client={client} preview={preview} studioLabel={s.label} onSchedule={() => setSched(true)} />
            <ScheduleCallModal open={sched} onClose={() => setSched(false)} previewId={scopeId || previewId} preview={preview} />
          </div>
        ) : null}
      />
    );
  }

  return (
    <div className="space-y-8" data-studio={s.key} data-studio-state={state}>
      <section className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-start [&>*]:min-w-0">
        <div>
          <p className="label-cross">({s.eyebrow})</p>
          <h1 className="mt-3 text-[34px] font-semibold leading-[1] tracking-[-0.045em] md:text-[50px]">
            {s.title} <span className="text-[#ff3c00]">{s.accent}</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink/65">{s.lead}</p>
          <div className="mt-5"><LockBadge on={on} soon={!!s.comingSoon} plan={planLocked} /></div>
          <div className="mt-5 border-l-2 border-[#ff3c00] bg-card px-4 py-3">
            <p className="mono-label text-[9.5px] text-ink/50">Replaces</p>
            <p className="mt-1 text-[14px] font-medium tracking-[-0.01em]">{s.replaces}</p>
          </div>
          {planLocked ? (
            <div className="mt-6">
              <UpgradeCta call={call} client={client} preview={preview} studioLabel={s.label} onSchedule={() => setSched(true)} />
              <ScheduleCallModal open={sched} onClose={() => setSched(false)} previewId={scopeId || previewId} preview={preview} />
            </div>
          ) : (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {on ? (
              <p className="text-[13px] text-ink/60">It&apos;s switched on for your account. Message us and we&apos;ll walk you through your first {s.key === "email" ? "campaign" : "session"}.</p>
            ) : sent ? (
              <span className="inline-flex h-11 items-center gap-2 border border-hair bg-card px-4 text-[13.5px] font-medium"><Check className="h-4 w-4 text-[#ff3c00]" /> Request sent. We&apos;ll be in touch.</span>
            ) : (
              <button
                type="button" onClick={ask} disabled={preview || busy}
                className="flame-bg flex h-11 items-center gap-2 px-5 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                title={preview ? "Admin preview: only the client's own login can send this" : undefined}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Ask about early access
              </button>
            )}
            {preview && !on && <span className="text-[11.5px] text-ink/45">Admin preview: the button works from the client&apos;s login.</span>}
          </div>
          )}
          {err && <p role="alert" className="mt-2 text-[12px] text-red-700">{err}</p>}
        </div>
        <SampleFrame label={s.label}><Mock k={s.key} business={client?.business} /></SampleFrame>
      </section>

      <section className="grid gap-px overflow-hidden rounded-md border border-hair bg-hair sm:grid-cols-2 lg:grid-cols-4">
        {s.features.map(([h, p]) => (
          <div key={h} className="bg-card p-5">
            <span className="flex h-8 w-8 items-center justify-center bg-ink/[0.06] text-[#ff3c00]"><Sparkles className="h-4 w-4" /></span>
            <p className="mt-3 text-[15px] font-semibold tracking-[-0.02em]">{h}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink/60">{p}</p>
          </div>
        ))}
      </section>
      {s.note && <p className="text-[11.5px] text-ink/45">{s.note}</p>}
      {fuel && !planLocked && !s.comingSoon && <WalletPanel key={`${fuel.client_id || ""}${fuel.month}`} fuel={fuel} scopeId={scopeId || previewId} preview={preview} onChanged={onFuelChanged} onRefuel={onRefuel} />}
    </div>
  );
}

// Static, non-interactive picture of the real admin screen. Clearly labelled "Sample".
function SampleFrame({ label, children }) {
  return (
    <figure className="relative select-none overflow-hidden rounded-md border border-hair bg-[#f7f5f2] shadow-[0_30px_60px_-30px_rgba(26,26,26,.45)]" aria-label={`Sample screen from ${label}`}>
      <div className="flex items-center gap-1.5 border-b border-hair bg-card px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-ink/15" /><span className="h-2 w-2 rounded-full bg-ink/15" /><span className="h-2 w-2 rounded-full bg-ink/15" />
        <span className="ml-2 truncate font-mono text-[10px] text-ink/40">Møthership · {label}</span>
        <span className="ml-auto bg-[#ff3c00] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-white">Sample</span>
      </div>
      <div className="pointer-events-none p-4" aria-hidden="true">{children}</div>
      <figcaption className="border-t border-hair px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/40">Sample data · for illustration</figcaption>
    </figure>
  );
}

const Tile = ({ k, v, sub }) => (
  <div className="border border-hair bg-card px-3 py-2.5">
    <p className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink/45">{k}</p>
    <p className="mt-1 text-[18px] font-semibold tracking-[-0.03em] tabular-nums">{v}</p>
    {sub && <p className="text-[10px] text-ink/45">{sub}</p>}
  </div>
);

function Mock({ k, business }) {
  const biz = business || "Your business";
  if (k === "social") {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const posts = [["Before & after", "flame"], ["Team spotlight", "ink"], ["5-star review", "flame"], ["Seasonal offer", "ink"], ["Behind the scenes", "flame"]];
    return (
      <div>
        <div className="flex items-center justify-between"><p className="text-[13px] font-semibold">Week of Nov 9</p><span className="text-[10px] text-ink/45">5 posts · 4 approved</span></div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {days.map((d, i) => (
            <div key={d} className="min-w-0">
              <p className="font-mono text-[8.5px] uppercase text-ink/45">{d}</p>
              <div className={`mt-1 aspect-[4/5] p-1.5 ${posts[i][1] === "flame" ? "flame-bg text-white" : "bg-ink text-white"}`}>
                <p className="text-[8px] font-semibold leading-tight">{posts[i][0]}</p>
                <p className="mt-auto pt-6 text-[6.5px] opacity-70">{biz}</p>
              </div>
              <p className={`mt-1 text-[8.5px] ${i === 3 ? "text-[#ff6a00]" : "text-green-700"}`}>{i === 3 ? "Needs approval" : "Approved"}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 border border-hair bg-card p-2.5">
          <p className="font-mono text-[8.5px] uppercase text-ink/45">Caption · AI draft</p>
          <p className="mt-1 text-[11px] leading-snug text-ink/75">Fresh results from this week&apos;s project. Swipe to see the before. Booking for December is open now, link in bio.</p>
        </div>
      </div>
    );
  }
  if (k === "email") {
    return (
      <div className="grid grid-cols-[0.9fr_1.1fr] gap-3">
        <div className="space-y-2">
          <Tile k="Audience" v="2,140" sub="Customers list · 12 unsubscribed" />
          <div className="border border-hair bg-card p-2.5 text-[10.5px]">
            <p className="font-mono text-[8.5px] uppercase text-ink/45">Subject</p>
            <p className="mt-0.5 font-medium">Holiday hours + a thank-you offer</p>
          </div>
          <div className="flame-bg px-2.5 py-2 text-center text-[11px] font-semibold text-white">Schedule send</div>
        </div>
        <div className="overflow-hidden border border-hair bg-white">
          <div className="h-1 bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" />
          <div className="p-3">
            <p className="font-mono text-[8px] uppercase text-[#ff3c00]">Announcement</p>
            <p className="mt-1 text-[15px] font-semibold leading-tight tracking-[-0.03em]">Thank you <span className="text-[#ff3c00]">/this year</span></p>
            <p className="mt-1.5 text-[10px] leading-snug text-ink/65">Hi Sam, here are our holiday hours and a little something for being with {biz}.</p>
            <div className="mt-2 inline-block bg-ink px-2.5 py-1 text-[9px] font-semibold text-white">Claim 15% off</div>
            <p className="mt-3 text-[8px] text-ink/40">Unsubscribe</p>
          </div>
        </div>
      </div>
    );
  }
  if (k === "ads") {
    const rows = [["Winter promo · Leads", "$412", "$18.70", "up"], ["Retargeting · Site visitors", "$188", "$11.05", "good"], ["Broad · New service", "$296", "$41.10", "bad"]];
    return (
      <div>
        <div className="grid grid-cols-3 gap-2"><Tile k="Spend (7d)" v="$896" /><Tile k="Leads" v="47" sub="+9 vs last week" /><Tile k="Cost / lead" v="$19.06" sub="-12%" /></div>
        <table className="mt-3 w-full border border-hair bg-card text-[10.5px]">
          <thead><tr className="text-left font-mono text-[8px] uppercase text-ink/45"><th className="px-2 py-1.5 font-normal">Campaign</th><th className="font-normal">Spend</th><th className="pr-2 text-right font-normal">CPL</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r[0]} className="border-t border-hair"><td className="truncate px-2 py-1.5">{r[0]}</td><td>{r[1]}</td><td className={`pr-2 text-right font-medium ${r[3] === "bad" ? "text-red-700" : "text-green-700"}`}>{r[2]}</td></tr>)}</tbody>
        </table>
        <div className="mt-3 border-l-2 border-[#ff3c00] bg-card p-2.5">
          <p className="font-mono text-[8.5px] uppercase text-[#ff3c00]">Recommendation · needs your OK</p>
          <p className="mt-1 text-[11px] leading-snug">Pause &quot;Broad · New service&quot; and move $40/day to Winter promo. Expected: about 6 more leads a week at the same spend.</p>
          <div className="mt-2 flex gap-1.5"><span className="bg-ink px-2 py-0.5 text-[9px] font-semibold text-white">Approve</span><span className="border border-hair px-2 py-0.5 text-[9px]">Not now</span></div>
        </div>
      </div>
    );
  }
  if (k === "accounting") {
    const tx = [["Nov 3", "Home Depot", "Materials", "-$214.18"], ["Nov 2", "Stripe payout", "Revenue", "+$3,120.00"], ["Nov 1", "Shell", "Vehicle", "-$68.40"], ["Oct 31", "Google Workspace", "Software", "-$14.00"]];
    return (
      <div>
        <div className="grid grid-cols-3 gap-2"><Tile k="Revenue YTD" v="$148,200" /><Tile k="Expenses YTD" v="$61,930" /><Tile k="Set aside" v="$21,400" sub="Q4 due Jan 15" /></div>
        <ul className="mt-3 divide-y divide-hair border border-hair bg-card text-[10.5px]">
          {tx.map((t) => <li key={t[1]} className="flex items-center gap-2 px-2 py-1.5"><span className="w-10 font-mono text-[9px] text-ink/45">{t[0]}</span><span className="flex-1 truncate">{t[1]}</span><span className="bg-ink/[0.06] px-1.5 py-0.5 text-[9px]">{t[2]}</span><span className={`w-16 text-right tabular-nums ${t[3].startsWith("+") ? "text-green-700" : ""}`}>{t[3]}</span></li>)}
        </ul>
        <p className="mt-2 text-[10px] text-ink/50">3 transactions need a category · 2 receipts missing</p>
      </div>
    );
  }
  if (k === "training") {
    const people = [["Marco R.", "Crew member", 67, "ES"], ["Dana O.", "Crew member", 100, "Sign-off"], ["Tyler B.", "Office hire", 25, "Stuck"]];
    return (
      <div>
        <div className="grid grid-cols-3 gap-2"><Tile k="In training" v="3" /><Tile k="Avg. complete" v="64%" /><Tile k="Questions" v="1" sub="Waiting on you" /></div>
        <ul className="mt-3 space-y-2">
          {people.map((p) => (
            <li key={p[0]} className="flex items-center gap-2.5 border border-hair bg-card px-2.5 py-2">
              <span className="w-16 truncate text-[11.5px] font-medium">{p[0]}</span>
              <span className="w-20 truncate text-[9.5px] text-ink/50">{p[1]}</span>
              <span className="h-1.5 flex-1 bg-ink/[0.08]"><span className="block h-full bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" style={{ width: `${p[2]}%` }} /></span>
              <span className={`w-14 text-right text-[9px] ${p[3] === "Stuck" ? "text-amber-700" : p[3] === "Sign-off" ? "text-[#ff3c00]" : "text-ink/50"}`}>{p[3]}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 border-l-2 border-[#ff3c00] bg-card p-2.5">
          <p className="font-mono text-[8.5px] uppercase text-[#ff3c00]">Module 2 of 6 · Hands-on</p>
          <p className="mt-1 text-[11px] leading-snug">Load a truck from the job sheet with your lead. Then take before photos of every slope.</p>
        </div>
      </div>
    );
  }
  if (k === "hiring") {
    const roles = [["Now", "Field technician", "Revenue supports it", true], ["Q2 2027", "Office coordinator", "At $35K/mo revenue", false], ["Q4 2027", "Crew lead", "At $52K/mo revenue", false]];
    return (
      <div>
        <div className="grid grid-cols-2 gap-2"><Tile k="Next hire" v="Field tech" sub="Affordable now" /><Tile k="Est. cost / yr" v="$52,000" sub="Wage + taxes" /></div>
        <ol className="mt-3 space-y-2">
          {roles.map((r) => (
            <li key={r[1]} className="flex items-center gap-2.5 border border-hair bg-card px-2.5 py-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r[3] ? "bg-[#ff3c00]" : "bg-ink/20"}`} />
              <span className="w-14 font-mono text-[9px] uppercase text-ink/45">{r[0]}</span>
              <span className="flex-1 text-[11.5px] font-medium">{r[1]}</span>
              <span className="text-[9.5px] text-ink/50">{r[2]}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[10px] text-ink/50">Scorecard, job post and interview kit ready for: Field technician</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3">
      <div className="space-y-1.5">{[1, 2, 3, 4].map((i) => <div key={i} className={`aspect-video ${i === 1 ? "flame-bg" : "bg-ink/80"}`} />)}</div>
      <div className="aspect-video bg-ink p-4 text-white">
        <p className="font-mono text-[8px] uppercase text-[#ffaa00]">Proposal</p>
        <p className="mt-2 text-[18px] font-semibold leading-tight tracking-[-0.03em]">{biz} <span className="text-[#ff6a00]">/2027 plan</span></p>
        <p className="mt-2 text-[9px] text-white/60">Where we are, where we&apos;re going, and how we get there.</p>
        <ArrowUpRight className="mt-3 h-4 w-4 text-[#ff6a00]" />
      </div>
    </div>
  );
}
