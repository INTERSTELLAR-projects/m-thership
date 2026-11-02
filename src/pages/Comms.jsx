import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Plus, Search, Settings2, Users, X, Check, MessageCircle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useList, useInvalidate } from "@/lib/useData";
import { LOGO_URL } from "@/lib/nav";
import ChatRoom, { SenderLogo } from "@/components/comms/ChatRoom";
import ThreadList from "@/components/comms/ThreadList";
import Martian from "@/components/comms/Martian";
import { martianPalette, MARTIAN_PALETTES, nameMatchKey } from "@/components/comms/martianColors";

// Comms: every client conversation in one alien inbox.
// 1:1 chats = ConversationMessage rows keyed by client_id (no thread_id) — the original model, unchanged.
// Group chats = ChatThread (client_ids) + ConversationMessage.thread_id. Member lists only appear in the settings menu.

const KING = { key: "admin", name: "Interstellar Strategies", logo: LOGO_URL, palette: MARTIAN_PALETTES.orange, king: true };
const at = (m) => m.created_date || m.timestamp;
const clientSender = (c, fallbackName) => (c ? { key: c.id, name: c.business, logo: c.logo_url || "", palette: martianPalette(c) } : { key: fallbackName || "member", name: fallbackName || "Member", palette: martianPalette({ business: fallbackName }) });

