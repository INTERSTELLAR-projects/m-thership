// One source of truth for offers (OfferCatalog), read-only here, plus the plan for wiring every surface to it.
// Nothing on the website, funnel, portal or decks reads it yet: that waits for Justin's approval (q:offers-wire).
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const KIND_LABEL = { mission: "Missions", build: "Builds", addon: "Add-ons", subscription: "Subscriptions", subscription_tier: "Subscription tiers", internal: "Internal only", bonus: "ALPHA bonuses", guarantee: "Guarantees", policy: "Policies", portal_tool: "Free portal tools", studio_access: "Studio access by plan" };

export const WIRING_STEPS = [
  "Website (app 6ae18dc255e0da91f0ee6f1b): add src/lib/offers.js that fetches POST /functions/launch {action:'offers'} from Møthership (public, cached 5 min) and maps rows onto ALPHA/BRAVO/VALUE_STACK/BONUSES/SINGLE_BUILDS/ORBIT_TIERS; keep today's data/offers.js as the offline fallback so the site never renders without prices.",
  "Booking funnel (69c5c154b612521a339f477d): same fetch replaces src/funnel/offers.js; the website and funnel then show identical numbers by construction.",
  "Møthership: Social Studio (social/brand.js BRAND.offers), AgencyKnowledge 'offers' section and the portal plan cards read OfferCatalog instead of their own copies; AgencyKnowledge keeps a generated mirror for Claude tasks.",
  "Decks: Presentation Studio pulls the catalog when a deck mentions packages; the deck script cites OfferCatalog keys.",
  "Guardrail: a Claude check compares every surface to OfferCatalog weekly and files a LaunchItem on any mismatch. Prices change only by editing OfferCatalog (Justin's decision).",
];

export default function OffersPanel() {
  const q = useQuery({ queryKey: ["OfferCatalog"], queryFn: async () => (await base44.entities.OfferCatalog.list("sort", 300)) || [] });
  const rows = q.data || [];
  const kinds = [...new Set(rows.map((r) => r.kind))];
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        {q.isLoading && <p className="text-[13px] text-ink/50">Loading the catalog…</p>}
        {kinds.map((k) => (
          <div key={k}>
            <p className="label-cross mb-2 text-ink/60">({KIND_LABEL[k] || k})</p>
            <div className="border border-hair bg-card">
              {rows.filter((r) => r.kind === k).map((r) => (
                <div key={r.id} className="flex flex-col gap-1 border-b border-hair px-4 py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium">{r.name}{r.architecture ? <span className="ml-2 font-mono text-[10.5px] text-ink/45">{r.architecture} {r.architecture_version}</span> : null}{r.public === false && <span className="ml-2 mono-label text-[9px] text-[#c23000]">internal</span>}{r.status === "pending_approval" && <span className="ml-2 mono-label text-[9px] text-[#c23000]">needs your decision</span>}</p>
                    {(r.terms || r.summary) && <p className="text-[12px] text-ink/55">{r.terms || r.summary}</p>}
                    {r.notes && <p className="text-[11.5px] text-[#c23000]">{r.notes}</p>}
                  </div>
                  {r.price_display && <span className="shrink-0 font-mono text-[12.5px] tabular-nums">{r.price_display}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <aside className="h-fit border border-hair bg-ink p-5 text-white">
        <p className="mono-label text-[10px] text-[#ffaa00]">For your approval</p>
        <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.03em]">Wire every surface <span className="text-[#ff6a00]">/once</span></h3>
        <p className="mt-2 text-[12.5px] text-white/65">Public read-only endpoint: Møthership function <span className="font-mono">launch</span>, body <span className="font-mono">{"{ action: \"offers\" }"}</span>. Returns only public, active rows. Not wired anywhere yet.</p>
        <ol className="mt-3 space-y-2 text-[12.5px] text-white/80">
          {WIRING_STEPS.map((s, i) => <li key={s} className="flex gap-2"><span className="font-mono text-[#ff6a00]">{String(i + 1).padStart(2, "0")}</span><span>{s}</span></li>)}
        </ol>
      </aside>
    </div>
  );
}
