import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox as InboxIcon, Mic } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import InboxCard from "@/features/tasks/components/InboxCard";
import Panel from "@/features/tasks/ui-kit/Panel";
import EmptyState from "@/features/tasks/ui-kit/EmptyState";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { useAssistant } from "@/features/tasks/assistant/AssistantContext";
import { fetchClients, itemsOf, TASKS_CHANGED } from "@/features/tasks/lib/clients";
import { btnGhost } from "@/features/tasks/lib/ui";

const STEPS = [
  'Name the client and the work: "Add a website build for Meridian, forty five hundred dollars, due in three weeks."',
  "Dictate a checklist in one breath and the core splits it into separate tasks.",
  'Ask a question instead: "How many websites do I have to build?" and it answers out loud.',
  "When it is unsure (under 55% confidence), it parks the command here rather than guessing."
];

export default function TaskInbox() {
  const assistant = useAssistant();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [filed, setFiled] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemPage, projectPage, clientRows, filedCount] = await Promise.all([
        base44.entities.InboxItem.filter({ status: "needs_review" }, { sort: "-created_date", limit: 60 }),
        base44.entities.Project.filter({ status: { $ne: "done" } }, { sort: "-updated_date", limit: 150 }),
        fetchClients(),
        base44.entities.InboxItem.count({ status: "filed" })
      ]);
      setItems(itemsOf(itemPage));
      setProjects(itemsOf(projectPage));
      setClients(clientRows);
      setFiled(Number(filedCount) || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    window.addEventListener(TASKS_CHANGED, load);
    return () => window.removeEventListener(TASKS_CHANGED, load);
  }, [load]);

  return (
    <div className="min-h-screen pb-24">
      <PageHeader breadcrumb="Command / Tasks" title="Voice Inbox" rightText={items.length + " waiting"}>
        {assistant ? (
          <RollButton label="Speak a command" icon={Mic} onClick={assistant.startListening} />
        ) : (
          <Link to="/tasks" className={btnGhost}>
            <Mic className="h-3.5 w-3.5 text-[#ff3c00]" />
            Open voice dock
          </Link>
        )}
      </PageHeader>

      <div className="grid gap-6 px-5 py-6 md:px-8 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3.5">
          <p className="label-cross">(Needs placement)</p>
          {loading ? (
            <p className="py-16 text-center text-[12.5px] text-ink/45">Opening the bucket...</p>
          ) : items.length ? (
            items.map((item) => <InboxCard key={item.id} item={item} projects={projects} clients={clients} onDone={load} />)
          ) : (
            <EmptyState icon={InboxIcon} title="The bucket is empty" hint="Speak something loosely and the core parks it here for you to place." />
          )}
        </div>

        <div>
          <Panel kicker="How the core files your voice" title="Speak in structure, get structure back">
            <ol className="space-y-3 text-[12.5px] leading-relaxed text-ink/65">
              {STEPS.map((step, index) => (
                <li key={index}>
                  <span className="mono-label mr-2 text-[10px] text-[#ff3c00]">{String(index + 1).padStart(2, "0")}</span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-5 border-t border-hair pt-4">
              <p className="mono-label text-[9.5px] text-ink/45">Filed to the system</p>
              <p className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-ink">{filed}</p>
              <p className="text-[11px] text-ink/45">commands placed without a second pass</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
