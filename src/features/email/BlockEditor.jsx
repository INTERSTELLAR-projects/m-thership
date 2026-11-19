import { useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { ChevronDown, ChevronRight, Copy, GripVertical, Plus, Trash2, X } from "lucide-react";
import { BLOCK_ORDER, BLOCK_TYPES, LINK_ICONS, TAG_STYLES, defaultBlock, newId } from "./emailBlocks";
import { Btn, Select, TextArea, TextInput, inputCls } from "./ui";

// Manual block editing: every block's text, drag to reorder, add / duplicate / remove. Header stays first.

const SPEC = {
  header: { fields: [["eyebrow", "Eyebrow", "input"], ["show_date", "Show today's date", "check"]] },
  hero: { fields: [["title", "Headline", "input"], ["accent", "Orange second line", "input"]] },
  intro: { fields: [["text", "Text", "area"]] },
  paragraph: { fields: [["text", "Text", "area"]] },
  stats: { list: { key: "items", max: 4, add: { value: "", label: "" }, fields: [["value", "Number", "input"], ["label", "Label", "input"], ["accent", "Orange", "check"]] } },
  band: { fields: [["label", "Label", "input"], ["text", "Text", "area"]] },
  section: { fields: [["title", "Label (numbered 01, 02… automatically)", "input"], ["text", "Line under it (optional)", "area"]] },
  videos: { list: { key: "items", max: 3, add: { thumb: "", title: "", text: "", url: "" }, fields: [["title", "Title", "input"], ["url", "Video link", "input"], ["thumb", "Thumbnail image URL (blank = dark play tile)", "input"], ["text", "Blurb", "area"]] } },
  links: { list: { key: "items", max: 6, add: { icon: "doc", title: "", text: "", url: "", cta: "Open" }, fields: [["title", "Title", "input"], ["url", "Link", "input"], ["icon", "Icon", "icon"], ["cta", "Link word (Open, Read…)", "input"], ["text", "Line under it", "area"]] } },
  checklist: { list: { key: "items", max: 12, add: { title: "", text: "" }, fields: [["title", "Bold part", "input"], ["text", "Rest of the line", "input"]] } },
  offer: { fields: [["eyebrow", "Label", "input"]], list: { key: "rows", max: 10, add: { label: "", value: "", accent: false }, fields: [["label", "Label", "input"], ["value", "Value", "input"], ["accent", "Big orange value", "check"]] } },
  guarantee: { fields: [["label", "Label", "input"], ["title", "Bold promise", "area"], ["text", "The rest", "area"]] },
  signature: { fields: [["name", "Name", "input"], ["role", "Role", "input"], ["website", "Website", "input"], ["email", "Email", "input"], ["ps", "P.S. line", "area"]] },
  cards: { list: { key: "items", max: 12, add: { tag: "Coming up", tag_style: "coming_up", title: "", text: "" }, fields: [["tag", "Tag", "input"], ["tag_style", "Tag colour", "tag"], ["title", "Title", "input"], ["text", "Text", "area"]] } },
  steps: { list: { key: "items", max: 10, add: { title: "", text: "", foot: "" }, fields: [["title", "Title", "input"], ["text", "Text", "area"], ["foot", "Small orange line", "input"]] } },
  callout: { fields: [["title", "Title", "input"], ["text", "Text", "area"]] },
  table: { fields: [["title", "Card title", "input"], ["total_label", "Total label", "input"], ["total_value", "Total value", "input"]], list: { key: "rows", max: 20, add: { label: "", value: "" }, fields: [["label", "Label", "input"], ["value", "Value", "input"]] } },
  image: { fields: [["url", "Image URL", "input"], ["alt", "Alt text", "input"], ["caption", "Caption", "input"], ["link", "Link (optional)", "input"]] },
  darkband: { fields: [["eyebrow", "Eyebrow", "input"], ["title", "Title", "input"], ["accent", "Orange accent", "input"], ["text", "Text", "area"]] },
  button: { fields: [["label", "Label", "input"], ["url", "Link", "input"]] },
  signoff: { fields: [["text", "Closing note", "area"], ["name", "Name line", "input"]] },
};

const TAG_OPTIONS = Object.entries(TAG_STYLES).map(([value, t]) => ({ value, label: t.label }));
const ICON_OPTIONS = Object.entries(LINK_ICONS).map(([value, label]) => ({ value, label }));

function summary(b) {
  const s = b.title || b.text || b.eyebrow || b.label || (b.items && b.items[0] && (b.items[0].title || b.items[0].value)) || (b.rows && b.rows[0] && b.rows[0].label) || b.url || "";
  const n = b.items ? b.items.length : b.rows ? b.rows.length : 0;
  return `${String(s).slice(0, 70)}${n > 1 ? ` · ${n} items` : ""}`;
}

function FieldInput({ kind, label, value, onChange }) {
  if (kind === "check") {
    return (
      <label className="flex items-center gap-2 text-[12px] text-ink/70">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="accent-[#ff3c00]" />
        {label}
      </label>
    );
  }
  return (
    <div>
      <p className="mono-label mb-1 text-[8.5px] text-ink/45">{label}</p>
      {kind === "area" ? <TextArea rows={3} value={value} onChange={onChange} /> : kind === "tag" ? <Select value={value} onChange={onChange} options={TAG_OPTIONS} /> : kind === "icon" ? <Select value={value} onChange={onChange} options={ICON_OPTIONS} /> : <TextInput value={value} onChange={onChange} />}
    </div>
  );
}

function BlockBody({ block, onChange }) {
  const spec = SPEC[block.type] || {};
  const set = (k, v) => onChange({ ...block, [k]: v });
  const list = spec.list;
  const items = list ? block[list.key] || [] : [];
  const setItem = (i, k, v) => set(list.key, items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="space-y-2.5 border-t border-hair px-3 py-3">
      {(spec.fields || []).map(([k, label, kind]) => <FieldInput key={k} kind={kind} label={label} value={block[k]} onChange={(v) => set(k, v)} />)}
      {list && (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="relative border border-hair bg-paper/60 p-2.5 pr-8">
              <span className="mono-label absolute right-2 top-2 text-[8.5px] text-ink/35">{String(i + 1).padStart(2, "0")}</span>
              <button type="button" title="Remove" onClick={() => set(list.key, items.filter((_, j) => j !== i))} className="absolute bottom-2 right-2 text-ink/35 hover:text-[#ff3c00]"><X className="h-3.5 w-3.5" /></button>
              <div className={`grid gap-2 ${list.fields.length > 2 ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
                {list.fields.map(([k, label, kind]) => (
                  <div key={k} className={kind === "area" ? "sm:col-span-2" : ""}>
                    <FieldInput kind={kind} label={label} value={it[k]} onChange={(v) => setItem(i, k, v)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {items.length < list.max && <Btn variant="ghost" className="h-7 px-1 text-[11.5px]" onClick={() => set(list.key, [...items, { ...list.add }])}><Plus className="h-3.5 w-3.5" /> Add {list.key === "rows" ? "row" : "item"}</Btn>}
        </div>
      )}
    </div>
  );
}

export default function BlockEditor({ blocks, onChange }) {
  const [open, setOpen] = useState(() => new Set());
  const [adding, setAdding] = useState("");
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const update = (i, b) => onChange(blocks.map((x, j) => (j === i ? b : x)));
  const remove = (i) => onChange(blocks.filter((_, j) => j !== i));
  const duplicate = (i) => { const copy = { ...JSON.parse(JSON.stringify(blocks[i])), id: newId() }; onChange([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]); };
  const onDragEnd = ({ source, destination }) => {
    if (!destination) return;
    const to = Math.max(1, destination.index); // header stays first
    if (source.index === 0) return;
    const next = [...blocks];
    const [m] = next.splice(source.index, 1);
    next.splice(to, 0, m);
    onChange(next);
  };
  const add = (type) => {
    if (!type) return;
    const b = defaultBlock(type);
    // New blocks go before the button / sign-off so the footer stays at the end.
    const tail = blocks.findIndex((x, i) => i > 0 && (x.type === "button" || x.type === "signoff" || x.type === "signature"));
    const at = type === "button" || type === "signoff" || type === "signature" || tail < 0 ? blocks.length : tail;
    onChange([...blocks.slice(0, at), b, ...blocks.slice(at)]);
    setOpen((s) => new Set(s).add(b.id));
    setAdding("");
  };

  return (
    <div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="email-blocks">
          {(drop) => (
            <div ref={drop.innerRef} {...drop.droppableProps} className="space-y-1.5">
              {blocks.map((b, i) => (
                <Draggable key={b.id} draggableId={b.id} index={i} isDragDisabled={b.type === "header"}>
                  {(drag, snap) => (
                    <div ref={drag.innerRef} {...drag.draggableProps} className={`border bg-card ${snap.isDragging ? "border-[#ff3c00] shadow-lg" : "border-hair"}`}>
                      <div className="flex items-center gap-1.5 px-2 py-1.5">
                        <span {...drag.dragHandleProps} className={`p-0.5 ${b.type === "header" ? "text-ink/15" : "cursor-grab text-ink/35 hover:text-ink"}`} title={b.type === "header" ? "The header is always first" : "Drag to reorder"}><GripVertical className="h-4 w-4" /></span>
                        <button type="button" onClick={() => toggle(b.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          {open.has(b.id) ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink/40" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink/40" />}
                          <span className="mono-label shrink-0 text-[9px] text-[#ff3c00]">{BLOCK_TYPES[b.type] ? BLOCK_TYPES[b.type].label : b.type}</span>
                          <span className="truncate text-[12.5px] text-ink/70">{summary(b) || <span className="text-ink/30">empty</span>}</span>
                        </button>
                        {b.type !== "header" && (
                          <>
                            <button type="button" title="Duplicate" onClick={() => duplicate(i)} className="p-1 text-ink/35 hover:text-ink"><Copy className="h-3.5 w-3.5" /></button>
                            <button type="button" title="Remove block" onClick={() => remove(i)} className="p-1 text-ink/35 hover:text-[#ff3c00]"><Trash2 className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                      </div>
                      {open.has(b.id) && <BlockBody block={b} onChange={(nb) => update(i, nb)} />}
                    </div>
                  )}
                </Draggable>
              ))}
              {drop.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <div className="mt-2 flex items-center gap-2">
        <select value={adding} onChange={(e) => add(e.target.value)} className={`${inputCls} h-9 py-0`}>
          <option value="">+ Add a block…</option>
          {BLOCK_ORDER.filter((t) => t !== "header").map((t) => <option key={t} value={t}>{BLOCK_TYPES[t].label} — {BLOCK_TYPES[t].hint}</option>)}
        </select>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-ink/45">Text fields take plain text. **bold**, [label](https://link) and plain email addresses / URLs become orange links automatically.</p>
    </div>
  );
}
