import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Pause, Plus, Rocket, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { E, KEYS, adsExecute, adsPolicy, inScope, listAccounts, listAdSets, listAds, listCampaigns, listChecks, listCreatives, listMetrics, loadSettings } from "../lib/adsApi";
import { int, money, monthToDate, ratio, sum, windows } from "../lib/metrics";
import { ApproveDialog, Btn, ConfirmDialog, Empty, Field, Notice, Panel, Pill, Select, TextInput } from "../ui";
import PolicyFindings from "./PolicyFindings";

const GOALS = [
  { value: "traffic", label: "Traffic — landing page views" },
  { value: "leads", label: "Leads — website conversions (pixel LEAD)" },
  { value: "sales", label: "Sales — website purchases (pixel PURCHASE)" },
  { value: "awareness", label: "Awareness — reach" },
];
const SAC = ["CREDIT", "EMPLOYMENT", "HOUSING", "FINANCIAL_PRODUCTS_SERVICES", "ISSUES_ELECTIONS_POLITICS"];

export default function Campaigns({ clientId = "", readOnly = false }) {
  const qc = useQueryClient();
  const cQ = useQuery({ queryKey: KEYS.campaigns, queryFn: listCampaigns });
  const sQ = useQuery({ queryKey: KEYS.adsets, queryFn: listAdSets });
  const aQ = useQuery({ queryKey: KEYS.ads, queryFn: listAds });
  const mQ = useQuery({ queryKey: KEYS.metrics(30), queryFn: () => listMetrics(30) });
  const accQ = useQuery({ queryKey: KEYS.accounts, queryFn: listAccounts });
  const crQ = useQuery({ queryKey: KEYS.creatives, queryFn: listCreatives });
  const chQ = useQuery({ queryKey: KEYS.checks, queryFn: listChecks });
  const setQ = useQuery({ queryKey: KEYS.settings, queryFn: () => loadSettings() });
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState({});
  const [act, setAct] = useState(null); // { kind: push|launch|pause|delete, camp?, obj? }
  const [busy, setBusy] = useState("");

  const scope = inScope(clientId);
  const camps = useMemo(() => (cQ.data || []).filter(scope), [cQ.data, scope]);
  const drafts = camps.filter((c) => c.origin === "in_app");
  const live = camps.filter((c) => c.origin !== "in_app" || c.external_id);
  const metrics = (mQ.data || []).filter(scope);
  const last7 = windows(metrics, 7).cur;
  const stat = (level, ext) => sum(last7.filter((m) => m.level === level && m.external_id === ext));
  const settings = setQ.data || {};
  const mtd = monthToDate(metrics);
  const cap = Number(settings.monthly_budget_cap) || 0;

  const refresh = () => ["campaigns", "checks", "log", "creatives"].forEach((k) => qc.invalidateQueries({ queryKey: KEYS[k] }));

  const runCheck = async (camp) => {
    setBusy(`check-${camp.id}`);
    try {
      const out = await adsPolicy({ action: "check", subject_type: "campaign", subject_id: camp.id, ai: false });
      toast({ title: out.check.result === "fail" ? "Blocked by policy" : out.check.result === "warn" ? "Passed with warnings" : "Policy passed" });
      refresh();
    } catch (e) {
      toast({ title: "Check failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const execute = async () => {
    const { kind, camp, obj } = act;
    setBusy(kind);
    try {
      if (kind === "push") await adsExecute({ action: "push_draft", campaign_id: camp.id });
      if (kind === "launch") await adsExecute({ action: "launch", campaign_id: camp.id });
      if (kind === "pause") await adsExecute({ action: "pause", external_id: obj.external_id, level: obj.level, name: obj.name });
      toast({ title: kind === "push" ? "Created on Meta — PAUSED" : kind === "launch" ? "Campaign is live" : "Paused on Meta" });
      setAct(null);
      refresh();
    } catch (e) {
      toast({ title: "Not done", description: e.message, variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const draftCreatives = (camp) => (crQ.data || []).filter((c) => (camp.draft?.creative_ids || []).includes(c.id));
  const latestCheck = (camp) => (chQ.data || []).find((c) => c.subject_type === "campaign" && c.subject_id === camp.id);

  return (
    <div className="space-y-4">
      <Panel
        label="Drafts"
        title="Built in Møthership"
        right={!readOnly && <Btn variant="flame" onClick={() => setEditing({})}><Plus className="h-3.5 w-3.5" />New draft</Btn>}
        bodyClass="p-3.5"
      >
        <p className="mb-3 text-[12px] text-ink/55">Draft → policy check → <strong>Push to Meta as PAUSED</strong> (approval) → <strong>Launch</strong> (separate approval). Nothing spends until you launch.</p>
        {!drafts.length ? <p className="text-[12.5px] text-ink/45">No drafts yet.</p> : (
          <div className="space-y-2">
            {drafts.map((c) => {
              const chk = latestCheck(c);
              const crs = draftCreatives(c);
              return (
                <div key={c.id} className="border border-hair bg-paper p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={c.status}>{c.status === "pushed_paused" ? "on Meta · paused" : c.status}</Pill>
                    <Pill tone={c.policy_status === "unchecked" ? "info" : c.policy_status}>policy {c.policy_status}</Pill>
                    <span className="text-[13.5px] font-semibold">{c.name}</span>
                    <span className="text-[12px] text-ink/55">· {GOALS.find((g) => g.value === c.draft?.goal)?.label.split(" — ")[0] || "Traffic"} · {money(c.draft?.adset?.daily_budget)}/day · {crs.length} creative{crs.length === 1 ? "" : "s"} · {c.draft?.image_ratio || "4:5"}</span>
                  </div>
                  {chk && <details className="mt-2"><summary className="cursor-pointer text-[12px] text-ink/60">Policy findings</summary><div className="mt-2"><PolicyFindings check={chk} /></div></details>}
                  {!readOnly && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {!c.external_id && <Btn onClick={() => setEditing(c)}>Edit</Btn>}
                      {!c.external_id && <Btn onClick={() => runCheck(c)} disabled={!!busy}>{busy === `check-${c.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}Policy check</Btn>}
                      {!c.external_id && <Btn variant="ink" disabled={!["pass", "warn"].includes(c.policy_status)} title={["pass", "warn"].includes(c.policy_status) ? "" : "Run the policy check first; hard fails block pushing"} onClick={() => setAct({ kind: "push", camp: c })}><UploadCloud className="h-3.5 w-3.5" />Push to Meta (paused)</Btn>}
                      {c.status === "pushed_paused" && <Btn variant="flame" onClick={() => setAct({ kind: "launch", camp: c })}><Rocket className="h-3.5 w-3.5" />Launch…</Btn>}
                      {!c.external_id && <Btn variant="ghost" onClick={() => setAct({ kind: "delete", camp: c })}><Trash2 className="h-3.5 w-3.5" /></Btn>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel label="Mirror" title="Campaigns on the platforms" bodyClass="">
        {cQ.isLoading ? <p className="py-10 text-center text-[13px] text-ink/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p> : !live.length ? (
          <div className="p-3.5"><Empty title="No synced campaigns">Connect Meta Ads and pick an ad account (Connections), or import a Google Ads CSV. Campaigns appear after the first sync.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead><tr className="mono-label border-b border-hair text-left text-[9px] text-ink/45"><th className="px-3.5 py-2 font-normal">Campaign / ad set / ad</th><th className="px-2 font-normal">Status</th><th className="px-2 text-right font-normal">Daily budget</th><th className="px-2 text-right font-normal">7d spend</th><th className="px-2 text-right font-normal">7d conv.</th><th className="px-2 text-right font-normal">7d ROAS</th><th className="px-3.5 text-right font-normal"></th></tr></thead>
              <tbody>
                {live.map((c) => {
                  const st = stat("campaign", c.external_id);
                  const sets = (sQ.data || []).filter((s) => s.external_campaign_id === c.external_id);
                  return [
                    <Row key={c.id} depth={0} name={c.name} platform={c.platform} status={c.effective_status || c.status} budget={c.daily_budget} st={st} expanded={open[c.id]} onToggle={sets.length ? () => setOpen((o) => ({ ...o, [c.id]: !o[c.id] })) : null}
                      onPause={!readOnly && c.platform === "meta" && String(c.effective_status || c.status).toUpperCase() === "ACTIVE" ? () => setAct({ kind: "pause", obj: { external_id: c.external_id, level: "campaign", name: c.name } }) : null} />,
                    ...(open[c.id] ? sets.flatMap((s) => {
                      const ads = (aQ.data || []).filter((a) => a.external_adset_id === s.external_id);
                      return [
                        <Row key={s.id} depth={1} name={s.name} platform="meta" status={s.effective_status || s.status} budget={s.daily_budget} st={stat("adset", s.external_id)}
                          onPause={!readOnly && String(s.effective_status || s.status).toUpperCase() === "ACTIVE" ? () => setAct({ kind: "pause", obj: { external_id: s.external_id, level: "adset", name: s.name } }) : null} />,
                        ...ads.map((a) => <Row key={a.id} depth={2} name={a.name} platform="meta" status={a.effective_status || a.status} st={stat("ad", a.external_id)} thumb={a.thumbnail_url}
                          onPause={!readOnly && String(a.effective_status || a.status).toUpperCase() === "ACTIVE" ? () => setAct({ kind: "pause", obj: { external_id: a.external_id, level: "ad", name: a.name } }) : null} />),
                      ];
                    }) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && <DraftDialog draft={editing} clientId={clientId} accounts={(accQ.data || []).filter((a) => a.platform === "meta" && scope(a))} creatives={(crQ.data || []).filter(scope).filter((c) => ["ready", "approved"].includes(c.status) || (editing.draft?.creative_ids || []).includes(c.id))} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}

      <ApproveDialog
        open={act?.kind === "push"}
        busy={busy === "push"}
        title={`Push "${act?.camp?.name}" to Meta as PAUSED`}
        confirmLabel="Create on Meta (paused)"
        lines={act?.kind === "push" ? [
          `Create campaign "${act.camp.name}" (${GOALS.find((g) => g.value === act.camp.draft?.goal)?.label || "Traffic"}) — status PAUSED.`,
          `Create 1 ad set with a ${money(act.camp.draft?.adset?.daily_budget)}/day budget, ${(act.camp.draft?.adset?.countries || ["US"]).join(", ")}${(act.camp.special_ad_categories || []).length ? "" : `, ages ${act.camp.draft?.adset?.age_min || 18}–${act.camp.draft?.adset?.age_max || 65}`} — PAUSED.`,
          `Upload ${draftCreatives(act.camp).length} image(s) (${act.camp.draft?.image_ratio || "4:5"}) and create ${draftCreatives(act.camp).length} ad(s) — PAUSED.`,
          `Special ad categories: ${(act.camp.special_ad_categories || []).join(", ") || "none"}.`,
          "No money is spent. Launching is a separate approval.",
        ] : []}
        onClose={() => setAct(null)}
        onConfirm={execute}
      />
      <ApproveDialog
        open={act?.kind === "launch"}
        busy={busy === "launch"}
        title={`Launch "${act?.camp?.name}"`}
        confirmLabel="Launch — start spending"
        lines={act?.kind === "launch" ? [
          `Set the campaign, its ad set and ${(act.camp.draft?.pushed?.ads || []).length} ad(s) to ACTIVE on Meta.`,
          `Spend starts at up to ${money(act.camp.draft?.adset?.daily_budget)}/day (≈ ${money((act.camp.draft?.adset?.daily_budget || 0) * 30)}/30 days).`,
          cap ? `Month to date: ${money(mtd)} of the ${money(cap)} cap.` : "No monthly cap is set (Goals tab).",
        ] : []}
        warning={cap && mtd >= cap ? "The monthly cap is reached — the launch will be refused." : !cap ? "Consider setting a monthly cap first: increases and launches are refused once it is reached." : ""}
        onClose={() => setAct(null)}
        onConfirm={execute}
      />
      <ApproveDialog
        open={act?.kind === "pause"}
        busy={busy === "pause"}
        title={`Pause ${act?.obj?.level} "${act?.obj?.name}"`}
        confirmLabel="Pause on Meta"
        lines={["Set it to PAUSED on Meta now. Delivery and spend stop; it can be resumed in Ads Manager."]}
        onClose={() => setAct(null)}
        onConfirm={execute}
      />
      <ConfirmDialog
        open={act?.kind === "delete"}
        title={`Delete draft "${act?.camp?.name}"?`}
        description="Removes the in-app draft only. Creatives stay."
        confirmLabel="Delete"
        onClose={() => setAct(null)}
        onConfirm={async () => { await E().AdCampaign.delete(act.camp.id); setAct(null); refresh(); }}
      />
    </div>
  );
}

function Row({ depth, name, platform, status, budget, st, expanded, onToggle, onPause, thumb }) {
  return (
    <tr className="border-b border-hair/60 hover:bg-paper">
      <td className="max-w-[360px] px-3.5 py-2">
        <div className="flex items-center gap-1.5" style={{ paddingLeft: depth * 18 }}>
          {onToggle ? <button type="button" onClick={onToggle} className="text-ink/50 hover:text-[#ff3c00]">{expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button> : <span className="w-3.5" />}
          {thumb && <img src={thumb} alt="" className="h-6 w-6 object-cover" />}
          {depth === 0 && <Pill tone="info">{platform}</Pill>}
          <span className="truncate">{name}</span>
        </div>
      </td>
      <td className="px-2"><Pill tone={String(status).toUpperCase() === "ACTIVE" ? "active" : "default"}>{String(status || "—").toLowerCase()}</Pill></td>
      <td className="px-2 text-right tabular-nums">{budget ? money(budget) : "—"}</td>
      <td className="px-2 text-right tabular-nums">{money(st.spend)}</td>
      <td className="px-2 text-right tabular-nums">{int(st.conversions)}</td>
      <td className="px-2 text-right tabular-nums">{ratio(st.roas)}</td>
      <td className="px-3.5 text-right">{onPause && <Btn variant="ghost" className="h-7" onClick={onPause}><Pause className="h-3.5 w-3.5" />Pause</Btn>}</td>
    </tr>
  );
}

function DraftDialog({ draft, clientId, accounts, creatives, onClose, onSaved }) {
  const d0 = draft.draft || {};
  const [name, setName] = useState(draft.name || "");
  const [account, setAccount] = useState(draft.account_ref || accounts.find((a) => a.is_primary)?.id || accounts[0]?.id || "");
  const [goal, setGoal] = useState(d0.goal || "traffic");
  const [budget, setBudget] = useState(d0.adset?.daily_budget ?? "");
  const [countries, setCountries] = useState((d0.adset?.countries || ["US"]).join(", "));
  const [ageMin, setAgeMin] = useState(d0.adset?.age_min ?? 25);
  const [ageMax, setAgeMax] = useState(d0.adset?.age_max ?? 65);
  const [ratioKey, setRatio] = useState(d0.image_ratio || "4:5");
  const [sac, setSac] = useState(draft.special_ad_categories || []);
  const [ids, setIds] = useState(d0.creative_ids || []);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const data = {
        name: name.trim() || "Untitled draft", account_ref: account, platform: "meta", origin: "in_app", status: "draft", policy_status: "unchecked",
        special_ad_categories: sac, client_id: clientId,
        draft: { goal, image_ratio: ratioKey, creative_ids: ids, adset: { name: `${name.trim() || "Draft"} — ad set`, daily_budget: Number(budget) || 0, countries: countries.split(/[,\s]+/).map((c) => c.trim().toUpperCase()).filter(Boolean), age_min: Number(ageMin) || 18, age_max: Number(ageMax) || 65 } },
      };
      if (draft.id) await E().AdCampaign.update(draft.id, data); else await E().AdCampaign.create(data);
      onSaved();
    } catch (e) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{draft.id ? "Edit draft" : "New campaign draft"}</DialogTitle></DialogHeader>
        {!accounts.length && <Notice tone="warn">No Meta ad account picked yet. You can save the draft now; pushing needs an account (Connections).</Notice>}
        <Field label="Campaign name"><TextInput value={name} onChange={setName} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ad account"><Select value={account} onChange={setAccount} placeholder="Pick…" options={accounts.map((a) => ({ value: a.id, label: `${a.name || a.account_id} (${a.currency || "USD"})` }))} /></Field>
          <Field label="Goal"><Select value={goal} onChange={setGoal} options={GOALS} /></Field>
          <Field label="Daily budget" hint="account currency"><TextInput type="number" min="1" value={budget} onChange={setBudget} /></Field>
          <Field label="Image for the ad"><Select value={ratioKey} onChange={setRatio} options={[{ value: "4:5", label: "4:5 (feed, recommended)" }, { value: "1:1", label: "1:1" }, { value: "9:16", label: "9:16 (stories-first)" }]} /></Field>
          <Field label="Countries" hint="ISO codes"><TextInput value={countries} onChange={setCountries} /></Field>
          {!sac.length && <div className="grid grid-cols-2 gap-2"><Field label="Age min"><TextInput type="number" value={ageMin} onChange={setAgeMin} /></Field><Field label="Age max"><TextInput type="number" value={ageMax} onChange={setAgeMax} /></Field></div>}
        </div>
        <Field label="Special ad categories" hint="declare if the ad is about credit, jobs, housing…">
          <div className="flex flex-wrap gap-1.5">
            {SAC.map((c) => (
              <button key={c} type="button" onClick={() => setSac((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))} className={`mono-label border px-2 py-1 text-[9px] ${sac.includes(c) ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair text-ink/60"}`}>{c.replace(/_/g, " ")}</button>
            ))}
          </div>
          {sac.length > 0 && <p className="mt-1 text-[11px] text-ink/50">Meta limits age/gender/zip targeting for these categories; age fields are hidden.</p>}
        </Field>
        <Field label="Creatives" hint="only ready / approved creatives">
          {!creatives.length ? <p className="text-[12px] text-ink/50">No ready creatives. Build one in Creatives, export its images, pass the policy check and mark it ready.</p> : (
            <div className="max-h-48 space-y-1 overflow-y-auto border border-hair p-2">
              {creatives.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-[12.5px]">
                  <input type="checkbox" className="accent-[#ff3c00]" checked={ids.includes(c.id)} onChange={(e) => setIds((x) => (e.target.checked ? [...x, c.id] : x.filter((y) => y !== c.id)))} />
                  <span className="truncate">{c.name}</span><Pill tone={c.policy_status}>{c.policy_status}</Pill>
                </label>
              ))}
            </div>
          )}
        </Field>
        <DialogFooter>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="flame" onClick={save} disabled={saving}>Save draft</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
