import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Loader2, Crown, Trophy, Award, Shield, Users, ChevronDown, ChevronRight, Star, Sparkles, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { earnedTier, getProgress } from "@/lib/prestige";
import AddMemberModal from "../components/prestige/AddMemberModal";

const PRESTIGE_TIERS = {
  "Prestige I": {
    credit: "$1,000", referrals: 3, icon: Shield,
    color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20",
    grad: "from-orange-500/20 to-transparent", glow: "shadow-[0_0_22px_rgba(255,106,0,0.18)]",
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/25", ring: "ring-orange-500/30",
    perks: ["Small automation", "Minor system integration", "Micro build or optimization", "Internal projects valued at $1000 or less", "No Expiration"],
  },
  "Prestige II": {
    credit: "$2,500", referrals: 5, icon: Award,
    color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20",
    grad: "from-sky-500/20 to-transparent", glow: "shadow-[0_0_22px_rgba(56,189,248,0.18)]",
    badge: "bg-sky-500/15 text-sky-400 border-sky-500/25", ring: "ring-sky-500/30",
    perks: ["Intermediate automation", "Medium system integration", "Standard build or optimization", "Internal projects valued at $2500 or less", "No Expiration"],
  },
  "Prestige III": {
    credit: "$3,500", referrals: 8, icon: Trophy,
    color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20",
    grad: "from-purple-500/20 to-transparent", glow: "shadow-[0_0_22px_rgba(168,85,247,0.18)]",
    badge: "bg-purple-500/15 text-purple-400 border-purple-500/25", ring: "ring-purple-500/30",
    perks: ["Advanced automation", "Elite system integration", "High-tier build or optimization", "Internal projects valued at $3500 or less", "No Expiration"],
  },
  "Prestige Master": {
    credit: "$10,000", referrals: 15, icon: Crown,
    color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20",
    grad: "from-yellow-500/25 to-transparent", glow: "shadow-[0_0_26px_rgba(250,204,21,0.25)]",
    badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25", ring: "ring-yellow-500/30",
    perks: ["Set of high-end automations", "Stack of system integration", "Massive build or optimization", "Internal projects valued at $10,000 or less", "10% on subs up to $500/mo | 7% above", "Recurring payouts while client is active", "Partner status & direct collaboration"],
  },
};

const EMPTY_MEMBER = { name: "", email: "", phone: "", prestige: "Prestige I", joinDate: "", notes: "", active: true };
const EMPTY_REFERRAL = { referredClientName: "", package: "", amount: "", date: "", status: "Pending", notes: "" };

