// Brand switcher in the Møthership header: Interstellar <-> DIALD <-> future brands. Opens each brand's dashboard.
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Orbit, Plus, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBrands } from "./useHouseData";
import { brandTheme, rootOf, childBrands } from "./graph";

export default function BrandSwitcher() {
  const { data: brands = [] } = useBrands();
  const location = useLocation();
  const navigate = useNavigate();
  const root = rootOf(brands);
  const list = [...(root ? [root] : []), ...childBrands(brands, root)];
  const m = location.pathname.match(/^\/brands\/([^/]+)/);
  const current = (m && list.find((b) => b.slug === decodeURIComponent(m[1]))) || root;
  const color = current ? brandTheme(current).primary : "#ff3c00";
  const label = current ? current.name.replace(/\s+Strategies$/i, "") : "Interstellar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="mr-3 flex h-[26px] shrink-0 items-center gap-1.5 rounded-full border border-hair bg-canvas px-2.5 text-[11.5px] font-medium text-ink/80 transition-colors hover:border-ink/30 hover:text-ink" aria-label={`Brand: ${label}. Switch brand dashboard`} data-testid="brand-switcher">
          <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <span className="max-w-[110px] truncate">{label}</span>
          <ChevronDown className="h-3 w-3 text-ink/45" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-[10px] font-normal uppercase tracking-[.14em] text-ink/45">Brand dashboards</DropdownMenuLabel>
        {list.map((b) => {
          const c = brandTheme(b).primary;
          const on = current && current.id === b.id && !!m;
          return (
            <DropdownMenuItem key={b.id} onSelect={() => navigate(`/brands/${b.slug}`)} className="cursor-pointer gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px]">{b.name}</span><span className="block truncate text-[11px] text-ink/45">{b.niche || ""}</span></span>
              {on ? <Check className="h-3.5 w-3.5 text-[#ff3c00]" /> : null}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/brands")} className="cursor-pointer gap-2.5"><Orbit className="h-3.5 w-3.5 text-[#ff3c00]" />House of Brands</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/brands?add=1")} className="cursor-pointer gap-2.5"><Plus className="h-3.5 w-3.5" />Add brand</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
