import { useState } from "react";
import { ChevronDown, ChevronUp, Upload, Trash2, Edit2, Check, X } from "lucide-react";

export default function BrandProfile({ clientId, initialData = {} }) {
  const [data, setData] = useState(initialData);
  const [collapsed, setCollapsed] = useState({});
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const toggleSection = (key) => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  const startEdit = (section) => {
    setEditing(section);
    setEditForm(data[section] || {});
  };

  const saveEdit = (section) => {
    setData(p => ({ ...p, [section]: editForm }));
    setEditing(null);
  };

  const toggleColor = (colorIndex) => {
    // Color picker functionality can be enhanced with a proper color picker lib
  };

  return (
    <div className="space-y-3 mt-6">
      <h2 className="text-ink font-bold text-xs tracking-[0.15em] uppercase">Brand Profile</h2>

      {/* 1. BRAND HEADER */}
      <Section title="Brand Header" collapsed={collapsed["header"]} toggle={() => toggleSection("header")}>
        {editing === "header" ? (
          <EditBrandHeader form={editForm} setForm={setEditForm} onSave={() => saveEdit("header")} onCancel={() => setEditing(null)} />
        ) : (
          <ViewBrandHeader data={data.header} onEdit={() => startEdit("header")} />
        )}
      </Section>

      {/* 2. BRAND COLORS */}
      <Section title="Brand Colors" collapsed={collapsed["colors"]} toggle={() => toggleSection("colors")}>
        {editing === "colors" ? (
          <EditBrandColors form={editForm} setForm={setEditForm} onSave={() => saveEdit("colors")} onCancel={() => setEditing(null)} />
        ) : (
          <ViewBrandColors data={data.colors} onEdit={() => startEdit("colors")} />
        )}
      </Section>

      {/* 3. TYPOGRAPHY */}
      <Section title="Typography" collapsed={collapsed["typography"]} toggle={() => toggleSection("typography")}>
        {editing === "typography" ? (
          <EditSection form={editForm} setForm={setEditForm} fields={["headingFont", "bodyFont", "accentFont", "notes", "usageRules"]} onSave={() => saveEdit("typography")} onCancel={() => setEditing(null)} />
        ) : (
          <ViewSection data={data.typography} onEdit={() => startEdit("typography")} />
        )}
      </Section>

      {/* 4. BRAND VOICE */}
      <Section title="Brand Voice" collapsed={collapsed["voice"]} toggle={() => toggleSection("voice")}>
        {editing === "voice" ? (
          <EditSection form={editForm} setForm={setEditForm} fields={["description", "tone", "messagingStyle", "wordsToUse", "wordsToAvoid", "ctaStyle", "notes"]} onSave={() => saveEdit("voice")} onCancel={() => setEditing(null)} />
        ) : (
          <ViewSection data={data.voice} onEdit={() => startEdit("voice")} />
        )}
      </Section>

      {/* 5. VISUAL IDENTITY */}
      <Section title="Visual Identity" collapsed={collapsed["visual"]} toggle={() => toggleSection("visual")}>
        {editing === "visual" ? (
          <EditSection form={editForm} setForm={setEditForm} fields={["description", "photographyStyle", "graphicStyle", "layoutStyle", "designDirection", "textures", "avoid"]} onSave={() => saveEdit("visual")} onCancel={() => setEditing(null)} />
        ) : (
          <ViewSection data={data.visual} onEdit={() => startEdit("visual")} />
        )}
      </Section>

      {/* 6. BRAND PERSONALITY */}
      <Section title="Brand Personality" collapsed={collapsed["personality"]} toggle={() => toggleSection("personality")}>
        {editing === "personality" ? (
          <EditSection form={editForm} setForm={setEditForm} fields={["traits", "feel", "avoid", "positioning", "keywords"]} onSave={() => saveEdit("personality")} onCancel={() => setEditing(null)} />
        ) : (
          <ViewSection data={data.personality} onEdit={() => startEdit("personality")} />
        )}
      </Section>

      {/* 7. ICONOGRAPHY */}
      <Section title="Iconography" collapsed={collapsed["icons"]} toggle={() => toggleSection("icons")}>
        {editing === "icons" ? (
          <EditSection form={editForm} setForm={setEditForm} fields={["style", "illustrationStyle", "motif", "shapeLanguage", "visualCues"]} onSave={() => saveEdit("icons")} onCancel={() => setEditing(null)} />
        ) : (
          <ViewSection data={data.icons} onEdit={() => startEdit("icons")} />
        )}
      </Section>

      {/* 8. SOCIAL / CONTENT STYLE */}
      <Section title="Social / Content Style" collapsed={collapsed["social"]} toggle={() => toggleSection("social")}>
        {editing === "social" ? (
          <EditSection form={editForm} setForm={setEditForm} fields={["contentStyle", "socialDirection", "themes", "postingNotes", "visualNotes"]} onSave={() => saveEdit("social")} onCancel={() => setEditing(null)} />
        ) : (
          <ViewSection data={data.social} onEdit={() => startEdit("social")} />
        )}
      </Section>

      {/* 9. BRAND RULES / NOTES */}
      <Section title="Brand Rules / Notes" collapsed={collapsed["rules"]} toggle={() => toggleSection("rules")}>
        {editing === "rules" ? (
          <EditSection form={editForm} setForm={setEditForm} fields={["rules", "doNotUse", "approvalNotes", "internalNotes"]} onSave={() => saveEdit("rules")} onCancel={() => setEditing(null)} />
        ) : (
          <ViewSection data={data.rules} onEdit={() => startEdit("rules")} />
        )}
      </Section>

      {/* 10. FILES / ASSETS */}
      <Section title="Files / Assets" collapsed={collapsed["files"]} toggle={() => toggleSection("files")}>
        <div className="space-y-2 text-ink/[0.48] text-xs">
          <p>Logo uploads, brand guides, moodboards, and creative assets coming soon</p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, collapsed, toggle, children }) {
  return (
    <div className="bg-card rounded-md border border-ink/[0.13] overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-ink/[0.02] transition-colors">
        <h3 className="text-ink/70 text-xs font-semibold tracking-wide uppercase">{title}</h3>
        {collapsed ? <ChevronDown className="w-4 h-4 text-ink/[0.43]" /> : <ChevronUp className="w-4 h-4 text-ink/[0.43]" />}
      </button>
      {!collapsed && <div className="px-4 py-3 border-t border-ink/[0.13]">{children}</div>}
    </div>
  );
}

