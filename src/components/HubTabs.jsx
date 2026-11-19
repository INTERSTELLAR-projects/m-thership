import { Link, useLocation } from "react-router-dom";
import { hubFor } from "@/lib/nav";
import { useNavBadges } from "@/components/navBadges";

// The tab bar every hub page shares (Today, Clients, Work, Marketing, Sales, Money, Agents, More).
// Sits under the time-zone bar (not sticky, so it never covers a page's own sticky toolbars) and carries the open tab's purpose line,
// so every page says what it is for in the same place. Pages outside a hub (Settings) render without it.
export default function HubTabs() {
  const location = useLocation();
  const badges = useNavBadges();
  const here = hubFor(location);
  if (!here) return null;
  const { hub, tab } = here;
  // Inside one client (/clients/:id) the Clients tab bar is scoped to that client: Messages opens only their thread,
  // Requests only theirs, Portal only their portal (preview as them). The cross-client pages stay one click away
  // from the Clients list.
  const inClient = location.pathname.match(/^\/clients\/([^/]+)/);
  const scoped = (t) => {
    if (!inClient || hub.id !== "clients") return t;
    const id = inClient[1];
    if (t.path === "/comms") return { ...t, path: `/clients/${id}?tab=messages`, label: "Messages", hint: "This client's thread only" };
    if (t.path === "/requests") return { ...t, path: `/clients/${id}?tab=requests`, hint: "This client's requests only" };
    if (t.path === "/settings?tab=portal") return { ...t, path: `/portal/${id}`, label: "Their portal", hint: "Preview this client's portal as them" };
    return t;
  };

  return (
    <div data-no-trail data-hub-tabs={hub.id} className="relative z-[15] border-b border-hair bg-canvas/95">
      <nav className="no-scrollbar flex items-center gap-0.5 overflow-x-auto px-3 md:px-6" aria-label={`${hub.label} pages`}>
        <span className="mono-label mr-2 hidden shrink-0 items-center gap-1.5 text-[9.5px] text-ink/45 sm:flex">
          <hub.icon className="h-3 w-3 text-[#ff3c00]" strokeWidth={2} />
          {hub.label}
        </span>
        {hub.tabs.map(scoped).map((t) => {
          const on = t.key === tab.key && !(inClient && hub.id === "clients" && t.path.startsWith("/clients/") === false && t.key !== "/crm");
          const n = t.badge ? badges[t.badge] : 0;
          return (
            <Link
              key={t.key}
              to={t.path}
              aria-current={on ? "page" : undefined}
              className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[12.5px] transition-colors ${on ? "font-medium text-ink" : "text-ink/50 hover:text-ink"}`}
            >
              <t.icon className={`h-3.5 w-3.5 ${on ? "text-[#ff3c00]" : "text-ink/35"}`} strokeWidth={1.75} />
              {t.label}
              {n ? <span className="rounded-sm bg-[#ff3c00]/[0.12] px-1 font-mono text-[9.5px] font-semibold tabular-nums text-[#c24100]">{n > 99 ? "99+" : n}</span> : null}
              {on ? <span className="absolute inset-x-3 bottom-[-1px] h-[2px] bg-[#ff3c00]" /> : null}
            </Link>
          );
        })}
        {tab.hint ? <span className="ml-auto hidden min-w-0 shrink truncate pl-6 text-[11.5px] text-ink/45 xl:block">{tab.hint}</span> : null}
      </nav>
      {tab.hint && <p className="truncate border-t border-hair/60 px-4 py-1.5 text-[11.5px] text-ink/55 md:px-7 xl:hidden">{tab.hint}</p>}
    </div>
  );
}