export default function Comms() {
  const { user } = useAuth();
  const clients = useList("CRMClient", { sort: "business", limit: 300 });
  const msgs = useList("ConversationMessage", { sort: "created_date", limit: 3000 });
  const groupsQ = useList("ChatThread", { sort: "-last_message_at", limit: 300 });
  const invalidate = useInvalidate();
  const [sel, setSel] = useState(null);
  const [mobileRoom, setMobileRoom] = useState(false);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState(false);

  // Realtime: refresh when messages or groups change anywhere.
  useEffect(() => {
    const u1 = base44.entities.ConversationMessage.subscribe(() => invalidate("ConversationMessage"));
    const u2 = base44.entities.ChatThread.subscribe(() => invalidate("ChatThread"));
    return () => { u1?.(); u2?.(); };
  }, []);

  const clientMap = useMemo(() => Object.fromEntries((clients.data || []).map((c) => [c.id, c])), [clients.data]);

  const threads = useMemo(() => {
    const direct = {};
    const grouped = {};
    (msgs.data || []).forEach((m) => {
      if (m.thread_id) (grouped[m.thread_id] ||= []).push(m);
      else if (m.client_id) (direct[m.client_id] ||= []).push(m);
    });
    const unread = (list) => list.filter((m) => m.sender_role === "client" && !m.read_at).length;
    const groups = (groupsQ.data || []).filter((g) => !g.archived).map((g) => {
      const list = grouped[g.id] || [];
      const last = list[list.length - 1];
      const members = (g.client_ids || []).map((id) => clientMap[id]).filter(Boolean);
      return {
        key: `g:${g.id}`, kind: "group", group: g, list, title: g.title, preview: last?.content || g.description || "", at: last ? at(last) : g.created_date,
        unread: unread(list), palette: members[0] ? martianPalette(members[0]) : MARTIAN_PALETTES.purpleblue, palette2: members[1] ? martianPalette(members[1]) : MARTIAN_PALETTES.orange,
      };
    });
    const directs = (clients.data || []).filter((c) => c.status !== "Inactive" || direct[c.id]?.length).map((c) => {
      const list = direct[c.id] || [];
      const last = list[list.length - 1];
      return { key: `d:${c.id}`, kind: "direct", client: c, list, title: c.business, preview: last?.content || "", at: last ? at(last) : null, unread: unread(list), palette: martianPalette(c), logo: c.logo_url };
    });
    return [...groups, ...directs].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")) || a.title.localeCompare(b.title));
  }, [msgs.data, groupsQ.data, clients.data, clientMap]);

  const shown = q.trim() ? threads.filter((t) => t.title.toLowerCase().includes(q.trim().toLowerCase())) : threads;
  const active = threads.find((t) => t.key === sel) || threads[0];

  // Mark the open chat read (also catches messages that arrive while it's open).
  const unreadIds = (active?.list || []).filter((m) => m.sender_role === "client" && !m.read_at).map((m) => m.id).join(",");
  useEffect(() => {
    if (!unreadIds) return;
    const now = new Date().toISOString();
    Promise.all(unreadIds.split(",").map((id) => base44.entities.ConversationMessage.update(id, { read_at: now }))).then(() => invalidate("ConversationMessage"));
  }, [unreadIds]);

  const open = (t) => { setSel(t.key); setMobileRoom(true); setSettings(false); };

  const messages = useMemo(() => (active?.list || []).map((m) => ({
    id: m.id, content: m.content, at: at(m), mine: m.sender_role === "admin",
    sender: m.sender_role === "admin" ? KING : clientSender(clientMap[m.sender_client_id || m.client_id], m.sender_name),
  })), [active, clientMap]);

  const send = async (content) => {
    const now = new Date().toISOString();
    const base = { content, sender_role: "admin", senderEmail: user?.email || "admin", messageType: "text", timestamp: now, sender_name: "Interstellar Strategies" };
    if (active.kind === "group") {
      await base44.entities.ConversationMessage.create({ ...base, thread_id: active.group.id, recipientEmail: `group:${active.group.id}`, read_at: now });
      await base44.entities.ChatThread.update(active.group.id, { last_message_at: now, last_message_preview: content.slice(0, 140) });
    } else {
      await base44.entities.ConversationMessage.create({ ...base, client_id: active.client.id, recipientEmail: active.client.emails?.[0] || "" });
    }
    await Promise.all([invalidate("ConversationMessage"), invalidate("ChatThread")]);
  };

  const header = active && (
    <div className="relative flex items-center gap-3 border-b border-hair bg-card px-3 py-2.5 sm:px-4">
      <button onClick={() => setMobileRoom(false)} className="p-1 text-ink/50 lg:hidden" aria-label="Back to chats"><ArrowLeft className="h-4 w-4" /></button>
      <Martian palette={active.palette} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {active.logo && <SenderLogo src={active.logo} name={active.title} />}
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">{active.title}</p>
        </div>
        <p className="truncate text-[11px] text-ink/45">{active.kind === "group" ? (active.group.description || "Group transmission") : `1:1 with ${active.client.contact || active.client.business}`}</p>
      </div>
      {active.kind === "direct" && (
        <Link to={`/clients/${active.client.id}`} className="mono-label hidden items-center gap-1 text-[10px] text-ink/50 hover:text-[#ff3c00] sm:inline-flex">Client page <ArrowUpRight className="h-3 w-3" /></Link>
      )}
      <button onClick={() => setSettings((s) => !s)} className={`rounded-md p-1.5 transition-colors ${settings ? "bg-ink text-white" : "text-ink/50 hover:bg-ink/[0.05] hover:text-ink"}`} aria-label="Chat settings" title="Chat settings">
        <Settings2 className="h-4 w-4" />
      </button>
      {settings && <SettingsMenu thread={active} clients={clients.data || []} onClose={() => setSettings(false)} onArchived={() => { setSettings(false); setSel(null); }} invalidate={invalidate} />}
    </div>
  );

  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Command / Comms" rightText="Martian transmissions" />
      <div className="grid gap-4 px-4 pt-6 md:px-8 lg:grid-cols-[320px_1fr]">
        <aside className={`flex max-h-[72vh] flex-col overflow-hidden rounded-xl border border-hair bg-card ${mobileRoom ? "hidden lg:flex" : ""}`}>
          <div className="flex items-center gap-2 border-b border-hair p-2.5">
            <Martian palette={MARTIAN_PALETTES.orange} king size="sm" title="King Martian" />
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="h-9 w-full rounded-md border border-hair bg-paper pl-8 pr-2 text-[13px] outline-none focus:border-[#ff6a00]" />
            </div>
            <button onClick={() => setCreating((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-md text-white" style={{ background: "linear-gradient(135deg,#ff3c00,#ff6a00 55%,#ffaa00)" }} aria-label="New chat" title="New chat">
              {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          {creating && <NewChat clients={(clients.data || []).filter((c) => c.status !== "Inactive")} onDone={(key) => { setCreating(false); if (key) { setSel(key); setMobileRoom(true); } invalidate("ChatThread"); }} />}
          <div className="flex-1 overflow-y-auto">
            {clients.isLoading ? <p className="px-4 py-10 text-center text-[13px] text-ink/45">Scanning the galaxy…</p> : <ThreadList items={shown} activeKey={active?.key} onOpen={open} empty="No chats match." />}
          </div>
        </aside>

        <div className={mobileRoom ? "" : "hidden lg:block"}>
          {active ? (
            <div className="space-y-2">
              <ChatRoom key={active.key} header={header} messages={messages} me={KING} onSend={send} placeholder={`Message ${active.kind === "group" ? active.title : active.client.contact || active.client.business}…`} />
              {active.kind === "direct" && !active.client.portal_enabled && <p className="px-1 text-[12px] text-ink/50">This client doesn&apos;t have portal access yet, so they won&apos;t see messages until you invite them from their client page.</p>}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-20 text-center"><Martian palette={MARTIAN_PALETTES.orange} king size="xl" /><p className="text-ink/50">No clients yet.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- New chat (group or 1:1) ---------------- */
function NewChat({ clients, onDone }) {
  const [mode, setMode] = useState("group");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const create = async () => {
    if (!title.trim()) return setErr("Give the group a name.");
    if (!picked.length) return setErr("Pick at least one client.");
    setBusy(true); setErr("");
    try {
      const g = await base44.entities.ChatThread.create({ kind: "group", title: title.trim(), description: desc.trim(), client_ids: picked, last_message_at: new Date().toISOString(), archived: false });
      onDone(`g:${g.id}`);
    } catch (e) { setErr(e?.message || "Couldn't create the group."); } finally { setBusy(false); }
  };

  return (
    <div className="max-h-[50vh] overflow-y-auto border-b border-hair bg-paper p-3">
      <div className="mb-3 flex rounded-md border border-hair bg-card p-0.5 text-[12px]">
        {[["group", "Group chat", Users], ["direct", "1:1 chat", MessageCircle]].map(([k, l, I]) => (
          <button key={k} onClick={() => setMode(k)} className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 ${mode === k ? "bg-ink text-white" : "text-ink/60"}`}><I className="h-3.5 w-3.5" />{l}</button>
        ))}
      </div>
      {mode === "group" && (
        <div className="mb-2 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Group name (e.g. Molalla Business Crew)" className="h-9 w-full rounded-md border border-hair bg-card px-2.5 text-[13px] outline-none focus:border-[#ff6a00]" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description (optional, clients see it)" className="h-9 w-full rounded-md border border-hair bg-card px-2.5 text-[13px] outline-none focus:border-[#ff6a00]" />
          <p className="mono-label pt-1 text-[9.5px] text-ink/45">Pick clients</p>
        </div>
      )}
      <ul className="space-y-0.5">
        {clients.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => (mode === "group" ? toggle(c.id) : onDone(`d:${c.id}`))}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${picked.includes(c.id) && mode === "group" ? "bg-[#ff6a00]/10" : "hover:bg-ink/[0.04]"}`}
            >
              <Martian palette={martianPalette(c)} size="xs" />
              <SenderLogo src={c.logo_url} name={c.business} size={14} />
              <span className="flex-1 truncate">{c.business}</span>
              {mode === "group" && picked.includes(c.id) && <Check className="h-3.5 w-3.5 text-[#ff3c00]" />}
            </button>
          </li>
        ))}
      </ul>
      {err && <p className="mt-2 text-[12px] text-[#ff3c00]">{err}</p>}
      {mode === "group" && (
        <button onClick={create} disabled={busy} className="mt-3 h-9 w-full rounded-md text-[13px] font-medium text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg,#ff3c00,#ff6a00 55%,#ffaa00)" }}>
          {busy ? "Launching…" : "Launch group"}
        </button>
      )}
    </div>
  );
}

/* ---------------- Settings menu (admin only; the only place members are listed) ---------------- */
function ColorPicker({ client, invalidate }) {
  const [hex, setHex] = useState(client.martian_color && client.martian_color.startsWith("#") ? client.martian_color : "");
  const save = async (v) => { await base44.entities.CRMClient.update(client.id, { martian_color: v }); invalidate("CRMClient"); };
  const def = nameMatchKey(client.business);
  return (
    <div>
      <p className="mono-label mb-1.5 text-[9.5px] text-ink/45">Martian color{def ? ` · default ${MARTIAN_PALETTES[def].label}` : ""}</p>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(MARTIAN_PALETTES).map(([k, p]) => (
          <button key={k} onClick={() => save(k)} title={p.label} aria-label={p.label}
            className={`h-6 w-6 rounded-full ring-offset-1 ${client.martian_color === k ? "ring-2 ring-ink" : ""}`}
            style={{ background: p.gradient ? `linear-gradient(135deg, ${p.gradient[0]}, ${p.gradient[1]})` : p.body }} />
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <input value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#hex" className="h-8 w-24 rounded border border-hair bg-paper px-2 font-mono text-[12px] outline-none focus:border-[#ff6a00]" />
        <button onClick={() => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.trim()) && save(hex.trim())} className="h-8 rounded border border-hair px-2 text-[12px] hover:border-ink">Set</button>
        {client.martian_color && <button onClick={() => { setHex(""); save(""); }} className="h-8 px-2 text-[12px] text-ink/50 hover:text-[#ff3c00]">Reset</button>}
      </div>
    </div>
  );
}

function SettingsMenu({ thread, clients, onClose, onArchived, invalidate }) {
  const g = thread.group;
  const [title, setTitle] = useState(g?.title || "");
  const [desc, setDesc] = useState(g?.description || "");
  const [members, setMembers] = useState(g?.client_ids || []);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [saved, setSaved] = useState(false);
  const [colorFor, setColorFor] = useState(null);

  const save = async () => {
    await base44.entities.ChatThread.update(g.id, { title: title.trim() || g.title, description: desc.trim(), client_ids: members });
    invalidate("ChatThread"); setSaved(true); setTimeout(() => setSaved(false), 1400);
  };
  const archive = async () => {
    if (!confirmArchive) { setConfirmArchive(true); return; }
    await base44.entities.ChatThread.update(g.id, { archived: true });
    invalidate("ChatThread"); onArchived();
  };
  const colorClient = clients.find((c) => c.id === colorFor);

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div className="absolute right-2 top-full z-40 mt-1 max-h-[70vh] w-[min(320px,calc(100vw-2rem))] space-y-3 overflow-y-auto rounded-lg border border-hair bg-card p-3 shadow-xl">
        {thread.kind === "direct" ? (
          <>
            <ColorPicker client={thread.client} invalidate={invalidate} />
            <Link to={`/clients/${thread.client.id}`} className="inline-flex items-center gap-1 text-[12px] text-[#ff3c00]">Open client page <ArrowUpRight className="h-3 w-3" /></Link>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <p className="mono-label text-[9.5px] text-ink/45">Group</p>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 w-full rounded border border-hair bg-paper px-2 text-[13px] outline-none focus:border-[#ff6a00]" />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" className="h-8 w-full rounded border border-hair bg-paper px-2 text-[13px] outline-none focus:border-[#ff6a00]" />
            </div>
            <div>
              <p className="mono-label mb-1 text-[9.5px] text-ink/45">Members (admin only, never shown to clients)</p>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                {clients.filter((c) => c.status !== "Inactive" || members.includes(c.id)).map((c) => {
                  const on = members.includes(c.id);
                  return (
                    <li key={c.id} className="flex items-center gap-1">
                      <button onClick={() => setMembers((m) => (on ? m.filter((x) => x !== c.id) : [...m, c.id]))} className={`flex flex-1 items-center gap-2 rounded px-1.5 py-1 text-left text-[12.5px] ${on ? "bg-[#ff6a00]/10" : "text-ink/55 hover:bg-ink/[0.04]"}`}>
                        <Martian palette={martianPalette(c)} size="xs" />
                        <span className="flex-1 truncate">{c.business}</span>
                        {on && <Check className="h-3 w-3 text-[#ff3c00]" />}
                      </button>
                      <button onClick={() => setColorFor(colorFor === c.id ? null : c.id)} className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: martianPalette(c).body }} title="Martian color" aria-label={`Change ${c.business} Martian color`} />
                    </li>
                  );
                })}
              </ul>
              {colorClient && <div className="mt-2 rounded border border-hair p-2"><p className="mb-1 text-[12px] font-medium">{colorClient.business}</p><ColorPicker key={colorClient.id} client={colorClient} invalidate={invalidate} /></div>}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-hair pt-3">
              <button onClick={archive} className={`text-[12px] ${confirmArchive ? "font-medium text-[#ff3c00]" : "text-ink/50 hover:text-[#ff3c00]"}`}>{confirmArchive ? "Click again to archive" : "Archive group"}</button>
              <button onClick={save} className="h-8 rounded-md px-3 text-[12.5px] font-medium text-white" style={{ background: "linear-gradient(135deg,#ff3c00,#ff6a00)" }}>{saved ? "Saved" : "Save"}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