function ViewBrandHeader({ data = {}, onEdit }) {
  return (
    <div className="space-y-3">
      {data.logo && <div className="w-16 h-16 rounded-lg bg-ink/5 border border-ink/[0.13] flex items-center justify-center text-ink/[0.38] text-xs">Logo</div>}
      {data.businessName && <p className="text-ink/70 text-sm">{data.businessName}</p>}
      {data.tagline && <p className="text-ink/[0.58] text-xs italic">{data.tagline}</p>}
      {data.summary && <p className="text-ink/[0.63] text-xs leading-relaxed">{data.summary}</p>}
      <button onClick={onEdit} className="text-orange-500/60 hover:text-orange-500 text-xs font-semibold">Edit</button>
    </div>
  );
}

function EditBrandHeader({ form, setForm, onSave, onCancel }) {
  return (
    <div className="space-y-2">
      <input value={form.tagline || ""} onChange={e => setForm({ ...form, tagline: e.target.value })} placeholder="Tagline..." className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded px-2 py-1.5 text-xs text-ink placeholder:text-ink/[0.38] outline-none" />
      <textarea value={form.summary || ""} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Brand summary..." className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded px-2 py-1.5 text-xs text-ink placeholder:text-ink/[0.38] outline-none resize-none min-h-[60px]" />
      <div className="flex gap-2">
        <button onClick={onSave} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-600/70 hover:bg-green-500/20 rounded text-xs font-semibold"><Check className="w-3 h-3" />Save</button>
        <button onClick={onCancel} className="px-3 py-1.5 bg-ink/[0.04] text-ink/[0.48] hover:bg-ink/[0.08] rounded text-xs">Cancel</button>
      </div>
    </div>
  );
}

