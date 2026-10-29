import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useList, useInvalidate, timeAgo } from "@/lib/useData";
import { MessageThread } from "@/features/clients/tabsGrowth";

// Every client conversation in one inbox. Messages are tied to the client, not an email address.
export default function Comms() {
  const { user } = useAuth();
  const clients = useList("CRMClient", { sort: "business", limit: 300 });
  const msgs = useList("ConversationMessage", { sort: "created_date", limit: 2000 });
  const invalidate = useInvalidate();
  const [sel, setSel] = useState(null);

  const threads = useMemo(() => {
    const by = {};
    (msgs.data || []).forEach((m) => { if (m.client_id) (by[m.client_id] ||= []).push(m); });
    return (clients.data || [])
      .filter((c) => c.status !== "Inactive")
      .map((c) => {
        const list = by[c.id] || [];
        const last = list[list.length - 1];
        return { client: c, list, last, unread: list.filter((m) => m.sender_role === "client" && !m.read_at).length };
      })
      .sort((a, b) => String(b.last?.created_date || "").localeCompare(String(a.last?.created_date || "")) || a.client.business.localeCompare(b.client.business));
  }, [clients.data, msgs.data]);

  const active = threads.find((t) => t.client.id === sel) || threads[0];

  const open = async (t) => {
    setSel(t.client.id);
    const unread = t.list.filter((m) => m.sender_role === "client" && !m.read_at);
    if (unread.length) {
      await Promise.all(unread.map((m) => base44.entities.ConversationMessage.update(m.id, { read_at: new Date().toISOString() })));
      invalidate("ConversationMessage");
    }
  };

  const send = async (content) => {
    const c = active.client;
    await base44.entities.ConversationMessage.create({ client_id: c.id, content, sender_role: "admin", senderEmail: user?.email, recipientEmail: c.emails?.[0], messageType: "text", timestamp: new Date().toISOString() });
    invalidate("ConversationMessage");
  };

  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Command / Comms" rightText="Client conversations" />
      <div className="grid gap-4 px-5 pt-6 md:px-8 lg:grid-cols-[300px_1fr]">
        <aside className="max-h-[70vh] overflow-y-auto rounded-md border border-hair bg-card">
          {threads.map((t) => (
            <button key={t.client.id} onClick={() => open(t)} className={`flex w-full items-start gap-3 border-b border-hair px-4 py-3 text-left transition-colors ${active?.client.id === t.client.id ? "bg-ink text-white" : "hover:bg-ink/[0.04]"}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{t.client.business}</p>
                <p className={`truncate text-[11.5px] ${active?.client.id === t.client.id ? "text-white/60" : "text-ink/50"}`}>{t.last ? t.last.content : "No messages yet"}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`font-mono text-[10px] ${active?.client.id === t.client.id ? "text-white/50" : "text-ink/40"}`}>{t.last ? timeAgo(t.last.created_date) : ""}</span>
                {t.unread > 0 && <span className="bg-[#ff3c00] px-1.5 text-[10px] text-white">{t.unread}</span>}
              </div>
            </button>
          ))}
        </aside>
        {active ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[18px] font-semibold tracking-[-0.03em]">{active.client.business}</p>
              <Link to={`/clients/${active.client.id}`} className="mono-label inline-flex items-center gap-1 text-[10px] text-ink/50 hover:text-[#ff3c00]">Client page <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
            <MessageThread messages={active.list} meRole="admin" onSend={send} placeholder={`Message ${active.client.contact || active.client.business}…`} />
            {!active.client.portal_enabled && <p className="text-[12px] text-ink/50">This client doesn&apos;t have portal access yet, so they won&apos;t see messages until you invite them from their client page.</p>}
          </div>
        ) : <p className="py-16 text-center text-ink/50">No clients yet.</p>}
      </div>
    </div>
  );
}
