import Martian from "./Martian";
import { SenderLogo } from "./ChatRoom";
import { timeAgo } from "@/lib/useData";

// Sidebar list of chats. items: [{ key, title, preview, at, unread, palette, king, logo, kind }]
// Shows an unread dot + count; never member counts.
export default function ThreadList({ items, activeKey, onOpen, empty = "No chats yet." }) {
  if (!items.length) return <p className="px-4 py-10 text-center text-[13px] text-ink/45">{empty}</p>;
  return (
    <ul>
      {items.map((t) => {
        const on = t.key === activeKey;
        return (
          <li key={t.key}>
            <button
              onClick={() => onOpen(t)}
              className={`flex w-full items-center gap-3 border-b border-hair px-3 py-2.5 text-left transition-colors ${on ? "bg-[#ff6a00]/[0.09]" : "hover:bg-ink/[0.035]"}`}
            >
              <div className="relative">
                {t.kind === "group" ? (
                  <div className="relative h-[44px] w-[40px]">
                    <div className="absolute left-0 top-0"><Martian palette={t.palette} size={26} /></div>
                    <div className="absolute bottom-0 right-0"><Martian palette={t.palette2 || t.palette} size={26} /></div>
                  </div>
                ) : (
                  <Martian palette={t.palette} king={t.king} size="md" />
                )}
                {t.unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#ff3c00] ring-2 ring-card" aria-label="Unread" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {t.logo && <SenderLogo src={t.logo} name={t.title} size={14} />}
                  <p className={`truncate text-[13.5px] ${t.unread ? "font-semibold" : "font-medium"}`}>{t.title}</p>
                  {t.kind === "group" && <span className="mono-label shrink-0 rounded-sm bg-ink/[0.06] px-1 text-[8.5px] text-ink/50">Group</span>}
                </div>
                <p className={`truncate text-[11.5px] ${t.unread ? "text-ink/80" : "text-ink/50"}`}>{t.preview || "No messages yet"}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-[10px] text-ink/40">{t.at ? timeAgo(t.at) : ""}</span>
                {t.unread > 0 && <span className="min-w-[18px] rounded-full bg-[#ff3c00] px-1.5 text-center text-[10px] font-medium leading-[18px] text-white">{t.unread > 99 ? "99+" : t.unread}</span>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
