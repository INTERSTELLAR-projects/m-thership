// Shared email editor for campaigns and automation steps: subject, AI first draft, typed blocks, live preview.
// Blocks render with the SAME renderer the send uses (clientEmail.js = base44/shared/clientEmail.ts).
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Heading, Image as ImageIcon, Minus, MousePointerClick, Plus, Quote, Columns3, Sparkles, Trash2, Type, Megaphone, Monitor, Smartphone, Wand2 } from "lucide-react";
import { renderClientEmail, defaultClientBlock, CLIENT_BLOCKS } from "./clientEmail";
import { personalize } from "./merge";
import { Btn, Label, inputCls, Segmented } from "./ui";
import { errMsg } from "./api";

const ICON = { heading: Heading, text: Type, button: MousePointerClick, image: ImageIcon, callout: Megaphone, columns: Columns3, quote: Quote, divider: Minus };
const MERGE = [["{{first_name}}", "First name"], ["{{name}}", "Full name"], ["{{business}}", "Your business"], ["{{review_link}}", "Review link"]];

export function EmailPreview({ subject, blocks, theme, height = 640 }) {
  const [device, setDevice] = useState("desktop");
  const html = useMemo(() => {
    const raw = renderClientEmail({ subject, blocks }, theme);
    return personalize(raw, { first_name: "Sam", name: "Sam Rivera", business: theme?.business || "", review_link: "#", unsubscribe_url: "#" }, true);
  }, [subject, blocks, theme]);
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold text-ink/55">Preview <span className="font-normal text-ink/40">· as Sam would see it</span></p>
        <Segmented size="sm" value={device} onChange={setDevice} options={[["desktop", <Monitor key="d" className="h-3.5 w-3.5" />], ["phone", <Smartphone key="p" className="h-3.5 w-3.5" />]]} />
      </div>
      <div className="overflow-hidden rounded-xl border border-hair bg-[#e9e7e3]">
        <div className="border-b border-hair bg-white px-4 py-2.5">
          <p className="truncate text-[13px] font-semibold">{personalize(subject || "(no subject)", { first_name: "Sam", business: theme?.business }, false)}</p>
          <p className="truncate text-[11.5px] text-ink/50">From {theme?.business || "you"}</p>
        </div>
        <div className="flex justify-center p-3">
          <iframe key={device} title="Email preview" srcDoc={html} sandbox="allow-same-origin" onLoad={(ev) => { try { const h = ev.currentTarget.contentDocument?.documentElement?.scrollHeight; if (h) ev.currentTarget.style.height = `${Math.min(h + 4, 2400)}px`; } catch { /* cross-origin */ } }} className="rounded-md bg-white transition-all" style={{ width: device === "phone" ? 375 : "100%", maxWidth: "100%", height }} />
        </div>
      </div>
    </div>
  );
}

