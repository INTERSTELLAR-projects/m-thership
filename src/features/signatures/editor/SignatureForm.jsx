import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, ImageIcon, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  SOCIAL_PLATFORMS,
  PHOTO_SIDES,
  PHOTO_SHAPES,
  PHOTO_ANIMS,
  BADGE_STYLES,
  BADGE_COLORS,
} from "@/features/signatures/lib/iconLibrary";
import { Section, ToggleRow, ChoiceGrid, RangeField, ColorField } from "./Controls";
import DesignSection from "./DesignSection";
import CtaSection from "./CtaSection";
import ThemeSection from "./ThemeSection";

export default function SignatureForm({ fields, theme, onFields, onTheme }) {
  const photoRef = useRef(null);
  const logoRef = useRef(null);
  const [uploading, setUploading] = useState(null);

  const setF = (patch) => onFields({ ...fields, ...patch });
  const setT = (patch) => onTheme({ ...theme, ...patch });
  const setSocial = (id, patch) =>
    onFields({ ...fields, social: { ...fields.social, [id]: { ...(fields.social[id] || {}), ...patch } } });

  const handleFile = async (e, type) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(type);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (type === "photo") setF({ profile_photo_url: file_url });
      else setF({ logo_url: file_url });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="p-5">
      <Section title="Identity">
        <div>
          <Label className="text-xs">Full name</Label>
          <Input value={fields.full_name} onChange={(e) => setF({ full_name: e.target.value })} className="h-10 mt-1" />
        </div>
        <div>
          <Label className="text-xs">Job title</Label>
          <Input value={fields.job_title} onChange={(e) => setF({ job_title: e.target.value })} className="h-10 mt-1" />
        </div>
        <div>
          <Label className="text-xs">Company name</Label>
          <Input value={fields.company_name} onChange={(e) => setF({ company_name: e.target.value })} className="h-10 mt-1" />
        </div>
        <div>
          <Label className="text-xs">Slogan</Label>
          <Input
            value={fields.slogan || ""}
            onChange={(e) => setF({ slogan: e.target.value })}
            className="h-10 mt-1"
            placeholder="The Future of Business"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Shows under the logo and company name.</p>
        </div>
      </Section>

      <Section title="Verified check">
        <ToggleRow label="Show check next to name" checked={fields.verified_badge !== false} onChange={(v) => setF({ verified_badge: v })} />
        {fields.verified_badge !== false && (
          <>
            <div>
              <span className="text-xs text-muted-foreground">Animation</span>
              <div className="mt-1">
                <ChoiceGrid value={theme.badge_style} options={BADGE_STYLES} onChange={(id) => setT({ badge_style: id })} />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Color</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {BADGE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => setT({ badge_color: c.id })}
                    className={`h-8 px-2.5 rounded-sm border text-xs inline-flex items-center gap-1.5 ${
                      theme.badge_color === c.id ? "border-[#ff3c00] bg-[#fff1ea]" : "border-border"
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full" style={{ background: c.id }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <ColorField label="Custom color" value={theme.badge_color} onChange={(v) => setT({ badge_color: v })} />
              <RangeField label="Size" value={Number(theme.badge_size) || 18} min={14} max={26} suffix="px" onChange={(v) => setT({ badge_size: v })} />
            </div>
          </>
        )}
      </Section>

      <Section title="Contact">
        <ToggleRow label="Phone" checked={fields.phone_show} onChange={(v) => setF({ phone_show: v })} />
        {fields.phone_show && (
          <Input value={fields.phone} onChange={(e) => setF({ phone: e.target.value })} className="h-9" placeholder="(555) 555-0100" />
        )}
        <ToggleRow label="Email" checked={fields.email_show} onChange={(v) => setF({ email_show: v })} />
        {fields.email_show && (
          <Input value={fields.email} onChange={(e) => setF({ email: e.target.value })} className="h-9" placeholder="you@company.com" />
        )}
        <ToggleRow label="Website" checked={fields.website_show} onChange={(v) => setF({ website_show: v })} />
        {fields.website_show && (
          <Input value={fields.website} onChange={(e) => setF({ website: e.target.value })} className="h-9" placeholder="company.com" />
        )}
        <ToggleRow label="Address" checked={!!fields.address_show} onChange={(v) => setF({ address_show: v })} />
        {fields.address_show && (
          <Input value={fields.address || ""} onChange={(e) => setF({ address: e.target.value })} className="h-9" placeholder="Molalla, OR" />
        )}
        <p className="text-[11px] text-muted-foreground">Each line is a tap-to-call, tap-to-email or open-the-site link.</p>
      </Section>

      {(theme.contact_style || "auto") === "auto" || theme.contact_style === "icons" ? (
        <Section title="Contact icons">
          <div>
            <span className="text-xs text-muted-foreground">Style</span>
            <div className="mt-1">
              <ChoiceGrid
                value={theme.contact_icon_style || "soft"}
                options={[
                  { id: "soft", label: "Soft disc" },
                  { id: "solid", label: "Solid" },
                  { id: "gradient", label: "Gradient" },
                  { id: "ring", label: "Ring" },
                  { id: "bare", label: "Icon only" },
                ]}
                onChange={(id) => setT({ contact_icon_style: id })}
              />
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Icon set</span>
            <div className="mt-1">
              <ChoiceGrid
                value={theme.contact_icon_set || "line"}
                options={[
                  { id: "line", label: "Line" },
                  { id: "solid", label: "Filled" },
                ]}
                onChange={(id) => setT({ contact_icon_set: id })}
                cols={2}
              />
            </div>
          </div>
          <RangeField
            label="Size"
            value={Number(theme.contact_icon_size) || 20}
            min={14}
            max={28}
            suffix="px"
            onChange={(v) => setT({ contact_icon_size: v })}
          />
          <div>
            <span className="text-xs text-muted-foreground">Color</span>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {[
                { id: "", label: "Accent", sw: theme.accent_color },
                { id: theme.accent_color_2 || theme.accent_color, label: "Accent 2", sw: theme.accent_color_2 || theme.accent_color },
                { id: theme.text_color, label: "Text", sw: theme.text_color },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setT({ contact_icon_color: o.id })}
                  className={`h-8 px-2.5 rounded-sm border text-xs inline-flex items-center gap-1.5 ${
                    (theme.contact_icon_color || "") === o.id ? "border-[#ff3c00] bg-[#fff1ea]" : "border-border"
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full" style={{ background: o.sw }} />
                  {o.label}
                </button>
              ))}
              <input
                type="color"
                value={theme.contact_icon_color || theme.accent_color}
                onChange={(e) => setT({ contact_icon_color: e.target.value })}
                className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                title="Custom color"
              />
            </div>
          </div>
        </Section>
      ) : null}

      <Section title="Profile photo" hint="Upload a regular photo. The animation is generated for you.">
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, "photo")} />
        <div className="flex items-center gap-3">
          {fields.profile_photo_url ? (
            <img src={fields.profile_photo_url} alt="profile" className="w-14 h-14 rounded-md object-cover border" />
          ) : (
            <div className="w-14 h-14 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
              <ImageIcon className="w-5 h-5" />
            </div>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()} disabled={uploading === "photo"}>
            {uploading === "photo" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} Upload
          </Button>
          {fields.profile_photo_url && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setF({ profile_photo_url: "" })}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        {fields.profile_photo_url && (
          <>
            <div>
              <span className="text-xs text-muted-foreground">Side</span>
              <div className="mt-1">
                <ChoiceGrid value={fields.photo_side} options={PHOTO_SIDES} onChange={(id) => setF({ photo_side: id })} />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Animation</span>
              <div className="mt-1">
                <ChoiceGrid value={fields.photo_anim} options={PHOTO_ANIMS} onChange={(id) => setF({ photo_anim: id })} />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Shape</span>
              <div className="mt-1">
                <ChoiceGrid value={fields.photo_shape} options={PHOTO_SHAPES} onChange={(id) => setF({ photo_shape: id })} cols={4} />
              </div>
            </div>
            <RangeField label="Size" value={Number(fields.photo_px) || 96} min={56} max={160} step={4} suffix="px" onChange={(v) => setF({ photo_px: v })} />
            <ToggleRow label="Accent ring" checked={!!fields.photo_ring} onChange={(v) => setF({ photo_ring: v })} />
          </>
        )}
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
          <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={uploading === "logo"}>
            {uploading === "logo" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} Upload
          </Button>
          {fields.logo_url && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setF({ logo_url: "" })}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        {fields.logo_url && (
          <>
            <div>
              <span className="text-xs text-muted-foreground">Placement</span>
              <div className="mt-1">
                <ChoiceGrid
                  value={fields.logo_position || "brand"}
                  options={[
                    { id: "brand", label: "Beside company" },
                    { id: "top", label: "Top" },
                    { id: "footer", label: "Footer" },
                  ]}
                  onChange={(id) => setF({ logo_position: id })}
                />
              </div>
            </div>
            <RangeField label="Logo height" value={Number(fields.logo_height) || 24} min={16} max={60} suffix="px" onChange={(v) => setF({ logo_height: v })} />
            <p className="text-[11px] text-muted-foreground">Beside company caps at 34px, footer at 40px, top at 60px so it never overpowers the name.</p>
          </>
        )}
      </Section>

      <Section title="Social links" hint="Toggle the networks to show, then paste each link.">
        {SOCIAL_PLATFORMS.map((p) => (
          <div key={p.id}>
            <ToggleRow label={p.label} checked={!!fields.social[p.id]?.show} onChange={(v) => setSocial(p.id, { show: v })} />
            {fields.social[p.id]?.show && (
              <Input
                value={fields.social[p.id]?.url || ""}
                onChange={(e) => setSocial(p.id, { url: e.target.value })}
                className="h-9 mt-2"
                placeholder={p.id === "website" ? "https://yoursite.com" : `https://${p.id}.com/yourhandle`}
              />
            )}
          </div>
        ))}
      </Section>

      <DesignSection theme={theme} onTheme={onTheme} fields={fields} />
      <CtaSection cta={fields.cta} onChange={(patch) => setF({ cta: { ...fields.cta, ...patch } })} />
      <ThemeSection theme={theme} onTheme={onTheme} />
    </div>
  );
}
