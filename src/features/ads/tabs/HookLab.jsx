import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, Download, FlaskConical, Plus, RefreshCw, Sparkles, Trash2, Trophy, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { loadAgencyKnowledge, offerPriceLabel, offersOf } from "@/features/agency/knowledge";
import { E, inScope, sinceDay } from "../lib/adsApi";
import {
  MEAT_KINDS, combosCsv, download, generateCtas, generateHooks, generateMeats, hookCode, hookStats, newId, rankHooks, shotList,
} from "../lib/hookGen";
import { Btn, ConfirmDialog, Empty, Field, Notice, Panel, Pill, Select, TextArea, TextInput, copyText } from "../ui";

// Hook Lab: Hormozi's "how to run ads" as a guided workflow.
// Goal -> 50 hooks -> 3 meats -> 3 CTAs -> record (56 clips = 450 ads) -> test -> top 5 -> re-shoot -> beat the control.
// Nothing here spends money or publishes: launching still goes through Campaigns + the approval dialog.

const KEY = ["ads", "hooklabs"];
const listLabs = async () => { const r = await E().AdHookLab.list("-updated_date", 100); return Array.isArray(r) ? r : r?.items || []; };

const STEPS = [
  { n: 1, t: "Goal", d: "One goal, one audience, one offer per lab." },
  { n: 2, t: "50 hooks", d: "The first 5 seconds decide everything. Make 50, keep the best." },
  { n: 3, t: "3 meats", d: "Education, belief-breaking, demonstration." },
  { n: 4, t: "3 CTAs", d: "Three ways to ask for the next step." },
  { n: 5, t: "Record", d: "Hooks + meats + CTAs = every combination. Film once, edit many." },
  { n: 6, t: "Launch test", d: "Upload paused with the codes as ad names. You approve spend." },
  { n: 7, t: "Track", d: "Numbers per hook. The lab ranks them." },
  { n: 8, t: "Top 5", d: "Keep the top 5 hooks. Re-shoot them in new settings." },
  { n: 9, t: "Beat the control", d: "New hooks built to beat the best one. Repeat." },
];

const HOOK_TONE = { draft: "default", keep: "ok", cut: "blocked", testing: "active", winner: "pass", loser: "info", control: "executed" };
const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const money = (v) => (v == null ? "—" : `$${v.toFixed(2)}`);

