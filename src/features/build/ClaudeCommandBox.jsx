// Claude screen: pick a client, type an instruction, send. Saved as a ClaudeJob (kind command, status queued). The
// job agent that runs these is Build Engine step 3, so for now each one waits in the list below and says so.
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { useList } from "@/lib/useData";
import { sendCommand } from "./engine";

export default function ClaudeCommandBox() {
  const clientsQ = useList("CRMClient", { sort: "business", limit: 300 });
  const clients = useMemo(() => (clientsQ.data || []).filter((c) => c.status !== "Inactive"), [clientsQ.data]);
  const [clientId, setClientId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const client = clients.find((c) => c.id === clientId) || null;
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setNote("");
    try {
      await sendCommand({ client, instruction: text });
      setText("");
      setNote(`Queued${client ? ` for ${client.business}` : ""}. It waits for the job agent (step 3).`);
      qc.invalidateQueries({ queryKey: ["ClaudeJob"] });
    } catch (err) { setNote(err?.message || "Could not queue it."); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={send} className="mb-5 border border-hair bg-paper/90 p-3 md:p-4" data-testid="claude-command-box">
      <p className="label-cross mb-2 text-[10.5px]">(Tell Claude)</p>
      <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Client" className="h-11 border border-hair bg-paper px-2 text-[13px]">
          <option value="">No client (Interstellar)</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.business}{c.status === "Lead" ? " · lead" : ""}</option>)}
        </select>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="e.g. Add a financing page to the website and link it from services" aria-label="Instruction"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(e); }}
          className="min-h-[44px] w-full resize-y border border-hair bg-paper px-3 py-2.5 text-[13.5px] outline-none focus:border-[#ff3c00]" />
        <button type="submit" disabled={busy || !text.trim()} className="inline-flex h-11 items-center justify-center gap-1.5 bg-[#ff3c00] px-4 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send
        </button>
      </div>
      {note ? <p className="mt-2 text-[12px] text-ink/60" role="status">{note}</p> : <p className="mt-2 text-[11.5px] text-ink/45">⌘↵ to send. You only approve taste; logic and best practice are decided for you.</p>}
    </form>
  );
}
