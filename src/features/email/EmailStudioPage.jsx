import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { newId, normalizeBlocks } from "./emailBlocks";
import { BLANK_DOC } from "./templates";
import { KEYS, listClients, listDrafts, listLists, listSubscribers, listTemplates, loadPortalUrl, DEFAULT_PORTAL_URL } from "./store";
import Composer from "./Composer";
import SubscribersTab from "./SubscribersTab";
import { HistoryTab, ListsTab, TemplatesTab } from "./LibraryTabs";
import { Btn } from "./ui";

// /email: Email Studio (admin only). Compose with AI in the house template, preview, send 1:1 or mass,
// keep drafts / sent history, reusable templates, Email Subscribers and saved lists.
const TABS = [
  { key: "compose", label: "Compose" },
  { key: "history", label: "Drafts & Sent" },
  { key: "templates", label: "Templates" },
  { key: "subscribers", label: "Subscribers" },
  { key: "lists", label: "Lists" },
];

const fresh = (src = BLANK_DOC, extra = {}) => ({
  id: null, status: "draft", prompt: "",
  subject: src.subject || "",
  blocks: normalizeBlocks(JSON.parse(JSON.stringify(src.blocks || BLANK_DOC.blocks))).map((b) => ({ ...b, id: newId() })),
  audience: src.audience || { mode: "clients", client_ids: [] },
  ...extra,
});

export default function EmailStudioPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "compose";
  const setTab = (k) => { const n = new URLSearchParams(params); if (k === "compose") n.delete("tab"); else n.set("tab", k); setParams(n, { replace: true }); };
  const [email, setEmail] = useState(() => fresh());
  const [composerKey, setComposerKey] = useState(0);

  const clientsQ = useQuery({ queryKey: KEYS.clients, queryFn: listClients });
  const subsQ = useQuery({ queryKey: KEYS.subs, queryFn: listSubscribers });
  const listsQ = useQuery({ queryKey: KEYS.lists, queryFn: listLists });
  const draftsQ = useQuery({ queryKey: KEYS.drafts, queryFn: listDrafts });
  const templatesQ = useQuery({ queryKey: KEYS.templates, queryFn: listTemplates });
  const portalQ = useQuery({ queryKey: KEYS.portal, queryFn: loadPortalUrl });
  const data = { clients: clientsQ.data || [], subscribers: subsQ.data || [], lists: listsQ.data || [], portalUrl: portalQ.data || DEFAULT_PORTAL_URL };
  const refresh = () => ["drafts", "templates", "subscribers", "lists"].forEach((k) => qc.invalidateQueries({ queryKey: ["email", k] }));

  const load = (next) => { setEmail(next); setComposerKey((k) => k + 1); setTab("compose"); };

  // Deep links from a client profile: /email?client=<id> (new email, that client preselected, prompt focused)
  // and /email?draft=<id> (open a draft, or reuse a sent email as a new draft).
  const [focusPrompt, setFocusPrompt] = useState(false);
  const clientParam = params.get("client");
  const draftParam = params.get("draft");
  useEffect(() => {
    if (!clientParam) return;
    load(fresh(BLANK_DOC, { audience: { mode: "clients", client_ids: [clientParam] } }));
    setFocusPrompt(true);
    const n = new URLSearchParams(params); n.delete("client"); n.delete("tab"); setParams(n, { replace: true });
  }, [clientParam]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draftParam || !draftsQ.data) return;
    const d = draftsQ.data.find((x) => x.id === draftParam);
    if (d) load(d.status === "sent" ? fresh(d, { prompt: d.prompt || "" }) : fresh(d, { id: d.id, prompt: d.prompt || "" }));
    const n = new URLSearchParams(params); n.delete("draft"); n.delete("tab"); if (d && d.status === "sent") n.set("tab", "history"); setParams(n, { replace: true });
  }, [draftParam, draftsQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-full">
      <PageHeader breadcrumb="Studio / Email Studio" rightText="Admin only">
        <Btn onClick={() => load(fresh())}><FilePlus2 className="h-3.5 w-3.5" /> New email</Btn>
      </PageHeader>
      <div className="px-5 py-5 md:px-8">
        <div className="mb-4 flex flex-wrap gap-1 border-b border-hair">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${tab === t.key ? "border-[#ff3c00] text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>
              {t.label}
              {t.key === "subscribers" && subsQ.data ? <span className="ml-1.5 text-[11px] text-ink/40">{subsQ.data.filter((s) => s.status !== "unsubscribed").length}</span> : null}
              {t.key === "history" && draftsQ.data ? <span className="ml-1.5 text-[11px] text-ink/40">{draftsQ.data.length}</span> : null}
            </button>
          ))}
        </div>

        {tab === "compose" && <Composer key={composerKey} email={email} setEmail={setEmail} data={data} onSaved={refresh} focusPrompt={focusPrompt} />}
        {tab === "history" && (
          <HistoryTab
            drafts={draftsQ.data || []}
            refresh={refresh}
            onOpen={(d) => load(fresh(d, { id: d.id, prompt: d.prompt || "" }))}
            onDuplicate={(d) => load(fresh(d, { prompt: d.prompt || "" }))}
          />
        )}
        {tab === "templates" && <TemplatesTab templates={templatesQ.data || []} refresh={refresh} onUse={(t) => load(fresh(t, { template_id: t.id }))} />}
        {tab === "subscribers" && <SubscribersTab subscribers={data.subscribers} refresh={refresh} />}
        {tab === "lists" && <ListsTab lists={data.lists} clients={data.clients} subscribers={data.subscribers} refresh={refresh} />}
      </div>
    </div>
  );
}
