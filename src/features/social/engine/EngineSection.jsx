import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "../PublishDialogs";
import { listPosts, POSTS_KEY } from "../lib/socialStore";
import { Select } from "../ui";
import {
  INTERSTELLAR, KEYS, channels, listAccounts, listClients, listDigests, listGuides, listIdeas, listVariants, loadEngineSettings,
  loadHooksKnowledge, resolveBrand,
} from "./store";
import Capture from "./Capture";
import ReviewQueue from "./ReviewQueue";
import ScheduleCalendar from "./ScheduleCalendar";
import Learn from "./Learn";
import VoiceGuide from "./VoiceGuide";
import Channels from "./Channels";

// "One idea → every platform": Capture → Voice → Design → Approve → Schedule → Learn, for Interstellar and every
// client. Admin operates on behalf of any client; the client portal Social Studio stays a locked preview.

const TABS = [
  { key: "capture", n: "01", label: "Capture" },
  { key: "voice", n: "02", label: "Voice guide" },
  { key: "review", n: "04", label: "Review queue" },
  { key: "schedule", n: "05", label: "Schedule" },
  { key: "learn", n: "06", label: "Learn" },
  { key: "channels", n: "13", label: "Channels" },
];
const STUDIO_LABEL = { on: "Portal Social Studio: On", preview: "Portal: locked preview", off: "Portal: hidden" };

export function useEngine(brandKey) {
  const clientsQ = useQuery({ queryKey: KEYS.clients, queryFn: listClients, staleTime: 5 * 60000 });
  const guidesQ = useQuery({ queryKey: KEYS.guides, queryFn: listGuides });
  const accountsQ = useQuery({ queryKey: KEYS.accounts, queryFn: listAccounts });
  const ideasQ = useQuery({ queryKey: KEYS.ideas(brandKey), queryFn: () => listIdeas(brandKey) });
  const variantsQ = useQuery({
    queryKey: KEYS.variants(brandKey), queryFn: () => listVariants(brandKey),
    refetchInterval: (q) => ((q.state.data || []).some((v) => v.status === "publishing") ? 20000 : false),
  });
  const digestsQ = useQuery({ queryKey: KEYS.digests(brandKey), queryFn: () => listDigests(brandKey) });
  const settingsQ = useQuery({ queryKey: KEYS.settings, queryFn: loadEngineSettings });
  const statusQ = useQuery({ queryKey: KEYS.status, queryFn: () => channels("status"), staleTime: 5 * 60000, retry: 1 });
  const knowledgeQ = useQuery({ queryKey: ["engine", "knowledge"], queryFn: loadHooksKnowledge, staleTime: 10 * 60000 });
  const legacyQ = useQuery({ queryKey: POSTS_KEY, queryFn: listPosts, enabled: brandKey === INTERSTELLAR });
  const brand = useMemo(() => resolveBrand(brandKey, clientsQ.data, guidesQ.data), [brandKey, clientsQ.data, guidesQ.data]);
  const statusAccounts = statusQ.data?.accounts;
  const modeOf = useMemo(() => (accountId) => (statusAccounts || []).find((a) => a.id === accountId) || null, [statusAccounts]);
  return {
    brand, clients: clientsQ.data || [], guides: guidesQ.data || [], accounts: accountsQ.data || [], ideas: ideasQ.data || [],
    variants: variantsQ.data || [], digests: digestsQ.data || [], settings: settingsQ.data, status: statusQ.data, statusQ,
    knowledge: knowledgeQ.data || {}, legacy: brandKey === INTERSTELLAR ? legacyQ.data || [] : [], modeOf,
    loading: ideasQ.isLoading || variantsQ.isLoading,
  };
}

export default function EngineSection() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("eng")) ? params.get("eng") : "capture";
  const brandKey = params.get("brand") || INTERSTELLAR;
  const me = useMe();
  const eng = useEngine(brandKey);
  const set = (k, v) => { const n = new URLSearchParams(params); n.set("section", "engine"); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };
  const counts = {
    review: eng.variants.filter((v) => v.status === "draft").length,
    schedule: eng.variants.filter((v) => v.status === "approved").length,
  };

  return (
    <div className="mt-1 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono-label text-[9px] text-ink/45">One idea · 13 platforms · nothing posts without approval</p>
          <h2 className="text-[26px] font-semibold leading-none tracking-[-0.04em]">Content <span className="text-[#ff3c00]">/engine</span></h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono-label text-[9px] text-ink/45">Brand</span>
          <Select className="h-9 !w-auto min-w-[220px]" value={brandKey === INTERSTELLAR ? "" : brandKey} onChange={(v) => set("brand", v)} placeholder="Interstellar Strategies"
            options={eng.clients.map((c) => ({ value: c.id, label: c.business }))} />
          {!eng.brand.isInterstellar && (
            <span className={`mono-label border px-1.5 py-1 text-[8.5px] ${eng.brand.studio === "on" ? "border-ink bg-ink text-white" : "border-hair text-ink/55"}`} title="Client portal state (Client usage → Studios). Admin can always operate on the client's behalf.">
              {STUDIO_LABEL[eng.brand.studio]}
            </span>
          )}
        </div>
      </div>

      <nav className="grid grid-cols-3 gap-px border border-hair bg-hair md:grid-cols-6" aria-label="Content engine steps">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => set("eng", t.key === "capture" ? "" : t.key)}
            className={`flex h-10 items-center justify-center gap-2 px-3 text-[12.5px] tracking-[-0.01em] transition-colors ${tab === t.key ? "bg-ink font-semibold text-white" : "bg-card text-ink/60 hover:text-[#ff3c00]"}`}>
            <span className={`font-mono text-[9.5px] ${tab === t.key ? "text-[#ffaa00]" : "text-ink/35"}`}>{t.n}</span>{t.label}
            {counts[t.key] ? <span className="font-mono text-[10px] text-[#ff3c00]">{counts[t.key]}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "capture" && <Capture eng={eng} me={me.data} onReview={() => set("eng", "review")} />}
      {tab === "voice" && <VoiceGuide eng={eng} me={me.data} />}
      {tab === "review" && <ReviewQueue eng={eng} me={me.data} />}
      {tab === "schedule" && <ScheduleCalendar eng={eng} />}
      {tab === "learn" && <Learn eng={eng} onCapture={() => set("eng", "")} />}
      {tab === "channels" && <Channels eng={eng} />}
    </div>
  );
}
