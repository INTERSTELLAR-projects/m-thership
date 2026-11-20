// Seasons & offers on the client page (Build Engine, Nov 19 2026). Shows what the client switched on in their portal,
// gives the site its public site_key (so the website can read its season + offers), and holds the ONE money gate:
// a checkout discount for an offer waits here for Justin's tap. The tap only approves it; the queue runner then
// creates the Stripe coupon / Shopify code with the offer's end date. Nothing is ever created automatically.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useList } from "@/lib/useData";
import { offerLabel, todayPacific } from "@/lib/siteExtras";

const newKey = () => {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};

export default function SeasonsOffersPanel({ client, me }) {
  const qc = useQueryClient();
  const seasonsQ = useList("SiteSeason", { filter: { client_id: client.id }, limit: 20, sort: "key" });
  const offersQ = useList("SiteOffer", { filter: { client_id: client.id }, limit: 30, sort: "-created_date" });
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const today = todayPacific();
  const active = (seasonsQ.data || []).find((s) => s.active);
  const run = async (id, fn) => { setBusy(id); setMsg(""); try { await fn(); await qc.invalidateQueries(); } catch (e) { setMsg(String(e?.message || e)); } setBusy(""); };

  const connect = () => run("key", () => base44.entities.CRMClient.update(client.id, { site_key: newKey() }));
  const approve = (o) => run(o.id, async () => {
    await base44.entities.SiteOffer.update(o.id, { discount_status: "approved", approved_by: me?.email || "justin", approved_at: new Date().toISOString() });
    await base44.entities.AgentAuditLog.create({ at: new Date().toISOString(), ok: true, actor: me?.email || "justin", action: "discount_approved", entity: "SiteOffer", record_id: o.id, summary: `Checkout discount approved: ${client.business} · ${o.title} (${offerLabel(o)}, ends ${o.ends_on})` }).catch(() => null);
  });
  const decline = (o) => run(o.id, () => base44.entities.SiteOffer.update(o.id, { discount_status: "declined" }));

  return (
    <div className="px-4 py-3 text-[12.5px]" data-testid="seasons-offers">
      {!client.site_key ? (
        <p className="text-ink/55">Not connected. The website reads its season and offers by a public site key.
          <button type="button" disabled={!!busy} onClick={connect} className="ml-2 border border-hair px-2 py-0.5 hover:border-[#ff3c00] hover:text-[#ff3c00]">Give the site a key</button>
        </p>
      ) : (
        <p className="text-ink/55">Connected. Site key: <span className="font-mono text-[11px]">{client.site_key}</span> (public, not a secret: the site sends it to site-config).</p>
      )}
      <p className="mt-2"><b className="font-medium">Season:</b> {active ? `${active.label} — "${active.banner_text}"` : "none on (site looks normal)"}</p>
      <ul className="mt-2 divide-y divide-hair border border-hair">
        {(offersQ.data || []).length ? offersQ.data.map((o) => {
          const live = o.status !== "ended" && o.starts_on <= today && today <= o.ends_on;
          return (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span><b className="font-medium">{o.title}</b> · {offerLabel(o)} · {o.starts_on} → {o.ends_on} · {o.status === "ended" ? "ended" : live ? "on the site" : o.starts_on > today ? "scheduled" : "past"}</span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[10.5px] text-ink/50">discount: {String(o.discount_status || "none").replace(/_/g, " ")}{o.discount_code ? ` (${o.discount_code})` : ""}</span>
                {o.discount_status === "awaiting_approval" && o.status !== "ended" ? (
                  <>
                    <button type="button" disabled={!!busy} onClick={() => approve(o)} className="bg-ink px-2 py-0.5 text-[11.5px] font-medium text-white hover:bg-[#ff3c00]">Approve discount</button>
                    <button type="button" disabled={!!busy} onClick={() => decline(o)} className="border border-hair px-2 py-0.5 text-[11.5px] hover:border-ink/40">No discount</button>
                  </>
                ) : null}
              </span>
            </li>
          );
        }) : <li className="px-3 py-2 text-ink/50">No offers yet. The client adds them in their portal (Seasons &amp; offers).</li>}
      </ul>
      <p className="mt-2 text-[11px] text-ink/45">Approving a discount is your tap on money: Claude then creates the Stripe coupon or Shopify code with the offer&apos;s end date on its next run. Nothing is created without it.</p>
      {msg ? <p className="mt-1 text-[11.5px] text-red-600">{msg}</p> : null}
    </div>
  );
}
