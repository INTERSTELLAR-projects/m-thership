import { Workflow, Smartphone, MousePointerClick, Package, Shirt, Printer, Megaphone, Film, Target, Layers, Coins } from "lucide-react";
import { CREDIT_CATEGORIES, CREDIT_GROUPS } from "@/lib/prestige";

export const CREDIT_ICONS = {
  automation: Workflow,
  app_upgrade: Smartphone,
  website_feature: MousePointerClick,
  addon_package: Package,
  merch: Shirt,
  marketing_materials: Printer,
  social_posts: Megaphone,
  video: Film,
  ad_spend: Target,
};

// "Where your credits go": two groups (stack for builds / up to $500 each) as small tiles.
export default function CreditTiles({ dark = false }) {
  const box = dark ? "border-white/10 bg-white/[0.04]" : "border-hair bg-card";
  const tile = dark ? "border-white/10 bg-black/20" : "border-hair bg-ink/[0.02]";
  const muted = dark ? "text-white/55" : "text-ink/55";
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CREDIT_GROUPS.map((g) => {
        const GroupIcon = g.key === "build" ? Layers : Coins;
        return (
          <div key={g.key} className={`rounded-md border p-4 ${box}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center flame-bg text-white"><GroupIcon className="h-3.5 w-3.5" /></span>
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.02em]">{g.label}</p>
                <p className={`text-[12px] leading-snug ${muted}`}>{g.detail}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CREDIT_CATEGORIES.filter((c) => c.group === g.key).map((c) => {
                const Icon = CREDIT_ICONS[c.key] || Coins;
                return (
                  <div key={c.key} className={`rounded-md border px-3 py-2.5 ${tile}`}>
                    <Icon className="h-3.5 w-3.5 text-[#ff3c00]" />
                    <p className="mt-1.5 text-[12.5px] font-semibold leading-tight">{c.label}</p>
                    <p className={`mt-0.5 text-[11px] leading-snug ${muted}`}>{c.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
