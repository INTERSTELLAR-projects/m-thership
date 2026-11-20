// Client portal: Seasons & offers (Build Engine, Nov 19 2026). The client flips a season on and their website's
// banner, accent and featured section switch; off reverts it. Offers show on the site between their dates. The
// matching checkout discount is set up by Interstellar after Justin approves it (money: never automatic).
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function PortalSeasons({ call }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState({});
  const [offer, setOffer] = useState({ title: "", kind: "percent", value: "", starts_on: "", ends_on: "", description: "" });

  const load = () => call("seasons").then((r) => { setD(r); setErr(""); }).catch((e) => setErr(String(e?.message || e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (what, action, args) => {
    setBusy(what); setMsg(""); setErr("");
    try { const r = await call(action, args); if (r?.note) setMsg(r.note); await load(); return r; }
    catch (e) { setErr(String(e?.message || e)); }
    finally { setBusy(""); }
  };

  if (!d) return <p className="text-[13px] text-ink/55">{err || "Loading…"}</p>;
  const byKey = new Map((d.seasons || []).map((s) => [s.key, s]));
  const off = !d.supported;

  return (
    <div className="space-y-6" data-testid="portal-seasons">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.03em]">Seasons &amp; offers</h2>
        <p className="mt-1 text-[13px] text-ink/60">Switch your website into a season or holiday look, and run offers with an end date. Turn a season off and your site goes back to normal.</p>
        {off ? <p className="mt-2 rounded-md border border-hair bg-paper px-3 py-2 text-[12.5px] text-ink/60">Your website isn&apos;t connected to seasons and offers yet. Send us a request and we&apos;ll switch it on.</p> : null}
      </div>

      <section>
        <h3 className="mb-2 text-[15px] font-semibold">Season or holiday</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(d.presets || []).map((p) => {
            const row = byKey.get(p.key);
            const on = !!row?.active;
            const e = edit[p.key] || {};
            return (
              <li key={p.key} className={`rounded-md border p-3 ${on ? "border-[#ff3c00]/40 bg-[#ff3c00]/[0.04]" : "border-hair"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[14px] font-medium"><span className="h-3 w-3 rounded-full border border-ink/10" style={{ background: row?.accent || p.accent || "#ddd" }} />{row?.label || p.label}</span>
                  <button type="button" role="switch" aria-checked={on} disabled={off || !!busy} onClick={() => run(p.key, "season_set", { key: p.key, active: !on, banner_text: e.banner_text ?? row?.banner_text, accent: e.accent ?? row?.accent, featured_title: e.featured_title ?? row?.featured_title, featured_text: e.featured_text ?? row?.featured_text, label: e.label ?? row?.label })} className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-[#ff3c00]" : "bg-ink/20"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                    {busy === p.key ? <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-white" /> : null}
                  </button>
                </div>
                <details className="mt-2 text-[12.5px]">
                  <summary className="cursor-pointer text-ink/55">Banner and featured section</summary>
                  <div className="mt-2 grid gap-1.5">
                    {p.key === "custom" ? <input className="rounded border border-hair px-2 py-1" placeholder="Name (e.g. Grand opening)" defaultValue={row?.label || ""} onChange={(ev) => setEdit({ ...edit, [p.key]: { ...e, label: ev.target.value } })} /> : null}
                    <input className="rounded border border-hair px-2 py-1" placeholder={p.banner || "Banner text"} defaultValue={row?.banner_text || ""} maxLength={140} onChange={(ev) => setEdit({ ...edit, [p.key]: { ...e, banner_text: ev.target.value } })} />
                    <label className="flex items-center gap-2 text-ink/55">Accent <input type="color" defaultValue={row?.accent || p.accent || "#ff3c00"} onChange={(ev) => setEdit({ ...edit, [p.key]: { ...e, accent: ev.target.value } })} /></label>
                    <input className="rounded border border-hair px-2 py-1" placeholder="Featured title (optional)" defaultValue={row?.featured_title || ""} maxLength={80} onChange={(ev) => setEdit({ ...edit, [p.key]: { ...e, featured_title: ev.target.value } })} />
                    <textarea className="rounded border border-hair px-2 py-1" rows={2} placeholder="Featured text (optional)" defaultValue={row?.featured_text || ""} maxLength={280} onChange={(ev) => setEdit({ ...edit, [p.key]: { ...e, featured_text: ev.target.value } })} />
                    <button type="button" disabled={off || !!busy} onClick={() => run(p.key, "season_set", { key: p.key, active: on, ...row, ...e })} className="justify-self-start rounded border border-hair px-2.5 py-1 hover:border-[#ff3c00] disabled:opacity-40">Save</button>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-[15px] font-semibold">Offers</h3>
        <form className="grid gap-2 rounded-md border border-hair p-3 sm:grid-cols-2" onSubmit={async (ev) => { ev.preventDefault(); const r = await run("offer", "offer_save", offer); if (r?.ok) setOffer({ title: "", kind: "percent", value: "", starts_on: "", ends_on: "", description: "" }); }}>
          <input required className="rounded border border-hair px-2 py-1.5 text-[13px] sm:col-span-2" placeholder="What's the offer? (e.g. Spring cleanup special)" value={offer.title} maxLength={80} onChange={(e) => setOffer({ ...offer, title: e.target.value })} />
          <div className="flex gap-2">
            <select className="rounded border border-hair px-2 py-1.5 text-[13px]" value={offer.kind} onChange={(e) => setOffer({ ...offer, kind: e.target.value })}><option value="percent">% off</option><option value="amount">$ off</option></select>
            <input required type="number" min="1" step="0.01" className="w-28 rounded border border-hair px-2 py-1.5 text-[13px]" placeholder={offer.kind === "percent" ? "15" : "50"} value={offer.value} onChange={(e) => setOffer({ ...offer, value: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 text-[12.5px] text-ink/60">
            <input required type="date" className="rounded border border-hair px-2 py-1" value={offer.starts_on} onChange={(e) => setOffer({ ...offer, starts_on: e.target.value })} /> to
            <input required type="date" className="rounded border border-hair px-2 py-1" value={offer.ends_on} onChange={(e) => setOffer({ ...offer, ends_on: e.target.value })} />
          </div>
          <input className="rounded border border-hair px-2 py-1.5 text-[13px] sm:col-span-2" placeholder="Details (optional)" value={offer.description} maxLength={280} onChange={(e) => setOffer({ ...offer, description: e.target.value })} />
          <button type="submit" disabled={off || !!busy} className="justify-self-start rounded bg-ink px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#ff3c00] disabled:opacity-40">{busy === "offer" ? "Saving…" : "Add offer"}</button>
          <p className="text-[11.5px] text-ink/50 sm:col-span-2">It shows on your site between these dates. We set up the matching checkout discount for you; it ends on its own.</p>
        </form>
        <ul className="mt-2 divide-y divide-hair rounded-md border border-hair">
          {(d.offers || []).length ? d.offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
              <span><b className="font-medium">{o.title}</b> · {o.label} · {o.starts_on} to {o.ends_on}{o.status === "ended" || o.ends_on < d.today ? " · ended" : o.starts_on > d.today ? " · scheduled" : " · live"}</span>
              <span className="flex items-center gap-2 text-[11.5px] text-ink/50">
                {o.discount_status === "created" ? `Checkout code: ${o.discount_code}` : o.discount_status === "awaiting_approval" || o.discount_status === "approved" ? "Checkout discount being set up" : ""}
                {o.status !== "ended" && o.ends_on >= d.today ? <button type="button" disabled={!!busy} onClick={() => run(`end-${o.id}`, "offer_end", { id: o.id })} className="rounded border border-hair px-2 py-0.5 hover:border-ink/40">End now</button> : null}
              </span>
            </li>
          )) : <li className="px-3 py-3 text-[12.5px] text-ink/50">No offers yet.</li>}
        </ul>
      </section>
      {msg ? <p className="text-[12.5px] text-ink/60">{msg}</p> : null}
      {err ? <p className="text-[12.5px] text-red-600">{err}</p> : null}
    </div>
  );
}
