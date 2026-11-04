import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Link2, Loader2, Mic, PenLine, Sparkles, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import DictationBox from "@/features/voice/DictationBox";
import { switchTemplate } from "../templates";
import { Btn, Field, Panel, TextArea, TextInput } from "../ui";
import { draftVariants, extractIdea } from "./ai";
import { PLATFORMS, formatOf } from "./platforms";
import { KEYS, brandAccounts, channels } from "./store";
import { parseTranscript, plainText } from "./transcript";
import IdeaWorkbench from "./IdeaWorkbench";

// 01 CAPTURE: drop one idea (video link, voice note, upload/transcript, or a messy thought). Claude extracts the hook
// bank (3 Triple Hooks), quotes, carousel outline, clip cut list and the one visual, then drafts every platform.

const SOURCES = [
  { key: "thought", label: "Messy thought", icon: PenLine },
  { key: "voice", label: "Voice note", icon: Mic },
  { key: "video_link", label: "Video link", icon: Link2 },
  { key: "upload", label: "Upload video / transcript", icon: Upload },
];

function buildTargets(selection, accounts, brandKey, modeOf) {
  const out = [];
  for (const [platform, formats] of Object.entries(selection)) {
    if (!formats?.length) continue;
    const accs = brandAccounts(accounts, brandKey).filter((a) => a.platform === platform);
    for (const a of accs.length ? accs : [null]) {
      for (const fmt of formats) {
        const f = formatOf(platform, fmt);
        out.push({
          id: `${platform}.${fmt}.${a?.id || "manual"}`, platform, format: fmt, ratio: f.ratio, account_id: a?.id || "",
          account_label: a ? a.display_name || a.handle || a.account_kind || "" : "",
          mode: f.manual ? "manual" : (a && modeOf(a.id)?.mode) || "manual",
        });
      }
    }
  }
  return out;
}

