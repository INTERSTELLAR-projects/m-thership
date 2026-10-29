import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, MinusCircle, ArrowUpRight, Radio, Inbox, Cpu } from "lucide-react";
import { useList, timeAgo, fmtDate, WORK_KINDS, SERVICE_LABELS } from "@/lib/useData";

const RUN_ICON = {
  success: <CheckCircle2 className="h-4 w-4 text-green-700" />,
  failed: <XCircle className="h-4 w-4 text-red-600" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-[#ff3c00]" />,
  skipped: <MinusCircle className="h-4 w-4 text-ink/40" />,
};

function Panel({ label, title, icon: Icon, action, children, className = "" }) {
  return (
    <section className={`flex min-h-[320px] flex-col rounded-md border border-hair bg-card ${className}`}>
      <header className="flex items-center justify-between border-b border-hair px-4 py-3">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="h-4 w-4 text-[#ff3c00]" strokeWidth={1.75} />}
          <div>
            <p className="mono-label text-[9.5px] text-ink/50">{label}</p>
            <h3 className="text-[15px] font-semibold tracking-[-0.02em]">{title}</h3>
          </div>
        </div>
        {action}
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return <p className="px-4 py-8 text-center text-[13px] leading-relaxed text-ink/55">{children}</p>;
}

export default function LiveOps() {
  const runs = useList("AutomationRun", { sort: "-started_at", limit: 40 });
  const work = useList("WorkLog", { sort: "-date", limit: 40 });
  const autos = useList("Automation", { sort: "-last_run_at", limit: 200 });
  const reqs = useList("ClientRequest", { sort: "-created_date", limit: 100 });

  const feed = [
    ...(runs.data || []).map((r) => ({
      id: `r${r.id}`, at: r.started_at || r.created_date, kind: "run", status: r.status,
      title: `${r.kind ? WORK_KINDS[r.kind] || r.kind : "Automation"} ${r.status === "success" ? "ran" : r.status}`,
      sub: r.message, client: r.client_name, url: r.output_url,
    })),
    ...(work.data || []).filter((w) => w.source !== "automation").map((w) => ({
      id: `w${w.id}`, at: w.date || w.created_date, kind: "work", status: w.status === "failed" ? "failed" : "success",
      title: `${WORK_KINDS[w.kind] || "Work"}: ${w.title}`, client: w.client_name, url: w.url,
    })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 30);

  const all = autos.data || [];
  const errored = all.filter((a) => a.status === "error" || a.last_result === "failed");
  const active = all.filter((a) => a.status === "active").length;
  const open = (reqs.data || []).filter((r) => !["complete", "declined"].includes(r.status));

  return (
    <div className="px-5 pt-6 md:px-8">
      <div className="mb-4 flex items-end justify-between">
        <p className="label-cross">(Live operations)</p>
        <p className="mono-label text-[10px] text-ink/45">Automations · work · requests across every client</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        <Panel label="Feed" title="What just happened" icon={Radio}>
          {feed.length === 0 ? (
            <Empty>Nothing reported yet. Each blog, GBP post, project page and site edit will land here the moment its automation reports in, or when you log work on a client.</Empty>
          ) : (
            <ul className="divide-y divide-hair">
              {feed.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5">{RUN_ICON[e.status] || RUN_ICON.success}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{e.title}</p>
                    <p className="truncate text-[12px] text-ink/55">
                      {e.client}{e.sub ? ` · ${e.sub}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-[10.5px] text-ink/45">{timeAgo(e.at)}</span>
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noreferrer" className="text-ink/40 hover:text-[#ff3c00]" title="Open">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="Automations" title={`${active} running · ${errored.length} need you`} icon={Cpu}>
          {all.length === 0 ? (
            <Empty>No automations registered yet. Add each client&apos;s blog, GBP and project-page automations from their cockpit so they show here.</Empty>
          ) : (
            <ul className="divide-y divide-hair">
              {[...errored, ...all.filter((a) => !errored.includes(a))].slice(0, 14).map((a) => (
                <li key={a.id}>
                  <Link to={`/clients/${a.client_id}?tab=automations`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink/[0.03]">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${a.status === "error" || a.last_result === "failed" ? "bg-red-600" : a.status === "active" ? "bg-green-600" : "bg-ink/30"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{a.name}</p>
                      <p className="truncate text-[11.5px] text-ink/55">{a.client_name} · {a.schedule || a.runner}</p>
                    </div>
                    <span className="font-mono text-[10.5px] text-ink/45">{a.last_run_at ? timeAgo(a.last_run_at) : "never"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          label="Requests"
          title={`${open.length} open`}
          icon={Inbox}
          action={<Link to="/requests" className="mono-label text-[10px] text-ink/50 hover:text-[#ff3c00]">All →</Link>}
        >
          {open.length === 0 ? (
            <Empty>No open requests. Site edits and project submissions from client portals queue here.</Empty>
          ) : (
            <ul className="divide-y divide-hair">
              {open.slice(0, 12).map((r) => (
                <li key={r.id}>
                  <Link to={`/clients/${r.client_id}?tab=requests`} className="block px-4 py-2.5 hover:bg-ink/[0.03]">
                    <div className="flex items-center gap-2">
                      <span className={`mono-label px-1.5 py-0.5 text-[9px] ${r.status === "received" ? "bg-[#ff3c00] text-white" : "bg-ink/[0.07] text-ink/70"}`}>
                        {r.status.replace("_", " ")}
                      </span>
                      <span className="mono-label text-[9px] text-ink/45">{r.kind?.replace("_", " ")}</span>
                    </div>
                    <p className="mt-1 truncate text-[13px] font-medium">{r.title}</p>
                    <p className="truncate text-[11.5px] text-ink/55">{r.client_name} · {fmtDate(r.created_date)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function ClientHealthStrip() {
  const clients = useList("CRMClient", { sort: "business", limit: 200 });
  const autos = useList("Automation", { limit: 500 });
  const reqs = useList("ClientRequest", { limit: 500 });
  const work = useList("WorkLog", { sort: "-date", limit: 500 });
  const active = (clients.data || []).filter((c) => c.status === "Active");
  if (!active.length) return null;
  const monthStart = new Date(); monthStart.setDate(1);
  const ms = monthStart.toISOString().slice(0, 10);

  return (
    <div className="px-5 pt-8 md:px-8">
      <div className="mb-4 flex items-end justify-between">
        <p className="label-cross">(Clients)</p>
        <Link to="/crm" className="mono-label text-[10px] text-ink/50 hover:text-[#ff3c00]">All clients →</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {active.map((c) => {
          const a = (autos.data || []).filter((x) => x.client_id === c.id);
          const bad = a.some((x) => x.status === "error" || x.last_result === "failed");
          const open = (reqs.data || []).filter((r) => r.client_id === c.id && !["complete", "declined"].includes(r.status)).length;
          const done = (work.data || []).filter((w) => w.client_id === c.id && (w.date || "") >= ms).length;
          return (
            <Link key={c.id} to={`/clients/${c.id}`} className="card-hover group rounded-md border border-hair bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14.5px] font-semibold leading-tight tracking-[-0.02em]">{c.business}</p>
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${bad ? "bg-red-600" : a.length ? "bg-green-600" : "bg-ink/25"}`} title={bad ? "An automation failed" : a.length ? "Automations healthy" : "No automations yet"} />
              </div>
              <p className="mt-1 truncate text-[11.5px] text-ink/50">{c.domain || c.websites?.[0] || "—"}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {(c.services_managed || []).map((s) => (
                  <span key={s} className="mono-label border border-hair px-1.5 py-0.5 text-[8.5px] text-ink/60">{SERVICE_LABELS[s] || s}</span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 border-t border-hair pt-3 text-center">
                <div><p className="text-[18px] font-semibold tabular-nums">{done}</p><p className="mono-label text-[8.5px] text-ink/45">This month</p></div>
                <div><p className="text-[18px] font-semibold tabular-nums">{a.length}</p><p className="mono-label text-[8.5px] text-ink/45">Automations</p></div>
                <div><p className={`text-[18px] font-semibold tabular-nums ${open ? "text-[#ff3c00]" : ""}`}>{open}</p><p className="mono-label text-[8.5px] text-ink/45">Requests</p></div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
