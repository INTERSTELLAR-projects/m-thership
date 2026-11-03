import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Archive, ExternalLink, ImageDown, Loader2, Save, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { loadAgencyKnowledge, offerPriceLabel, offersOf } from "@/features/agency/knowledge";
import { TEMPLATES, switchTemplate } from "@/features/social/templates";
import { E, KEYS, adsPolicy, listChecks, listLearnings } from "../lib/adsApi";
import { generateAdCopy } from "../lib/copyGen";
import { frameToPng, uploadPng } from "../lib/adExport";
import { UTM_FIELDS, buildUrl, isHttps, slug } from "../lib/utm";
import ScaledAd, { AdRender, RATIOS } from "../AdFrame";
import { Btn, Field, Notice, Panel, Pill, Select, TextArea, TextInput, fmtDate } from "../ui";
import PolicyFindings from "./PolicyFindings";

const CTAS = ["LEARN_MORE", "CONTACT_US", "GET_QUOTE", "SIGN_UP", "BOOK_NOW", "SCHEDULE", "GET_OFFER", "MESSAGE_PAGE", "SUBSCRIBE", "APPLY_NOW", "DOWNLOAD", "SHOP_NOW"];
const COPY_FIELDS = ["headline", "primary_text", "description", "cta", "destination_url", "utm", "offer_key", "template", "spec"];
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));

