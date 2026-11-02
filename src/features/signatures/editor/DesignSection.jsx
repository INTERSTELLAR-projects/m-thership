import React, { useMemo } from "react";
import { Section, ChoiceGrid, RangeField } from "./Controls";
import { ICON_STYLES, ICON_SHAPES, ICON_LAYOUTS, ICON_ANIMS } from "@/features/signatures/lib/iconLibrary";
import { iconSwatch } from "@/features/signatures/lib/assetRender";

const SAMPLE = ["instagram", "facebook", "linkedin", "x", "tiktok", "youtube"];

export default function DesignSection({ theme, onTheme, fields }) {
  const set = (patch) => onTheme({ ...theme, ...patch });
  const chosen = SAMPLE.filter((id) => fields?.social?.[id]?.show);
  const ids = chosen.length ? chosen : SAMPLE.slice(0, 4);
  const size = Number(theme.icon_size) || 30;

  const swatches = useMemo(
    () =>
      ids.map((id) => ({
        id,
        src: iconSwatch({
          kind: "icon",
          platform: id,
          style: theme.icon_style,
          shape: theme.icon_shape,
          size,
          accent: theme.accent_color,
          bg: theme.border_style === "box" ? theme.surface_color : "#ffffff",
        }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids.join(","), theme.icon_style, theme.icon_shape, size, theme.accent_color, theme.surface_color, theme.border_style]
  );

  return (
    <Section title="Social icon design" hint="Real platform logos, rendered sharp at 2× and hosted for you.">
      <div className="flex flex-wrap items-center rounded-sm border border-border bg-white px-3 py-3" style={{ gap: theme.icon_gap }}>
        {swatches.map((s) => (
          <img key={s.id} src={s.src} alt={s.id} style={{ width: size, height: size }} />
        ))}
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Style</span>
        <div className="mt-1">
          <ChoiceGrid value={theme.icon_style} options={ICON_STYLES} onChange={(id) => set({ icon_style: id })} cols={4} />
        </div>
      </div>

      {theme.icon_style !== "logo" && (
        <div>
          <span className="text-xs text-muted-foreground">Shape</span>
          <div className="mt-1">
            <ChoiceGrid value={theme.icon_shape} options={ICON_SHAPES} onChange={(id) => set({ icon_shape: id })} />
          </div>
        </div>
      )}

      <RangeField label="Size" value={size} min={18} max={44} suffix="px" onChange={(v) => set({ icon_size: v })} />
      <RangeField label="Spacing" value={Number(theme.icon_gap) || 0} min={0} max={18} suffix="px" onChange={(v) => set({ icon_gap: v })} />

      <div>
        <span className="text-xs text-muted-foreground">Arrangement</span>
        <div className="mt-1">
          <ChoiceGrid value={theme.icon_layout} options={ICON_LAYOUTS} onChange={(id) => set({ icon_layout: id })} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">The Signature template always stacks icons in its side rail.</p>
      </div>

      <div>
        <span className="text-xs text-muted-foreground">Animation</span>
        <div className="mt-1">
          <ChoiceGrid value={theme.icon_anim} options={ICON_ANIMS} onChange={(id) => set({ icon_anim: id })} />
        </div>
      </div>
    </Section>
  );
}
