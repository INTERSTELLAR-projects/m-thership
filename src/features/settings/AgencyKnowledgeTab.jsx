// Settings > Agency knowledge: Interstellar's own facts (offers + prices, rules, voice, operations) in
// one place. Generators read short excerpts of it, Claude tasks read the compiled doc from the
// `agency-knowledge` backend function, and "Export for Claude" copies the same doc for the Claude Project.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, Check, ClipboardCopy, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Panel, EmptyState } from "@/components/financial/finance/ui";
import { compileMarkdown, offersOf, readKnowledgeMeta, setCachedSections, sortSections, writeKnowledgeMeta } from "@/features/agency/knowledge";
import { SEED_SECTIONS, SEED_SOURCE, offerLine } from "@/features/agency/seed";
import { PRICE_OF } from "@/features/flight/onboarding/catalog";
import { SERVICE_GROUPS } from "@/features/tasks/StartServiceDialog";
import { BRAND, OFFER_KEY_MAP } from "@/features/social/brand";

const inputCls = "w-full rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#ff3c00]";
const fmtDate = (d) => (d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never");
const money = (n) => `$${Number(n || 0).toLocaleString("en-US")}`;
const parseMoney = (s) => { const m = String(s || "").replace(/,/g, "").match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; };

// Every place in the code that still carries a price, compared with AgencyKnowledge offers.
function priceChecks(sections) {
  const offers = offersOf(sections);
  const byKey = Object.fromEntries(offers.map((o) => [o.key, o]));
  const rows = [];
  const add = (where, key, label, value) => {
    const o = byKey[key];
    if (!o) { rows.push({ where, key, label, value, ak: null, ok: false, note: "No offer with this key in Agency knowledge" }); return; }
    rows.push({ where, key, label, value, ak: Number(o.price), ok: Number(o.price) === Number(value) });
  };
  Object.entries(PRICE_OF).forEach(([k, v]) => add("Flight plan catalog (catalog.js PRICE_OF)", k, k, v));
  SERVICE_GROUPS.forEach((g) => g.items.forEach((i) => { const v = parseMoney(i.price); if (v != null) add("Start-service menu (StartServiceDialog.jsx)", i.key, i.label, v); }));
  Object.entries(BRAND.offers).forEach(([k, o]) => { const v = o.price ?? o.price_from_monthly ?? o.price_monthly; if (v != null) add("Social Studio brand rules (social/brand.js)", OFFER_KEY_MAP[k] || k, o.label, v); });
  return rows;
}

function OffersEditor({ offers, onChange }) {
  const set = (i, k, v) => onChange(offers.map((o, j) => (j === i ? { ...o, [k]: v } : o)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-[12px]">
        <thead className="text-[10px] uppercase tracking-[0.08em] text-ink/45">
          <tr><th className="py-1.5 pr-2">Key</th><th className="pr-2">Name</th><th className="pr-2">Price</th><th className="pr-2">Billing</th><th className="pr-2">Architecture</th><th className="pr-2">Terms</th><th /></tr>
        </thead>
        <tbody className="align-top">
          {offers.map((o, i) => (
            <tr key={i} className="border-t border-hair">
              <td className="py-1.5 pr-2"><input className={`${inputCls} w-[120px] font-mono`} value={o.key || ""} onChange={(e) => set(i, "key", e.target.value.trim())} /></td>
              <td className="pr-2"><input className={`${inputCls} w-[150px]`} value={o.name || ""} onChange={(e) => set(i, "name", e.target.value)} /></td>
              <td className="pr-2"><input className={`${inputCls} w-[84px] tabular-nums`} inputMode="numeric" value={o.price ?? ""} onChange={(e) => set(i, "price", e.target.value === "" ? "" : Number(e.target.value.replace(/[^\d.]/g, "")))} /></td>
              <td className="pr-2"><select className={`${inputCls} w-[100px]`} value={o.billing || "one_time"} onChange={(e) => set(i, "billing", e.target.value)}><option value="one_time">One-time</option><option value="monthly">Monthly</option><option value="included">Included</option></select></td>
              <td className="pr-2"><input className={`${inputCls} w-[110px]`} value={o.architecture || ""} onChange={(e) => set(i, "architecture", e.target.value)} /></td>
              <td className="pr-2"><textarea rows={2} className={`${inputCls} w-[260px]`} value={o.terms || ""} onChange={(e) => set(i, "terms", e.target.value)} /></td>
              <td><button type="button" onClick={() => onChange(offers.filter((_, j) => j !== i))} className="p-1 text-ink/35 hover:text-red-600" aria-label="Remove offer"><X className="h-3.5 w-3.5" /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={() => onChange([...offers, { key: "", name: "", price: "", billing: "one_time", architecture: "", terms: "", includes: [] }])} className="mt-2 inline-flex items-center gap-1 text-[12px] text-[#d83300] hover:underline"><Plus className="h-3 w-3" />Add offer</button>
    </div>
  );
}

function SectionCard({ s, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [armDelete, setArmDelete] = useState(false);
  const [err, setErr] = useState("");
  const isOffers = s.key === "offers";
  const start = () => { setDraft({ title: s.title || "", body: s.body || "", offers: offersOf([s]).map((o) => ({ ...o })) }); setEditing(true); setErr(""); };
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const patch = { title: draft.title.trim() || s.title, body: draft.body };
      if (isOffers) {
        const offers = draft.offers.filter((o) => o.key && o.name).map((o) => ({ ...o, price: o.price === "" ? 0 : Number(o.price) || 0 }));
        // Keep the intro paragraph, rebuild the price list from the table so body and data never disagree.
        const intro = String(draft.body || "").split(/\n\s*-\s/)[0].trim();
        patch.body = [intro, "", ...offers.map(offerLine)].join("\n").trim();
        patch.data = { ...(s.data || {}), offers };
      }
      await onSave(s, patch);
      setEditing(false);
    } catch (e) { setErr(String(e?.message || e)); } finally { setBusy(false); }
  };
  return (
    <li className="rounded-md border border-hair bg-paper">
      <div className="flex flex-wrap items-center gap-2 border-b border-hair px-3 py-2">
        <span className="text-[13.5px] font-semibold">{s.title}</span>
        <span className="font-mono text-[10.5px] text-ink/40">{s.key}</span>
        <span className="ml-auto text-[11px] text-ink/45">Edited {fmtDate(s.updated_at || s.updated_date)}{s.updated_by ? ` · ${s.updated_by}` : ""}</span>
        {!editing && <button type="button" onClick={start} className="inline-flex items-center gap-1 rounded-sm border border-hair px-2 py-1 text-[11.5px] hover:border-[#ff3c00] hover:text-[#ff3c00]"><Pencil className="h-3 w-3" />Edit</button>}
        {!editing && (armDelete
          ? <span className="inline-flex items-center gap-1 text-[11.5px]"><button type="button" onClick={() => onDelete(s)} className="rounded-sm bg-red-600 px-2 py-1 text-white">Delete section</button><button type="button" onClick={() => setArmDelete(false)} className="px-1 text-ink/50">Keep</button></span>
          : <button type="button" onClick={() => setArmDelete(true)} className="p-1 text-ink/30 hover:text-red-600" aria-label={`Delete ${s.title}`}><Trash2 className="h-3.5 w-3.5" /></button>)}
      </div>
      {editing ? (
        <div className="space-y-2 px-3 py-3">
          <input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" />
          {isOffers && <OffersEditor offers={draft.offers} onChange={(offers) => setDraft({ ...draft, offers })} />}
          <textarea rows={isOffers ? 3 : 9} className={`${inputCls} font-mono text-[12px] leading-relaxed`} value={isOffers ? String(draft.body || "").split(/\n\s*-\s/)[0] : draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder={isOffers ? "Intro paragraph (the price list is rebuilt from the table)" : "Markdown"} />
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-1 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-ink/50 hover:text-ink">Cancel</button>
            {err && <span className="text-[12px] text-red-700">{err}</span>}
          </div>
        </div>
      ) : (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap px-3 py-2.5 font-sans text-[12.5px] leading-relaxed text-ink/75">{s.body || "—"}</pre>
      )}
    </li>
  );
}

export default function AgencyKnowledgeTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["AgencyKnowledge", "settings"], queryFn: async () => sortSections((await base44.entities.AgencyKnowledge.list("sort", 200)) || []) });
  const meta = useQuery({ queryKey: ["AgencyKnowledge", "meta"], queryFn: readKnowledgeMeta, staleTime: 15_000 });
  const sections = useMemo(() => q.data || [], [q.data]);
  const checks = useMemo(() => priceChecks(sections), [sections]);
  const mismatches = checks.filter((c) => !c.ok);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(false);
  const [adding, setAdding] = useState(null);

  const refresh = async () => {
    const rows = await qc.fetchQuery({ queryKey: ["AgencyKnowledge", "settings"], queryFn: async () => sortSections((await base44.entities.AgencyKnowledge.list("sort", 200)) || []) });
    setCachedSections(rows);
    qc.invalidateQueries({ queryKey: ["AgencyKnowledge"] });
  };
  const stamp = async () => { const me = await base44.auth.me().catch(() => null); return { updated_at: new Date().toISOString(), updated_by: (me && me.email) || "" }; };
  const saveSection = async (s, patch) => { await base44.entities.AgencyKnowledge.update(s.id, { ...patch, ...(await stamp()) }); await refresh(); setMsg(`Saved "${patch.title || s.title}". Export for Claude again so the Project copy matches.`); };
  const deleteSection = async (s) => { await base44.entities.AgencyKnowledge.delete(s.id); await refresh(); setMsg(`Deleted "${s.title}".`); };
  const missingSeed = SEED_SECTIONS.filter((x) => !sections.some((s) => s.key === x.key));

  const addSeed = async () => {
    setBusy("seed");
    try {
      const st = await stamp();
      for (const x of missingSeed) await base44.entities.AgencyKnowledge.create({ ...x, source: SEED_SOURCE, ...st });
      await refresh(); setMsg(`Added ${missingSeed.length} section${missingSeed.length === 1 ? "" : "s"}.`);
    } catch (e) { setMsg(String(e?.message || e)); } finally { setBusy(""); }
  };
  const addSection = async () => {
    const key = String(adding.key || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!key || !adding.title.trim()) { setMsg("Give the section a key and a title."); return; }
    if (sections.some((s) => s.key === key)) { setMsg(`A section with key "${key}" already exists.`); return; }
    setBusy("add");
    try { await base44.entities.AgencyKnowledge.create({ key, title: adding.title.trim(), body: adding.body || "", sort: (sections.length + 1) * 10 + 100, ...(await stamp()) }); setAdding(null); await refresh(); } catch (e) { setMsg(String(e?.message || e)); } finally { setBusy(""); }
  };
  const exportForClaude = async () => {
    setBusy("export");
    try {
      const md = compileMarkdown(sections);
      await navigator.clipboard.writeText(md);
      await writeKnowledgeMeta({ last_exported_at: new Date().toISOString(), last_exported_by: ((await base44.auth.me().catch(() => null)) || {}).email || "" });
      meta.refetch();
      setMsg(`Copied ${md.length.toLocaleString()} characters. Paste it over claude/interstellar-knowledge-base.md in the Interstellar Claude Project.`);
    } catch (e) { setMsg(`Couldn't copy: ${String(e?.message || e)}. Use "Show the doc" and copy it by hand.`); setPreview(true); } finally { setBusy(""); }
  };

  const m = meta.data?.data || {};
  const lastEdit = sections.reduce((mx, s) => (String(s.updated_at || s.updated_date || "") > mx ? String(s.updated_at || s.updated_date || "") : mx), "");
  const lastSync = [m.last_exported_at, m.last_read_by_claude_at].filter(Boolean).sort().pop() || "";
  const stale = lastEdit && (!lastSync || lastEdit > lastSync);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel title="Agency knowledge" subtitle="Interstellar's own facts, one source. Brand kit, playbook, content plan, social plan, Fix with AI and the outreach agent read short excerpts of these sections.">
        {q.isLoading ? <div className="h-24 animate-pulse rounded-md bg-ink/[0.04]" /> : !sections.length ? (
          <EmptyState icon={BookOpen} title="No agency knowledge yet" body="Add the starting sections (offers and prices, rules, voice, operations) from the Interstellar Claude Project." action={<button type="button" onClick={addSeed} className="rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-3 py-1.5 text-[12px] font-medium text-white">Add starting sections</button>} />
        ) : (
          <ul className="space-y-3">{sections.map((s) => <SectionCard key={s.id} s={s} onSave={saveSection} onDelete={deleteSection} />)}</ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {adding ? (
            <div className="w-full space-y-2 rounded-md border border-hair bg-paper p-3">
              <div className="grid gap-2 sm:grid-cols-[160px_1fr]"><input className={`${inputCls} font-mono`} placeholder="key (e.g. faq)" value={adding.key} onChange={(e) => setAdding({ ...adding, key: e.target.value })} /><input className={inputCls} placeholder="Title" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} /></div>
              <textarea rows={5} className={`${inputCls} font-mono text-[12px]`} placeholder="Markdown" value={adding.body} onChange={(e) => setAdding({ ...adding, body: e.target.value })} />
              <div className="flex gap-2"><button type="button" disabled={busy === "add"} onClick={addSection} className="rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">Add section</button><button type="button" onClick={() => setAdding(null)} className="text-[12px] text-ink/50">Cancel</button></div>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding({ key: "", title: "", body: "" })} className="inline-flex items-center gap-1 rounded-sm border border-hair px-2.5 py-1.5 text-[12px] hover:border-[#ff3c00] hover:text-[#ff3c00]"><Plus className="h-3.5 w-3.5" />New section</button>
          )}
          {sections.length > 0 && missingSeed.length > 0 && <button type="button" disabled={busy === "seed"} onClick={addSeed} className="text-[12px] text-[#d83300] hover:underline">Add {missingSeed.length} missing starting section{missingSeed.length === 1 ? "" : "s"}</button>}
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel title="Sync with Claude" subtitle="The in-app version is the source of truth. Claude tasks read it live from the agency-knowledge function; the Claude Project keeps a copy.">
          <div className="space-y-1.5 text-[12.5px]">
            <p><span className="text-ink/50">Last synced to Claude:</span> <b className="font-semibold">{fmtDate(lastSync)}</b></p>
            <p className="text-[11.5px] text-ink/50">Exported for the Project {fmtDate(m.last_exported_at)} · read live by a Claude task {fmtDate(m.last_read_by_claude_at)}</p>
            {stale && <p className="flex items-start gap-1.5 rounded-sm bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Edited {fmtDate(lastEdit)}, after the last sync. Export again so the Claude Project matches.</p>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={!sections.length || busy === "export"} onClick={exportForClaude} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">{busy === "export" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCopy className="h-3.5 w-3.5" />}Export for Claude</button>
            <button type="button" onClick={() => setPreview((v) => !v)} className="text-[12px] text-ink/55 hover:text-ink">{preview ? "Hide" : "Show"} the doc</button>
          </div>
          {msg && <p className="mt-2 text-[12px] text-ink/65">{msg}</p>}
          {preview && <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-ink/[0.04] p-3 text-[11.5px] text-ink/75">{compileMarkdown(sections)}</pre>}
          <p className="mt-3 rounded-md bg-ink/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-ink/55">Claude tasks: call the backend function <span className="font-mono">agency-knowledge</span> (admin only; GET returns the markdown, POST {"{ format: \"json\" }"} returns sections + offers) or query the AgencyKnowledge entity.</p>
        </Panel>

        <Panel title="Price consistency" subtitle="Every price still written in the code, checked against the Offers section.">
          {!offersOf(sections).length ? <p className="text-[12.5px] text-ink/55">No offers section yet.</p> : mismatches.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[12.5px] text-green-800"><Check className="h-3.5 w-3.5" />All {checks.length} prices in the code match Agency knowledge.</p>
          ) : (
            <>
              <p className="mb-2 flex items-start gap-1.5 text-[12.5px] text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{mismatches.length} mismatch{mismatches.length === 1 ? "" : "es"}. The flight plan and Social Studio already read Agency knowledge first; the start-service menu labels and fallback values still need a code change to match.</p>
              <ul className="divide-y divide-hair text-[12px]">
                {mismatches.map((c, i) => (
                  <li key={i} className="py-1.5"><b className="font-medium">{c.label}</b> <span className="font-mono text-[10.5px] text-ink/40">{c.key}</span><span className="block text-ink/55">{c.where}: {money(c.value)}{c.ak != null ? ` · Agency knowledge: ${money(c.ak)}` : ` · ${c.note}`}</span></li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