export default function HookLab({ clientId = "", readOnly = false }) {
  const qc = useQueryClient();
  const labsQ = useQuery({ queryKey: KEY, queryFn: listLabs });
  const kQ = useQuery({ queryKey: ["agency", "knowledge"], queryFn: () => loadAgencyKnowledge() });
  const offers = offersOf(kQ.data || []);
  const labs = useMemo(() => (labsQ.data || []).filter(inScope(clientId)).filter((l) => l.status !== "archived"), [labsQ.data, clientId]);
  const [activeId, setActiveId] = useState("");
  const [lab, setLab] = useState(null);
  const [busy, setBusy] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", goal: "", audience: "", offer_key: "", platform: "meta" });
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    const pick = labs.find((l) => l.id === activeId) || labs[0] || null;
    if (pick && pick.id !== lab?.id) setLab(pick);
    if (!pick) setLab(null);
    if (pick && !activeId) setActiveId(pick.id);
  }, [labs, activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (patch) => {
    const next = { ...lab, ...patch };
    setLab(next);
    try {
      await E().AdHookLab.update(lab.id, patch);
      qc.invalidateQueries({ queryKey: KEY });
    } catch (e) { toast({ title: "Couldn't save", description: e.message, variant: "destructive" }); }
    return next;
  };

  const create = async () => {
    try {
      const code = `HL${(labsQ.data || []).length + 1}`;
      const row = await E().AdHookLab.create({ ...draft, code, client_id: clientId, status: "planning", step: 2, round: 1, hooks: [], meats: [], ctas: [] });
      setCreating(false); setDraft({ name: "", goal: "", audience: "", offer_key: "", platform: "meta" });
      setActiveId(row.id); setLab(row);
      qc.invalidateQueries({ queryKey: KEY });
    } catch (e) { toast({ title: "Couldn't create", description: e.message, variant: "destructive" }); }
  };

  const run = async (label, fn) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast({ title: `${label} failed`, description: e.message, variant: "destructive" }); }
    setBusy("");
  };

  const hooks = lab?.hooks || [];
  const setHook = (id, patch) => save({ hooks: hooks.map((h) => (h.id === id ? { ...h, ...patch } : h)) });
  const kept = hooks.filter((h) => h.status !== "cut");
  const combos = kept.length * (lab?.meats?.length || 0) * (lab?.ctas?.length || 0);
  const ranked = rankHooks(hooks);
  const control = hooks.find((h) => h.id === lab?.control_hook_id);

  const pullNumbers = () => run("Pull numbers", async () => {
    const rows = await E().AdMetricDaily.filter({ level: "ad", date: { $gte: sinceDay(120) } }, "-date", 10000);
    const list = Array.isArray(rows) ? rows : rows?.items || [];
    let matched = 0;
    const next = hooks.map((h, i) => {
      const code = hookCode(lab, i);
      const mine = list.filter((r) => String(r.name || "").includes(code));
      if (!mine.length) return h;
      matched += 1;
      const sum = (k) => mine.reduce((s, r) => s + (Number(r[k]) || 0), 0);
      return { ...h, spend: Math.round(sum("spend") * 100) / 100, impressions: sum("impressions"), clicks: sum("link_clicks") || sum("clicks"), leads: sum("conversions"), status: h.status === "draft" || h.status === "keep" ? "testing" : h.status };
    });
    await save({ hooks: next });
    toast({ title: matched ? `Updated ${matched} hooks from synced ads` : "No synced ads match these codes yet", description: matched ? "3-second views still need to be typed in (Meta doesn't sync them yet)." : `Name your ads with the codes, e.g. ${hookCode(lab, 0)}-M1-C1, then sync.` });
  });

  if (labsQ.isLoading) return <p className="text-sm text-ink/50">Loading…</p>;

  return (
    <div className="grid gap-3 xl:grid-cols-[260px_1fr]">
      <div className="space-y-3">
        <Panel label="Hook Lab" title="Ad tests" right={!readOnly && <Btn onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />New</Btn>} bodyClass="p-2 space-y-1">
          {!labs.length && !creating && <p className="p-2 text-[12px] text-ink/50">No labs yet. Start one per goal.</p>}
          {labs.map((l) => (
            <button key={l.id} type="button" onClick={() => setActiveId(l.id)} className={`block w-full border px-2.5 py-2 text-left ${lab?.id === l.id ? "border-ink bg-ink text-white" : "border-hair bg-paper hover:border-[#ff3c00]"}`}>
              <span className="block truncate text-[12.5px] font-medium">{l.name}</span>
              <span className={`mono-label text-[8.5px] ${lab?.id === l.id ? "text-white/60" : "text-ink/45"}`}>{l.code} · step {l.step || 1} · round {l.round || 1} · {(l.hooks || []).length} hooks</span>
            </button>
          ))}
        </Panel>
        <Panel label="Why this works" title="The math" bodyClass="p-3 text-[12px] leading-relaxed text-ink/65 space-y-1.5">
          <p><b>50 hooks × 3 meats × 3 CTAs = 450 ads</b> from one recording session (56 clips).</p>
          <p>The hook decides who stops scrolling, so it gets the most variations. Keep the top 5, re-shoot them with new backgrounds, then write new hooks to beat the best one (the control).</p>
        </Panel>
      </div>

      <div className="space-y-3">
        {creating && (
          <Panel label="New lab" title="Step 1 · Goal" bodyClass="grid gap-2.5 p-3.5 sm:grid-cols-2">
            <Field label="Name"><TextInput value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="e.g. Roofers · strategy calls · Dec" /></Field>
            <Field label="Platform"><Select value={draft.platform} onChange={(v) => setDraft((d) => ({ ...d, platform: v }))} options={["meta", "tiktok", "youtube", "all"]} /></Field>
            <Field label="Goal" className="sm:col-span-2"><TextArea rows={2} value={draft.goal} onChange={(v) => setDraft((d) => ({ ...d, goal: v }))} placeholder="What should these ads get? e.g. Book 30-minute strategy calls from home-service owners doing $500k+" /></Field>
            <Field label="Audience"><TextInput value={draft.audience} onChange={(v) => setDraft((d) => ({ ...d, audience: v }))} placeholder="e.g. Roofing and HVAC owners in Oregon" /></Field>
            <Field label="Offer"><Select value={draft.offer_key} onChange={(v) => setDraft((d) => ({ ...d, offer_key: v }))} placeholder="No specific offer (no prices)" options={offers.map((o) => ({ value: o.key, label: `${o.name} — ${offerPriceLabel(o)}` }))} /></Field>
            <div className="flex gap-2 sm:col-span-2"><Btn variant="flame" disabled={!draft.name.trim() || !draft.goal.trim()} onClick={create}>Create lab</Btn><Btn onClick={() => setCreating(false)}>Cancel</Btn></div>
          </Panel>
        )}

        {!lab && !creating && <Empty icon={FlaskConical} title="Start your first Hook Lab" action={!readOnly && <Btn variant="flame" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />New lab</Btn>}>Type a goal and the lab writes 50 hooks, 3 meats and 3 CTAs, gives you a shot list, then ranks the hooks once the ads run.</Empty>}

        {lab && (
          <>
            <div className="flex flex-wrap gap-0 border border-hair bg-card">
              {STEPS.map((s) => (
                <button key={s.n} type="button" onClick={() => save({ step: s.n })} title={s.d}
                  className={`flex h-9 items-center gap-1.5 px-3 text-[12px] ${lab.step === s.n ? "bg-ink text-white" : (lab.step || 1) > s.n ? "text-ink/70" : "text-ink/45"} hover:text-[#ff3c00]`}>
                  <span className={`mono-label text-[9px] ${(lab.step || 1) > s.n ? "text-[#ff3c00]" : ""}`}>{(lab.step || 1) > s.n ? "✓" : s.n}</span>{s.t}
                </button>
              ))}
            </div>
            <Notice>{STEPS[(lab.step || 1) - 1]?.d} <span className="text-ink/45">· Goal: {lab.goal}</span></Notice>

            {(lab.step || 1) <= 2 && (
              <Panel label={`Step 2 · ${kept.length} kept of ${hooks.length}`} title="Hooks" right={!readOnly && (
                <div className="flex gap-1.5">
                  <Btn variant="flame" disabled={!!busy} onClick={() => run("Generate hooks", async () => { const n = await generateHooks(lab, { count: Math.max(10, 50 - kept.length), round: lab.round || 1 }); await save({ hooks: [...hooks, ...n] }); })}>
                    <Sparkles className="h-3.5 w-3.5" />{busy === "Generate hooks" ? "Writing…" : hooks.length ? "Fill to 50" : "Write 50 hooks"}
                  </Btn>
                  <Btn onClick={() => save({ hooks: [...hooks, { id: newId("h"), text: "", style: "mine", round: lab.round || 1, status: "draft" }] })}><Plus className="h-3.5 w-3.5" />Add</Btn>
                  <Btn disabled={!kept.length} onClick={() => save({ step: 3 })}>Next →</Btn>
                </div>
              )} bodyClass="max-h-[620px] overflow-y-auto">
                {!hooks.length ? <div className="p-3.5"><Empty icon={Sparkles} title="No hooks yet">Hit "Write 50 hooks". Then cut the weak ones: keep the ones you'd stop scrolling for.</Empty></div> : hooks.map((h, i) => (
                  <div key={h.id} className={`flex items-start gap-2 border-b border-hair px-3 py-1.5 last:border-0 ${h.status === "cut" ? "opacity-40" : ""}`}>
                    <span className="mono-label mt-2 w-14 shrink-0 text-[9px] text-ink/45">{hookCode(lab, i).split("-")[1]}</span>
                    <TextInput className="flex-1 border-transparent bg-transparent" value={h.text} onChange={(v) => setHook(h.id, { text: v })} />
                    <span className="mono-label mt-2 hidden w-20 shrink-0 truncate text-[8.5px] text-ink/40 sm:block">{h.style}</span>
                    <button type="button" title="Keep" onClick={() => setHook(h.id, { status: h.status === "keep" ? "draft" : "keep" })} className={`mt-1.5 p-1 ${h.status === "keep" ? "text-green-700" : "text-ink/30 hover:text-green-700"}`}><Check className="h-4 w-4" /></button>
                    <button type="button" title="Cut" onClick={() => setHook(h.id, { status: h.status === "cut" ? "draft" : "cut" })} className={`mt-1.5 p-1 ${h.status === "cut" ? "text-[#ff3c00]" : "text-ink/30 hover:text-[#ff3c00]"}`}><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </Panel>
            )}

            {lab.step === 3 && (
              <Panel label="Step 3" title="Meat · the body of the ad" right={!readOnly && (
                <div className="flex gap-1.5">
                  <Btn variant="flame" disabled={!!busy} onClick={() => run("Write meats", async () => save({ meats: await generateMeats(lab) }))}><Sparkles className="h-3.5 w-3.5" />{busy ? "Writing…" : lab.meats?.length ? "Rewrite" : "Write 3 meats"}</Btn>
                  <Btn disabled={!lab.meats?.length} onClick={() => save({ step: 4 })}>Next →</Btn>
                </div>
              )} bodyClass="grid gap-3 p-3.5 lg:grid-cols-3">
                {MEAT_KINDS.map((k, i) => {
                  const m = (lab.meats || []).find((x) => x.kind === k.key);
                  return (
                    <div key={k.key} className="space-y-1.5">
                      <p className="mono-label text-[9px] text-[#d83300]">M{i + 1} · {k.label}</p>
                      <p className="text-[11.5px] text-ink/50">{k.hint}</p>
                      <TextArea rows={12} value={m?.script || ""} placeholder="Write it or let the lab draft it." onChange={(v) => {
                        const rest = (lab.meats || []).filter((x) => x.kind !== k.key);
                        const list = [...rest, { ...(m || { id: newId("m"), kind: k.key }), script: v }];
                        save({ meats: MEAT_KINDS.map((mk) => list.find((x) => x.kind === mk.key)).filter(Boolean) });
                      }} />
                    </div>
                  );
                })}
              </Panel>
            )}

            {lab.step === 4 && (
              <Panel label="Step 4" title="Calls to action" right={!readOnly && (
                <div className="flex gap-1.5">
                  <Btn variant="flame" disabled={!!busy} onClick={() => run("Write CTAs", async () => save({ ctas: await generateCtas(lab) }))}><Sparkles className="h-3.5 w-3.5" />{busy ? "Writing…" : lab.ctas?.length ? "Rewrite" : "Write 3 CTAs"}</Btn>
                  <Btn disabled={!lab.ctas?.length} onClick={() => save({ step: 5, status: "recording" })}>Next →</Btn>
                </div>
              )} bodyClass="space-y-2 p-3.5">
                {[0, 1, 2].map((i) => {
                  const c = (lab.ctas || [])[i];
                  return (
                    <Field key={i} label={`C${i + 1}`}>
                      <TextArea rows={2} value={c?.text || ""} onChange={(v) => { const list = [...(lab.ctas || [])]; list[i] = { ...(c || { id: newId("c") }), text: v }; save({ ctas: list.filter(Boolean) }); }} />
                    </Field>
                  );
                })}
              </Panel>
            )}

            {lab.step === 5 && (
              <Panel label="Step 5" title={`Record · ${kept.length} hooks × ${lab.meats?.length || 0} meats × ${lab.ctas?.length || 0} CTAs = ${combos} ads`} bodyClass="space-y-3 p-3.5">
                <ol className="list-decimal space-y-1 pl-5 text-[12.5px] text-ink/75">
                  <li>Film every hook 2-3 times (same outfit, same spot). Energy up, eyes on the lens.</li>
                  <li>Film the 3 meats and 3 CTAs once each. Demo meat = screen recording or phone mockup.</li>
                  <li>Edit: stitch every hook to every meat and CTA. Name each file with its code (e.g. <code>{hookCode(lab, 0)}-M1-C1</code>).</li>
                  <li>Captions on. Export 9:16 (and 4:5 for feed).</li>
                </ol>
                <div className="flex flex-wrap gap-1.5">
                  <Btn onClick={() => download(`${lab.code}-shot-list.txt`, shotList(lab))}><Download className="h-3.5 w-3.5" />Shot list</Btn>
                  <Btn onClick={() => download(`${lab.code}-all-${combos}-ads.csv`, combosCsv(lab), "text/csv")}><Download className="h-3.5 w-3.5" />All {combos} scripts (CSV)</Btn>
                  <Btn onClick={async () => { if (await copyText(shotList(lab))) toast({ title: "Shot list copied" }); }}>Copy shot list</Btn>
                  <Btn variant="flame" onClick={() => save({ step: 6 })}>Recorded → Next</Btn>
                </div>
                <Notice tone="warn">Motion and SFX prompts for the demo meat (product UI, phone mockups) are in the motion prompt library.</Notice>
              </Panel>
            )}

            {lab.step === 6 && (
              <Panel label="Step 6" title="Launch the test" bodyClass="space-y-2 p-3.5 text-[12.5px] text-ink/75">
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Upload the edited videos as creatives (Creatives tab) and keep the code as the ad name.</li>
                  <li>Build the test campaign in Campaigns. It is created <b>paused</b>; nothing spends until you approve it there.</li>
                  <li>Spread budget evenly across hooks first. Judge hooks on hook rate (3-second views ÷ impressions) and cost per lead.</li>
                  <li>Let each ad get enough impressions to judge before cutting anything.</li>
                </ol>
                <div className="flex gap-1.5"><Btn variant="flame" onClick={() => save({ step: 7, status: "testing" })}>Ads are running → Track</Btn></div>
              </Panel>
            )}

            {lab.step === 7 && (
              <Panel label="Step 7" title="Track results per hook" right={<div className="flex gap-1.5"><Btn disabled={!!busy} onClick={pullNumbers}><RefreshCw className="h-3.5 w-3.5" />{busy === "Pull numbers" ? "Pulling…" : "Pull from synced ads"}</Btn><Btn variant="flame" onClick={() => save({ step: 8 })}>Next →</Btn></div>} bodyClass="overflow-x-auto">
                <table className="w-full min-w-[760px] text-[12px]">
                  <thead><tr className="mono-label text-left text-[8.5px] text-ink/45">{["Code", "Hook", "Spend", "Impr.", "3s views", "Clicks", "Leads", "Hook rate", "CTR", "CPL"].map((h) => <th key={h} className="border-b border-hair px-2 py-2">{h}</th>)}</tr></thead>
                  <tbody>
                    {hooks.map((h, i) => ({ h, i })).filter(({ h }) => h.status !== "cut").map(({ h, i }) => {
                      const s = hookStats(h);
                      const num = (k) => <input type="number" min="0" value={h[k] ?? ""} onChange={(e) => setHook(h.id, { [k]: e.target.value === "" ? null : Number(e.target.value) })} className="w-20 border border-hair bg-paper px-1.5 py-1 text-[12px]" />;
                      return (
                        <tr key={h.id} className="border-b border-hair">
                          <td className="mono-label px-2 text-[9px] text-ink/45">{hookCode(lab, i)}</td>
                          <td className="max-w-[260px] truncate px-2" title={h.text}>{h.text}</td>
                          <td className="px-1">{num("spend")}</td><td className="px-1">{num("impressions")}</td><td className="px-1">{num("views3s")}</td>
                          <td className="px-1">{num("clicks")}</td><td className="px-1">{num("leads")}</td>
                          <td className="px-2">{pct(s.hookRate)}</td><td className="px-2">{pct(s.ctr)}</td><td className="px-2">{money(s.cpl)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            )}

            {lab.step === 8 && (
              <Panel label="Step 8" title="Top 5 hooks" right={<Btn variant="flame" disabled={!ranked.length} onClick={() => {
                const top = ranked.slice(0, 5).map((h) => h.id);
                save({ step: 9, status: "iterating", control_hook_id: lab.control_hook_id || top[0], hooks: hooks.map((h) => (top.includes(h.id) ? { ...h, status: h.id === (lab.control_hook_id || top[0]) ? "control" : "winner" } : h.status === "testing" ? { ...h, status: "loser" } : h)) });
              }}><Trophy className="h-3.5 w-3.5" />Lock winners → Next</Btn>} bodyClass="space-y-2 p-3.5">
                {!ranked.length ? <Empty icon={Trophy} title="No numbers yet">Enter or pull results in step 7 first.</Empty> : ranked.slice(0, 10).map((h, r) => {
                  const s = hookStats(h);
                  return (
                    <div key={h.id} className={`flex flex-wrap items-center gap-2 border p-2.5 ${r < 5 ? "border-[#ff3c00]/40 bg-[#ff3c00]/[0.04]" : "border-hair bg-paper opacity-70"}`}>
                      <span className="mono-label w-6 text-[11px] text-[#d83300]">#{r + 1}</span>
                      <span className="min-w-0 flex-1 text-[12.5px] font-medium">{h.text}</span>
                      <span className="text-[11px] text-ink/55">hook {pct(s.hookRate)} · CTR {pct(s.ctr)} · CPL {money(s.cpl)}</span>
                      <button type="button" onClick={() => save({ control_hook_id: h.id })} className={`flex items-center gap-1 text-[11px] ${lab.control_hook_id === h.id ? "text-[#d83300]" : "text-ink/45 hover:text-[#ff3c00]"}`}><Crown className="h-3.5 w-3.5" />{lab.control_hook_id === h.id ? "Control" : "Make control"}</button>
                    </div>
                  );
                })}
                <Notice>Re-shoot the top 5: same words, different backgrounds, settings or outfits. Each new take becomes a fresh ad with the same code plus a letter (e.g. {hookCode(lab, 0)}b).</Notice>
              </Panel>
            )}

            {lab.step === 9 && (
              <Panel label={`Step 9 · round ${lab.round || 1}`} title="Beat the control" right={!readOnly && (
                <Btn variant="flame" disabled={!!busy || !control} onClick={() => run("New round", async () => {
                  const round = (lab.round || 1) + 1;
                  const n = await generateHooks(lab, {
                    count: 20, round,
                    beat: { control: control.text, winners: hooks.filter((h) => h.status === "winner").map((h) => h.text), losers: hooks.filter((h) => h.status === "loser").slice(0, 15).map((h) => h.text) },
                  });
                  await save({ hooks: [...hooks, ...n], round, step: 2 });
                  toast({ title: `Round ${round}: 20 new challenger hooks`, description: "Cut the weak ones, then record and test them against the control." });
                })}><Sparkles className="h-3.5 w-3.5" />{busy ? "Writing…" : "Write 20 challengers"}</Btn>
              )} bodyClass="space-y-2 p-3.5">
                {control ? (
                  <div className="border border-ink bg-ink p-3 text-white"><p className="mono-label text-[8.5px] text-white/50">Control</p><p className="mt-1 text-[14px] font-medium">{control.text}</p></div>
                ) : <Notice tone="warn">Pick a control in step 8 first.</Notice>}
                <p className="text-[12.5px] text-ink/65">New hooks are written to keep what makes the control work and push harder. Test them with the control's meat and CTA; a challenger that beats the control's cost per lead becomes the new control.</p>
                {hooks.filter((h) => h.status === "winner").map((h) => <div key={h.id} className="flex items-center gap-2 border border-hair bg-paper p-2 text-[12.5px]"><Pill tone="pass">winner</Pill>{h.text}</div>)}
              </Panel>
            )}

            {!readOnly && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setArchiveOpen(true)} className="flex items-center gap-1 text-[11px] text-ink/40 hover:text-[#ff3c00]"><Trash2 className="h-3.5 w-3.5" />Archive this lab</button>
              </div>
            )}
            <ConfirmDialog open={archiveOpen} title="Archive this lab?" description="It disappears from the list. Nothing is deleted." confirmLabel="Archive"
              onClose={() => setArchiveOpen(false)} onConfirm={async () => { setArchiveOpen(false); await save({ status: "archived" }); setActiveId(""); }} />
          </>
        )}
      </div>
    </div>
  );
}