export default function CreativeEditor({ creative, onBack, readOnly = false }) {
  const qc = useQueryClient();
  const [d, setD] = useState(creative);
  const [ratio, setRatio] = useState("4:5");
  const [busy, setBusy] = useState("");
  const [variants, setVariants] = useState(creative.variants || []);
  const [aiReview, setAiReview] = useState(true);
  const [exporting, setExporting] = useState(false);
  const refs = useRef({});
  useEffect(() => { setD(creative); setVariants(creative.variants || []); }, [creative]);

  const kQ = useQuery({ queryKey: ["AgencyKnowledge"], queryFn: () => loadAgencyKnowledge() });
  const offers = offersOf(kQ.data || []);
  const checksQ = useQuery({ queryKey: KEYS.checks, queryFn: listChecks });
  const lQ = useQuery({ queryKey: KEYS.learnings, queryFn: listLearnings });
  const latest = useMemo(() => (checksQ.data || []).find((c) => c.subject_type === "creative" && c.subject_id === creative.id), [checksQ.data, creative.id]);

  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const setSpec = (k, v) => setD((x) => ({ ...x, spec: { ...(x.spec || {}), [k]: v } }));
  const setUtm = (k, v) => setD((x) => ({ ...x, utm: { ...(x.utm || {}), [k]: v } }));
  const finalUrl = buildUrl(d.destination_url, { ...(d.utm || {}), campaign: d.utm?.campaign || slug(d.name), content: d.utm?.content || slug(d.headline || d.name) });
  const dirty = COPY_FIELDS.some((k) => JSON.stringify(d[k] ?? null) !== JSON.stringify(creative[k] ?? null)) || d.name !== creative.name;

  const save = async (extra = {}) => {
    const changedCopy = COPY_FIELDS.some((k) => JSON.stringify(d[k] ?? null) !== JSON.stringify(creative[k] ?? null));
    const patch = {
      name: d.name, headline: d.headline || "", primary_text: d.primary_text || "", description: d.description || "", cta: d.cta || "LEARN_MORE",
      destination_url: d.destination_url || "", utm: d.utm || {}, final_url: finalUrl, offer_key: d.offer_key || "", template: d.template, spec: d.spec || {},
      variants, ...(changedCopy ? { policy_status: "unchecked", status: creative.status === "pushed" ? "pushed" : "draft" } : {}), ...extra,
    };
    await E().AdCreative.update(creative.id, patch);
    qc.invalidateQueries({ queryKey: KEYS.creatives });
    return patch;
  };

  const run = async (label, fn) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast({ title: `${label} failed`, description: e.message, variant: "destructive" }); } finally { setBusy(""); }
  };

  const genVariants = () => run("Generate copy", async () => {
    const v = await generateAdCopy({ creative: { ...d }, count: 3, platform: d.platform || "meta", learnings: (lQ.data || []).filter((l) => l.active !== false) });
    const next = [...v, ...variants].slice(0, 12);
    setVariants(next);
    await E().AdCreative.update(creative.id, { variants: next, ai_generated: true });
    qc.invalidateQueries({ queryKey: KEYS.creatives });
  });

  const useVariant = (v) => setD((x) => ({ ...x, headline: v.headline, primary_text: v.primary_text, description: v.description || x.description, cta: v.cta || x.cta }));

  const check = () => run("Policy check", async () => {
    await save();
    const out = await adsPolicy({ action: "check", subject_type: "creative", subject_id: creative.id, ai: aiReview });
    qc.invalidateQueries({ queryKey: KEYS.checks });
    qc.invalidateQueries({ queryKey: KEYS.creatives });
    const r = out.check?.result;
    toast({ title: r === "fail" ? "Blocked: fix the hard fails" : r === "warn" ? "Passed with warnings" : "Policy check passed" });
  });

  const exportImages = () => run("Export images", async () => {
    if (!d.template) throw new Error("Pick a design first.");
    setExporting(true);
    await nextFrame();
    await nextFrame();
    const urls = {};
    for (const key of Object.keys(RATIOS)) {
      const r = RATIOS[key];
      const png = await frameToPng(refs.current[key], r.w, r.h);
      urls[key] = await uploadPng(png, `${slug(d.name)}-${key.replace(":", "x")}.png`);
    }
    setExporting(false);
    await save({ image_urls: urls });
    setD((x) => ({ ...x, image_urls: urls }));
    toast({ title: "Images exported", description: "1:1, 4:5 and 9:16 PNGs are saved on the creative." });
  }).finally(() => setExporting(false));

  const markReady = () => run("Mark ready", async () => {
    await save({ status: "ready" });
    toast({ title: "Ready for a campaign draft" });
  });

  const archive = () => run("Archive", async () => {
    await E().AdCreative.update(creative.id, { status: "archived" });
    qc.invalidateQueries({ queryKey: KEYS.creatives });
    onBack();
  });

  const canReady = ["pass", "warn"].includes(creative.policy_status) && !dirty && creative.image_urls && Object.keys(creative.image_urls).length > 0;

  return (
    <div className="space-y-3">
      {exporting && createPortal(
        <div aria-hidden="true" style={{ position: "fixed", left: -30000, top: 0, pointerEvents: "none" }}>
          {Object.keys(RATIOS).map((k) => <AdRender key={k} ref={(el) => { refs.current[k] = el; }} template={d.template} spec={d.spec} ratio={k} />)}
        </div>,
        document.body,
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="ghost" onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" />All creatives</Btn>
        <input value={d.name || ""} onChange={(e) => set("name", e.target.value)} disabled={readOnly} className="h-9 min-w-[220px] flex-1 border border-transparent bg-transparent px-1 text-[18px] font-semibold tracking-[-0.02em] outline-none focus:border-hair" />
        <Pill tone={creative.policy_status === "unchecked" ? "info" : creative.policy_status}>policy {creative.policy_status}</Pill>
        <Pill>{creative.status}</Pill>
        {!readOnly && (
          <>
            <Btn onClick={() => run("Save", async () => { await save(); toast({ title: "Saved" }); })} disabled={!!busy || !dirty}><Save className="h-3.5 w-3.5" />Save</Btn>
            <Btn variant="ink" onClick={markReady} disabled={!!busy || !canReady} title={canReady ? "" : "Needs exported images and a passing policy check on the saved copy"}>Mark ready</Btn>
            <Btn variant="ghost" onClick={archive} disabled={!!busy} title="Archive"><Archive className="h-3.5 w-3.5" /></Btn>
          </>
        )}
      </div>
      {dirty && <Notice tone="warn">Unsaved changes. Saving copy changes resets the policy status to unchecked — run the check again before using this creative.</Notice>}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,420px)_1fr]">
        {/* Visual */}
        <div className="space-y-3">
          <Panel label="Design" title={TEMPLATES.find((t) => t.key === d.template)?.label || "No design"} right={
            <div className="flex border border-hair">
              {Object.keys(RATIOS).map((k) => <button key={k} type="button" onClick={() => setRatio(k)} className={`h-7 px-2 text-[11px] ${ratio === k ? "bg-ink text-white" : "text-ink/60"}`}>{k}</button>)}
            </div>
          } bodyClass="p-3">
            {d.template ? <div className={ratio === "9:16" ? "mx-auto max-w-[260px]" : ""}><ScaledAd template={d.template} spec={d.spec} ratio={ratio} /></div> : <p className="py-10 text-center text-[12px] text-ink/45">Pick a template below.</p>}
            <p className="mono-label mt-2 text-[9px] text-ink/45">{RATIOS[ratio].placements} · {RATIOS[ratio].w}×{RATIOS[ratio].h}</p>
            {!readOnly && (
              <div className="mt-3 space-y-2">
                <Select value={d.template || ""} onChange={(v) => setD((x) => ({ ...x, template: v, spec: switchTemplate(x.spec || {}, v) }))} placeholder="Template…" options={TEMPLATES.map((t) => ({ value: t.key, label: t.label }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Image headline"><TextInput value={d.spec?.headline} onChange={(v) => setSpec("headline", v)} /></Field>
                  <Field label="Accent word"><TextInput value={d.spec?.accent_word} onChange={(v) => setSpec("accent_word", v)} /></Field>
                </div>
                <Field label="Image subhead"><TextInput value={d.spec?.subhead} onChange={(v) => setSpec("subhead", v)} /></Field>
                <Field label="Image CTA"><TextInput value={d.spec?.cta} onChange={(v) => setSpec("cta", v)} /></Field>
                {d.social_post_id && <Link to={`/social/${d.social_post_id}`} className="inline-flex items-center gap-1 text-[12px] text-ink/60 hover:text-[#ff3c00]"><ExternalLink className="h-3 w-3" />Source post in Social Studio</Link>}
                <Btn className="w-full" onClick={exportImages} disabled={!!busy || !d.template}>{busy === "Export images" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageDown className="h-3.5 w-3.5" />}Export 1:1, 4:5, 9:16 PNGs</Btn>
              </div>
            )}
            {d.image_urls && Object.keys(d.image_urls).length > 0 && (
              <div className="mt-3 flex gap-2">
                {Object.entries(d.image_urls).map(([k, u]) => <a key={k} href={u} target="_blank" rel="noreferrer" className="mono-label border border-hair px-1.5 py-1 text-[9px] text-ink/60 hover:text-[#ff3c00]">{k} PNG</a>)}
              </div>
            )}
          </Panel>
        </div>

        {/* Copy */}
        <div className="space-y-3">
          <Panel label="Ad copy" title="Meta feed copy" bodyClass="space-y-3 p-3.5">
            <Field label="Offer (prices only from Agency Knowledge)">
              <Select value={d.offer_key || ""} onChange={(v) => set("offer_key", v)} placeholder="No specific offer (no prices)" options={offers.map((o) => ({ value: o.key, label: `${o.name} — ${offerPriceLabel(o)}` }))} />
            </Field>
            <Field label="Headline" hint={`${(d.headline || "").length}/40`}><TextInput value={d.headline} onChange={(v) => set("headline", v)} disabled={readOnly} /></Field>
            <Field label="Primary text" hint={`${(d.primary_text || "").length}/125 before "See more"`}><TextArea value={d.primary_text} onChange={(v) => set("primary_text", v)} rows={4} disabled={readOnly} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Description" hint={`${(d.description || "").length}/30`}><TextInput value={d.description} onChange={(v) => set("description", v)} disabled={readOnly} /></Field>
              <Field label="Call to action"><Select value={d.cta || "LEARN_MORE"} onChange={(v) => set("cta", v)} options={CTAS.map((c) => ({ value: c, label: c.replace(/_/g, " ").toLowerCase() }))} /></Field>
            </div>
            <Field label="Destination URL" hint={d.destination_url && !isHttps(d.destination_url) ? "must be https" : ""}><TextInput value={d.destination_url} onChange={(v) => set("destination_url", v)} placeholder="https://interstellar-strategies.com/…" disabled={readOnly} /></Field>
            <div className="grid gap-2 sm:grid-cols-5">
              {UTM_FIELDS.map((f) => <Field key={f.key} label={f.label}><TextInput value={d.utm?.[f.key]} onChange={(v) => setUtm(f.key, v)} placeholder={f.key === "campaign" ? slug(d.name) : f.key === "content" ? slug(d.headline || d.name) : f.hint} disabled={readOnly} /></Field>)}
            </div>
            {finalUrl && <p className="break-all border border-hair bg-paper px-2.5 py-1.5 font-mono text-[11px] text-ink/65">{finalUrl}</p>}
          </Panel>

          <Panel label="AI" title="Copy variants" right={!readOnly && <Btn onClick={genVariants} disabled={!!busy}>{busy === "Generate copy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Generate 3</Btn>} bodyClass="p-3.5">
            {!variants.length ? (
              <p className="text-[12px] text-ink/50">Variants use Agency Knowledge (offers, prices, voice) and the learnings log. No invented claims, urgency or prices — and each one still has to pass the policy check.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {variants.map((v) => (
                  <div key={v.id} className="border border-hair bg-paper p-2.5">
                    <div className="flex items-center gap-1.5"><Pill tone="info">{v.angle}</Pill><span className="ml-auto text-[10.5px] text-ink/40">{fmtDate(v.generated_at)}</span></div>
                    <p className="mt-1.5 text-[13px] font-semibold">{v.headline}</p>
                    <p className="mt-0.5 whitespace-pre-line text-[12px] text-ink/70">{v.primary_text}</p>
                    {v.why && <p className="mt-1 text-[11px] italic text-ink/45">{v.why}</p>}
                    {!readOnly && <Btn className="mt-2 h-7" onClick={() => useVariant(v)}>Use this</Btn>}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel label="Policy guard" title={latest ? `Last check ${fmtDate(latest.checked_at)} · rules ${latest.rules_version}` : "Not checked yet"} right={!readOnly && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11.5px] text-ink/60"><input type="checkbox" checked={aiReview} onChange={(e) => setAiReview(e.target.checked)} className="accent-[#ff3c00]" />AI second opinion</label>
              <Btn variant="flame" onClick={check} disabled={!!busy}>{busy === "Policy check" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}Run check</Btn>
            </div>
          )} bodyClass="p-3.5">
            {latest ? <PolicyFindings check={latest} /> : <p className="text-[12px] text-ink/50">Hard fails block the creative from any campaign push; warnings need your eyes. The check also loads the landing page.</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
