import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, BookOpen, Image, Inbox as InboxIcon, Layers, Plug, ShieldCheck, Target } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { KEYS, inScope, listRecs } from "./lib/adsApi";
import { Tabs } from "./ui";
import Overview from "./tabs/Overview";
import Inbox from "./tabs/Inbox";
import Campaigns from "./tabs/Campaigns";
import Creatives from "./tabs/Creatives";
import Policy from "./tabs/Policy";
import Connections from "./tabs/Connections";
import Learnings from "./tabs/Learnings";
import Goals from "./tabs/Goals";

// Ads Studio (admin). One place to read ad performance, build on-brand creatives, policy-check them, and approve
// what the optimisation agent proposes. Built for per-client use later: every view takes a clientId scope
// ("" = Interstellar's own ads) and a readOnly flag for a future portal-safe view. Not linked from the portal.

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "inbox", label: "Approvals", icon: InboxIcon },
  { key: "campaigns", label: "Campaigns", icon: Layers },
  { key: "creatives", label: "Creatives", icon: Image },
  { key: "policy", label: "Policy guard", icon: ShieldCheck },
  { key: "connections", label: "Connections", icon: Plug },
  { key: "learnings", label: "Learnings & log", icon: BookOpen },
  { key: "goals", label: "Goals & safety", icon: Target },
];

export default function AdsStudioPage({ clientId = "", readOnly = false }) {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "overview";
  const go = (k) => { const n = new URLSearchParams(params); n.set("tab", k); setParams(n, { replace: true }); };
  const recsQ = useQuery({ queryKey: KEYS.recs, queryFn: listRecs });
  const waiting = (recsQ.data || []).filter(inScope(clientId)).filter((r) => r.status === "proposed").length;
  const tabs = TABS.map((t) => (t.key === "inbox" ? { ...t, count: waiting } : t));
  const props = { clientId, readOnly, onGo: go };

  return (
    <div className="min-h-full">
      <PageHeader breadcrumb="Studio / Ads Studio" rightText="Agent proposes · Justin approves · nothing spends on its own" />
      <div className="space-y-4 px-5 py-5 md:px-8">
        <Tabs tabs={tabs} value={tab} onChange={go} />
        {tab === "overview" && <Overview {...props} />}
        {tab === "inbox" && <Inbox {...props} />}
        {tab === "campaigns" && <Campaigns {...props} />}
        {tab === "creatives" && <Creatives {...props} />}
        {tab === "policy" && <Policy {...props} />}
        {tab === "connections" && <Connections {...props} />}
        {tab === "learnings" && <Learnings {...props} />}
        {tab === "goals" && <Goals {...props} />}
      </div>
    </div>
  );
}