function BlockFields({ b, set }) {
  if (b.type === "heading") return <input className={inputCls} value={b.text} onChange={(e) => set({ text: e.target.value })} placeholder="Headline" />;
  if (b.type === "text") return <textarea rows={5} className={inputCls} value={b.text} onChange={(e) => set({ text: e.target.value })} placeholder="Write your message. **bold** and [link text](https://...) work." />;
  if (b.type === "button") return (
    <div className="grid gap-2 sm:grid-cols-[0.8fr_1.2fr]">
      <input className={inputCls} value={b.label} onChange={(e) => set({ label: e.target.value })} placeholder="Button text" />
      <input className={inputCls} value={b.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://… or {{review_link}}" />
    </div>
  );
  if (b.type === "image") return (
    <div className="grid gap-2">
      <input className={inputCls} value={b.url} onChange={(e) => set({ url: e.target.value })} placeholder="Image link (https://…)" />
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inputCls} value={b.alt} onChange={(e) => set({ alt: e.target.value })} placeholder="Describe the image (for screen readers)" />
        <input className={inputCls} value={b.link} onChange={(e) => set({ link: e.target.value })} placeholder="Link when tapped (optional)" />
      </div>
    </div>
  );
  if (b.type === "callout") return (
    <div className="grid gap-2">
      <input className={inputCls} value={b.title} onChange={(e) => set({ title: e.target.value })} placeholder="Highlight title" />
      <textarea rows={2} className={inputCls} value={b.text} onChange={(e) => set({ text: e.target.value })} placeholder="Details" />
    </div>
  );
  if (b.type === "columns") return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(b.items || []).map((it, i) => (
        <div key={i} className="grid gap-1.5">
          <input className={inputCls} value={it.title} onChange={(e) => set({ items: b.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder={`Point ${i + 1}`} />
          <textarea rows={2} className={inputCls} value={it.text} onChange={(e) => set({ items: b.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="Short text" />
        </div>
      ))}
      {(b.items || []).length < 3 && <button type="button" onClick={() => set({ items: [...(b.items || []), { title: "", text: "" }] })} className="rounded-md border border-dashed border-hair text-[12.5px] text-ink/50 hover:border-ink/40">+ Add column</button>}
    </div>
  );
  if (b.type === "quote") return (
    <div className="grid gap-2">
      <textarea rows={2} className={inputCls} value={b.text} onChange={(e) => set({ text: e.target.value })} placeholder="Paste a real customer quote" />
      <input className={inputCls} value={b.cite} onChange={(e) => set({ cite: e.target.value })} placeholder="Who said it (e.g. Dana R., Molalla)" />
      <p className="text-[11.5px] text-ink/45">Only use real quotes you have permission to share.</p>
    </div>
  );
  return <p className="text-[12.5px] text-ink/45">A thin divider line.</p>;
}

export function BlocksEditor({ blocks, onChange }) {
  const [adding, setAdding] = useState(false);
  const set = (i, patch) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i, d) => { const n = [...blocks]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        const I = ICON[b.type] || Type;
        return (
          <div key={b.id || i} className="group rounded-lg border border-hair bg-white p-3 transition-shadow hover:shadow-[0_8px_24px_-16px_rgba(26,26,26,.4)]">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-ink/[0.05] text-ink/60"><I className="h-3.5 w-3.5" /></span>
              <span className="text-[12px] font-semibold text-ink/60">{CLIENT_BLOCKS[b.type]?.label}</span>
              <div className="ml-auto flex items-center gap-0.5 opacity-70 group-hover:opacity-100">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-ink/50 hover:bg-ink/5 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Move down" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-ink/50 hover:bg-ink/5 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Remove block" onClick={() => onChange(blocks.filter((_, j) => j !== i))} className="rounded p-1 text-ink/50 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <BlockFields b={b} set={(p) => set(i, p)} />
          </div>
        );
      })}
      {adding ? (
        <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-hair bg-white p-2 sm:grid-cols-4">
          {Object.entries(CLIENT_BLOCKS).map(([k, v]) => {
            const I = ICON[k];
            return (
              <button key={k} type="button" onClick={() => { onChange([...blocks, defaultClientBlock(k)]); setAdding(false); }} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] font-medium hover:bg-[#ff3c00]/[0.07]">
                <I className="h-4 w-4 text-[#ff3c00]" /> {v.label}
              </button>
            );
          })}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-hair py-3 text-[13px] font-medium text-ink/60 hover:border-[#ff3c00] hover:text-[#ff3c00]"><Plus className="h-4 w-4" /> Add a block</button>
      )}
    </div>
  );
}

export function SubjectField({ value, onChange }) {
  return (
    <div>
      <Label hint={`${(value || "").length}/60 is ideal`}>Subject line</Label>
      <input className={`${inputCls} text-[15px] font-medium`} value={value} onChange={(e) => onChange(e.target.value)} placeholder="What's the email about?" />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {MERGE.slice(0, 2).map(([t, l]) => <button key={t} type="button" onClick={() => onChange(`${value || ""}${value?.endsWith(" ") || !value ? "" : " "}${t}`)} className="rounded-full bg-ink/[0.05] px-2.5 py-0.5 text-[11.5px] text-ink/65 hover:bg-[#ff3c00]/10 hover:text-[#c22d00]">+ {l}</button>)}
      </div>
    </div>
  );
}

// AI first draft (Base44 InvokeLLM in email-client ai_draft). Never invents prices or claims: gaps come back as [PLACEHOLDERS].
export function AiDraft({ call, purpose, onDraft, compact }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    if (!prompt.trim()) return;
    setBusy(true); setErr("");
    try { const r = await call("ai_draft", { prompt, purpose }); onDraft(r); setPrompt(""); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border border-[#ff3c00]/25 bg-gradient-to-br from-[#fff4ee] to-white p-3.5">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#c22d00]"><Sparkles className="h-4 w-4" /> Write it for me</div>
      <div className={`mt-2 flex gap-2 ${compact ? "flex-col sm:flex-row" : "flex-col sm:flex-row"}`}>
        <input className={inputCls} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} placeholder={purpose === "review_request" ? "e.g. Thank them for the job and ask for a Google review" : "e.g. Fall storm prep reminder with a free inspection offer"} />
        <Btn kind="flame" icon={Wand2} busy={busy} onClick={go} disabled={!prompt.trim()}>Draft</Btn>
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink/50">Uses your brand voice and business facts. Anything we don&apos;t know (prices, dates, offers) comes back as [PLACEHOLDER] for you to fill in. 1 AI action.</p>
      {err && <p role="alert" className="mt-1.5 text-[12px] text-red-700">{err}</p>}
    </div>
  );
}
