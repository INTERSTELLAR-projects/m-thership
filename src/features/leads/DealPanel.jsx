// Deal on a lead: products from OfferCatalog list prices (single source of truth). A price the server flags gets
// "This price needs approval" — the floor itself is never sent to this screen. Won deals feed commission.
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { DEAL_PRODUCTS, dealTotals } from "@/lib/leadEngine";
import { sales, useSales, money } from "./api";
import { Card, Pill, Loading, ErrorNote, btn, btnFlame, input, STATUS_TONE } from "./ui";

export default function DealPanel({ client }) {
  const offers = useSales("offers");
  const deals = useSales("deals");
  const mine = (deals.data?.deals || []).filter((d) => d.client_id === client.id);
  const current = mine[0] || null;
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    setRows(current ? current.products.map((p) => ({ key: p.key, price: p.price })) : []);
    setStatus(current && ["draft", "won", "lost"].includes(current.status) ? current.status : "draft");
    setNotes(current?.notes || "");
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (offers.isLoading || deals.isLoading) return <Loading />;
  if (offers.isError) return <ErrorNote error={offers.error} />;
  const catalog = offers.data?.products || DEAL_PRODUCTS;
  const byKey = Object.fromEntries(catalog.map((p) => [p.key, p]));
  const totals = dealTotals(rows.map((r) => ({ ...r, billing: byKey[r.key]?.billing })));
  const save = async (st = status) => {
    setBusy(true); setErr(""); setMsg("");
    try { const r = await sales("deal_save", { id: current?.id, client_id: client.id, products: rows, status: st, notes }); setMsg(r.message); deals.refetch(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const locked = current?.status === "won";
  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <Card title={current ? `Deal · ${current.status.replace(/_/g, " ")}` : "New deal"} kicker="List prices from the offer catalog" right={current ? <Pill tone={STATUS_TONE[current.status]}>{current.status.replace(/_/g, " ")}</Pill> : null}>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_130px_32px] items-center gap-2">
              <select disabled={locked} value={r.key} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { key: e.target.value, price: byKey[e.target.value]?.list_price || 0 } : y)))} className={input} aria-label="Product">{catalog.map((p) => <option key={p.key} value={p.key}>{p.label}{p.price_display ? ` · list ${p.price_display}` : ""}</option>)}</select>
              <input disabled={locked} type="number" min="0" value={r.price} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, price: e.target.value } : y)))} className={`${input} text-right tabular-nums`} aria-label="Price" />
              <button disabled={locked} type="button" onClick={() => setRows((x) => x.filter((_, k) => k !== i))} aria-label="Remove" className="grid h-9 place-items-center text-ink/40 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {!locked ? <button type="button" onClick={() => setRows((x) => [...x, { key: catalog[0].key, price: catalog[0].list_price || 0 }])} className={btn}><Plus className="h-3.5 w-3.5" />Add product</button> : null}
          <textarea disabled={locked} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (what they bought, terms they asked for)" className="w-full border border-hair bg-paper px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-3">
            <p className="text-[13px]"><b className="font-semibold tabular-nums">{money(totals.contract_value)}</b> one-time{totals.monthly_value ? <> · <b className="font-semibold tabular-nums">{money(totals.monthly_value)}</b>/mo</> : null}</p>
            {!locked ? <div className="flex gap-2"><button type="button" onClick={() => save("draft")} disabled={busy || !rows.length} className={btn}>Save</button><button type="button" onClick={() => save("lost")} disabled={busy || !current} className={btn}>Lost</button><button type="button" onClick={() => save("won")} disabled={busy || !rows.length || current?.status === "pending_approval"} className={btnFlame}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Mark won</button></div> : null}
          </div>
          {current?.needs_approval || current?.status === "pending_approval" ? <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">This price needs approval. Justin reviews it; once approved you can mark it won.</p> : null}
          {msg ? <p role="status" className="text-[12.5px] text-ink/70">{msg}</p> : null}
          {err ? <p role="alert" className="text-[12.5px] text-red-700">{err}</p> : null}
        </div>
      </Card>
      <Card title="How deals work" kicker="For reps">
        <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink/70">
          <li>Start from list prices. Quotes are custom; never quote on the first call.</li>
          <li>Below what's allowed, the deal goes to Justin as “needs approval”.</li>
          <li>Every website or system sale needs a monthly plan (HyperCare+ or GravïtyCare).</li>
          <li>Mark won after they say yes: it moves the lead to Won and counts toward your pay.</li>
        </ul>
      </Card>
    </div>
  );
}
