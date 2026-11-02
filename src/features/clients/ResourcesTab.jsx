import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Compass, Eye, EyeOff, ListChecks, Loader2, Megaphone, Palette, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useClientRecords } from "@/features/clients/hooks";
import { timeAgo } from "@/lib/useData";
import { cn } from "@/lib/utils";

// Admin side of the portal Resources hub: one place to see and switch on everything this client can
// see under Resources (brand kit, playbook, social plan, their SOPs and guides, and SOP-library SOPs
// shared with them). Every toggle writes the same flag the portal function reads.

function Toggle({ on, busy, onClick, onLabel = "Visible in portal", offLabel = "Hidden from portal", disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11.5px] disabled:opacity-50", on ? "border-green-300 bg-green-50 text-green-800" : "border-hair text-ink/60 hover:border-ink/40")}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}{on ? onLabel : offLabel}
    </button>
  );
}

function Row({ icon: Icon, title, meta, children, href }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-[#ff3c00]" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{href ? <Link to={href} className="hover:text-[#ff3c00]">{title}</Link> : title}</p>
        {meta && <p className="truncate text-[11.5px] text-ink/50">{meta}</p>}
      </div>
      {children}
    </li>
  );
}

function Group({ title, hint, children }) {
  return (
    <section className="rounded-md border border-hair bg-card">
      <header className="border-b border-hair px-4 py-2.5">
        <p className="text-[13.5px] font-semibold tracking-[-0.02em]">{title}</p>
        {hint && <p className="text-[11.5px] text-ink/50">{hint}</p>}
      </header>
      <ul className="divide-y divide-hair">{children}</ul>
    </section>
  );
}

