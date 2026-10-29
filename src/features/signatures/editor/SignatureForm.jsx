import React, { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Upload, Trash2, ImageIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SOCIAL_PLATFORMS, ICON_STYLES, CTA_STYLES } from "@/features/signatures/lib/iconLibrary";

function Section({ title, children }) {
  return (
    <div className="border-b border-border pb-5 mb-5 last:border-0 last:mb-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
      {children}
    </div>
  );
}

export default function SignatureForm({ fields, theme, onFields, onTheme, onUpload }) {
  const photoRef = useRef(null);
  const logoRef = useRef(null);

  const setF = (patch) => onFields({ ...fields, ...patch });
  const setSocial = (id, patch) =>
    onFields({ ...fields, social: { ...fields.social, [id]: { ...fields.social[id], ...patch } } });
  const setCta = (patch) => onFields({ ...fields, cta: { ...fields.cta, ...patch } });

  const handleFile = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
    onUpload(type, file_url);
    if (type === "profile_photo") setF({ profile_photo_url: file_url });
    else setF({ logo_url: file_url });
    e.target.value = "";
  };

  return (
    <div className="p-5">
      <Section title="Identity">
        <div>
          <Label className="text-xs">Full name</Label>
          <Input value={fields.full_name} onChange={(e) => setF({ full_name: e.target.value })} className="h-10" />
        </div>
        <div>
          <Label className="text-xs">Job title</Label>
          <Input value={fields.job_title} onChange={(e) => setF({ job_title: e.target.value })} className="h-10" />
        </div>
        <div>
          <Label className="text-xs">Company name</Label>
          <Input value={fields.company_name} onChange={(e) => setF({ company_name: e.target.value })} className="h-10" />
        </div>
      </Section>

      <Section title="Contact">
        <ToggleRow label="Phone" checked={fields.phone_show} onChange={(v) => setF({ phone_show: v })} />
        {fields.phone_show && (
          <Input value={fields.phone} onChange={(e) => setF({ phone: e.target.value })} className="h-10" placeholder="+1 (555) 555-0100" />
        )}
        <ToggleRow label="Email" checked={fields.email_show} onChange={(v) => setF({ email_show: v })} />
        {fields.email_show && (
          <Input value={fields.email} onChange={(e) => setF({ email: e.target.value })} className="h-10" placeholder="you@company.com" />
        )}
        <ToggleRow label="Website" checked={fields.website_show} onChange={(v) => setF({ website_show: v })} />
        {fields.website_show && (
          <Input value={fields.website} onChange={(e) => setF({ website: e.target.value })} className="h-10" placeholder="company.com" />
        )}
      </Section>

      <Section title="Profile photo">
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, "profile_photo")} />
        <div className="flex items-center gap-3">
          {fields.profile_photo_url ? (
            <img src={fields.profile_photo_url} alt="profile" className="w-14 h-14 rounded-full object-cover border" />
          ) : (
            <div className="w-14 h-14 rounded-full border border-dashed flex items-center justify-center text-muted-foreground">
              <ImageIcon className="w-5 h-5" />
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Upload
          </Button>
          {fields.profile_photo_url && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setF({ profile_photo_url: "" })}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <ToggleRow label="Rounded corners" checked={fields.photo_rounded} onChange={(v) => setF({ photo_rounded: v })} />
      </Section>

      <Section title="Company logo">
        <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, "logo")} />
        <div className="flex items-center gap-3">
          {fields.logo_url ? (
            <img src={fields.logo_url} alt="logo" className="h-10 w-auto object-contain border rounded px-1" />
          ) : (
            <div className="h-10 w-16 border border-dashed rounded flex items-center justify-center text-muted-foreground">
              <ImageIcon className="w-4 h-4" />
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Upload
          </Button>
          {fields.logo_url && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setF({ logo_url: "" })}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Section>

      <Section title="Social links">
        <div className="text-xs text-muted-foreground -mt-1 mb-1">Toggle the networks to show in your signature.</div>
        {SOCIAL_PLATFORMS.map((p) => (
          <div key={p.id}>
            <ToggleRow
              label={p.label}
              checked={fields.social[p.id]?.show}
              onChange={(v) => setSocial(p.id, { show: v })}
            />
            {fields.social[p.id]?.show && (
              <Input
                value={fields.social[p.id]?.url || ""}
                onChange={(e) => setSocial(p.id, { url: e.target.value })}
                className="h-9 mt-2"
                placeholder={`https://${p.id}.com/yourhandle`}
              />
            )}
          </div>
        ))}
        <div>
          <Label className="text-xs">Icon style</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {ICON_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onTheme({ ...theme, icon_style: s.id })}
                className={`text-xs rounded-none border px-2 py-2 text-center transition ${
                  theme.icon_style === s.id ? "border-[#ff3c00] bg-[#fff1ea] text-[#ff6a00]" : "border-border hover:bg-muted"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Verified badge">
        <ToggleRow
          label="Show verified checkmark next to name"
          checked={fields.verified_badge}
          onChange={(v) => setF({ verified_badge: v })}
        />
      </Section>

      <Section title="Call-to-action button">
        <div>
          <Label className="text-xs">Button label</Label>
          <Input value={fields.cta?.label || ""} onChange={(e) => setCta({ label: e.target.value })} className="h-10" />
        </div>
        <div>
          <Label className="text-xs">Button URL</Label>
          <Input value={fields.cta?.url || ""} onChange={(e) => setCta({ url: e.target.value })} className="h-10" placeholder="https://cal.com/you" />
        </div>
        <div>
          <Label className="text-xs">Button style</Label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {CTA_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCta({ style: s.id })}
                className={`text-xs rounded-none border px-2 py-2 text-center transition ${
                  fields.cta?.style === s.id ? "border-[#ff3c00] bg-[#fff1ea] text-[#ff6a00]" : "border-border hover:bg-muted"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Theme">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Accent color</Label>
            <input
              type="color"
              value={theme.accent_color}
              onChange={(e) => onTheme({ ...theme, accent_color: e.target.value })}
              className="w-full h-9 rounded border border-border cursor-pointer"
            />
          </div>
          <div>
            <Label className="text-xs">Text color</Label>
            <input
              type="color"
              value={theme.text_color}
              onChange={(e) => onTheme({ ...theme, text_color: e.target.value })}
              className="w-full h-9 rounded border border-border cursor-pointer"
            />
          </div>
          <div>
            <Label className="text-xs">Border color</Label>
            <input
              type="color"
              value={theme.border_color}
              onChange={(e) => onTheme({ ...theme, border_color: e.target.value })}
              className="w-full h-9 rounded border border-border cursor-pointer"
            />
          </div>
          <div>
            <Label className="text-xs">Border radius</Label>
            <Input
              value={theme.border_radius}
              onChange={(e) => onTheme({ ...theme, border_radius: e.target.value })}
              className="h-9"
              placeholder="10px"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Font</Label>
          <select
            value={theme.font}
            onChange={(e) => onTheme({ ...theme, font: e.target.value })}
            className="w-full h-9 rounded border border-border bg-background px-2 text-sm"
          >
            {["Inter", "Arial", "Helvetica", "Georgia"].map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Border style</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[
              { id: "box", label: "Rounded box" },
              { id: "none", label: "No border" },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onTheme({ ...theme, border_style: b.id })}
                className={`text-xs rounded-none border px-2 py-2 text-center transition ${
                  theme.border_style === b.id ? "border-[#ff3c00] bg-[#fff1ea] text-[#ff6a00]" : "border-border hover:bg-muted"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