export default function Capture({ eng, me, onReview }) {
  const qc = useQueryClient();
  const { brand } = eng;
  const [source, setSource] = useState("thought");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [transcriptRaw, setTranscriptRaw] = useState("");
  const [step, setStep] = useState("");
  const [openId, setOpenId] = useState(null);
  const [reuseId, setReuseId] = useState(null); // an idea saved from Learn (no extraction yet)
  const enabledDefault = useMemo(() => {
    const has = new Set(brandAccounts(eng.accounts, brand.key).map((a) => a.platform));
    const base = brand.isInterstellar ? ["instagram", "facebook", "linkedin", "youtube"] : ["instagram", "facebook", "gbp"];
    return Object.fromEntries(PLATFORMS.map((p) => [p.key, has.has(p.key) || base.includes(p.key) ? p.default_formats : []]));
  }, [eng.accounts, brand.key, brand.isInterstellar]);
  const [sel, setSel] = useState(null);
  const selection = sel || enabledDefault;
  const toggleFormat = (p, f) => setSel((s) => {
    const cur = (s || selection)[p] || [];
    return { ...(s || selection), [p]: cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f] };
  });
  const segs = useMemo(() => parseTranscript(transcriptRaw), [transcriptRaw]);
  const nTargets = buildTargets(selection, eng.accounts, brand.key, eng.modeOf).length;

  const onFile = async (f) => {
    if (!f) return;
    if (/\.(srt|vtt|txt)$/i.test(f.name) || f.type.startsWith("text/")) { setTranscriptRaw(await f.text()); setFile(null); return; }
    setFile(f);
  };

  const run = async () => {
    const notes = source === "upload" || source === "video_link" ? [text, transcriptRaw && !segs.length ? transcriptRaw : ""].filter(Boolean).join("\n\n") : text;
    if (!notes.trim() && !url.trim() && !segs.length && !file) { toast({ title: "Add something to work from", description: "A thought, a dictated note, a link or a transcript." }); return; }
    if (!nTargets) { toast({ title: "Pick at least one platform" }); return; }
    let idea = null;
    try {
      setStep("Saving the idea…");
      let upload_url = "";
      if (file) { setStep("Uploading the video…"); upload_url = (await base44.integrations.Core.UploadFile({ file })).file_url || ""; }
      let meta = null;
      if (source === "video_link" && url.trim()) { setStep("Reading the link…"); meta = await channels("fetch_source", { url: url.trim() }).catch(() => null); }
      const ideaData = {
        brand_key: brand.key, client_id: brand.isInterstellar ? "" : brand.key, brand_name: brand.name,
        title: (meta?.title || notes.split("\n")[0] || segs[0]?.text || "New idea").slice(0, 120),
        status: "extracting", source_type: segs.length ? "transcript" : source, source_url: url.trim(), source_meta: meta || {},
        source_text: segs.length ? plainText(segs).slice(0, 100000) : notes.slice(0, 100000), transcript_segments: segs.slice(0, 2000),
        upload_url, upload_name: file?.name || "", platforms: Object.keys(selection).filter((k) => selection[k]?.length),
        generation_batch: `idea-${new Date().toISOString().slice(0, 10)}`, created_by_email: me?.email || "",
      };
      idea = reuseId ? await base44.entities.SocialIdea.update(reuseId, ideaData) : await base44.entities.SocialIdea.create(ideaData);
      setStep("Claude is pulling hooks, quotes, the carousel and clips…");
      const extraction = await extractIdea({ brand, idea, knowledge: eng.knowledge });
      const v = extraction.visual || {};
      const th = extraction.triple_hooks?.[0];
      const design = brand.isInterstellar
        ? { template: "quote_hook", spec: { ...switchTemplate({ eyebrow: v.eyebrow, headline: v.headline, accent_word: v.accent_word, subhead: v.subhead, cta: v.cta, theme: "dark", lockup: "interstellar" }, "quote_hook"), body: th ? `${th.lean} ${th.snapback}`.trim() : v.subhead || "" } }
        : { template: "", spec: { eyebrow: v.eyebrow, headline: v.headline, accent_word: v.accent_word, subhead: v.subhead, cta: v.cta } };
      idea = await base44.entities.SocialIdea.update(idea.id, { extraction, design });

      setStep(`Writing ${nTargets} platform drafts in ${brand.name}'s voice…`);
      const targets = buildTargets(selection, eng.accounts, brand.key, eng.modeOf);
      const drafts = await draftVariants({ brand, idea: { ...idea, extraction }, targets, knowledge: eng.knowledge });
      setStep("Saving drafts to the review queue…");
      for (const t of targets) {
        const d = drafts.find((x) => x.id === t.id) || {};
        await base44.entities.SocialVariant.create({
          idea_id: idea.id, brand_key: brand.key, client_id: brand.isInterstellar ? "" : brand.key,
          platform: t.platform, account_id: t.account_id, account_label: t.account_label, format: t.format, ratio: t.ratio, mode: t.mode,
          status: "draft", title: d.title || "", text: d.text || "", hashtags: d.hashtags || [], alt_text: d.alt_text || "", script: d.script || "",
          link: t.platform === "gbp" || t.platform === "pinterest" ? brand.guide?.website || "" : "", needs_image: true,
          hook_check: {}, publish_error: d.warnings?.length ? `Check: ${d.warnings.join(" ")}` : "",
        });
      }
      await base44.entities.SocialIdea.update(idea.id, { status: "drafted" });
      toast({ title: `${targets.length} drafts ready for review`, description: "Nothing posts until you approve it." });
      setText(""); setUrl(""); setFile(null); setTranscriptRaw(""); setReuseId(null);
      setOpenId(idea.id);
    } catch (e) {
      if (idea) await base44.entities.SocialIdea.update(idea.id, { status: "captured" }).catch(() => null);
      toast({ title: "Capture stopped", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setStep("");
      qc.invalidateQueries({ queryKey: KEYS.ideas(brand.key) });
      qc.invalidateQueries({ queryKey: KEYS.variants(brand.key) });
    }
  };

  const open = eng.ideas.find((i) => i.id === openId) || null;
  const pick = (i) => {
    if (i.extraction?.triple_hooks?.length || i.extraction?.hooks?.length) { setOpenId(i.id); return; }
    setSource("thought"); setText(i.source_text || i.title || ""); setReuseId(i.id);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <Panel label="01 · Capture" title={`Drop one idea for ${brand.name}`} bodyClass="space-y-3 p-3.5">
        <div className="grid grid-cols-2 gap-px border border-hair bg-hair sm:grid-cols-4">
          {SOURCES.map((s) => {
            const I = s.icon;
            return (
              <button key={s.key} type="button" onClick={() => setSource(s.key)} className={`flex h-10 items-center justify-center gap-1.5 text-[12px] ${source === s.key ? "bg-ink text-white" : "bg-paper text-ink/60 hover:text-[#ff3c00]"}`}>
                <I className="h-3.5 w-3.5" />{s.label}
              </button>
            );
          })}
        </div>

        {reuseId && <p className="border border-[#ff6a00]/50 bg-[#ff6a00]/10 px-2.5 py-1.5 text-[11.5px]">Drafting a saved idea. <button type="button" className="underline" onClick={() => { setReuseId(null); setText(""); }}>Start fresh instead</button></p>}
        {source === "thought" && <Field label="The idea, messy is fine"><TextArea rows={6} value={text} onChange={setText} placeholder="e.g. Owners think a new website fixes slow lead follow-up. It doesn't: the leak is the hours before anyone calls back…" /></Field>}
        {source === "voice" && <DictationBox label="Say it out loud" value={text} onChange={setText} rows={6} placeholder="Tap the mic and talk it through. Edit the text after." />}
        {source === "video_link" && (
          <>
            <Field label="YouTube or Instagram link"><TextInput value={url} onChange={setUrl} placeholder="https://www.youtube.com/watch?v=…" /></Field>
            <Field label="Transcript (paste for timestamps)" hint={segs.length ? `${segs.length} timed lines` : "optional"}><TextArea rows={4} value={transcriptRaw} onChange={setTranscriptRaw} placeholder={"0:00 intro…\n0:12 the first point…  (YouTube → … → Show transcript → copy)"} /></Field>
            <Field label="Your notes"><TextArea rows={2} value={text} onChange={setText} /></Field>
          </>
        )}
        {source === "upload" && (
          <>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-hair bg-paper px-4 py-6 text-center hover:border-[#ff3c00]">
              <FileText className="h-5 w-5 text-ink/35" />
              <span className="text-[12.5px] text-ink/70">{file ? file.name : segs.length ? `Transcript loaded · ${segs.length} timed lines` : "Choose a video (.mp4/.mov) or a transcript (.srt / .vtt / .txt)"}</span>
              <span className="text-[11px] text-ink/45">Videos are stored with the idea. Timestamps for the clip list come from a transcript file.</span>
              <input type="file" accept="video/*,.srt,.vtt,.txt,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            {!segs.length && <Field label="Transcript or notes" hint="paste if you have it"><TextArea rows={3} value={transcriptRaw} onChange={setTranscriptRaw} /></Field>}
            <Field label="Your notes"><TextArea rows={2} value={text} onChange={setText} /></Field>
          </>
        )}

        <div>
          <p className="mono-label mb-1.5 text-[9px] text-ink/50">Platforms & formats · {nTargets} drafts</p>
          <div className="grid gap-px border border-hair bg-hair sm:grid-cols-2">
            {PLATFORMS.map((p) => {
              const on = (selection[p.key] || []).length > 0;
              const accs = brandAccounts(eng.accounts, brand.key).filter((a) => a.platform === p.key);
              return (
                <div key={p.key} className={`bg-card px-2.5 py-2 ${on ? "" : "opacity-70"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium">{p.label}</span>
                    <span className="font-mono text-[9.5px] text-ink/40">{accs.length ? `${accs.length} acct` : "no account · manual"}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.formats.map((f) => {
                      const act = (selection[p.key] || []).includes(f.key);
                      return <button key={f.key} type="button" onClick={() => toggleFormat(p.key, f.key)} className={`border px-1.5 py-0.5 text-[10.5px] ${act ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair text-ink/55 hover:border-ink/40"}`}>{f.label}</button>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-hair pt-3">
          <Btn variant="flame" onClick={run} disabled={!!step}>{step ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{step ? "Working…" : `Extract & draft ${nTargets}`}</Btn>
          <span className="text-[11.5px] text-ink/50">{step || `Drafts land in the review queue.${brand.isInterstellar ? "" : ` Metered against ${brand.name}'s AI allowance (admin calls aren't capped).`}`}</span>
        </div>
      </Panel>

      <div className="space-y-3">
        {open ? <IdeaWorkbench eng={eng} idea={open} onClose={() => setOpenId(null)} onReview={onReview} /> : (
          <Panel label="Recent ideas" title={eng.ideas.length ? `${eng.ideas.length} captured` : "Nothing captured yet"} bodyClass="divide-y divide-hair">
            {eng.ideas.length === 0 && <p className="px-3.5 py-10 text-center text-[12.5px] text-ink/50">Drop the first idea on the left. Claude pulls the hooks, a carousel, clips and every platform draft from it.</p>}
            {eng.ideas.slice(0, 12).map((i) => {
              const vs = eng.variants.filter((v) => v.idea_id === i.id);
              return (
                <button key={i.id} type="button" onClick={() => pick(i)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-paper">
                  <span className="mono-label border border-hair px-1 py-0.5 text-[8px] text-ink/50">{i.source_type}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">{i.title}</span>
                  <span className="font-mono text-[10px] text-ink/45">{i.extraction ? `${vs.filter((v) => v.status === "draft").length} draft · ${vs.filter((v) => ["approved", "posted"].includes(v.status)).length} ok` : "not drafted"}</span>
                </button>
              );
            })}
          </Panel>
        )}
        {!open && (
          <p className="px-1 text-[11.5px] leading-snug text-ink/45">
            Video links: YouTube shares captions only with the channel owner through its API, so paste the transcript (YouTube → Show transcript) to get a timed clip list. Uploaded videos are stored with the idea; transcribe them elsewhere and drop the .srt here.
          </p>
        )}
      </div>
    </div>
  );
}
