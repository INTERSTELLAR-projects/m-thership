import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { packagePath } from "@/features/packages/registry";
import { btnGhost } from "@/features/tasks/lib/ui";
import { cn } from "@/lib/utils";

const money = (n, cents = false) => "$" + (Number(n) || 0).toLocaleString("en-US", cents ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });

/*
 * Mission Control, top of the page: money this month and who is subscribed — straight from Stripe.
 *   left   revenue this month: subscriptions · other · fees · net to bank
 *   right  HyperCare+ and GravïtyCare: subscribers + MRR, then every subscriber with their amount
 */
export default function RevenueStrip() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("stripeSubscriptions", {});
      setData(res.data);
      if (res.data && res.data.error) setError(res.data.error);
    } catch (e) {
      setError((e && e.response && e.response.data && e.response.data.error) || "Could not reach Stripe");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const sync = async () => {
    setSyncing(true);
    setSyncNote("");
    try {
      const res = await base44.functions.invoke("stripeSync", {});
      const r = res.data || {};
      setSyncNote(`${r.synced || 0} client(s) updated from Stripe${r.unmatched && r.unmatched.length ? ` · ${r.unmatched.length} subscription(s) not matched to a client` : ""}`);
      load();
    } catch (e) {
      setSyncNote("Sync failed: " + ((e && e.response && e.response.data && e.response.data.error) || "could not reach Stripe"));
    } finally {
      setSyncing(false);
    }
  };

  const m = (data && data.month) || {};
  const plans = (data && data.plans) || {};
  const subs = (data && data.subscriptions) || [];
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="px-5 pt-6 md:px-8">
      <div className="mb-3 flex items-center justify-between">
        <p className="label-cross text-[10.5px] text-ink/60">(Revenue · {monthLabel} · live from Stripe)</p>
        <div className="flex items-center gap-2">
          {syncNote ? <span className="text-[10.5px] text-ink/55">{syncNote}</span> : null}
          <button type="button" onClick={sync} disabled={syncing || !data || !data.configured} className={btnGhost + " h-7 px-2.5 text-[11px]"} title="Rewrite every client's billing lines from their Stripe subscription">
            <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync Stripe → clients"}
          </button>
          <button type="button" onClick={load} className={btnGhost + " h-7 px-2.5 text-[11px]"}>
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {data && !data.configured ? (
        <div className="rounded-md border border-hair bg-card px-5 py-4 text-[12.5px] text-ink/60">Stripe isn't connected yet — add STRIPE_SECRET_KEY in Secrets and this fills in.</div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-md border border-[#ff3c00]/40 bg-card px-5 py-4 text-[12.5px] text-ink/70">
          <AlertTriangle className="h-4 w-4 text-[#ff3c00]" /> {error}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          {/* Left: this month */}
          <div className="relative overflow-hidden rounded-md border border-hair bg-ink text-white">
            <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />
            <div className="grid grid-cols-2 divide-x divide-white/10">
              <div className="px-5 py-5">
                <p className="mono-label text-[8.5px] text-white/50">Subscriptions this month</p>
                <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.04em]">{loading && !data ? "—" : money(m.subscriptions)}</p>
                <p className="mt-1.5 text-[10.5px] text-white/50">{m.invoices || 0} invoices paid</p>
              </div>
              <div className="px-5 py-5">
                <p className="mono-label text-[8.5px] text-white/50">Other revenue this month</p>
                <p className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.04em]">{loading && !data ? "—" : money(m.other)}</p>
                <p className="mt-1.5 text-[10.5px] text-white/50">builds, one-offs, anything not recurring</p>
              </div>
            </div>
            <div className="grid grid-cols-4 divide-x divide-white/10 border-t border-white/10">
              {[["Collected", money(m.collected)], ["Stripe fees", "-" + money(m.fees, true)], ["Capital", m.capital ? "-" + money(m.capital, true) : "—"], ["Net to bank", money(m.net, true)]].map(([k, v]) => (
                <div key={k} className="px-4 py-2.5">
                  <p className="mono-label text-[8px] text-white/45">{k}</p>
                  <p className={cn("mt-0.5 font-mono text-[12.5px] tabular-nums", k === "Net to bank" ? "text-[#ffaa00]" : "text-white/85")}>{loading && !data ? "—" : v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: subscriptions */}
          <div className="overflow-hidden rounded-md border border-hair bg-card">
            <div className="grid grid-cols-3 divide-x divide-hair border-b border-hair">
              {[
                ["HyperCare+", plans.hypercare, packagePath("orbit-seo"), "#ff3c00"],
                ["GravïtyCare", plans.gravitycare, packagePath("gravitycare"), "#1a1a1a"],
                ["Special arrangements", { count: ["appcare", "manage", "mission", "website", "other"].reduce((n, k) => n + ((plans[k] && plans[k].count) || 0), 0), mrr: ["appcare", "manage", "mission", "website", "other"].reduce((n, k) => n + ((plans[k] && plans[k].mrr) || 0), 0) }, null, "#8a8580"]
              ].map(([k, p, to, c]) => {
                const inner = (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-[12.5px] font-semibold tracking-[-0.01em]">{k}</p>
                      {to ? <ArrowUpRight className="h-3.5 w-3.5 text-ink/30 group-hover:text-[#ff3c00]" /> : null}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-[26px] font-semibold leading-none tracking-[-0.04em]" style={{ color: c }}>{p ? p.count : 0}</p>
                      <p className="text-[10.5px] text-ink/45">{k === "Special arrangements" ? "AppCare · Manage+ · financed missions" : "subscribers"}</p>
                    </div>
                    <p className="mt-1 font-mono text-[11.5px] tabular-nums text-ink/70">{money(p ? p.mrr : 0)}<span className="text-ink/40">/mo</span></p>
                  </>
                );
                return to ? (
                  <Link key={k} to={to} className="group px-4 py-3.5 transition-colors hover:bg-ink/[0.03]">{inner}</Link>
                ) : (
                  <div key={k} className="px-4 py-3.5">{inner}</div>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-4 py-2 text-[10.5px] text-ink/50">
              <span>
                MRR <span className="font-mono text-ink">{money(data ? data.mrr : 0)}</span> across {subs.length} live subscriptions
              </span>
              {data && data.unmatched ? <span className="text-[#ff3c00]">{data.unmatched} not matched to a client</span> : null}
            </div>
            <div className="max-h-[172px] divide-y divide-hair overflow-y-auto border-t border-hair">
              {subs.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-1.5 text-[11.5px]">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.status === "active" ? "bg-ink" : "bg-[#ff3c00]")} title={s.status} />
                  <span className="min-w-0 flex-1 truncate">
                    {s.client ? (
                      <Link to={"/clients/" + s.client.id} className="hover:text-[#ff3c00]">{s.client.business}</Link>
                    ) : (
                      <span className="text-[#ff3c00]">{s.customer.name || s.customer.email || s.customer.id} · no client match</span>
                    )}
                  </span>
                  <span className="hidden truncate text-[10px] text-ink/45 sm:inline">{s.lines.map((l) => l.name).join(" + ")}</span>
                  {s.cancel_at_period_end ? <span className="mono-label text-[8px] text-[#ff3c00]">ends {s.current_period_end}</span> : null}
                  <span className="font-mono text-[11.5px] tabular-nums">{money(s.mrr)}<span className="text-ink/40">/mo</span></span>
                </div>
              ))}
              {!loading && !subs.length ? <p className="px-4 py-4 text-[11.5px] text-ink/45">No live subscriptions in Stripe.</p> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
