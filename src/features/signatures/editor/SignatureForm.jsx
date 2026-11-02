import React, { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, ImageIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SOCIAL_PLATFORMS } from "@/features/signatures/lib/iconLibrary";
import { Section, ToggleRow, ChoiceGrid } from "./Controls";
import DesignSection from "./DesignSection";
import CtaSection from "./CtaSection";
import ThemeSection from "./ThemeSection";

const SIDES = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
];
const SIZES = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
];

export default function SignatureForm({ fields, theme, onFields, onTheme, onUpload }) {
  const photoRef = useRef(null);
  const logoRef = useRef(null);

  const setF = (patch) => onFields({ ...fields, ...patch });
  const setSocial = (id, patch) =>
    onFields({ ...fields, social: { ...fields.social, [id]: { ...fields.social[id], ...patch } } });

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
      </Section>

      <Section title="Contact">
        <ToggleRow label="Phone" checked={fields.phone_show} onChange={(v) => setF({ phone_show: v })} />
        {fields.phone_show && (
          <Input value={fields.phone} onChange={(e) => setF({ phone: e.target.value })} className="h-9" placeholder="+1 (555) 555-0100" />
        )}
        <ToggleRow label="Email" checked={fields.email_show} onChange={(v) => setF({ email_show: v })} />
        {fields.email_show && (
          <Input value={fields.email} onChange={(e) => setF({ email: e.target.value })} className="h-9" placeholder="you@company.com" />
        )}
        <ToggleRow label="Website" checked={fields.website_show} onChange={(v) => setF({ website_show: v })} />
        {fields.website_show && (
          <Input value={fields.website} onChange={(e) => setF({ website: e.target.value })} className="h-9" placeholder="company.com" />
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
        <div>
          <span className="text-xs text-muted-foreground">Photo side</span>
          <div className="mt-1">
            <ChoiceGrid value={fields.photo_side} options={SIDES} onChange={(id) => setF({ photo_side: id })} cols={2} />
          </div>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Photo size</span>
          <div className="mt-1">
            <ChoiceGrid value={fields.photo_size} options={SIZES} onChange={(id) => setF({ photo_size: id })} />
          </div>
        </div>
        <ToggleRow label="Circular crop" checked={fields.photo_rounded} onChange={(v) => setF({ photo_rounded: v })} />
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

      <Section title="Social links" hint="Toggle the networks to show, then paste each link.">
        {SOCIAL_PLATFORMS.map((p) => (
          <div key={p.id}>
            <ToggleRow label={p.label} checked={fields.social[p.id]?.show} onChange={(v) => setSocial(p.id, { show: v })} />
            {fields.social[p.id]?.show && (
              <Input
                value={fields.social[p.id]?.url || ""}
                onChange={(e) => setSocial(p.id, { url: e.target.value })}
                className="h-9 mt-2"
                placeholder={`https://${p.id === "x" ? "x" : p.id}.com/yourhandle`}
              />
            )}
          </div>
        ))}
      </Section>

      <DesignSection theme={theme} onTheme={onTheme} fields={fields} onFields={onFields} />
      <CtaSection cta={fields.cta} onChange={(patch) => setF({ cta: { ...fields.cta, ...patch } })} />
      <ThemeSection theme={theme} onTheme={onTheme} />
    </div>
  );
}