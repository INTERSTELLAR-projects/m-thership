import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Wand2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Btn, Field, Panel, TextArea, TextInput } from "../ui";
import { Toggle } from "../connUi";
import { PLATFORMS } from "./platforms";
import { Fit, NeutralCard, brandStyle } from "./Ratios";
import { KEYS, brandKitPrefill, saveGuide } from "./store";

// 02 VOICE: a Voice Guide per brand (Interstellar and each client): tone, words to use/avoid, examples, and the
// register Claude uses per platform. Stored in SocialBrand; every draft reads it.

const list = (s) => String(s || "").split(/\n|,/).map((x) => x.trim()).filter(Boolean);
const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
const HEX = /^#[0-9a-f]{6}$/i;

export default function VoiceGuide({ eng, me }) {
  const qc = useQueryClient();
  const { brand } = eng;
  const [g, setG] = useState(brand.guide);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  useEffect(() => { setG(brand.guide); setDirty(false); }, [brand.key, brand.guide]);
  const set = (k, v) => { setG((x) => ({ ...x, [k]: v })); setDirty(true); };

  const save = async () => {
    setBusy("save");
    try {
      const { colors, ...rest } = g;
      await saveGuide(brand.key, brand.isInterstellar ? rest : { ...rest, colors, name: brand.name }, me);
      qc.invalidateQueries({ queryKey: KEYS.guides });
      setDirty(false);
      toast({ title: "Voice Guide saved", description: "New drafts use it straight away." });
    } catch (e) { toast({ title: "Couldn't save", description: String(e?.message || e), variant: "destructive" }); } finally { setBusy(""); }
  };
  const prefill = async () => {
    setBusy("prefill");
    try {
      const { patch, found } = await brandKitPrefill(brand.key);
      if (!Object.keys(patch).length) { toast({ title: "Nothing on file to prefill", description: `${found.kit ? "The brand kit has no voice or colors." : "No approved brand kit yet."} Fill it in by hand.` }); return; }
      setG((x) => ({ ...x, ...patch, colors: { ...x.colors, ...(patch.colors || {}) } }));
      setDirty(true);
      toast({ title: "Prefilled from the brand kit", description: "Check it, then save." });
    } finally { setBusy(""); }
  };
  const st = brandStyle({ ...brand, guide: g });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Panel label="02 · Voice guide" title={`${brand.name}${brand.saved ? "" : " · defaults (not saved yet)"}`} right={
        <div className="flex gap-1">
          {!brand.isInterstellar && <Btn variant="ghost" onClick={prefill} disabled={!!busy}>{busy === "prefill" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}Prefill from brand kit</Btn>}
          <Btn variant={dirty ? "flame" : "outline"} onClick={save} disabled={!dirty || !!busy}>{busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save</Btn>
        </div>
      } bodyClass="space-y-3 p-3.5">
        <Field label="Tone · how the brand sounds"><TextArea rows={3} value={g.tone} onChange={(v) => set("tone", v)} placeholder="Plain, confident, a little dry. Talks like the owner on a job site, not a marketer." /></Field>
        <Field label="Audience"><TextInput value={g.audience} onChange={(v) => set("audience", v)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Words to use" hint="comma or new line"><TextArea rows={3} value={(g.words_use || []).join(", ")} onChange={(v) => set("words_use", list(v))} /></Field>
          <Field label="Words to avoid"><TextArea rows={3} value={(g.words_avoid || []).join(", ")} onChange={(v) => set("words_avoid", list(v))} /></Field>
        </div>
        <Field label="Example lines in this voice" hint="one per line · real lines only"><TextArea rows={3} value={(g.examples || []).join("\n")} onChange={(v) => set("examples", lines(v))} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default CTA"><TextInput value={g.cta_default} onChange={(v) => set("cta_default", v)} /></Field>
          <Field label="Website (plain URL, no UTM)"><TextInput value={g.website} onChange={(v) => set("website", v)} /></Field>
          <Field label="Handle line on visuals"><TextInput value={g.handle_line} onChange={(v) => set("handle_line", v)} placeholder="@brand" /></Field>
          <Field label="Hashtag bank"><TextInput value={(g.hashtags || []).join(" ")} onChange={(v) => set("hashtags", v.split(/\s+/).filter(Boolean))} /></Field>
        </div>
        <Field label="Search phrases (social search)" hint="the words customers type"><TextArea rows={2} value={(g.keywords || []).join(", ")} onChange={(v) => set("keywords", list(v))} /></Field>
        <Toggle on={!!g.emoji_ok} onChange={(v) => set("emoji_ok", v)} label="Emoji allowed" sub={brand.isInterstellar ? "Interstellar rule: no emoji strings." : "Off strips emoji from every draft."} disabled={brand.isInterstellar} />

        <details className="border border-hair bg-paper">
          <summary className="cursor-pointer px-2.5 py-2 text-[12.5px] font-medium">Register per platform · 13</summary>
          <div className="space-y-2 px-2.5 pb-2.5">
            {PLATFORMS.map((p) => (
              <Field key={p.key} label={p.label}><TextArea rows={2} value={g.registers?.[p.key] || ""} onChange={(v) => set("registers", { ...(g.registers || {}), [p.key]: v })} /></Field>
            ))}
          </div>
        </details>
      </Panel>

      <div className="space-y-3">
        <Panel label="Brand colors" title={brand.isInterstellar ? "Interstellar flame (fixed)" : "Client palette"} bodyClass="space-y-3 p-3.5">
          {brand.isInterstellar ? (
            <p className="text-[12px] text-ink/60">#ff3c00 → #ff6a00 → #ffaa00, never gold. Templates and frames use it automatically.</p>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {["primary", "secondary", "accent", "ink", "paper"].map((k) => (
                <label key={k} className="block">
                  <span className="mono-label text-[8px] text-ink/45">{k}</span>
                  <div className="mt-1 flex items-center border border-hair bg-paper">
                    <input type="color" value={HEX.test(g.colors?.[k] || "") ? g.colors[k] : "#000000"} onChange={(e) => set("colors", { ...g.colors, [k]: e.target.value })} className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0.5" aria-label={`${k} color`} />
                    <input value={g.colors?.[k] || ""} onChange={(e) => set("colors", { ...g.colors, [k]: e.target.value })} className="w-full min-w-0 bg-transparent px-1 font-mono text-[10px] outline-none" aria-label={`${k} hex`} />
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="h-2" style={{ background: st.gradient }} />
          <div className="mx-auto max-w-[280px]">
            <Fit w={1080} h={1080} className="border border-hair">
              <NeutralCard st={st} visual={{ eyebrow: "Voice preview", headline: (g.examples || [])[0] || `How ${brand.name} sounds on every platform`, accent_word: "", subhead: g.tone ? String(g.tone).slice(0, 90) : "Set the tone on the left.", cta: g.cta_default || "" }} />
            </Fit>
          </div>
        </Panel>
        <p className="px-1 text-[11.5px] leading-snug text-ink/45">Claude adapts the same idea per platform using these registers: casual Instagram, professional LinkedIn, punchy X and Threads, scripted YouTube. Hard rules always apply: no invented results or testimonials, ™ never ®, GBP copy never carries a phone, address or bare URL, and every hook follows the Triple Hook Method.</p>
      </div>
    </div>
  );
}
