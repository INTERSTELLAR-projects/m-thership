import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Search, Bot, Zap, Trophy, Shield, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { STATUSES, STATUS_LABEL, isSigned, progressFor, tierLabel, enumTier, slugify } from "@/lib/prestige";
import ServiceLineItems from "./ServiceLineItems";
import PrestigeEmblem from "./PrestigeEmblem";

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY_REF = { referredClientName: "", lineItems: [{ service: "", subscription: false, amount: "" }], date: "", status: "Confirmed", notes: "" };

function ClientAutocomplete({ value, onChange, onSelectClient, clients, placeholder, exclude }) {
  const [focused, setFocused] = useState(false);
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = clients.filter(c => c.business && c.business !== exclude);
    if (!q) return list.slice(0, 6);
    return list.filter(c => c.business.toLowerCase().includes(q)).slice(0, 6);
  }, [value, clients, exclude]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink/[0.43] pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="pl-8 bg-ink/[0.03] border-ink/[0.13] text-ink placeholder:text-ink/[0.38]"
        />
      </div>
      {focused && matches.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-ink/[0.13] rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(c.business); onSelectClient?.(c); setFocused(false); }}
              className="w-full text-left px-3 py-2 text-xs text-ink/70 hover:bg-orange-500/10 hover:text-orange-600 border-b border-ink/[0.13] last:border-0 transition-colors"
            >
              <span className="font-medium text-ink/90">{c.business}</span>
              {c.emails?.[0] && <span className="ml-2 text-ink/[0.48]">{c.emails[0]}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddMemberModal({ open, onOpenChange, onSave, clients, offer }) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [referrals, setReferrals] = useState([{ ...EMPTY_REF }]);

  useEffect(() => {
    if (open) {
      setName(""); setEmail(""); setPhone(""); setClientId("");
      setJoinDate(today());
      setReferrals([{ ...EMPTY_REF, date: today() }]);
    }
  }, [open]);

  const validReferrals = referrals.filter((r) => r.referredClientName.trim());
  const confirmed = validReferrals.filter(isSigned).length;
  const progress = progressFor(confirmed, offer);
  const projectedTier = tierLabel(progress.idx, offer);

  const selectMember = (c) => {
    setClientId(c.id);
    setEmail(c.emails?.[0] || (c.portal_emails || [])[0] || "");
    setPhone(c.phones?.[0] || "");
  };

  const updateRef = (i, patch) => setReferrals(referrals.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRef = () => setReferrals([...referrals, { ...EMPTY_REF, date: today() }]);
  const removeRef = (i) => setReferrals(referrals.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(
      { name: name.trim(), email, phone, prestige: enumTier(progress.idx), joinDate, active: true, notes: "", client_id: clientId || undefined, referral_code: slugify(name) },
      validReferrals.map((r) => {
        const lineItems = (r.lineItems || [])
          .map((li) => ({ service: li.service, subscription: !!li.subscription, amount: parseFloat(li.amount) || 0 }))
          .filter((li) => li.service);
        return {
          referredClientName: r.referredClientName.trim(),
          lineItems,
          package: lineItems.map((li) => li.service).join(", "),
          amount: lineItems.reduce((s, li) => s + li.amount, 0),
          date: r.date || today(),
          status: r.status,
          notes: r.notes || "",
        };
      })
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-orange-500/20 text-ink max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-ink flex items-center gap-2">
            <Bot className="w-4 h-4 text-orange-600" />
            Enroll Prestige Member
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2 max-h-[72vh] overflow-y-auto pr-1">
          {/* Member identity */}
          <div className="rounded-md border border-ink/[0.13] bg-ink/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-ink/50 text-[11px] font-bold tracking-[0.15em] uppercase">Member Identity</span>
            </div>
            <div>
              <Label className="text-ink/[0.58] text-xs">Select from CRM or type a name *</Label>
              <div className="mt-1">
                <ClientAutocomplete
                  value={name}
                  onChange={(v) => { setName(v); setClientId(""); }}
                  onSelectClient={selectMember}
                  clients={clients}
                  placeholder="Search CRM clients…"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-ink/[0.58] text-xs">Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink h-9" /></div>
              <div><Label className="text-ink/[0.58] text-xs">Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink h-9" /></div>
              <div><Label className="text-ink/[0.58] text-xs">Join Date</Label><Input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink h-9" /></div>
            </div>
          </div>

          {/* Referrals builder */}
          <div className="rounded-md border border-ink/[0.13] bg-ink/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-orange-600" />
                <span className="text-ink/50 text-[11px] font-bold tracking-[0.15em] uppercase">Referrals Submitted</span>
              </div>
              <span className="text-[10px] text-ink/[0.48]">{confirmed} signed · {validReferrals.length} total</span>
            </div>

            {referrals.map((r, i) => (
              <div key={i} className="rounded-lg border border-ink/[0.13] bg-white/70 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-ink/[0.48] text-[10px] font-semibold tracking-widest uppercase">Referral #{i + 1}</span>
                  {referrals.length > 1 && (
                    <button onClick={() => removeRef(i)} className="p-1 text-ink/[0.38] hover:text-red-600/60 transition-colors"><Trash2 className="w-3 h-3" /></button>
                  )}
                </div>
                <div>
                  <Label className="text-ink/[0.58] text-[11px]">Referred Business</Label>
                  <div className="mt-1">
                    <ClientAutocomplete
                      value={r.referredClientName}
                      onChange={(v) => updateRef(i, { referredClientName: v })}
                      clients={clients}
                      placeholder="Search CRM business they referred…"
                      exclude={name}
                    />
                  </div>
                </div>
                <ServiceLineItems value={r.lineItems} onChange={(lv) => updateRef(i, { lineItems: lv })} />
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-ink/[0.58] text-[11px]">Date</Label><Input type="date" value={r.date} onChange={(e) => updateRef(i, { date: e.target.value })} className="mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink h-9" /></div>
                  <div>
                    <Label className="text-ink/[0.58] text-[11px]">Status</Label>
                    <select value={r.status} onChange={(e) => updateRef(i, { status: e.target.value })} className="mt-1 w-full bg-ink/[0.03] border border-ink/[0.13] rounded-md px-2 py-1.5 text-xs text-ink outline-none">
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <button onClick={addRef} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-ink/15 text-ink/[0.58] hover:text-orange-600 hover:border-orange-500/40 transition-colors text-xs font-medium">
              <Plus className="w-3.5 h-3.5" /> Add Another Referral
            </button>
          </div>

          {/* Live progression ladder */}
          <div className="rounded-md border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-2 text-ink/60 text-[11px] font-bold tracking-[0.15em] uppercase">
                <Trophy className="w-3.5 h-3.5 text-orange-600" /> Live Progression
              </span>
              <span className="text-[10px] text-orange-600 font-semibold tracking-wider">{progress.maxed ? "Top of the ladder" : `Next: ${progress.next?.name}`}</span>
            </div>

            <div className="flex items-center justify-between mb-3 gap-1">
              {offer.tiers.map((t, i) => {
                const reached = confirmed >= t.threshold;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <PrestigeEmblem tier={i + 1} size={34} locked={!reached} showNumeral={false} />
                    <span className={`text-[8px] tracking-wider uppercase text-center leading-tight ${reached ? "text-orange-600" : "text-ink/[0.45]"}`}>{t.name.replace(/^Prestige\s+/i, "")} · {t.threshold}</span>
                  </div>
                );
              })}
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-ink/[0.58]">{confirmed} signed referrals</span>
                <span className="text-orange-600 font-semibold">
                  {progress.maxed ? "MAXED" : `${progress.remaining} to ${progress.next?.name ?? ""}`}
                </span>
              </div>
              <div className="h-2 w-full bg-ink/[0.04] rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-orange-300 to-orange-600 transition-all duration-500" style={{ width: `${progress.pct}%` }} />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Shield className="w-3 h-3 text-orange-600" />
                <span className="text-xs text-ink/70">Projected rank on save: </span>
                <span className="text-xs font-bold text-orange-600 tracking-wide">{projectedTier}</span>
              </div>
            </div>
          </div>

          <Button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-4 h-4 mr-1" /> Enroll Member & Log {validReferrals.length} Referral{validReferrals.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}