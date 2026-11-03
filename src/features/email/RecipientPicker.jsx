import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { AUDIENCE_MODES, recipientIssues } from "./recipients";
import { Pill, Select, TextArea, inputCls } from "./ui";

// Who gets it: one client, several clients, a saved list, all subscribers (or a tag), or typed addresses.
export default function RecipientPicker({ audience, onAudience, clients, subscribers, lists, recipients, doc }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("Active");
  const a = audience || { mode: "clients", client_ids: [] };
  const set = (patch) => onAudience({ ...a, ...patch });
  const selected = new Set(a.client_ids || []);
  const tags = useMemo(() => [...new Set(subscribers.flatMap((s) => s.tags || []))].sort(), [subscribers]);
  const statuses = useMemo(() => ["Active", "Lead", ...new Set(clients.map((c) => c.status).filter((s) => s && s !== "Active" && s !== "Lead"))], [clients]);
  const shown = clients.filter((c) => (!status || c.status === status || selected.has(c.id)) && (!q || `${c.business} ${c.contact || ""} ${(c.emails || []).join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const toggle = (id) => set({ client_ids: selected.has(id) ? [...selected].filter((x) => x !== id) : [...selected, id] });
  const excluded = new Set(a.excluded || []);
  const toggleExcluded = (email) => set({ excluded: excluded.has(email) ? [...excluded].filter((e) => e !== email) : [...excluded, email] });
  const subscribedCount = subscribers.filter((s) => s.status !== "unsubscribed").length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 border border-hair">
        {AUDIENCE_MODES.map((m) => (
          <button key={m.key} type="button" title={m.hint} onClick={() => set({ mode: m.key })} className={`px-2 py-2 text-[12px] font-medium transition-colors ${a.mode === m.key ? "bg-ink text-white" : "bg-card text-ink/60 hover:text-[#ff3c00]"}`}>
            {m.label}
          </button>
        ))}
      </div>

      {a.mode === "clients" && (
        <div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink/35" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" className={`${inputCls} h-9 pl-8`} />
            </div>
            <Select value={status} onChange={setStatus} placeholder="All statuses" options={statuses} className="w-36" />
          </div>
          {selected.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {[...selected].map((id) => { const c = clients.find((x) => x.id === id); return c ? (
                <button key={id} type="button" onClick={() => toggle(id)} className="inline-flex items-center gap-1 border border-[#ff3c00]/50 bg-[#ff3c00]/10 px-1.5 py-0.5 text-[11.5px] text-[#d83300]">{c.business}<X className="h-3 w-3" /></button>
              ) : null; })}
              <button type="button" onClick={() => set({ client_ids: [] })} className="px-1 text-[11px] text-ink/45 hover:text-[#ff3c00]">Clear</button>
            </div>
          )}
          <div className="mt-2 max-h-56 overflow-auto border border-hair">
            {shown.length === 0 && <p className="p-3 text-[12px] text-ink/45">No clients match.</p>}
            {shown.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 border-b border-hair px-2.5 py-1.5 last:border-b-0 hover:bg-paper">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-[#ff3c00]" />
                <span className="min-w-0 flex-1 truncate text-[12.5px]"><span className="font-medium">{c.business}</span>{c.contact ? <span className="text-ink/45"> · {c.contact}</span> : null}</span>
                {!(c.emails || []).length && !(c.portal_emails || []).length && <Pill tone="warn">no email</Pill>}
                <Pill tone="muted">{c.status || "?"}</Pill>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-ink/45">Each client gets their own copy (1:1, no unsubscribe link).</p>
        </div>
      )}

      {a.mode === "list" && (
        <div>
          <Select value={a.list_id} onChange={(v) => set({ list_id: v })} placeholder={lists.length ? "Choose a saved list" : "No saved lists yet (make one under Lists)"} options={lists.map((l) => ({ value: l.id, label: l.name }))} />
          <p className="mt-1.5 text-[11px] text-ink/45">Sent as a mass email: one-click unsubscribe link added, unsubscribed addresses skipped.</p>
        </div>
      )}

      {a.mode === "subscribers" && (
        <div>
          <Select value={a.tag} onChange={(v) => set({ tag: v })} placeholder={`Everyone subscribed (${subscribedCount})`} options={tags.map((t) => ({ value: t, label: `Tag: ${t}` }))} />
          <p className="mt-1.5 text-[11px] text-ink/45">Mass email to Email Subscribers: one-click unsubscribe link added automatically.</p>
        </div>
      )}

      {a.mode === "manual" && (
        <div>
          <TextArea rows={3} value={a.emails_text} onChange={(v) => set({ emails_text: v })} placeholder="name@example.com, other@example.com" />
          <p className="mt-1.5 text-[11px] text-ink/45">Each address gets its own copy. Only {"{{email}}"} and {"{{portal_url}}"} can be filled for typed addresses.</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <p className="mono-label text-[9px] text-ink/50">Recipients · {recipients.filter((r) => r.email && !r.excluded).length}</p>
          {recipients.length > 0 && <p className="text-[11px] text-ink/40">Untick to leave someone out</p>}
        </div>
        <div className="mt-1 max-h-64 overflow-auto border border-hair">
          {recipients.length === 0 && <p className="p-3 text-[12px] text-ink/45">Nobody yet.</p>}
          {recipients.slice(0, 500).map((r) => {
            const issues = recipientIssues(doc, r);
            return (
              <div key={r.key} className={`flex items-center gap-2 border-b border-hair px-2.5 py-1.5 last:border-b-0 ${r.excluded ? "opacity-45" : ""}`}>
                <input type="checkbox" disabled={!r.email} checked={!!r.email && !r.excluded} onChange={() => toggleExcluded(r.email)} className="accent-[#ff3c00]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{r.name || r.email}</p>
                  {r.options && r.options.length > 1 ? (
                    <select value={r.email} onChange={(e) => set({ overrides: { ...(a.overrides || {}), [r.client_id]: e.target.value } })} className="mt-0.5 h-6 max-w-full border border-hair bg-paper px-1 text-[11.5px] outline-none focus:border-[#ff3c00]">
                      {r.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : <p className="truncate text-[11.5px] text-ink/50">{r.email || "no email on file"}</p>}
                </div>
                <Pill tone="muted">{r.source}</Pill>
                {issues.length > 0 ? <span title={issues.join(" · ")}><Pill tone="warn">{issues[0]}</Pill></span> : <Pill tone="plain">ok</Pill>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
