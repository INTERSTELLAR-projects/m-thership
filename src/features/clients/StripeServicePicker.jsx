import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X, Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Live list of Stripe products (exact Stripe names). Re-read every time the picker opens,
// so a product added in Stripe shows up here without touching Møthership.
export function useStripeProducts(enabled = true) {
  return useQuery({
    queryKey: ["stripeProducts"],
    queryFn: async () => {
      const r = await base44.functions.invoke("stripeProducts", {});
      return r?.data || { products: [] };
    },
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

const money = (n) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
export const priceLabel = (p) =>
  p.interval === "one_time" ? `${money(p.amount)} one-time`
    : `${money(p.amount)}/${p.interval_count > 1 ? `${p.interval_count} ` : ""}${p.interval}${p.interval !== "month" && p.monthly != null ? ` (${money(p.monthly)}/mo)` : ""}`;

const CUSTOM = "__custom__";

export default function StripeServicePicker({ onAdd, onCancel }) {
  const q = useStripeProducts(true);
  const products = q.data?.products || [];
  const [productId, setProductId] = useState("");
  const [priceId, setPriceId] = useState("");
  const [custom, setCustom] = useState({ name: "", price: "" });
  const [override, setOverride] = useState("");

  const product = products.find((p) => p.product_id === productId);
  const prices = product?.prices || [];
  const price = prices.find((p) => p.price_id === priceId) || (prices.length === 1 ? prices[0] : null);

  const choose = (id) => {
    setProductId(id);
    const p = products.find((x) => x.product_id === id);
    setPriceId(p?.prices?.length === 1 ? p.prices[0].price_id : "");
    setOverride("");
  };

  const grouped = useMemo(() => {
    const order = [["hypercare", "HyperCare+"], ["gravitycare", "GravïtyCare"], ["mission", "Missions"], ["website", "Builds"], ["upgrade", "Upgrades"], ["appcare", "AppCare"], ["manage", "Manage+"], ["other", "Other products"]];
    return order.map(([k, l]) => [l, products.filter((p) => (p.plan || "other") === k)]).filter(([, list]) => list.length);
  }, [products]);

  const add = () => {
    if (productId === CUSTOM) {
      if (!custom.name.trim()) return;
      onAdd({ id: Date.now(), name: custom.name.trim(), price: parseFloat(custom.price) || 0, off_stripe: true, note: "not in Stripe yet" });
      return;
    }
    if (!product || !price) return;
    const recurring = price.interval !== "one_time";
    const monthly = override !== "" ? parseFloat(override) || 0 : recurring ? price.monthly : 0;
    onAdd({
      id: Date.now(),
      name: product.name, // exact Stripe product name
      price: recurring ? monthly : 0,
      one_time_amount: recurring ? undefined : (override !== "" ? parseFloat(override) || 0 : price.amount),
      interval: price.interval,
      stripe_product_id: product.product_id,
      stripe_price_id: price.price_id,
      manual: true,
      starts_on: new Date().toISOString().slice(0, 10),
    });
  };

  const field = "h-8 rounded-md border border-ink/[0.13] bg-ink/[0.04] px-2 text-xs text-ink outline-none focus:border-[#ff3c00]";

  return (
    <div className="mt-2 space-y-2 border-t border-ink/[0.13] pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={productId} onChange={(e) => choose(e.target.value)} className={`${field} min-w-[220px] flex-1`} autoFocus>
          <option value="">{q.isLoading ? "Loading Stripe products…" : "Pick a service from Stripe"}</option>
          {grouped.map(([label, list]) => (
            <optgroup key={label} label={label}>
              {list.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
            </optgroup>
          ))}
          <option value={CUSTOM}>Not in Stripe yet (type a name)</option>
        </select>
        {product && prices.length > 1 && (
          <select value={priceId} onChange={(e) => { setPriceId(e.target.value); setOverride(""); }} className={`${field} min-w-[160px]`}>
            <option value="">Pick a price</option>
            {prices.map((p) => <option key={p.price_id} value={p.price_id}>{priceLabel(p)}{p.nickname ? ` · ${p.nickname}` : ""}</option>)}
          </select>
        )}
        <button type="button" onClick={() => q.refetch()} title="Re-read products from Stripe" className="p-1 text-ink/40 hover:text-ink">
          {q.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </button>
      </div>

      {productId === CUSTOM && (
        <div className="flex items-center gap-2">
          <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Service name" className={`${field} flex-1`} />
          <input value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} type="number" placeholder="$/mo" className={`${field} w-24`} />
        </div>
      )}

      {product && price && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/60">
          <span>Stripe price: <b className="text-ink">{priceLabel(price)}</b></span>
          <span className="text-ink/40">·</span>
          <label className="flex items-center gap-1.5">
            {price.interval === "one_time" ? "Charged" : "Billed here at $/mo"}
            <input value={override} onChange={(e) => setOverride(e.target.value)} type="number"
              placeholder={String(price.interval === "one_time" ? price.amount : price.monthly ?? "")} className={`${field} w-24`} />
          </label>
          <span className="text-ink/40">(leave blank to use the Stripe price; referral pricing goes here)</span>
        </div>
      )}

      {q.data?.configured === false && <p className="text-xs text-red-600">Stripe isn&apos;t connected (STRIPE_SECRET_KEY missing).</p>}
      {q.data?.error && <p className="text-xs text-red-600">Stripe: {q.data.error}</p>}

      <div className="flex items-center gap-2">
        <button type="button" onClick={add} disabled={productId === CUSTOM ? !custom.name.trim() : !(product && price)}
          className="inline-flex items-center gap-1 rounded-md bg-[#ff3c00] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">
          <Check className="h-3.5 w-3.5" /> Add service
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-ink/50 hover:text-ink">
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}
