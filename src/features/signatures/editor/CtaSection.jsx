import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section, ChoiceGrid } from "./Controls";
import { CTA_STYLES } from "@/features/signatures/lib/iconLibrary";

export default function CtaSection({ cta, onChange }) {
  const value = cta || {};
  return (
    <Section title="Call-to-action button">
      <div>
        <Label className="text-xs">Label</Label>
        <Input value={value.label || ""} onChange={(e) => onChange({ label: e.target.value })} className="h-10 mt-1" />
      </div>
      <div>
        <Label className="text-xs">Link</Label>
        <Input
          value={value.url || ""}
          onChange={(e) => onChange({ url: e.target.value })}
          className="h-10 mt-1"
          placeholder="https://cal.com/you"
        />
      </div>
      <div>
        <span className="text-xs text-muted-foreground">Style</span>
        <div className="mt-1">
          <ChoiceGrid value={value.style} options={CTA_STYLES} onChange={(id) => onChange({ style: id })} />
        </div>
      </div>
    </Section>
  );
}