export default function ResourcesTab({ client, go }) {
  const qc = useQueryClient();
  const kits = useClientRecords("BrandKit", client.id, { sort: "-version" });
  const books = useClientRecords("IndustryPlaybook", client.id, { sort: "-version" });
  const socials = useClientRecords("SocialPlan", client.id, { sort: "-version" });
  const files = useClientRecords("ClientFile", client.id, { sort: "-delivered_on" });
  const sops = useQuery({ queryKey: ["TaskTemplate", "resources"], queryFn: async () => (await base44.entities.TaskTemplate.list("sort_order", 300)) || [] });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", link_url: "", category: "guide", description: "" });

  const run = async (key, fn) => {
    setBusy(key);
    setError("");
    try { await fn(); } catch (e) { setError(e?.message || "That didn't save"); } finally { setBusy(""); }
  };

  const docs = [
    ["brand", "Brand kit", Palette, kits, "brand"],
    ["playbook", "2027 Industry Playbook", Compass, books, "playbook"],
    ["social", "Social media plan", Megaphone, socials, "social"],
  ];
  const clientDocs = files.rows.filter((f) => ["sop", "guide"].includes(f.category));
  const library = sops.data || [];

  const toggleShare = (t) => run(`sop-${t.id}`, async () => {
    const ids = new Set(t.portal_client_ids || []);
    if (ids.has(client.id)) ids.delete(client.id); else ids.add(client.id);
    await base44.entities.TaskTemplate.update(t.id, { portal_client_ids: [...ids] });
    qc.invalidateQueries({ queryKey: ["TaskTemplate"] });
  });

  const addDoc = () => run("add", async () => {
    await files.create({ title: draft.title.trim(), link_url: draft.link_url.trim(), category: draft.category, description: draft.description.trim(), delivered_on: new Date().toISOString().slice(0, 10), portal_visible: false });
    setDraft({ title: "", link_url: "", category: "guide", description: "" });
    setAdding(false);
  });

  const shownCount = docs.filter(([, , , rec]) => rec.rows.find((r) => r.status === "approved")?.portal_visible).length
    + clientDocs.filter((f) => f.portal_visible !== false).length
    + library.filter((t) => (t.portal_client_ids || []).includes(client.id)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-cross mb-2">(Portal resources)</p>
          <p className="max-w-2xl text-[13px] text-ink/60">What {client.business} sees under Resources in their portal. Approved documents stay hidden until you switch them on. {shownCount} item{shownCount === 1 ? "" : "s"} visible now.</p>
        </div>
        <Link to={`/portal/${client.id}`} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3 py-1.5 text-[12px] text-ink/70 hover:border-[#ff3c00]"><Eye className="h-3.5 w-3.5" /> Preview their portal</Link>
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}

      <Group title="Brand & plans" hint="Only the newest approved version can be shown.">
        {docs.map(([key, label, Icon, rec, tab]) => {
          const cur = rec.rows.find((r) => r.status === "approved");
          return (
            <Row key={key} icon={Icon} title={label} meta={rec.isLoading ? "Loading…" : cur ? `v${cur.version || 1} · approved ${timeAgo(cur.approved_at || cur.created_date)}` : "Nothing approved yet"}>
              {!cur && go && <button type="button" onClick={() => go(tab)} className="mono-label text-[9px] text-ink/45 hover:text-[#ff3c00]">open tab</button>}
              {cur && <Toggle on={!!cur.portal_visible} busy={busy === key} onClick={() => run(key, () => rec.update(cur.id, { portal_visible: !cur.portal_visible }))} />}
            </Row>
          );
        })}
      </Group>

      <Group title={`${client.business}'s SOPs & guides`} hint="Files with category SOP or Guide on this client (also listed under Files & Brand).">
        {clientDocs.map((f) => (
          <Row key={f.id} icon={f.category === "guide" ? BookOpen : ListChecks} title={f.title} meta={`${f.category === "guide" ? "Guide" : "SOP"}${f.link_url || f.file_url ? ` · ${(f.link_url || f.file_url).replace(/^https?:\/\//, "").slice(0, 60)}` : " · no file or link yet"}`}>
            <Toggle on={f.portal_visible !== false} busy={busy === f.id} onClick={() => run(f.id, () => files.update(f.id, { portal_visible: f.portal_visible === false }))} />
          </Row>
        ))}
        {!clientDocs.length && !adding && <li className="px-4 py-3 text-[12.5px] text-ink/50">No SOPs or guides for this client yet.</li>}
        {adding ? (
          <li className="space-y-2 px-4 py-3">
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title (e.g. How to film a before/after)" className="rounded-sm border border-hair bg-card px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#ff3c00]" />
              <input value={draft.link_url} onChange={(e) => setDraft({ ...draft, link_url: e.target.value })} placeholder="Link (Google Doc, PDF, Loom…)" className="rounded-sm border border-hair bg-card px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#ff3c00]" />
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded-sm border border-hair bg-card px-2 py-1.5 text-[12.5px]">
                <option value="guide">Guide</option>
                <option value="sop">SOP</option>
              </select>
            </div>
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} placeholder="Short description the client sees (optional)" className="w-full rounded-sm border border-hair bg-card px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#ff3c00]" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className="px-2 text-[12px] text-ink/55 hover:text-ink">Cancel</button>
              <button type="button" disabled={!draft.title.trim() || busy === "add"} onClick={addDoc} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-3.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">
                {busy === "add" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add (hidden until you show it)
              </button>
            </div>
          </li>
        ) : (
          <li className="px-4 py-2"><button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-[12px] text-ink/60 hover:text-[#ff3c00]"><Plus className="h-3.5 w-3.5" /> Add an SOP or guide link</button></li>
        )}
      </Group>

      <Group title="Shared from the SOP library" hint="Sharing shows the SOP's name, client intro (or description), phases, step titles and notes. Time estimates are never shown.">
        {sops.isLoading && <li className="px-4 py-3 text-[12.5px] text-ink/50">Loading…</li>}
        {library.map((t) => {
          const on = (t.portal_client_ids || []).includes(client.id);
          return (
            <Row key={t.id} icon={ListChecks} title={`${t.sop_code ? `${t.sop_code} · ` : ""}${t.name}`} meta={`${(t.items || []).length} steps${(t.portal_client_ids || []).length ? ` · shared with ${(t.portal_client_ids || []).length} client${(t.portal_client_ids || []).length === 1 ? "" : "s"}` : ""}`} href={`/tasks/sops?sop=${t.id}`}>
              <Toggle on={on} busy={busy === `sop-${t.id}`} onClick={() => toggleShare(t)} onLabel="Shared with this client" offLabel="Not shared" />
            </Row>
          );
        })}
        {!sops.isLoading && !library.length && <li className="px-4 py-3 text-[12.5px] text-ink/50">The SOP library is empty.</li>}
      </Group>
    </div>
  );
}
