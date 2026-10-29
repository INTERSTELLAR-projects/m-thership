import React from 'react';
import { Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SLIDE_THEMES, CUSTOM_THEME_ID, DEFAULT_CUSTOM_BRAND, normalizeBrand } from '@/features/presentations/lib/slideThemes';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-14 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <span className="relative h-7 w-7 flex-none overflow-hidden rounded-md border border-border">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute -left-1 -top-1 h-10 w-10 cursor-pointer border-0 bg-transparent p-0"
          aria-label={label}
        />
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-24 font-mono text-[11px] uppercase"
      />
    </div>
  );
}

export default function ThemePicker({ value, brand, onChange, onBrandChange }) {
  const customBrand = normalizeBrand(brand || DEFAULT_CUSTOM_BRAND);
  const isCustom = value === CUSTOM_THEME_ID;

  const update = (patch) => onBrandChange({ ...customBrand, ...patch });

  return (
    <div className="flex items-center gap-1.5">
      {SLIDE_THEMES.map((theme) => {
        const active = theme.id === value;
        return (
          <button
            key={theme.id}
            type="button"
            title={theme.name}
            onClick={() => onChange(theme.id)}
            className={`relative h-7 w-7 overflow-hidden rounded-full border transition-all ${
              active ? 'scale-105 border-transparent ring-2 ring-highlight' : 'border-border hover:scale-105'
            }`}
          >
            <span className="absolute inset-0" style={{ background: theme.swatch[0] }} />
            <span
              className="absolute bottom-0 left-0 right-0 h-[38%]"
              style={{ background: theme.swatch[1] }}
            />
          </button>
        );
      })}

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Custom brand colors"
            onClick={() => onChange(CUSTOM_THEME_ID)}
            className={`relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border transition-all ${
              isCustom ? 'scale-105 border-transparent ring-2 ring-highlight' : 'border-border hover:scale-105'
            }`}
            style={{
              background: `conic-gradient(from 140deg, ${customBrand.bg}, ${customBrand.accent}, ${customBrand.fg}, ${customBrand.bg})`
            }}
          >
            <Palette className="h-3.5 w-3.5 text-white drop-shadow" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium">Custom brand</p>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Custom theme</span>
          </div>
          <div className="space-y-2">
            <ColorRow label="BG" value={customBrand.bg} onChange={(v) => update({ bg: v })} />
            <ColorRow label="Text" value={customBrand.fg} onChange={(v) => update({ fg: v })} />
            <ColorRow label="Accent" value={customBrand.accent} onChange={(v) => update({ accent: v })} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Mode</Label>
              <div className="flex overflow-hidden rounded-md border border-border">
                {['light', 'dark'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => update({ mode: m })}
                    className={`flex-1 px-2 py-1 text-[11px] capitalize transition-colors ${
                      customBrand.mode === m ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Headings</Label>
              <div className="flex overflow-hidden rounded-md border border-border">
                {[
                  { id: 'sans', label: 'Sans' },
                  { id: 'serif', label: 'Serif' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => update({ headingFont: f.id })}
                    className={`flex-1 px-2 py-1 text-[11px] transition-colors ${
                      customBrand.headingFont === f.id ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
