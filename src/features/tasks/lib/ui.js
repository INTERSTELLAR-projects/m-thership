// Light-theme form + button classes for the task engine (canvas / ink / hairline / flame).
export const inputClass =
  "h-9 w-full rounded-md border border-hair bg-card px-3 text-[12.5px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-[#ff3c00]";

export const textareaClass =
  "min-h-[82px] w-full rounded-md border border-hair bg-card px-3 py-2 text-[12.5px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-[#ff3c00]";

export const selectTriggerClass =
  "h-9 w-full rounded-md border border-hair bg-card px-3 text-[12.5px] text-ink outline-none transition-colors focus:border-[#ff3c00] focus:ring-0 focus:ring-offset-0";

export const selectContentClass = "rounded-md border border-hair bg-card text-ink";

export const selectItemClass = "text-[12.5px] focus:bg-[#ff3c00]/10 focus:text-ink";

export const dialogClass = "max-h-[92vh] overflow-y-auto rounded-md border border-hair bg-canvas text-ink sm:max-w-lg";

export const labelClass = "mono-label text-[9.5px] text-ink/50";

export const btnGhost =
  "inline-flex h-9 items-center gap-2 rounded-md border border-hair bg-card px-3 text-[12px] font-medium text-ink/70 transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40";

export const btnSmallFlame =
  "inline-flex h-9 items-center gap-2 rounded-md bg-[#ff3c00] px-3 text-[12px] font-medium text-white transition-colors hover:bg-ink disabled:opacity-40";

export const btnDanger =
  "inline-flex h-9 items-center gap-2 rounded-md border border-red-600/30 bg-card px-3 text-[12px] font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40";

export const cardClass = "bg-card border border-hair rounded-md";
