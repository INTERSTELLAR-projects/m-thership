import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section, ToggleRow, ChoiceGrid, ColorField } from "./Controls";

const FONTS = ["Inter", "Arial", "Helvetica", "Georgia"];
const BORDERS = [
  { id: "box", label: "Framed" },
  { id: "none", label: "Borderless" },
];
const CONTACT = [
  { id: "auto", label: "Icons (default)" },
  { id: "caps", label: "CALL / MAIL" },
  { id: "bold", label: "Phone: / Email:" },
];

export default function ThemeSection({ theme, onTheme }) {
  const set = (patch) => onTheme({ ...theme, ...patch });

  return (
    <Section title="Theme">
      <div className="grid grid-cols-2 gap-3">
        <ColorField label="Accent" value={theme.accent_color} onChange={(v) => set({ accent_color: v })} />
        <ColorField label="Accent 2 (gradient end)" value={theme.accent_color_2 || theme.accent_color} onChange={(v) => set({ accent_color_2: v })} />
        <ColorField label="Text" value={theme.text_color} onChange={(v) => set({ text_color: v })} />
        <ColorField label="Hairline" value={theme.border_color} onChange={(v) => set({ border_color: v })} />
        <ColorField label="Surface" value={theme.surface_color} onChange={(v) => set({ surface_color: v })} />
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Contact labels</span>
        <div className="mt-1">
          <ChoiceGrid value={theme.contact_style === "icons" ? "auto" : theme.contact_style} options={CONTACT} onChange={(id) => set({ contact_style: id })} />
        </div>
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Border treatment</span>
        <div className="mt-1">
          <ChoiceGrid value={theme.border_style} options={BORDERS} onChange={(id) => set({ border_style: id })} cols={2} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Corner radius</Label>
          <Input value={theme.border_radius} onChange={(e) => set({ border_radius: e.target.value })} className="h-9 mt-1" placeholder="14px" />
        </div>
        <div>
          <Label className="text-xs">Typeface</Label>
          <select
            value={theme.font}
            onChange={(e) => set({ font: e.target.value })}
            className="w-full h-9 mt-1 rounded-sm border border-border bg-background px-2 text-sm"
          >
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {theme.border_style === "box" && (
        <ToggleRow label="Accent bar" hint="Gradient rule across the top of the panel." checked={theme.accent_bar} onChange={(v) => set({ accent_bar: v })} />
      )}
    </Section>
  );
}