function ViewBrandColors({ data = {}, onEdit }) {
  const colorSections = ["primary", "secondary", "accent", "neutral", "additional"];
  return (
    <div className="space-y-3">
      {colorSections.map(section => data[section] && (
        <div key={section} className="space-y-1">
          <p className="text-ink/[0.58] text-[10px] tracking-wider uppercase">{section}</p>
          {Array.isArray(data[section]) ? (
            data[section].map((color, i) => (
              <ColorBox key={i} color={color} />
            ))
          ) : (
            <ColorBox color={data[section]} />
          )}
        </div>
      ))}
      <button onClick={onEdit} className="text-orange-500/60 hover:text-orange-500 text-xs font-semibold">Edit</button>
    </div>
  );
}

function ColorBox({ color }) {
  if (!color) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded border border-ink/[0.13]" style={{ backgroundColor: color.hex || "#000" }} />
      <span className="text-ink/[0.58] text-xs font-mono">{color.hex || "N/A"}</span>
    </div>
  );
}

function EditBrandColors({ form, setForm, onSave, onCancel }) {
  return (
    <div className="space-y-2">
      <p className="text-ink/[0.48] text-xs">Color editing interface coming soon</p>
      <div className="flex gap-2">
        <button onClick={onSave} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-600/70 hover:bg-green-500/20 rounded text-xs font-semibold"><Check className="w-3 h-3" />Save</button>
        <button onClick={onCancel} className="px-3 py-1.5 bg-ink/[0.04] text-ink/[0.48] hover:bg-ink/[0.08] rounded text-xs">Cancel</button>
      </div>
    </div>
  );
}

function ViewSection({ data = {}, onEdit }) {
  return (
    <div className="space-y-2">
      {Object.entries(data).length === 0 ? (
        <p className="text-ink/[0.48] text-xs">No information added yet</p>
      ) : (
        Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <p className="text-ink/[0.58] text-[10px] tracking-wider uppercase">{key.replace(/([A-Z])/g, ' $1')}</p>
            <p className="text-ink/50 text-xs mt-0.5">{String(value).slice(0, 100)}...</p>
          </div>
        ))
      )}
      <button onClick={onEdit} className="text-orange-500/60 hover:text-orange-500 text-xs font-semibold">Edit</button>
    </div>
  );
}

function EditSection({ form, setForm, fields, onSave, onCancel }) {
  return (
    <div className="space-y-2">
      {fields.map(field => (
        <div key={field}>
          <label className="text-ink/[0.58] text-[10px] tracking-wider uppercase block mb-1">{field.replace(/([A-Z])/g, ' $1')}</label>
          {["description", "notes", "rules", "doNotUse", "approvalNotes", "internalNotes", "wordsToUse", "wordsToAvoid"].includes(field) ? (
            <textarea value={form[field] || ""} onChange={e => setForm({ ...form, [field]: e.target.value })} className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded px-2 py-1.5 text-xs text-ink placeholder:text-ink/[0.38] outline-none resize-none min-h-[50px]" />
          ) : (
            <input value={form[field] || ""} onChange={e => setForm({ ...form, [field]: e.target.value })} className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded px-2 py-1.5 text-xs text-ink placeholder:text-ink/[0.38] outline-none" />
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-2">
        <button onClick={onSave} className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-600/70 hover:bg-green-500/20 rounded text-xs font-semibold"><Check className="w-3 h-3" />Save</button>
        <button onClick={onCancel} className="px-3 py-1.5 bg-ink/[0.04] text-ink/[0.48] hover:bg-ink/[0.08] rounded text-xs">Cancel</button>
      </div>
    </div>
  );
}