export default function Prestige() {
  const [members, setMembers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("members");
  const [addModal, setAddModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ ...EMPTY_MEMBER });
  const [referralModal, setReferralModal] = useState(false);
  const [editingReferral, setEditingReferral] = useState(null);
  const [referralForm, setReferralForm] = useState({ ...EMPTY_REFERRAL });
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [expandedMember, setExpandedMember] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.PrestigeMember.list("-created_date", 200),
      base44.entities.PrestigeReferral.list("-date", 500),
      base44.entities.CRMClient.list("business", 500),
    ]).then(([m, r, c]) => {
      setMembers(m); setReferrals(r); setClients(c); setLoading(false);
    });
  }, []);

  const memberConfirmed = (memberId) => referrals.filter((r) => r.memberId === memberId && r.status !== "Pending").length;

  // --- Add member (with inline referrals) ---
  const enrollMember = async (memberData, newReferrals) => {
    const created = await base44.entities.PrestigeMember.create({ ...memberData, totalReferrals: 0 });
    const refsToCreate = newReferrals.map((r) => ({
      referredClientName: r.referredClientName,
      package: r.package || "",
      amount: parseFloat(r.amount) || 0,
      date: r.date || "",
      status: r.status,
      notes: r.notes || "",
      memberId: created.id,
      memberName: created.name,
    }));
    const createdRefs = refsToCreate.length ? await base44.entities.PrestigeReferral.bulkCreate(refsToCreate) : [];
    const confirmed = createdRefs.filter((r) => r.status !== "Pending").length;
    const prestige = earnedTier(confirmed);
    await base44.entities.PrestigeMember.update(created.id, { totalReferrals: confirmed, prestige });
    setMembers([{ ...created, totalReferrals: confirmed, prestige }, ...members]);
    setReferrals([...createdRefs, ...referrals]);
    setAddModal(false);
  };

  // --- Members (edit) ---
  const openEditMember = (m) => {
    setEditingMember(m);
    setMemberForm({ name: m.name, email: m.email || "", phone: m.phone || "", prestige: m.prestige, joinDate: m.joinDate || "", notes: m.notes || "", active: m.active !== false });
    setMemberModal(true);
  };

  const saveMember = async () => {
    if (!memberForm.name.trim()) return;
    if (editingMember) {
      await base44.entities.PrestigeMember.update(editingMember.id, memberForm);
      setMembers(members.map((m) => (m.id === editingMember.id ? { ...m, ...memberForm } : m)));
    }
    setMemberModal(false);
  };

  const deleteMember = async (id) => {
    const memberRefs = referrals.filter((r) => r.memberId === id);
    if (memberRefs.length) await base44.entities.PrestigeReferral.deleteMany({ memberId: id });
    await base44.entities.PrestigeMember.delete(id);
    setMembers(members.filter((m) => m.id !== id));
    setReferrals(referrals.filter((r) => r.memberId !== id));
  };

  // --- Referrals ---
  const openAddReferral = (memberId, memberName) => {
    setEditingReferral(null);
    setSelectedMemberId(memberId);
    setReferralForm({ ...EMPTY_REFERRAL, memberId, memberName });
    setReferralModal(true);
  };

  const openEditReferral = (r) => {
    setEditingReferral(r);
    setReferralForm({ referredClientName: r.referredClientName, package: r.package || "", amount: r.amount || "", date: r.date || "", status: r.status, notes: r.notes || "" });
    setReferralModal(true);
  };

  const saveReferral = async () => {
    if (!referralForm.referredClientName.trim()) return;
    const data = { ...referralForm, amount: parseFloat(referralForm.amount) || 0 };
    if (editingReferral) {
      await base44.entities.PrestigeReferral.update(editingReferral.id, data);
      const updated = referrals.map((r) => (r.id === editingReferral.id ? { ...r, ...data } : r));
      setReferrals(updated);
      await recomputeMember(updated, editingReferral.memberId);
    } else {
      const memberId = referralForm.memberId || selectedMemberId;
      const memberName = referralForm.memberName || members.find((m) => m.id === memberId)?.name || "";
      const created = await base44.entities.PrestigeReferral.create({ ...data, memberId, memberName });
      const updated = [created, ...referrals];
      setReferrals(updated);
      await recomputeMember(updated, memberId);
    }
    setReferralModal(false);
  };

  const deleteReferral = async (r) => {
    await base44.entities.PrestigeReferral.delete(r.id);
    const updated = referrals.filter((x) => x.id !== r.id);
    setReferrals(updated);
    await recomputeMember(updated, r.memberId);
  };

  const updateReferralStatus = async (r, status) => {
    await base44.entities.PrestigeReferral.update(r.id, { status });
    const updated = referrals.map((x) => (x.id === r.id ? { ...x, status } : x));
    setReferrals(updated);
    await recomputeMember(updated, r.memberId);
  };

  // Recompute + auto-promote a member's tier & count from the live referrals array.
  const recomputeMember = async (refArr, memberId) => {
    const count = refArr.filter((x) => x.memberId === memberId && x.status !== "Pending").length;
    const prestige = earnedTier(count);
    const member = members.find((m) => m.id === memberId);
    if (member && (member.totalReferrals !== count || member.prestige !== prestige)) {
      await base44.entities.PrestigeMember.update(memberId, { totalReferrals: count, prestige });
      setMembers(members.map((m) => (m.id === memberId ? { ...m, totalReferrals: count, prestige } : m)));
    }
  };

  const tierGroups = Object.keys(PRESTIGE_TIERS).reduce((acc, t) => {
    acc[t] = members.filter((m) => earnedTier(memberConfirmed(m.id)) === t && m.active !== false);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Portal / Prestige" rightText="Referral Program Management" />

      <div className="px-8 py-6 space-y-6">
        {/* Tier Showcase */}
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(PRESTIGE_TIERS).map(([tier, info]) => {
            const group = tierGroups[tier] || [];
            const TierIcon = info.icon;
            return (
              <div key={tier} className={`relative overflow-hidden rounded-2xl border ${info.border} bg-gradient-to-b ${info.grad} bg-card p-4 ${group.length ? info.glow : ""}`}>
                <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-3xl opacity-40 pointer-events-none" style={{ background: tier === "Prestige I" ? "#FF6A00" : tier === "Prestige II" ? "#38BDF8" : tier === "Prestige III" ? "#A855F7" : "#FACC15" }} />
                <div className="relative flex items-center justify-between mb-2">
                  <div className={`text-[10px] font-bold tracking-[0.18em] uppercase ${info.color}`}>// {tier}</div>
                  <div className={`w-8 h-8 rounded-lg ${info.bg} border ${info.border} flex items-center justify-center ${info.color}`}>
                    <TierIcon className="w-4 h-4" />
                  </div>
                </div>
                <div className={`relative text-2xl font-bold ${info.color} drop-shadow`}>{info.credit}</div>
                <div className="text-white/40 text-[11px] mt-0.5">Interstellar Credit</div>
                <div className="text-white/60 text-[11px] mt-2 font-medium">{info.referrals} Successful Referrals</div>

                {/* Members placed beneath their achieved tier */}
                <div className="relative mt-3 pt-3 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-lg font-bold ${info.color}`}>{group.length}</span>
                    <span className="text-[9px] text-white/30 tracking-widest uppercase">members</span>
                  </div>
                  {group.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {group.slice(0, 6).map((m) => (
                        <div key={m.id} title={m.name} className={`w-7 h-7 rounded-full ${info.bg} border ${info.border} flex items-center justify-center text-[11px] font-bold ${info.color} ring-1 ${info.ring}`}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {group.length > 6 && (
                        <div className="w-7 h-7 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-[10px] text-white/40">+{group.length - 6}</div>
                      )}
                    </div>
                  ) : (
                    <p className="text-white/20 text-[10px]">No members ranked here yet.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/[0.06] pb-0">
          {["members", "referrals"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize transition-all border-b-2 -mb-[1px] ${tab === t ? "border-orange-500 text-orange-400" : "border-transparent text-white/40 hover:text-white/60"}`}>
              {t === "members" ? "Prestige Members" : "All Referrals"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-white/20 animate-spin" /></div>
        ) : tab === "members" ? (
          <MembersTab
            members={members}
            referrals={referrals}
            tiers={PRESTIGE_TIERS}
            memberConfirmed={memberConfirmed}
            onAdd={() => setAddModal(true)}
            onEdit={openEditMember}
            onDelete={deleteMember}
            onAddReferral={openAddReferral}
            onEditReferral={openEditReferral}
            onDeleteReferral={deleteReferral}
            onUpdateReferralStatus={updateReferralStatus}
            expandedMember={expandedMember}
            setExpandedMember={setExpandedMember}
          />
        ) : (
          <ReferralsTab referrals={referrals} members={members} tiers={PRESTIGE_TIERS} memberConfirmed={memberConfirmed} onEdit={openEditReferral} onDelete={deleteReferral} onUpdateStatus={updateReferralStatus} />
        )}
      </div>

      {/* Add Member (CRM + referrals) */}
      <AddMemberModal open={addModal} onOpenChange={setAddModal} onSave={enrollMember} clients={clients} />

      {/* Edit Member Modal */}
      <Dialog open={memberModal} onOpenChange={setMemberModal}>
        <DialogContent className="bg-card border-white/[0.08] text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white">Edit Member</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-white/40 text-xs">Name *</Label><Input value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-white/40 text-xs">Email</Label><Input value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" /></div>
              <div><Label className="text-white/40 text-xs">Phone</Label><Input value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" /></div>
            </div>
            <div>
              <Label className="text-white/40 text-xs">Prestige Tier</Label>
              <select value={memberForm.prestige} onChange={(e) => setMemberForm({ ...memberForm, prestige: e.target.value })} className="mt-1 w-full bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-2 text-white text-sm outline-none">
                {Object.keys(PRESTIGE_TIERS).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-white/40 text-xs">Join Date</Label><Input type="date" value={memberForm.joinDate} onChange={(e) => setMemberForm({ ...memberForm, joinDate: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" /></div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={memberForm.active} onChange={(e) => setMemberForm({ ...memberForm, active: e.target.checked })} className="w-4 h-4 accent-orange-500" />
                  <span className="text-white/60 text-sm">Active</span>
                </label>
              </div>
            </div>
            <div><Label className="text-white/40 text-xs">Notes</Label><textarea value={memberForm.notes} onChange={(e) => setMemberForm({ ...memberForm, notes: e.target.value })} className="mt-1 w-full bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-2 text-white text-sm outline-none resize-none min-h-[60px]" /></div>
            <Button onClick={saveMember} className="w-full bg-orange-500 hover:bg-orange-600 text-white">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Referral Modal */}
      <Dialog open={referralModal} onOpenChange={setReferralModal}>
        <DialogContent className="bg-card border-white/[0.08] text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white">{editingReferral ? "Edit Referral" : "Add Referral"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-white/40 text-xs">Referred Client Name *</Label><Input value={referralForm.referredClientName} onChange={(e) => setReferralForm({ ...referralForm, referredClientName: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-white/40 text-xs">Package / Service</Label><Input value={referralForm.package} onChange={(e) => setReferralForm({ ...referralForm, package: e.target.value })} placeholder="e.g. Web Ops" className="mt-1 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20" /></div>
              <div><Label className="text-white/40 text-xs">Amount Paid ($)</Label><Input type="number" value={referralForm.amount} onChange={(e) => setReferralForm({ ...referralForm, amount: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-white/40 text-xs">Date</Label><Input type="date" value={referralForm.date} onChange={(e) => setReferralForm({ ...referralForm, date: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white" /></div>
              <div>
                <Label className="text-white/40 text-xs">Status</Label>
                <select value={referralForm.status} onChange={(e) => setReferralForm({ ...referralForm, status: e.target.value })} className="mt-1 w-full bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-2 text-white text-sm outline-none">
                  {["Pending", "Confirmed", "Paid Out"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div><Label className="text-white/40 text-xs">Notes</Label><textarea value={referralForm.notes} onChange={(e) => setReferralForm({ ...referralForm, notes: e.target.value })} className="mt-1 w-full bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-2 text-white text-sm outline-none resize-none min-h-[60px]" /></div>
            <Button onClick={saveReferral} className="w-full bg-orange-500 hover:bg-orange-600 text-white">{editingReferral ? "Save Changes" : "Add Referral"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembersTab({ members, referrals, tiers, memberConfirmed, onAdd, onEdit, onDelete, onAddReferral, onEditReferral, onDeleteReferral, onUpdateReferralStatus, expandedMember, setExpandedMember }) {
  const statusColors = { Pending: "text-yellow-400 bg-yellow-500/10", Confirmed: "text-blue-400 bg-blue-500/10", "Paid Out": "text-green-400 bg-green-500/10" };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd} className="bg-orange-500 hover:bg-orange-600 text-white gap-2 h-9 shadow-[0_0_16px_rgba(255,106,0,0.3)]"><Plus className="w-4 h-4" />Add Member</Button>
      </div>
      {members.length === 0 && (
        <div className="bg-card rounded-xl border border-white/[0.06] p-10 text-center">
          <Star className="w-8 h-8 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No Prestige members yet. Add your first member!</p>
        </div>
      )}
      <div className="space-y-3">
        {members.map((m) => {
          const confirmed = memberConfirmed(m.id);
          const progress = getProgress(confirmed);
          const tier = tiers[progress.tier] || tiers["Prestige I"];
          const TierIcon = tier.icon;
          const isMaxed = progress.maxed;
          const memberReferrals = referrals.filter((r) => r.memberId === m.id);
          const isExpanded = expandedMember === m.id;
          return (
            <div key={m.id} className={`card-hover relative overflow-hidden bg-card rounded-xl border ${tier.border} ${isMaxed ? tier.glow : ""}`}>
              {/* Award ribbon when prestige master */}
              {isMaxed && (
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-[10px] font-bold tracking-widest uppercase shadow-[0_0_12px_rgba(250,204,21,0.4)]">
                  <Crown className="w-3 h-3" /> Master
                </div>
              )}
              <div className="p-4 flex items-center gap-4">
                <div className={`relative w-12 h-12 rounded-xl ${tier.bg} flex items-center justify-center text-lg font-bold ${tier.color} shrink-0 border ${tier.border} ring-1 ${tier.ring}`}>
                  {m.name.charAt(0).toUpperCase()}
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${tier.bg} border border-white/10 flex items-center justify-center`}>
                    <TierIcon className={`w-3 h-3 ${tier.color}`} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm">{m.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${tier.badge}`}>{progress.tier}</span>
                    {m.active === false && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/5 text-white/30 border border-white/10">Inactive</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                    {m.email && <span className="truncate">{m.email}</span>}
                    {m.joinDate && <span>Joined {new Date(m.joinDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className={`font-semibold ${tier.color}`}>{confirmed} / {progress.maxed ? confirmed : progress.target} referrals</span>
                      <span className="text-white/30">{progress.maxed ? "Peak rank reached" : `${progress.remaining} to ${progress.nextTier}`}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full bg-gradient-to-r ${tier.grad.includes("orange") ? "from-orange-300 to-orange-600" : tier.grad.includes("sky") ? "from-sky-300 to-sky-600" : tier.grad.includes("purple") ? "from-purple-300 to-purple-600" : "from-yellow-200 to-yellow-500"} transition-all duration-500`} style={{ width: `${progress.pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button onClick={() => onAddReferral(m.id, m.name)} variant="ghost" className="h-8 text-xs text-orange-400/70 hover:text-orange-400 hover:bg-orange-500/10 gap-1"><Plus className="w-3 h-3" />Referral</Button>
                  <button onClick={() => onEdit(m)} className="p-1.5 text-white/20 hover:text-white/60 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(m.id)} className="p-1.5 text-white/20 hover:text-red-400/60 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setExpandedMember(isExpanded ? null : m.id)} className="p-1.5 text-white/20 hover:text-white/60 transition-colors">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-white/[0.06] px-4 py-3">
                  {m.notes && <p className="text-white/40 text-xs mb-3 italic">{m.notes}</p>}
                  <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-orange-400/60" /> Referrals Log ({memberReferrals.length})</p>
                  {memberReferrals.length === 0 ? (
                    <p className="text-white/20 text-xs">No referrals recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {memberReferrals.map((r) => (
                        <div key={r.id} className="flex items-center gap-3 bg-white/[0.02] rounded-lg px-3 py-2 group">
                          <div className="flex-1 min-w-0">
                            <span className="text-white/70 text-xs font-medium">{r.referredClientName}</span>
                            {r.package && <span className="ml-2 text-white/30 text-[10px]">{r.package}</span>}
                            {r.amount > 0 && <span className="ml-2 text-orange-500/60 text-[10px] font-semibold">${r.amount.toLocaleString()}</span>}
                            {r.date && <span className="ml-2 text-white/20 text-[10px]">{new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                          </div>
                          <select value={r.status} onChange={(e) => onUpdateReferralStatus(r, e.target.value)} className={`text-[10px] font-semibold px-2 py-0.5 rounded border-0 outline-none cursor-pointer ${statusColors[r.status]}`}>
                            {["Pending", "Confirmed", "Paid Out"].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button onClick={() => onEditReferral(r)} className="p-1 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => onDeleteReferral(r)} className="p-1 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReferralsTab({ referrals, members, tiers, memberConfirmed, onEdit, onDelete, onUpdateStatus }) {
  const statusColors = { Pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", Confirmed: "text-blue-400 bg-blue-500/10 border-blue-500/20", "Paid Out": "text-green-400 bg-green-500/10 border-green-500/20" };

  if (referrals.length === 0) return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-10 text-center">
      <Users className="w-8 h-8 text-white/10 mx-auto mb-3" />
      <p className="text-white/30 text-sm">No referrals recorded yet.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {referrals.map((r) => {
        const member = members.find((m) => m.id === r.memberId);
        const earnedT = member ? earnedTier(memberConfirmed(member.id)) : "Prestige I";
        const tier = tiers[earnedT] || tiers["Prestige I"];
        return (
          <div key={r.id} className="bg-card rounded-xl border border-white/[0.06] p-4 flex items-center gap-4 group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white/85 text-sm font-medium">{r.referredClientName}</span>
                {r.package && <span className="text-white/30 text-xs">{r.package}</span>}
                {r.amount > 0 && <span className="text-orange-500/70 text-xs font-semibold">${r.amount.toLocaleString()}</span>}
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-white/30">
                <span className={`font-semibold ${tier.color}`}>via {r.memberName}</span>
                {member && <span className={`px-1.5 py-0.5 rounded border text-[9px] ${tier.badge}`}>{earnedT}</span>}
                {r.date && <span>{new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
              </div>
            </div>
            <select value={r.status} onChange={(e) => onUpdateStatus(r, e.target.value)} className={`text-[10px] font-semibold px-2 py-1 rounded border outline-none cursor-pointer ${statusColors[r.status]}`}>
              {["Pending", "Confirmed", "Paid Out"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => onEdit(r)} className="p-1.5 text-white/15 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => onDelete(r)} className="p-1.5 text-white/15 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        );
      })}
    </div>
  );
}