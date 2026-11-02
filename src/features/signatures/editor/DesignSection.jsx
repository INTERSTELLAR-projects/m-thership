import React from "react";
import { Section, ToggleRow, ChoiceGrid, RangeField } from "./Controls";
import { ICON_STYLES, ICON_SHAPES, ICON_LAYOUTS, ICON_SIZES, getIconSpec } from "@/features/signatures/lib/iconLibrary";

const PREVIEW = ["instagram", "linkedin", "x", "youtube"];

function IconSample({ id, theme }) {
  const s = getIconSpec(id, theme);
  if (!s.url) return null;
  if (!s.bubble) return <img src={s.url} alt="" style={{ width: s.img, height: s.img, display: "block" }} />;
  return (
    <span
      style={{
        width: s.box,
        height: s.box,
        borderRadius: s.radius,
        background: s.bg,
        border: s.border,
        padding: s.pad,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img src={s.url} alt="" style={{ width: s.img, height: s.img, display: "block" }} />
    </span>
  );
}

export default function DesignSection({ theme, onTheme, fields, onFields }) {
  const set = (patch) => onTheme({ ...theme, ...patch });

  return (
    <Section title="Social icon design" hint="Every network icon picks these up at once.">
      <div className="flex items-center gap-2 rounded-sm border border-border bg-muted/40 px-3 py-3">
        {PREVIEW.map((id) => (
          <IconSample key={id} id={id} theme={theme} />
        ))}
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Style</span>
        <div className="mt-1">
          <ChoiceGrid
            value={theme.icon_style}
            options={ICON_STYLES}
            onChange={(id) => set({ icon_style: id })}
          />
        </div>
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Shape</span>
        <div className="mt-1">
          <ChoiceGrid value={theme.icon_shape} options={ICON_SHAPES} onChange={(id) => set({ icon_shape: id })} />
        </div>
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Size</span>
        <div className="mt-1">
          <ChoiceGrid
            value={theme.icon_size}
            options={ICON_SIZES.map((n) => ({ id: n, label: String(n) }))}
            onChange={(id) => set({ icon_size: Number(id) })}
            cols={4}
          />
        </div>
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Arrangement</span>
        <div className="mt-1">
          <ChoiceGrid value={theme.icon_layout} options={ICON_LAYOUTS} onChange={(id) => set({ icon_layout: id })} />
        </div>
      </div>

      <RangeField label="Spacing" value={theme.icon_gap} min={0} max={18} suffix="px" onChange={(v) => set({ icon_gap: v })} />

      <ToggleRow
        label="Verified check next to name"
        checked={fields?.verified_badge !== false}
        onChange={(v) => fields && onFields({ ...fields, verified_badge: v })}
      />

      <ToggleRow
        label="Animated verified check"
        hint="Brighter blue with a live shine and pulse in modern mail apps."
        checked={theme.badge_animated !== false}
        onChange={(v) => set({ badge_animated: v })}
      />
    </Section>
  );
}