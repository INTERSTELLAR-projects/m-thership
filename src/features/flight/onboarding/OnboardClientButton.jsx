import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plane, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { dialogClass, inputClass, btnSmallFlame } from "@/features/tasks/lib/ui";
import { packagePath } from "@/features/packages/registry";
import { createFlight } from "./store";

// Start a flight plan for any CRM client (leads included) straight from a package page.
export default function OnboardClientButton({ pkg, clients = [], flights = [], onCreated }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();
  const has = useMemo(() => new Set(flights.filter((f) => f.package_key === pkg.key && f.status !== "archived").map((f) => f.client_id)), [flights, pkg.key]);
  const list = clients
    .filter((c) => c.status !== "Inactive")
    .filter((c) => !q.trim() || String(c.business || "").toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 60);

  const pick = async (c) => {
    setBusy(c.id);
    setErr("");
    try {
      if (!has.has(c.id)) {
        const existing = await base44.entities.OnboardingFlight.filter({ client_id: c.id, package_key: pkg.key }, "-created_date", 1).catch(() => []);
        if (!(Array.isArray(existing) ? existing : []).length) await createFlight(c, pkg);
      }
      if (onCreated) onCreated();
      setOpen(false);
      navigate(packagePath(pkg.key) + "/" + c.id);
    } catch (e) {
      setErr(e.message || "Could not start the flight plan");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnSmallFlame}>
        <Plane className="h-3.5 w-3.5" /> Onboard a client
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle>Onboard a client onto {pkg.label}</DialogTitle>
            <DialogDescription>Starts the flight plan: every piece of info this package needs, collected once, prefilled from what is on file.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client or lead" className={inputClass + " pl-8"} />
          </div>
          <ul className="max-h-[50vh] divide-y divide-hair overflow-y-auto rounded-md border border-hair bg-card">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => pick(c)} disabled={Boolean(busy)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[12.5px] hover:bg-ink/[0.03] disabled:opacity-50">
                  <span className="min-w-0 truncate">{c.business}</span>
                  <span className="mono-label shrink-0 text-[8.5px] text-ink/45">
                    {busy === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : has.has(c.id) ? "flight open" : c.status || ""}
                  </span>
                </button>
              </li>
            ))}
            {!list.length ? <li className="px-3 py-4 text-[12px] text-ink/50">No match. Add them in the CRM first.</li> : null}
          </ul>
          {err ? <p className="text-[12px] text-red-700">{err}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
