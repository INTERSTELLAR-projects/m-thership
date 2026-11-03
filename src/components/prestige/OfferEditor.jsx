import { useEffect, useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DEFAULT_OFFER, ROMAN, CREDIT_PER_SIGNED, CREDIT_CAP } from "@/lib/prestige";

const inputCls = "mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink";
const areaCls = "mt-1 w-full resize-none rounded-md border border-ink/[0.13] bg-ink/[0.03] px-3 py-2 text-sm text-ink outline-none min-h-[56px]";

const clone = (o) => JSON.parse(JSON.stringify(o));

// Edit the whole Prestige offer: instant rewards, tiers, link, share text, terms.
export default function OfferEditor({ open, onOpenChange, offer, onSave }) {
  const [form, setForm] = useState(() => clone(offer));
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(clone(offer)); }, [open, offer]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setReward = (k, patch) => setForm((f) => ({ ...f, [k]: { ...f[k], ...patch } }));
  const setTier = (i, patch) => setForm((f) => ({ ...f, tiers: f.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) }));
  const addTier = () => setForm((f) => {
    const lastT = f.tiers[f.tiers.length - 1];
    const n = f.tiers.length + 1;
    return { ...f, tiers: [...f.tiers, { name: `Prestige ${ROMAN[n] || n}`, threshold: (lastT?.threshold || 0) + 5, unlock: "", detail: "", value: 0 }] };
  });
  const removeTier = (i) => setForm((f) => ({ ...f, tiers: f.tiers.filter((_, idx) => idx !== i) }));

  const save = async () => {
    setSaving(true);
    try {
      const clean = {
        referral_base_url: String(form.referral_base_url || "").trim(),
        share_message: form.share_message || "",
        // Values are fixed by the program rules: Priority Pass has no dollar value, each signed referral is $500 credit.
        booked: { title: form.booked.title, detail: form.booked.detail, value: 0 },
        signed: { title: form.signed.title, detail: form.signed.detail, value: CREDIT_PER_SIGNED },
        tiers: form.tiers
          .filter((t) => String(t.name || "").trim())
          .map((t) => ({ name: t.name.trim(), threshold: Math.max(1, Math.round(Number(t.threshold) || 1)), unlock: t.unlock || "", detail: t.detail || "", value: Number(t.value) || 0 }))
          .sort((a, b) => a.threshold - b.threshold),
        terms: form.terms || "",
      };
      await onSave(clean);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl border-ink/[0.13] bg-card text-ink">
        <DialogHeader>
          <DialogTitle className="text-ink">Edit the Prestige offer</DialogTitle>
          <p className="text-[12.5px] text-ink/55">
            {offer.is_default ? "You're looking at the starter defaults. Nothing is saved until you hit Save. " : ""}
            Changes apply to new rewards going forward; rewards already logged keep the title and value they were earned with.
          </p>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1 pt-1">
          <section className="space-y-3">
            <p className="mono-label text-[10px] text-ink/50">Instant rewards (earned every time)</p>
            {[["booked", "When a referral books a call", "Priority Pass · no dollar value"], ["signed", "When a referral signs (first invoice paid)", `$${CREDIT_PER_SIGNED} credit to their balance · builds stack, other spends capped at $${CREDIT_CAP} each`]].map(([k, label, fixed]) => (
              <div key={k} className="rounded-md border border-ink/[0.13] bg-ink/[0.02] p-3">
                <p className="text-[12.5px] font-semibold">{label}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div><Label className="text-xs text-ink/[0.58]">Reward</Label><Input value={form[k].title} onChange={(e) => setReward(k, { title: e.target.value })} className={inputCls} /></div>
                  <p className="pb-2 font-mono text-[10.5px] text-ink/50">{fixed}</p>
                </div>
                <div className="mt-2"><Label className="text-xs text-ink/[0.58]">Details</Label><textarea value={form[k].detail} onChange={(e) => setReward(k, { detail: e.target.value })} className={areaCls} /></div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="mono-label text-[10px] text-ink/50">Tier unlocks (by signed referrals)</p>
              <button type="button" onClick={addTier} className="inline-flex items-center gap-1 text-[12px] font-medium text-[#ff3c00] hover:underline"><Plus className="h-3.5 w-3.5" />Add tier</button>
            </div>
            {form.tiers.map((t, i) => (
              <div key={i} className="rounded-md border border-ink/[0.13] bg-ink/[0.02] p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_110px_1fr_120px_auto]">
                  <div><Label className="text-xs text-ink/[0.58]">Tier name</Label><Input value={t.name} onChange={(e) => setTier(i, { name: e.target.value })} className={inputCls} /></div>
                  <div><Label className="text-xs text-ink/[0.58]">Signed needed</Label><Input type="number" min="1" value={t.threshold} onChange={(e) => setTier(i, { threshold: e.target.value })} className={inputCls} /></div>
                  <div><Label className="text-xs text-ink/[0.58]">Unlock</Label><Input value={t.unlock} onChange={(e) => setTier(i, { unlock: e.target.value })} className={inputCls} /></div>
                  <div><Label className="text-xs text-ink/[0.58]">Value ($)</Label><Input type="number" min="0" value={t.value} onChange={(e) => setTier(i, { value: e.target.value })} className={inputCls} /></div>
                  <div className="flex items-end pb-1">
                    <button type="button" disabled={form.tiers.length <= 1} onClick={() => removeTier(i)} className="p-2 text-ink/40 hover:text-red-600 disabled:opacity-30" title="Remove tier"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="mt-2"><Label className="text-xs text-ink/[0.58]">Details</Label><textarea value={t.detail} onChange={(e) => setTier(i, { detail: e.target.value })} className={areaCls} /></div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <p className="mono-label text-[10px] text-ink/50">Sharing</p>
            <div><Label className="text-xs text-ink/[0.58]">Referral link base (each referrer gets ?ref=their-code)</Label><Input value={form.referral_base_url} onChange={(e) => set("referral_base_url", e.target.value)} className={inputCls} /></div>
            <div><Label className="text-xs text-ink/[0.58]">One-tap share message ({"{link}"} is replaced with their link)</Label><textarea value={form.share_message} onChange={(e) => set("share_message", e.target.value)} className={areaCls} /></div>
            <div><Label className="text-xs text-ink/[0.58]">Program terms</Label><textarea value={form.terms} onChange={(e) => set("terms", e.target.value)} className={`${areaCls} min-h-[80px]`} /></div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-3">
          <button type="button" onClick={() => setForm({ ...clone(DEFAULT_OFFER) })} className="inline-flex items-center gap-1.5 text-[12px] text-ink/55 hover:text-[#ff3c00]"><RotateCcw className="h-3.5 w-3.5" />Reset form to defaults</button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-[#ff3c00] text-white hover:bg-ink">{saving ? "Saving…" : "Save offer"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
