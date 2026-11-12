import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { HUBS, MORE_HUB, SETTINGS_ITEM } from "@/lib/nav";
import { PACKAGES, packagePath } from "@/features/packages/registry";

// /more — the occasional tools, plus an index of every page in the app grouped the way the sidebar is.
// Nothing is hidden: if it is not in the sidebar's seven hubs it is here, and ⌘K finds all of it.
function Section({ hub, items }) {
  return (
    <section className="min-w-0 border border-hair bg-paper/70">
      <header className="flex items-center gap-2 border-b border-hair px-4 py-3">
        <hub.icon className="h-4 w-4 text-[#ff3c00]" strokeWidth={1.75} />
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{hub.label}</h2>
        <span className="min-w-0 truncate text-[11.5px] text-ink/45">{hub.hint}</span>
      </header>
      <ul className="divide-y divide-hair/70">
        {items.map((t) => (
          <li key={t.key || t.path}>
            <Link to={t.path} className="group flex items-start gap-3 px-4 py-2.5 hover:bg-ink/[0.03]">
              {t.icon ? <t.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40 group-hover:text-[#ff3c00]" strokeWidth={1.75} /> : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-ink">{t.label}{t.arch ? <span className="ml-2 font-mono text-[9px] text-ink/35">{t.arch}</span> : null}</span>
                {t.hint ? <span className="block text-[11.5px] leading-snug text-ink/50">{t.hint}</span> : null}
              </span>
              <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/25 group-hover:text-ink" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function More() {
  const tools = MORE_HUB.tabs.filter((t) => t.path !== "/more");
  const packages = PACKAGES.map((p) => ({ key: p.key, label: p.label, icon: p.icon, path: packagePath(p.key), hint: p.tagline }));
  return (
    <div className="pb-16">
      <PageHeader breadcrumb="More / Everything" title="Every /Page" rightText="Nothing removed, just organised" />
      <div className="space-y-8 px-5 pt-6 md:px-8">
        <div>
          <p className="label-cross mb-3 text-ink/60">(Tools)</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {tools.map((t) => (
              <Link key={t.key} to={t.path} className="group flex flex-col gap-1 border border-hair bg-paper/70 px-4 py-3 hover:border-ink/40">
                <span className="flex items-center gap-2 text-[13.5px] font-medium">
                  <t.icon className="h-4 w-4 text-ink/45 group-hover:text-[#ff3c00]" strokeWidth={1.75} />
                  {t.label}
                  {t.arch ? <span className="ml-auto font-mono text-[9px] text-ink/35">{t.arch}</span> : null}
                </span>
                <span className="text-[11.5px] leading-snug text-ink/50">{t.hint}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="label-cross mb-3 text-ink/60">(Every page, by hub)</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {HUBS.map((hub) => <Section key={hub.id} hub={hub} items={hub.id === "work" ? [...hub.tabs, ...packages.map((p) => ({ ...p, label: "Package · " + p.label }))] : hub.tabs} />)}
            <Section hub={{ ...SETTINGS_ITEM, label: "Settings", hint: SETTINGS_ITEM.hint }} items={[SETTINGS_ITEM]} />
          </div>
        </div>
      </div>
    </div>
  );
}
