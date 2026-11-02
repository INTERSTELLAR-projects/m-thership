import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { LOGO_URL } from "@/lib/nav";
import ChatRoom from "@/components/comms/ChatRoom";
import ThreadList from "@/components/comms/ThreadList";
import Martian from "@/components/comms/Martian";
import { martianPalette, MARTIAN_PALETTES } from "@/components/comms/martianColors";

// Client portal chats: their 1:1 with Interstellar and any group chats they're in.
// Everything goes through the `portal` function (chats / chat_messages / chat_send), which checks
// membership server-side and never returns who else is in a group.

const KING_SENDER = { key: "admin", name: "Interstellar Strategies", logo: LOGO_URL, palette: MARTIAN_PALETTES.orange, king: true };
const toSender = (s) => (s ? { key: s.id || s.name, name: s.name || "Member", logo: s.logo_url || "", palette: martianPalette({ id: s.id, business: s.name, martian_color: s.martian_color, accent: s.accent }) } : KING_SENDER);

export default function PortalChats({ call, previewId }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState("direct");
  const [mobileRoom, setMobileRoom] = useState(false);

  const chats = useQuery({ queryKey: ["portal", previewId, "chats"], queryFn: () => call("chats"), refetchInterval: 15000 });
  const room = useQuery({ queryKey: ["portal", previewId, "chat", sel], queryFn: () => call("chat_messages", { thread: sel }), refetchInterval: 6000 });

  const me = useMemo(() => (previewId ? KING_SENDER : toSender(chats.data?.me)), [chats.data, previewId]);

  const items = useMemo(() => (chats.data?.threads || []).map((t) => ({
    key: t.id, kind: t.kind, title: t.title, preview: t.last_preview, at: t.last_at,
    unread: sel === t.id ? 0 : t.unread,
    palette: t.kind === "direct" ? MARTIAN_PALETTES.orange : MARTIAN_PALETTES.purpleblue,
    palette2: MARTIAN_PALETTES.orange,
    king: t.kind === "direct", logo: t.kind === "direct" ? LOGO_URL : "",
  })), [chats.data, sel]);

  const active = items.find((t) => t.key === sel) || items[0];
  const messages = useMemo(() => (room.data?.messages || []).map((m) => ({ id: m.id, content: m.content, at: m.at, mine: m.mine, sender: m.sender_role === "admin" ? KING_SENDER : toSender(m.sender) })), [room.data]);

  const open = (t) => { setSel(t.key); setMobileRoom(true); qc.invalidateQueries({ queryKey: ["portal", previewId, "chats"] }); };
  const send = async (content) => {
    await call("chat_send", { thread: sel, content });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["portal", previewId, "chat", sel] }),
      qc.invalidateQueries({ queryKey: ["portal", previewId, "chats"] }),
    ]);
  };

  const header = active && (
    <div className="flex items-center gap-3 border-b border-hair bg-card px-3 py-2.5 sm:px-4">
      <button onClick={() => setMobileRoom(false)} className="p-1 text-ink/50 lg:hidden" aria-label="Back to chats"><ArrowLeft className="h-4 w-4" /></button>
      <Martian palette={active.palette} king={active.king} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-[14.5px] font-semibold tracking-[-0.02em]">{active.title}</p>
        <p className="truncate text-[11px] text-ink/45">{active.kind === "direct" ? "Your direct line to the King Martian" : (room.data?.thread?.description || "Group transmission")}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="label-cross">(Messages)</p>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className={`max-h-[64vh] overflow-y-auto rounded-xl border border-hair bg-card ${mobileRoom ? "hidden lg:block" : ""}`}>
          {chats.isLoading ? <p className="px-4 py-10 text-center text-[13px] text-ink/45">Scanning the galaxy…</p> : <ThreadList items={items} activeKey={active?.key} onOpen={open} />}
        </aside>
        <div className={mobileRoom ? "" : "hidden lg:block"}>
          <ChatRoom
            key={sel}
            header={header}
            messages={messages}
            me={me}
            onSend={send}
            placeholder={active?.kind === "group" ? `Message ${active.title}…` : "Message the Interstellar team…"}
          />
        </div>
      </div>
    </div>
  );
}
