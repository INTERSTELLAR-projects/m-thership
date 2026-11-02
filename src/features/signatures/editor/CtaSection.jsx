import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section, ChoiceGrid, RangeField, ToggleRow } from "./Controls";
import { CTA_STYLES, CTA_ANIMS, CTA_ICONS } from "@/features/signatures/lib/iconLibrary";

export default function CtaSection({ cta, onChange }) {
  const value = cta || {};
  const on = !!value.label;
  return (
    <Section title="Call-to-action button">
      <ToggleRow
        label="Show button"
        checked={on}
        onChange={(v) => onChange({ label: v ? value._label || "Book a Call" : "", _label: value.label || value._label })}
      />
      {on && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={value.label || ""} onChange={(e) => onChange({ label: e.target.value })} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Link</Label>
              <Input
                value={value.url || ""}
                onChange={(e) => onChange({ url: e.target.value })}
                className="h-9 mt-1"
                placeholder="interstellar-booking.com"
              />
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Style</span>
            <div className="mt-1">
              <ChoiceGrid value={value.style} options={CTA_STYLES} onChange={(id) => onChange({ style: id })} cols={4} />
            </div>
          </div>
          {value.style !== "link" && (
            <>
              <div>
                <span className="text-xs text-muted-foreground">Animation</span>
                <div className="mt-1">
                  <ChoiceGrid value={value.anim} options={CTA_ANIMS} onChange={(id) => onChange({ anim: id })} cols={4} />
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Icon</span>
                <div className="mt-1">
                  <ChoiceGrid value={value.icon} options={CTA_ICONS} onChange={(id) => onChange({ icon: id })} cols={4} />
                </div>
              </div>
              {value.style !== "pill" && (
                <RangeField label="Corner radius" value={Number(value.radius ?? 8)} min={0} max={20} suffix="px" onChange={(v) => onChange({ radius: v })} />
              )}
            </>
          )}
          <p className="text-[11px] text-muted-foreground">
            Animated, Glass and Neon buttons are rendered as a sharp hosted image so they look the same in every inbox.
          </p>
        </>
      )}
    </Section>
  );
}
