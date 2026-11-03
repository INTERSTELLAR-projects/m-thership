import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronRight, Copy, MessageSquare, Mail, Settings2, Check, Undo2, Ban, Sparkles, Trophy, Gift, Users, Zap, Crown, Coins } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  OFFER_KEY, mergeOffer, STATUSES, STATUS_LABEL, STATUS_TONE, isSigned, isBooked, tierIndex, tierLabel, enumTier, progressFor,
  referralLink, referralCode, shareText, smsHref, mailHref, money, slugify, unlockProps, rewardsForTransition, missingRewards,
  creditSummary, redemptionError, creditCategory, CREDIT_CATEGORIES, CREDIT_GROUPS, CREDIT_CAP, REDEMPTION_STATUS_LABEL,
} from "@/lib/prestige";
import CreditTiles from "../components/prestige/CreditTiles";
import AddMemberModal from "../components/prestige/AddMemberModal";
import TierLadderCard from "../components/prestige/TierLadderCard";
import ServiceLineItems from "../components/prestige/ServiceLineItems";
import PrestigeEmblem from "../components/prestige/PrestigeEmblem";
import PrestigeUnlock from "../components/prestige/PrestigeUnlock";
import OfferEditor from "../components/prestige/OfferEditor";

const today = () => new Date().toISOString().slice(0, 10);
const fmtDay = (d) => (d ? new Date(d.length <= 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const EMPTY_MEMBER = { name: "", email: "", phone: "", joinDate: "", notes: "", active: true, client_id: "", referral_code: "" };
const EMPTY_REFERRAL = { referredClientName: "", lineItems: [{ service: "", subscription: false, amount: "" }], date: "", status: "Pending", notes: "" };
const fieldCls = "mt-1 bg-ink/[0.03] border-ink/[0.13] text-ink";
const selectCls = "mt-1 w-full rounded-md border border-ink/[0.13] bg-ink/[0.03] px-3 py-2 text-sm text-ink outline-none";

const PLAYBOOK = [
  ["Reward the behavior, every time", "A Priority Pass the moment a referral books a call, and $500 in credit when they sign. Never make people wait for a tier to feel it."],
  ["Make it stupidly easy", "One link per referrer and a pre-written text they can send in one tap. No forms, no explaining."],
  ["Recognize them in public", "Leaderboard, ranks and the unlock moment. Status is a reward that costs nothing."],
  ["Always show the next step", "A progress bar toward the next tier turns one referral into a reason for the next."],
  ["Cheap to give, big to get", "Builds are high-value to the client and fast for us to deliver, so the offer can be generous."],
];

export default function Prestige() {
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [redeemFor, setRedeemFor] = useState(null); // member id, or "" to pick one
  const [clients, setClients] = useState([]);
  const [offerRec, setOfferRec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("referrers");
  const [addModal, setAddModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ ...EMPTY_MEMBER });
  const [referralModal, setReferralModal] = useState(false);
  const [editingReferral, setEditingReferral] = useState(null);
  const [referralForm, setReferralForm] = useState({ ...EMPTY_REFERRAL });
  const [expandedMember, setExpandedMember] = useState(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [unlock, setUnlock] = useState(null);
  const [confirm, setConfirm] = useState(null); // { title, body, action, label }
  const [rewardFilter, setRewardFilter] = useState("owed");

  const offer = useMemo(() => mergeOffer(offerRec?.prestigeOffer), [offerRec]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      base44.entities.PrestigeMember.list("-created_date", 500),
      base44.entities.PrestigeReferral.list("-date", 1000),
      base44.entities.PrestigeReward.list("-created_date", 1000).catch(() => []),
      base44.entities.CRMClient.list("business", 500).catch(() => []),
      base44.entities.AppSettings.filter({ key: OFFER_KEY }, "-created_date", 1).catch(() => []),
      base44.entities.PrestigeRedemption.list("-created_date", 1000).catch(() => []),
    ]).then(async ([m, r, rw, c, s, rd]) => {
      if (!alive) return;
      const rec = (s || [])[0] || null;
      const off = mergeOffer(rec?.prestigeOffer);
      // Legacy members: mark their current rank as already celebrated so old data doesn't replay the unlock.
      const legacy = m.filter((x) => x.last_celebrated_tier === undefined || x.last_celebrated_tier === null);
      const patched = await Promise.all(legacy.map(async (x) => {
        const idx = tierIndex(r.filter((y) => y.memberId === x.id && isSigned(y)).length, off);
        await base44.entities.PrestigeMember.update(x.id, { last_celebrated_tier: idx }).catch(() => null);
        return [x.id, idx];
      }));
      const map = Object.fromEntries(patched);
      if (!alive) return;
      setMembers(m.map((x) => (x.id in map ? { ...x, last_celebrated_tier: map[x.id] } : x)));
      setReferrals(r); setRewards(rw || []); setRedemptions(rd || []); setClients(c || []); setOfferRec(rec); setLoading(false);
    }).catch((e) => {
      if (!alive) return;
      setLoading(false);
      toast({ title: "Could not load Prestige", description: e.message, variant: "destructive" });
    });
    return () => { alive = false; };
  }, [toast]);

  // ---------- derived ----------
  const statsFor = (memberId, refs = referrals) => {
    const mine = refs.filter((r) => r.memberId === memberId);
    return { signed: mine.filter(isSigned).length, booked: mine.filter(isBooked).length, total: mine.length };
  };
  const active = members.filter((m) => m.active !== false);
  const board = useMemo(() => active
    .map((m) => ({ m, ...statsFor(m.id) }))
    .sort((a, b) => b.signed - a.signed || b.booked - a.booked || a.m.name.localeCompare(b.m.name)), [members, referrals]);
  const totalSigned = referrals.filter(isSigned).length;
  const totalBooked = referrals.filter(isBooked).length;
  const owed = rewards.filter((r) => r.status === "owed");
  const owedValue = owed.reduce((s, r) => s + (Number(r.value) || 0), 0);
  const creditsFor = (memberId, reds = redemptions) => creditSummary(rewards.filter((r) => r.memberId === memberId), reds.filter((x) => x.memberId === memberId));
  const pendingRedemptions = redemptions.filter((x) => x.status === "requested");

  // ---------- core: settle a member after their referrals change ----------
  const settle = async (member, refsBefore, refsAfter, change = {}) => {
    if (!member) return;
    const prevSigned = statsFor(member.id, refsBefore).signed;
    const nextSigned = statsFor(member.id, refsAfter).signed;
    const payloads = rewardsForTransition({ member, referral: change.referral, prevStatus: change.prevStatus || "Pending", nextStatus: change.nextStatus || "Pending", prevSigned, nextSigned, offer, existing: rewards });
    if (payloads.length) {
      try {
        const created = await base44.entities.PrestigeReward.bulkCreate(payloads);
        setRewards((rw) => [...(created || []), ...rw]);
        toast({ title: `${member.name} earned ${payloads.length === 1 ? "a reward" : `${payloads.length} rewards`}`, description: payloads.map((p) => p.title).join(" · ") });
      } catch (e) {
        toast({ title: "Could not log the reward", description: e.message, variant: "destructive" });
      }
    }
    const idx = tierIndex(nextSigned, offer);
    const patch = {};
    if (member.totalReferrals !== nextSigned) patch.totalReferrals = nextSigned;
    if (member.prestige !== enumTier(idx)) patch.prestige = enumTier(idx);
    if (idx > (member.last_celebrated_tier || 0)) {
      patch.last_celebrated_tier = idx;
      setUnlock({ ...unlockProps(idx, offer, member.name), sound: true, key: Date.now() });
    }
    if (Object.keys(patch).length) {
      await base44.entities.PrestigeMember.update(member.id, patch);
      setMembers((ms) => ms.map((m) => (m.id === member.id ? { ...m, ...patch } : m)));
    }
  };

  // ---------- members ----------
  const enrollMember = async (memberData, newReferrals) => {
    try {
      const created = await base44.entities.PrestigeMember.create({ ...memberData, totalReferrals: 0, last_celebrated_tier: 0 });
      const refsToCreate = newReferrals.map((r) => ({ ...r, memberId: created.id, memberName: created.name, ...(isBooked(r) ? { booked_at: new Date().toISOString() } : {}), ...(isSigned(r) ? { signed_at: new Date().toISOString() } : {}) }));
      const createdRefs = refsToCreate.length ? await base44.entities.PrestigeReferral.bulkCreate(refsToCreate) : [];
      const allRefs = [...(createdRefs || []), ...referrals];
      setMembers((ms) => [created, ...ms]);
      setReferrals(allRefs);
      setAddModal(false);
      const payloads = missingRewards({ member: created, referrals: allRefs, offer, existing: [] });
      if (payloads.length) {
        const rw = await base44.entities.PrestigeReward.bulkCreate(payloads);
        setRewards((x) => [...(rw || []), ...x]);
      }
      const signed = (createdRefs || []).filter(isSigned).length;
      const idx = tierIndex(signed, offer);
      const patch = { totalReferrals: signed, prestige: enumTier(idx), last_celebrated_tier: idx };
      await base44.entities.PrestigeMember.update(created.id, patch);
      setMembers((ms) => ms.map((m) => (m.id === created.id ? { ...m, ...patch } : m)));
      toast({ title: `${created.name} enrolled`, description: payloads.length ? `${payloads.length} reward${payloads.length === 1 ? "" : "s"} logged as owed.` : "Share their referral link to get them started." });
      if (idx > 0) setUnlock({ ...unlockProps(idx, offer, created.name), sound: true, key: Date.now() });
    } catch (e) {
      toast({ title: "Could not enroll member", description: e.message, variant: "destructive" });
    }
  };

  const openEditMember = (m) => {
    setEditingMember(m);
    setMemberForm({ name: m.name, email: m.email || "", phone: m.phone || "", joinDate: m.joinDate || "", notes: m.notes || "", active: m.active !== false, client_id: m.client_id || "", referral_code: m.referral_code || referralCode(m) });
    setMemberModal(true);
  };

  const saveMember = async () => {
    if (!memberForm.name.trim() || !editingMember) return;
    const data = { ...memberForm, name: memberForm.name.trim(), referral_code: slugify(memberForm.referral_code || memberForm.name) };
    try {
      await base44.entities.PrestigeMember.update(editingMember.id, data);
      setMembers((ms) => ms.map((m) => (m.id === editingMember.id ? { ...m, ...data } : m)));
      setMemberModal(false);
      toast({ title: "Member saved" });
    } catch (e) {
      toast({ title: "Could not save member", description: e.message, variant: "destructive" });
    }
  };

  const deleteMember = (m) => setConfirm({
    title: `Remove ${m.name}?`,
    body: "This deletes the member, their referral log, their reward history and their credit redemptions. It can't be undone.",
    label: "Delete member",
    action: async () => {
      await Promise.all([
        base44.entities.PrestigeReferral.deleteMany({ memberId: m.id }).catch(() => null),
        base44.entities.PrestigeReward.deleteMany({ memberId: m.id }).catch(() => null),
        base44.entities.PrestigeRedemption.deleteMany({ memberId: m.id }).catch(() => null),
      ]);
      await base44.entities.PrestigeMember.delete(m.id);
      setMembers((ms) => ms.filter((x) => x.id !== m.id));
      setReferrals((rs) => rs.filter((x) => x.memberId !== m.id));
      setRewards((rw) => rw.filter((x) => x.memberId !== m.id));
      toast({ title: `${m.name} removed` });
    },
  });

  // ---------- referrals ----------
  const openAddReferral = (m) => {
    setEditingReferral(null);
    setReferralForm({ ...EMPTY_REFERRAL, date: today(), memberId: m.id, memberName: m.name });
    setReferralModal(true);
  };

  const openEditReferral = (r) => {
    setEditingReferral(r);
    const li = r.lineItems && r.lineItems.length
      ? r.lineItems.map((x) => ({ service: x.service || "", subscription: !!x.subscription, amount: x.amount != null ? String(x.amount) : "" }))
      : [{ service: r.package || "", subscription: false, amount: r.amount != null ? String(r.amount) : "" }];
    setReferralForm({ referredClientName: r.referredClientName, lineItems: li, date: r.date || "", status: r.status, notes: r.notes || "", memberId: r.memberId, memberName: r.memberName });
    setReferralModal(true);
  };

  const stamps = (prev, next) => ({
    ...(!isBooked({ status: prev }) && isBooked({ status: next }) ? { booked_at: new Date().toISOString() } : {}),
    ...(!isSigned({ status: prev }) && isSigned({ status: next }) ? { signed_at: new Date().toISOString() } : {}),
  });

  const saveReferral = async () => {
    if (!referralForm.referredClientName.trim()) return;
    const lineItems = (referralForm.lineItems || [])
      .map((li) => ({ service: li.service, subscription: !!li.subscription, amount: parseFloat(li.amount) || 0 }))
      .filter((li) => li.service);
    const data = {
      referredClientName: referralForm.referredClientName.trim(),
      lineItems,
      package: lineItems.map((li) => li.service).join(", "),
      amount: lineItems.reduce((s, li) => s + li.amount, 0),
      date: referralForm.date || today(),
      status: referralForm.status,
      notes: referralForm.notes || "",
    };
    try {
      if (editingReferral) {
        const full = { ...data, ...stamps(editingReferral.status, data.status) };
        await base44.entities.PrestigeReferral.update(editingReferral.id, full);
        const updated = referrals.map((r) => (r.id === editingReferral.id ? { ...r, ...full } : r));
        setReferrals(updated);
        setReferralModal(false);
        await settle(members.find((m) => m.id === editingReferral.memberId), referrals, updated, { referral: { ...editingReferral, ...full }, prevStatus: editingReferral.status, nextStatus: full.status });
      } else {
        const member = members.find((m) => m.id === referralForm.memberId);
        const created = await base44.entities.PrestigeReferral.create({ ...data, ...stamps("Pending", data.status), memberId: member.id, memberName: member.name });
        const updated = [created, ...referrals];
        setReferrals(updated);
        setReferralModal(false);
        await settle(member, referrals, updated, { referral: created, prevStatus: "Pending", nextStatus: created.status });
      }
    } catch (e) {
      toast({ title: "Could not save referral", description: e.message, variant: "destructive" });
    }
  };

  const deleteReferral = (r) => setConfirm({
    title: `Delete the ${r.referredClientName} referral?`,
    body: "Rewards already logged for it stay in the reward history (void them there if needed).",
    label: "Delete referral",
    action: async () => {
      await base44.entities.PrestigeReferral.delete(r.id);
      const updated = referrals.filter((x) => x.id !== r.id);
      setReferrals(updated);
      await settle(members.find((m) => m.id === r.memberId), referrals, updated);
    },
  });

  const updateReferralStatus = async (r, status) => {
    if (status === r.status) return;
    const patch = { status, ...stamps(r.status, status) };
    try {
      await base44.entities.PrestigeReferral.update(r.id, patch);
      const updated = referrals.map((x) => (x.id === r.id ? { ...x, ...patch } : x));
      setReferrals(updated);
      await settle(members.find((m) => m.id === r.memberId), referrals, updated, { referral: { ...r, ...patch }, prevStatus: r.status, nextStatus: status });
    } catch (e) {
      toast({ title: "Could not update status", description: e.message, variant: "destructive" });
    }
  };

  // ---------- rewards ----------
  const setRewardStatus = async (rw, status) => {
    const patch = { status, delivered_at: status === "delivered" ? new Date().toISOString() : null };
    try {
      await base44.entities.PrestigeReward.update(rw.id, patch);
      setRewards((x) => x.map((y) => (y.id === rw.id ? { ...y, ...patch } : y)));
      if (status === "delivered") toast({ title: "Marked delivered", description: `${rw.title} for ${rw.memberName}` });
    } catch (e) {
      toast({ title: "Could not update reward", description: e.message, variant: "destructive" });
    }
  };

  // ---------- credit redemptions (never auto-deducted: only approved / fulfilled rows count) ----------
  const syncRequest = async (x, patch) => {
    if (!x.request_id) return;
    await base44.entities.ClientRequest.update(x.request_id, patch).catch(() => null);
  };
  const setRedemption = async (x, status) => {
    const label = creditCategory(x.category)?.label || x.category;
    if (status === "approved" || status === "fulfilled") {
      // Re-check the rules at approval time against the balance without this row.
      const others = redemptions.filter((y) => y.id !== x.id);
      const c = creditsFor(x.memberId, others);
      const err = x.status === "approved" && status === "fulfilled" ? "" : redemptionError({ category: x.category, amount: Number(x.amount), available: c.balance });
      if (err) { toast({ title: "Can't approve this one", description: err, variant: "destructive" }); return; }
    }
    const now = new Date().toISOString();
    const patch = { status, ...(status === "fulfilled" ? { fulfilled_at: now } : {}), ...(status !== "requested" && x.status === "requested" ? { decided_at: now } : {}) };
    try {
      await base44.entities.PrestigeRedemption.update(x.id, patch);
      setRedemptions((rs) => rs.map((y) => (y.id === x.id ? { ...y, ...patch } : y)));
      if (status === "approved") await syncRequest(x, { status: "in_progress", client_note: `Approved: ${money(x.amount)} of your Interstellar credit is going to ${label.toLowerCase()}.` });
      if (status === "fulfilled") await syncRequest(x, { status: "complete", completed_at: now });
      if (status === "declined") await syncRequest(x, { status: "declined", client_note: "This credit redemption wasn't approved, so nothing came off your balance. Message Justin with any questions." });
      toast({ title: `${REDEMPTION_STATUS_LABEL[status] || status}`, description: `${x.memberName} · ${label} · ${money(x.amount)}` });
    } catch (e) {
      toast({ title: "Could not update the redemption", description: e.message, variant: "destructive" });
    }
  };
  const logRedemption = async ({ memberId, category, amount, details }) => {
    const m = members.find((x) => x.id === memberId);
    const cat = creditCategory(category);
    const err = !m ? "Pick a referrer." : redemptionError({ category, amount, available: creditsFor(memberId).available });
    if (err) throw new Error(err);
    const now = new Date().toISOString();
    const created = await base44.entities.PrestigeRedemption.create({
      memberId: m.id, memberName: m.name, client_id: m.client_id || undefined, client_name: clients.find((c) => c.id === m.client_id)?.business || undefined,
      category, category_group: cat.group, amount, status: "approved", details: details || "", source: "admin", requested_at: now, decided_at: now,
    });
    setRedemptions((rs) => [created, ...rs]);
    setRedeemFor(null);
    toast({ title: "Redemption logged", description: `${m.name} · ${cat.label} · ${money(amount)} deducted from their balance` });
  };

  const backfill = () => {
    const payloads = members.flatMap((m) => missingRewards({ member: m, referrals, offer, existing: rewards }));
    if (!payloads.length) { toast({ title: "Reward history is complete", description: "Every booked call, signed referral and tier already has a reward logged." }); return; }
    setConfirm({
      title: `Log ${payloads.length} missing reward${payloads.length === 1 ? "" : "s"}?`,
      body: `Referrals recorded before rewards were tracked haven't earned anything in the history yet. This logs them as owed under the current offer (${[...new Set(payloads.map((p) => p.memberName))].join(", ")}). Skip this if those were settled under the old program.`,
      label: "Log as owed",
      action: async () => {
        const created = await base44.entities.PrestigeReward.bulkCreate(payloads);
        setRewards((x) => [...(created || []), ...x]);
        toast({ title: `${payloads.length} rewards logged` });
      },
    });
  };

  // ---------- offer ----------
  const saveOffer = async (clean) => {
    try {
      if (offerRec?.id) {
        await base44.entities.AppSettings.update(offerRec.id, { prestigeOffer: clean });
        setOfferRec({ ...offerRec, prestigeOffer: clean });
      } else {
        const created = await base44.entities.AppSettings.create({ key: OFFER_KEY, prestigeOffer: clean });
        setOfferRec(created);
      }
      setOfferOpen(false);
      toast({ title: "Offer saved", description: "New rewards use these values from now on." });
    } catch (e) {
      toast({ title: "Could not save the offer", description: e.message, variant: "destructive" });
    }
  };

  // ---------- share ----------
  const copy = async (text, what = "Link") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${what} copied` });
    } catch {
      toast({ title: "Copy failed", description: text });
    }
  };

  const preview = (idx) => setUnlock({ ...unlockProps(idx, offer, "Preview"), sound: true, key: Date.now() });
  const leaderIdx = board.length ? tierIndex(board[0].signed, offer) : 0;
  const holders = (i) => board.filter((b) => tierIndex(b.signed, offer) === i).map((b) => b.m.name);
  const defaultTag = offer.is_default ? <span className="ml-1.5 align-middle font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/40">default</span> : null;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Agency / Prestige" rightText="Referral program">
        <button type="button" onClick={() => setOfferOpen(true)} className="inline-flex h-9 items-center gap-1.5 border border-hair bg-card px-3 text-[12.5px] font-medium text-ink/75 hover:border-[#ff3c00] hover:text-[#ff3c00]">
          <Settings2 className="h-3.5 w-3.5" /> Edit offer
        </button>
      </PageHeader>

      <div className="space-y-8 px-4 py-6 md:px-8">
        {/* ---------- HERO ---------- */}
        <section className="band-dark grain relative overflow-hidden rounded-md">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,106,0,.35),transparent_65%)]" />
          <div className="relative grid gap-6 p-5 md:p-7 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="mono-label text-[10px] text-white/50">(Prestige / referral program)</p>
              <h2 className="mt-3 text-[32px] font-semibold leading-[0.98] tracking-[-0.045em] md:text-[46px]">
                Every referral pays.<br /><span className="bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00] bg-clip-text text-transparent">Every tier unlocks.</span>
              </h2>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/65">
                Call booked: <span className="text-white">{offer.booked.title}</span>{defaultTag}. Signed: <span className="text-white">{offer.signed.title}</span>{defaultTag}. Then ranks from {offer.tiers[0]?.name} to {offer.tiers[offer.tiers.length - 1]?.name}.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-white/10 sm:grid-cols-4">
                {[
                  [active.length, "Referrers", Users],
                  [totalBooked, "Calls booked", Zap],
                  [totalSigned, "Signed", Trophy],
                  [owed.length, owedValue ? `Owed · ${money(owedValue)}` : "Rewards owed", Gift],
                ].map(([v, l, Icon]) => (
                  <div key={l} className="bg-[#1a1a1a] px-4 py-4">
                    <Icon className="h-3.5 w-3.5 text-[#ff6a00]" />
                    <p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.05em] tabular-nums">{loading ? "–" : v}</p>
                    <p className="mono-label mt-2 text-[9.5px] text-white/50">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => setAddModal(true)} className="btn-roll is-flame"><span className="roll"><span>Add referrer</span><span>Add referrer</span></span><span className="box"><Plus className="h-3.5 w-3.5" /></span></button>
                <button type="button" onClick={() => setTermsOpen(true)} className="h-10 border border-white/25 px-4 text-[13px] text-white hover:bg-white hover:text-ink">Program terms</button>
              </div>
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between">
                <p className="mono-label text-[10px] text-white/55">Leaderboard</p>
                <Crown className="h-4 w-4 text-[#ffaa00]" />
              </div>
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
              ) : board.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-white/50">No referrers yet. Add your first one and send them their link.</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {board.slice(0, 5).map(({ m, signed, booked }, i) => {
                    const pr = progressFor(signed, offer);
                    return (
                      <li key={m.id} className="flex items-center gap-3 rounded-md bg-white/[0.03] px-3 py-2.5">
                        <span className={`w-5 text-center font-mono text-[13px] font-bold ${i === 0 ? "text-[#ffaa00]" : "text-white/40"}`}>{i + 1}</span>
                        <PrestigeEmblem tier={pr.idx || 1} locked={!pr.idx} size={34} showNumeral={false} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13.5px] font-semibold">{m.name}</span>
                            <span className="shrink-0 font-mono text-[11px] text-white/55">{signed} signed · {booked} booked</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="mono-label shrink-0 text-[9px] text-[#ff6a00]">{tierLabel(pr.idx, offer)}</span>
                            <div className="h-1 flex-1 overflow-hidden bg-white/10"><div className="h-full flame-bg" style={{ width: `${pr.pct}%` }} /></div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </section>

        {/* ---------- LADDER ---------- */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label-cross">(The ladder)</p>
              <h3 className="mt-2 text-[26px] font-semibold tracking-[-0.04em]">Tier unlocks <span className="text-ink/40">by signed referrals</span></h3>
            </div>
            {offer.is_default && <p className="max-w-sm text-[12px] text-ink/50">Showing starter default rewards and thresholds. Change any of them in <button type="button" onClick={() => setOfferOpen(true)} className="text-[#ff3c00] hover:underline">Edit offer</button>.</p>}
          </div>
          <div className="no-scrollbar mt-4 flex snap-x gap-3 overflow-x-auto pb-1 md:grid md:overflow-visible" style={{ gridTemplateColumns: `repeat(${offer.tiers.length}, minmax(0, 1fr))` }}>
            {offer.tiers.map((t, i) => {
              const idx = i + 1;
              const state = leaderIdx >= idx ? "unlocked" : leaderIdx + 1 === idx ? "next" : "locked";
              const pct = board.length ? Math.min(100, (board[0].signed / t.threshold) * 100) : 0;
              return <div key={i} className="snap-start"><TierLadderCard tier={t} index={idx} state={state} pct={pct} holders={holders(idx)} onPreview={() => preview(idx)} isDefault={offer.is_default} /></div>;
            })}
          </div>
          <p className="mt-2 text-[11.5px] text-ink/45">Unlocked / up next reflects your top referrer. Each referrer&apos;s own progress is below.</p>
        </section>

        {/* ---------- OFFER + PLAYBOOK ---------- */}
        <section className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
          <div className="rounded-md border border-hair bg-card p-5">
            <p className="label-cross">(Earned instantly)</p>
            <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em]">Every referral earns something</h3>
            <div className="mt-4 space-y-3">
              {[["Books a call", offer.booked, Zap], ["Signs (first invoice paid)", offer.signed, Trophy]].map(([when, r, Icon]) => (
                <div key={when} className="flex gap-3 rounded-md border border-hair bg-ink/[0.02] p-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center flame-bg text-white"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="mono-label text-[9.5px] text-ink/50">{when}</p>
                    <p className="text-[15px] font-semibold tracking-[-0.02em]">{r.title}</p>
                    <p className="text-[12.5px] leading-snug text-ink/55">{r.detail}</p>
                    {r.value ? <p className="mt-1 font-mono text-[11px] text-[#ff3c00]">{money(r.value)} credit to their balance</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="band-dark grain rounded-md p-5">
            <p className="mono-label text-[10px] text-white/50">Hormozi playbook</p>
            <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em]">Why this works</h3>
            <ol className="relative mt-4 space-y-3">
              {PLAYBOOK.map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 font-mono text-[12px] font-bold text-[#ff6a00]">0{i + 1}</span>
                  <div>
                    <p className="text-[14px] font-semibold">{t}</p>
                    <p className="text-[12.5px] leading-snug text-white/60">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- TABS ---------- */}
        <section>
          <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-hair">
            {[["referrers", `Referrers (${members.length})`], ["rewards", `Rewards${owed.length ? ` · ${owed.length} owed` : ""}`], ["credits", `Credits${pendingRedemptions.length ? ` · ${pendingRedemptions.length} to approve` : ""}`], ["referrals", `All referrals (${referrals.length})`]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-[13px] font-medium transition-colors ${tab === k ? "border-[#ff3c00] text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>{l}</button>
            ))}
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ink/40" /></div>
            ) : tab === "referrers" ? (
              <div className="space-y-3">
                {members.length === 0 && <Empty icon={Sparkles}>No referrers yet. Add your first one, then send them their link.</Empty>}
                {members.map((m) => (
                  <MemberCard
                    key={m.id}
                    m={m}
                    offer={offer}
                    stats={statsFor(m.id)}
                    refs={referrals.filter((r) => r.memberId === m.id)}
                    memberRewards={rewards.filter((r) => r.memberId === m.id)}
                    client={clients.find((c) => c.id === m.client_id)}
                    expanded={expandedMember === m.id}
                    onToggle={() => setExpandedMember(expandedMember === m.id ? null : m.id)}
                    onEdit={() => openEditMember(m)}
                    onDelete={() => deleteMember(m)}
                    onAddReferral={() => openAddReferral(m)}
                    onEditReferral={openEditReferral}
                    onDeleteReferral={deleteReferral}
                    onStatus={updateReferralStatus}
                    onCopy={copy}
                    onCelebrate={(idx) => setUnlock({ ...unlockProps(idx, offer, m.name), sound: true, key: Date.now() })}
                  />
                ))}
              </div>
            ) : tab === "rewards" ? (
              <RewardsPanel rewards={rewards} filter={rewardFilter} setFilter={setRewardFilter} onStatus={setRewardStatus} onBackfill={backfill} />
            ) : tab === "credits" ? (
              <CreditsPanel members={members} redemptions={redemptions} creditsFor={creditsFor} onStatus={setRedemption} onLog={(id) => setRedeemFor(id || "")} />
            ) : (
              <ReferralsList referrals={referrals} members={members} offer={offer} statsFor={statsFor} onEdit={openEditReferral} onDelete={deleteReferral} onStatus={updateReferralStatus} />
            )}
          </div>
        </section>
      </div>

      {/* ---------- modals ---------- */}
      <AddMemberModal open={addModal} onOpenChange={setAddModal} onSave={enrollMember} clients={clients} offer={offer} />
      <OfferEditor open={offerOpen} onOpenChange={setOfferOpen} offer={offer} onSave={saveOffer} />
      <LogRedemptionDialog memberId={redeemFor} members={members} creditsFor={creditsFor} onClose={() => setRedeemFor(null)} onSave={logRedemption} />

      <Dialog open={memberModal} onOpenChange={setMemberModal}>
        <DialogContent className="max-w-md border-ink/[0.13] bg-card text-ink">
          <DialogHeader><DialogTitle className="text-ink">Edit referrer</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs text-ink/[0.58]">Name *</Label><Input value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} className={fieldCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-ink/[0.58]">Email</Label><Input value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} className={fieldCls} /></div>
              <div><Label className="text-xs text-ink/[0.58]">Phone</Label><Input value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} className={fieldCls} /></div>
            </div>
            <div>
              <Label className="text-xs text-ink/[0.58]">CRM client (shows their progress in the client portal)</Label>
              <select value={memberForm.client_id} onChange={(e) => setMemberForm({ ...memberForm, client_id: e.target.value })} className={selectCls}>
                <option value="">Not linked</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}
              </select>
            </div>
            <div><Label className="text-xs text-ink/[0.58]">Referral code (?ref=…)</Label><Input value={memberForm.referral_code} onChange={(e) => setMemberForm({ ...memberForm, referral_code: e.target.value })} className={fieldCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-ink/[0.58]">Join date</Label><Input type="date" value={memberForm.joinDate} onChange={(e) => setMemberForm({ ...memberForm, joinDate: e.target.value })} className={fieldCls} /></div>
              <label className="flex cursor-pointer items-end gap-2 pb-2">
                <input type="checkbox" checked={memberForm.active} onChange={(e) => setMemberForm({ ...memberForm, active: e.target.checked })} className="h-4 w-4 accent-[#ff3c00]" />
                <span className="text-sm text-ink/60">Active</span>
              </label>
            </div>
            <div><Label className="text-xs text-ink/[0.58]">Notes</Label><textarea value={memberForm.notes} onChange={(e) => setMemberForm({ ...memberForm, notes: e.target.value })} className="mt-1 min-h-[60px] w-full resize-none rounded-md border border-ink/[0.13] bg-ink/[0.03] px-3 py-2 text-sm text-ink outline-none" /></div>
            <p className="text-[11.5px] text-ink/45">Rank is set automatically from signed referrals.</p>
            <Button onClick={saveMember} className="w-full bg-[#ff3c00] font-semibold text-white hover:bg-ink">Save changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={referralModal} onOpenChange={setReferralModal}>
        <DialogContent className="max-w-md border-ink/[0.13] bg-card text-ink">
          <DialogHeader><DialogTitle className="text-ink">{editingReferral ? "Edit referral" : `New referral from ${referralForm.memberName || ""}`}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs text-ink/[0.58]">Referred business *</Label><Input value={referralForm.referredClientName} onChange={(e) => setReferralForm({ ...referralForm, referredClientName: e.target.value })} className={fieldCls} /></div>
            <ServiceLineItems value={referralForm.lineItems} onChange={(lv) => setReferralForm({ ...referralForm, lineItems: lv })} />
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-ink/[0.58]">Date</Label><Input type="date" value={referralForm.date} onChange={(e) => setReferralForm({ ...referralForm, date: e.target.value })} className={fieldCls} /></div>
              <div>
                <Label className="text-xs text-ink/[0.58]">Stage</Label>
                <select value={referralForm.status} onChange={(e) => setReferralForm({ ...referralForm, status: e.target.value })} className={selectCls}>
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
            <div><Label className="text-xs text-ink/[0.58]">Notes</Label><textarea value={referralForm.notes} onChange={(e) => setReferralForm({ ...referralForm, notes: e.target.value })} className="mt-1 min-h-[60px] w-full resize-none rounded-md border border-ink/[0.13] bg-ink/[0.03] px-3 py-2 text-sm text-ink outline-none" /></div>
            <p className="text-[11.5px] text-ink/45">Call booked earns a &ldquo;{offer.booked.title}&rdquo; (logged as owed until you use it). Signed (first invoice paid) adds &ldquo;{offer.signed.title}&rdquo; to their credit balance automatically.</p>
            <Button onClick={saveReferral} className="w-full bg-[#ff3c00] font-semibold text-white hover:bg-ink">{editingReferral ? "Save changes" : "Add referral"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-md border-ink/[0.13] bg-card text-ink">
          <DialogHeader><DialogTitle className="text-ink">Program terms</DialogTitle></DialogHeader>
          <p className="whitespace-pre-line pt-2 text-sm leading-relaxed text-ink/65">{offer.terms}</p>
          {offer.is_default && <p className="text-[11.5px] text-ink/45">Default terms. Edit them in Edit offer.</p>}
          <Button onClick={() => setTermsOpen(false)} className="w-full bg-ink text-white hover:bg-[#ff3c00]">Close</Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent className="border-ink/[0.13] bg-card text-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#ff3c00] text-white hover:bg-ink"
              onClick={async () => {
                const c = confirm;
                setConfirm(null);
                try { await c?.action?.(); } catch (e) { toast({ title: "Something went wrong", description: e.message, variant: "destructive" }); }
              }}
            >
              {confirm?.label || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PrestigeUnlock
        key={unlock?.key}
        open={!!unlock}
        tierIndex={unlock?.tierIndex}
        title={unlock?.title}
        subtitle={unlock?.subtitle}
        memberName={unlock?.memberName}
        rewards={unlock?.rewards || []}
        sound={unlock?.sound}
        onClose={() => setUnlock(null)}
      />
    </div>
  );
}

function Empty({ icon: Icon = Sparkles, children }) {
  return (
    <div className="rounded-md border border-dashed border-hair bg-card p-10 text-center">
      <Icon className="mx-auto mb-3 h-7 w-7 text-ink/25" />
      <p className="text-[13px] text-ink/50">{children}</p>
    </div>
  );
}

function StatusSelect({ r, onStatus, className = "" }) {
  return (
    <select value={r.status} onChange={(e) => onStatus(r, e.target.value)} className={`cursor-pointer rounded border-0 px-2 py-1 text-[11px] font-semibold outline-none ${STATUS_TONE[r.status] || ""} ${className}`}>
      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
    </select>
  );
}

function MemberCard({ m, offer, stats, refs, memberRewards, client, expanded, onToggle, onEdit, onDelete, onAddReferral, onEditReferral, onDeleteReferral, onStatus, onCopy, onCelebrate }) {
  const pr = progressFor(stats.signed, offer);
  const link = referralLink(m, offer);
  const text = shareText(m, offer);
  const owedHere = memberRewards.filter((r) => r.status === "owed");
  return (
    <div className={`card-hover overflow-hidden rounded-md border bg-card ${pr.idx ? "border-[#ff3c00]/25" : "border-hair"} ${m.active === false ? "opacity-60" : ""}`}>
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <button type="button" onClick={() => pr.idx && onCelebrate(pr.idx)} title={pr.idx ? "Replay unlock" : "Not ranked yet"} className="shrink-0">
            <PrestigeEmblem tier={pr.idx || 1} locked={!pr.idx} size={52} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold tracking-[-0.02em]">{m.name}</span>
              <span className={`mono-label rounded px-1.5 py-0.5 text-[9px] ${pr.idx ? "bg-[#ff3c00]/10 text-[#ff3c00]" : "bg-ink/[0.06] text-ink/50"}`}>{tierLabel(pr.idx, offer)}</span>
              {client && <span className="text-[11px] text-ink/45">· {client.business}</span>}
              {m.active === false && <span className="rounded bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink/50">Inactive</span>}
              {owedHere.length > 0 && <span className="rounded bg-[#ffaa00]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#a35a00]">{owedHere.length} owed</span>}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="font-mono text-ink/60">{stats.signed} signed · {stats.booked} booked · {stats.total} sent</span>
              <span className="text-ink/50">{pr.maxed ? "Top of the ladder" : `${pr.remaining} more to ${pr.next.name}`}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden bg-ink/[0.07]"><div className="h-full flame-bg transition-[width] duration-700" style={{ width: `${pr.pct}%` }} /></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <button type="button" onClick={() => onCopy(link, "Referral link")} className="inline-flex h-8 items-center gap-1.5 border border-hair px-2.5 text-[11.5px] font-medium text-ink/70 hover:border-[#ff3c00] hover:text-[#ff3c00]" title={link}><Copy className="h-3 w-3" />Link</button>
          <a href={smsHref(text)} className="inline-flex h-8 items-center gap-1.5 border border-hair px-2.5 text-[11.5px] font-medium text-ink/70 hover:border-[#ff3c00] hover:text-[#ff3c00]" title="Text the share message"><MessageSquare className="h-3 w-3" />Text</a>
          <a href={mailHref(text)} className="inline-flex h-8 items-center gap-1.5 border border-hair px-2.5 text-[11.5px] font-medium text-ink/70 hover:border-[#ff3c00] hover:text-[#ff3c00]" title="Email the share message"><Mail className="h-3 w-3" />Email</a>
          <button type="button" onClick={() => onCopy(text, "Share message")} className="inline-flex h-8 items-center gap-1.5 border border-hair px-2.5 text-[11.5px] font-medium text-ink/70 hover:border-[#ff3c00] hover:text-[#ff3c00]"><Copy className="h-3 w-3" />Message</button>
          <button type="button" onClick={onAddReferral} className="inline-flex h-8 items-center gap-1 bg-[#ff3c00] px-2.5 text-[11.5px] font-medium text-white hover:bg-ink"><Plus className="h-3 w-3" />Referral</button>
          <button type="button" onClick={onEdit} className="p-1.5 text-ink/40 hover:text-ink" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onDelete} className="p-1.5 text-ink/40 hover:text-red-600" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onToggle} className="p-1.5 text-ink/40 hover:text-ink" title="Referral log">{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-hair bg-ink/[0.015] px-4 py-3">
          {m.notes && <p className="mb-3 text-[12px] italic text-ink/55">{m.notes}</p>}
          <p className="mb-2 break-all font-mono text-[10.5px] text-ink/45">{link}</p>
          <p className="mono-label mb-2 text-[9.5px] text-ink/50">Referral log ({refs.length})</p>
          {refs.length === 0 ? <p className="text-[12px] text-ink/40">No referrals yet.</p> : (
            <div className="space-y-1.5">
              {refs.map((r) => (
                <div key={r.id} className="group flex flex-wrap items-center gap-2 rounded bg-card px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{r.referredClientName}</span>
                  {r.package && <span className="hidden truncate text-[11px] text-ink/45 sm:inline">{r.package}</span>}
                  {r.amount > 0 && <span className="font-mono text-[11px] text-[#ff3c00]/80">{money(r.amount)}</span>}
                  {r.date && <span className="text-[10.5px] text-ink/40">{fmtDay(r.date)}</span>}
                  <StatusSelect r={r} onStatus={onStatus} />
                  <button type="button" onClick={() => onEditReferral(r)} className="p-1 text-ink/35 hover:text-ink"><Pencil className="h-3 w-3" /></button>
                  <button type="button" onClick={() => onDeleteReferral(r)} className="p-1 text-ink/35 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RewardsPanel({ rewards, filter, setFilter, onStatus, onBackfill }) {
  const list = rewards.filter((r) => (filter === "all" ? true : r.status === filter));
  const KIND = { priority_pass: "Priority Pass", credit_500: "$500 credit", tier_unlock: "Tier unlock" };
  const typeOf = (r) => r.reward_type || (r.kind === "booked" ? "priority_pass" : r.kind === "signed" ? "credit_500" : "tier_unlock");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {[["owed", "Owed"], ["delivered", "Delivered"], ["void", "Void"], ["all", "All"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={`h-8 border px-3 text-[12px] font-medium ${filter === k ? "border-ink bg-ink text-white" : "border-hair bg-card text-ink/60 hover:text-ink"}`}>
              {l} <span className="opacity-60">{rewards.filter((r) => k === "all" || r.status === k).length}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onBackfill} className="text-[12px] text-ink/50 hover:text-[#ff3c00]">Check for missing rewards</button>
      </div>
      {list.length === 0 ? <Empty icon={Gift}>{filter === "owed" ? "Nothing owed right now." : "No rewards here yet."}</Empty> : (
        <div className="overflow-hidden rounded-md border border-hair bg-card">
          <ul className="divide-y divide-hair">
            {list.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`mono-label rounded px-1.5 py-0.5 text-[9px] ${typeOf(r) === "tier_unlock" ? "bg-[#ff3c00] text-white" : "bg-ink/[0.06] text-ink/60"}`}>{KIND[typeOf(r)]}</span>
                    <span className={`text-[13.5px] font-semibold ${r.status === "void" ? "text-ink/40 line-through" : ""}`}>{r.title}</span>
                    {r.value ? <span className="font-mono text-[11px] text-[#ff3c00]">{money(r.value)}</span> : null}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-ink/50">
                    {r.memberName}{r.referredClientName ? ` · for ${r.referredClientName}` : ""} · earned {fmtDay(r.earned_at || r.created_date)}
                    {r.status === "delivered" && r.delivered_at ? ` · ${typeOf(r) === "credit_500" ? "in balance since" : typeOf(r) === "priority_pass" ? "used" : "delivered"} ${fmtDay(r.delivered_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.status === "owed" && (
                    <>
                      <button type="button" onClick={() => onStatus(r, "delivered")} className="inline-flex h-8 items-center gap-1.5 bg-ink px-3 text-[12px] font-medium text-white hover:bg-[#ff3c00]"><Check className="h-3.5 w-3.5" />{typeOf(r) === "priority_pass" ? "Mark used" : typeOf(r) === "credit_500" ? "Add to balance" : "Mark delivered"}</button>
                      <button type="button" onClick={() => onStatus(r, "void")} className="p-2 text-ink/35 hover:text-red-600" title="Void"><Ban className="h-3.5 w-3.5" /></button>
                    </>
                  )}
                  {r.status !== "owed" && (
                    <button type="button" onClick={() => onStatus(r, "owed")} className="inline-flex h-8 items-center gap-1.5 border border-hair px-3 text-[12px] text-ink/60 hover:text-ink"><Undo2 className="h-3.5 w-3.5" />Back to owed</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CreditsPanel({ members, redemptions, creditsFor, onStatus, onLog }) {
  const rows = members.map((m) => ({ m, c: creditsFor(m.id) })).filter((x) => x.c.earned || x.c.redeemed || x.c.pending);
  const btn = "inline-flex h-8 items-center gap-1.5 px-3 text-[12px] font-medium";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-[12px] text-ink/55">Each signed referral adds ${"500"} credit. Balance = earned − approved spends. Client requests wait here for you and are never deducted until you approve. Builds stack with no cap; merch, marketing materials, social posts, videos and ad spend are capped at ${CREDIT_CAP} per redemption.</p>
        <button type="button" onClick={() => onLog("")} className={`${btn} bg-[#ff3c00] text-white hover:bg-ink`}><Plus className="h-3.5 w-3.5" />Log redemption</button>
      </div>

      {rows.length === 0 ? <Empty icon={Coins}>No credit earned yet. Credit lands when a referral signs (first invoice paid).</Empty> : (
        <div className="overflow-x-auto rounded-md border border-hair bg-card">
          <table className="w-full min-w-[560px] text-[12.5px]">
            <thead><tr className="border-b border-hair text-left">{["Referrer", "Earned", "Redeemed", "Pending", "Balance", ""].map((h) => <th key={h} className="mono-label px-4 py-2 text-[9.5px] font-normal text-ink/50">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-hair">
              {rows.map(({ m, c }) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 font-medium">{m.name}</td>
                  <td className="px-4 py-2.5 font-mono">{money(c.earned) || "$0"}</td>
                  <td className="px-4 py-2.5 font-mono">{money(c.redeemed) || "$0"}</td>
                  <td className="px-4 py-2.5 font-mono text-ink/55">{money(c.pending) || "$0"}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-[#ff3c00]">{money(c.balance) || "$0"}</td>
                  <td className="px-4 py-2.5 text-right"><button type="button" disabled={c.available <= 0} onClick={() => onLog(m.id)} className="text-[12px] text-ink/55 hover:text-[#ff3c00] disabled:opacity-30">Log spend</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <p className="mono-label mb-2 text-[9.5px] text-ink/50">Redemptions ({redemptions.length})</p>
        {redemptions.length === 0 ? <Empty icon={Coins}>No redemptions yet. Client requests from the portal (Referrals &gt; Use my credits) show up here.</Empty> : (
          <div className="overflow-hidden rounded-md border border-hair bg-card">
            <ul className="divide-y divide-hair">
              {redemptions.map((x) => {
                const cat = creditCategory(x.category);
                return (
                  <li key={x.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`mono-label rounded px-1.5 py-0.5 text-[9px] ${x.category_group === "build" ? "bg-[#ff3c00] text-white" : "bg-ink/[0.06] text-ink/60"}`}>{x.category_group === "build" ? "Build" : `Capped $${CREDIT_CAP}`}</span>
                        <span className={`text-[13.5px] font-semibold ${x.status === "declined" ? "text-ink/40 line-through" : ""}`}>{cat?.label || x.category}</span>
                        <span className="font-mono text-[11px] text-[#ff3c00]">{money(x.amount)}</span>
                        <span className="rounded bg-ink/[0.05] px-1.5 py-0.5 text-[10px] text-ink/60">{REDEMPTION_STATUS_LABEL[x.status] || x.status}</span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-ink/50">{x.memberName} · {x.source === "admin" ? "logged by you" : "from the portal"} · {fmtDay(x.requested_at || x.created_date)}{x.details ? ` · ${x.details}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {x.status === "requested" && (
                        <>
                          <button type="button" onClick={() => onStatus(x, "approved")} className={`${btn} bg-ink text-white hover:bg-[#ff3c00]`}><Check className="h-3.5 w-3.5" />Approve</button>
                          <button type="button" onClick={() => onStatus(x, "declined")} className="p-2 text-ink/35 hover:text-red-600" title="Decline"><Ban className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                      {x.status === "approved" && <button type="button" onClick={() => onStatus(x, "fulfilled")} className={`${btn} border border-hair text-ink/70 hover:text-ink`}><Check className="h-3.5 w-3.5" />Mark done</button>}
                      {x.status === "declined" && <button type="button" onClick={() => onStatus(x, "requested")} className={`${btn} border border-hair text-ink/60 hover:text-ink`}><Undo2 className="h-3.5 w-3.5" />Reopen</button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div>
        <p className="mono-label mb-2 text-[9.5px] text-ink/50">What clients see: where credits go</p>
        <CreditTiles />
      </div>
    </div>
  );
}

function LogRedemptionDialog({ memberId, members, creditsFor, onClose, onSave }) {
  const open = memberId !== null && memberId !== undefined;
  const [form, setForm] = useState({ memberId: "", category: "", amount: "", details: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setForm({ memberId: memberId || "", category: "", amount: "", details: "" }); setErr(""); } }, [open, memberId]);
  const c = form.memberId ? creditsFor(form.memberId) : null;
  const save = async () => {
    setBusy(true); setErr("");
    try { await onSave({ ...form, amount: Number(form.amount) }); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md border-ink/[0.13] bg-card text-ink">
        <DialogHeader><DialogTitle className="text-ink">Log a credit redemption</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs text-ink/[0.58]">Referrer</Label>
            <select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} className={selectCls}>
              <option value="">Pick a referrer</option>
              {members.map((m) => { const s = creditsFor(m.id); return <option key={m.id} value={m.id}>{m.name} · {money(s.available) || "$0"} available</option>; })}
            </select>
          </div>
          <div>
            <Label className="text-xs text-ink/[0.58]">Where it goes</Label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={selectCls}>
              <option value="">Pick a category</option>
              {CREDIT_GROUPS.map((g) => (
                <optgroup key={g.key} label={g.label}>
                  {CREDIT_CATEGORIES.filter((x) => x.group === g.key).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div><Label className="text-xs text-ink/[0.58]">Amount ($)</Label><Input type="number" min="1" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={fieldCls} /></div>
          <div><Label className="text-xs text-ink/[0.58]">Notes</Label><textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className="mt-1 min-h-[60px] w-full resize-none rounded-md border border-ink/[0.13] bg-ink/[0.03] px-3 py-2 text-sm text-ink outline-none" /></div>
          <p className="text-[11.5px] text-ink/45">{c ? `Balance ${money(c.balance) || "$0"} · ${money(c.pending) || "$0"} pending · ${money(c.available) || "$0"} available. ` : ""}Logged as approved, so it comes off the balance now. Capped categories max ${CREDIT_CAP} per redemption.</p>
          {err && <p className="text-[12px] text-red-600">{err}</p>}
          <Button onClick={save} disabled={busy} className="w-full bg-[#ff3c00] font-semibold text-white hover:bg-ink">{busy ? "Saving…" : "Log redemption"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReferralsList({ referrals, members, offer, statsFor, onEdit, onDelete, onStatus }) {
  if (referrals.length === 0) return <Empty icon={Users}>No referrals recorded yet.</Empty>;
  return (
    <div className="overflow-hidden rounded-md border border-hair bg-card">
      <ul className="divide-y divide-hair">
        {referrals.map((r) => {
          const m = members.find((x) => x.id === r.memberId);
          const idx = m ? tierIndex(statsFor(m.id).signed, offer) : 0;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{r.referredClientName}</p>
                <p className="text-[11px] text-ink/50">via <span className="font-medium text-ink/70">{r.memberName}</span>{m ? ` · ${tierLabel(idx, offer)}` : ""}{r.package ? ` · ${r.package}` : ""}{r.date ? ` · ${fmtDay(r.date)}` : ""}</p>
              </div>
              {r.amount > 0 && <span className="font-mono text-[11.5px] text-[#ff3c00]/80">{money(r.amount)}</span>}
              <StatusSelect r={r} onStatus={onStatus} />
              <button type="button" onClick={() => onEdit(r)} className="p-1.5 text-ink/35 hover:text-ink"><Pencil className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => onDelete(r)} className="p-1.5 text-ink/35 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

