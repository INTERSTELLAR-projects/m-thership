import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, LogOut, X, ChevronDown, Check, Eye, UserRound, LayoutGrid, Menu, Palette } from "lucide-react";
import { ScheduleCallButton, ScheduleCallModal } from "@/features/portal/PortalNav";
import { HEADER_TABS, STUDIO_KEYS, groupsFor, labelFor } from "@/features/portal/v2/portalMap";
import { BrandAssetsPage, SelfServeStrip } from "@/features/portal/v2/PortalPages";
import PortalSubmit from "@/features/portal/v2/PortalSubmit";
import { EverythingSheet, PortalV2Motion } from "@/features/portal/v2/Everything";
import PortalHomeV2 from "@/features/portal/v2/PortalHomeV2";
import { BrainView, MentionsView, BillingView, StudioDuo, PlaybookPending } from "@/features/portal/v2/PortalViews";
import { base44 } from "@/api/base44Client";
import { LOGO_URL } from "@/lib/nav";
import { fmtDate } from "@/lib/useData";
import { Panel, Empty, Tag, Btn, Field } from "@/features/clients/ui";
import { PerformanceView, FileGrid } from "@/features/clients/tabsGrowth";
import PortalChats from "@/features/portal/PortalChats";
import { INTAKE_SECTIONS, intakeProgress } from "@/features/clients/intakeQuestions";
import GridTrail from "@/components/GridTrail";
import BrandLockup from "@/components/brand/BrandLockup";
import PortalSignatures from "@/features/signatures/PortalSignatures";
import PortalSeasons from "@/features/portal/PortalSeasons";
import PortalQr from "@/features/qr/PortalQr";
import PortalPrestige from "@/features/portal/PortalPrestige";
import ClientHealthSummary from "@/features/performance/ClientHealthSummary";
import RequestFormRenderer, { isComplete } from "@/features/requests/RequestFormRenderer";
import { kindLabel, portalForms, priorityFor, toAnswers, titleFor, detailsFor, attachmentsFor } from "@/features/requests/formSchema";
import { KitView } from "@/features/clients/BrandKitTab";
import PortalPlaybook from "@/features/portal/PortalPlaybook";
import PortalResources from "@/features/portal/PortalResources";
import PortalInstagram from "@/features/social/portal/PortalInstagram";
import { PortalGbp } from "@/features/gbp/GbpPanel";
import PortalAssistant, { AssistantLauncher } from "@/features/portal/assistant/PortalAssistant";
import SecurityPanel from "@/features/security/SecurityPanel";
import StudioPreview, { studioTabs, STUDIO_BY_TAB } from "@/features/portal/PortalStudios";
import { IS_DEMO } from "@/lib/qa";
import TwoFactorChallenge from "@/features/security/TwoFactorChallenge";
import { needsSecondFactor } from "@/features/security/api";
import { ClientHeaderBrand } from "@/features/portal/BusinessSwitcher";
import { useFuel } from "@/features/fuel/useFuel";
import { FuelBanner, RefuelModal } from "@/features/fuel/FuelPrompts";
import ErrorBoundary from "@/components/ErrorBoundary";
import PortalUpgrades from "@/features/addons/PortalUpgrades";
import { useAddonStore } from "@/features/addons/api";
import PortalTraining from "@/features/training/PortalTraining";
import PortalEmailStudio from "@/features/email-studio/PortalEmailStudio";
import PortalPresentations from "@/features/presentations/portal/PortalPresentations";
import LeadPortalView from "@/features/leads/LeadPortalView";

// Tabs this portal can show. Grouping, labels and icons for the header nav live in PortalNav.jsx (NAV);
// free-for-life bonus tools (Signatures, QR Codes) are tagged there and listed together on Home.
// Portal v2 (Nov 2026): + brain, mentions, billing. Navigation for all of them is the one-tap map in v2/portalMap.js.
const TABS = [["home", "Glance"], ["assets", "Brand & assets"], ["assistant", "Assistant"], ["results", "Results"], ["gbp", "Google Business"], ["goals", "Goals"], ["files", "Files"], ["resources", "Resources"], ["brand", "Brand kit"], ["playbook", "Playbook"], ["brain", "Your Brain"], ["mentions", "Mentions & PR"], ["requests", "Requests"], ["signatures", "Signatures"], ["qr", "QR Codes"], ["seasons", "Seasons & offers"], ["upgrades", "Upgrades"], ["billing", "Billing"], ["referrals", "Referrals"], ["messages", "Messages"], ["account", "Account"]];

function usePortal(previewId) {
  const call = async (action, args = {}) => (await base44.functions.invoke("portal", { action, client_id: previewId, ...args })).data;
  const home = useQuery({ queryKey: ["portal", previewId, "home"], queryFn: () => call("home"), retry: false });
  return { call, home };
}

// Package-deal owners (one login on several clients' portal_emails) pick which business the portal shows.
// The choice is remembered per browser; the server only honours a client_id this login is on.
const PICK_KEY = "portal.business";
const readPick = () => { try { return localStorage.getItem(PICK_KEY) || ""; } catch { return ""; } };
const writePick = (id) => { try { if (id) localStorage.setItem(PICK_KEY, id); else localStorage.removeItem(PICK_KEY); } catch { /* storage blocked */ } };

export default function PortalApp({ previewId }) {
  const [picked, setPicked] = useState(() => (previewId ? "" : readPick()));
  // scopeId: the client every portal call is for (admin preview id, or the business a package-deal owner picked).
  const scopeId = previewId || picked || undefined;
  const { call, home } = usePortal(scopeId);
  // Demo screen library (preview + ?qa=1&demo=1 only): ?tab= opens a portal tab directly for captures.
  // Back from an Upgrade Store checkout (?tab=upgrades): open the Upgrades tab.
  const [tab, setTab] = useState(() => (IS_DEMO && new URLSearchParams(window.location.search).get("tab")) || (new URLSearchParams(window.location.search).get("tab") === "upgrades" ? "upgrades" : "home"));
  const [audit, setAudit] = useState(false);
  const [qrOpen, setQrOpen] = useState(null); // a QR code to open on the QR tab (from Google Business)
  const [novaAsk, setNovaAsk] = useState(null); // Home "Ask or request anything" -> Nøva drawer ({ text, n })
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["portal", scopeId] });
  const d = home.data;
  // Fuel: Studios plan gating, meter, Refuel wallet (the `fuel` function). Loads once the portal knows its client.
  const { fuel, refresh: refreshFuel } = useFuel(scopeId, { enabled: !!d?.client });
  const [refuelOpen, setRefuelOpen] = useState(false);
  // Back from Stripe Checkout: the webhook credits the wallet a moment later, so re-read the meter a few times.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (!p.get("fuel")) return undefined;
    const timers = p.get("fuel") === "success" ? [0, 4000, 10000, 20000].map((ms) => setTimeout(refreshFuel, ms)) : [];
    p.delete("fuel"); p.delete("session_id");
    window.history.replaceState(null, "", `${window.location.pathname}${p.toString() ? `?${p}` : ""}`);
    return () => timers.forEach(clearTimeout);
     
  }, []);
  // Out of fuel: the Refuel modal opens when the client lands on a Studio page.
  useEffect(() => {
    if (fuel?.out_of_fuel && !fuel.nova_only && STUDIO_BY_TAB[tab]) setRefuelOpen(true);
  }, [tab, fuel?.out_of_fuel, fuel?.nova_only]);
  const businesses = d?.businesses || [];
  // A saved choice this login no longer has: keep what the server resolved (or forget it if only one is left).
  useEffect(() => {
    if (previewId || !picked || !d?.client?.id || d.client.id === picked) return;
    const next = businesses.length > 1 ? d.client.id : "";
    writePick(next);
    setPicked(next);
  }, [previewId, picked, d?.client?.id, businesses.length]);
  const switchTo = (id) => {
    if (!id || id === d?.client?.id) return;
    if (previewId) { window.location.assign(`/portal/${id}`); return; }
    writePick(id);
    // Views keyed without a client id (chats, referrals) are dropped so they reload for the new business.
    qc.removeQueries({ predicate: (q) => q.queryKey[0] === "portal" && q.queryKey[1] == null });
    setAudit(false);
    setQrOpen(null);
    setTab("home");
    setPicked(id);
  };
  // Upgrade Store: the Upgrades tab exists only when this client has at least one add-on offered (or owned).
  const { addons: upgrades } = useAddonStore(scopeId, { enabled: !!d?.client });
  // The Brand kit tab only exists when an approved, portal-visible kit does.
  // Playbook always has a tile (a designed "being written" state until one is published).
  const tabs = [...TABS.filter(([k]) => (k !== "brand" || d?.has_brand_kit) && (k !== "upgrades" || upgrades.length > 0)), ...studioTabs(d?.client, fuel).tabs];
  const st = studioTabs(d?.client, fuel);
  // Do it yourself / Have us do it: the state of the tool on each Studio tab.
  const duoState = (k) => (k === "signatures" || k === "qr" ? "free" : st.planLocked ? "plan" : STUDIO_BY_TAB[k]?.comingSoon ? "soon" : st.locked.has(k) ? "preview" : "on");
  const go = (k) => { setQrOpen(null); setTab(k); window.scrollTo({ top: 0 }); };

  if (home.isLoading) return <Shell><p className="py-24 text-center text-ink/50">Loading your portal…</p></Shell>;
  // This login has 2-step verification on and this session hasn't passed it yet: nothing loads until it does.
  if (home.isError && needsSecondFactor(home.error)) {
    const info = home.error.response.data || {};
    return <TwoFactorChallenge methods={info.methods} emailHint={info.email_hint} onDone={() => qc.resetQueries({ queryKey: ["portal", previewId] })} />;
  }
  if (home.isError || !d?.client) {
    const msg = home.error?.response?.data?.error || "Your portal isn't set up yet.";
    return (
      <Shell>
        <div className="mx-auto max-w-md py-24 text-center">
          <img src={LOGO_URL} alt="" className="mx-auto h-14 w-20 object-contain" />
          <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.04em]">Almost there</h1>
          <p className="mt-2 text-[14px] text-ink/60">{msg} Reach out to Interstellar and we&apos;ll connect your login.</p>
          <button onClick={() => base44.auth.logout()} className="mt-6 text-[13px] text-[#ff3c00] hover:underline">Log out</button>
        </div>
      </Shell>
    );
  }

  // Lead Engine lead tier: only their preview, what Interstellar is and the walkthrough booking.
  if (d.tier === "lead") return <LeadTier d={d} call={call} previewId={previewId} />;

  // No active plan: a friendly screen with a way to reach us. Their data is kept; nothing else loads.
  if (d.plan_inactive) return <PlanInactive d={d} call={call} previewId={previewId} />;

  return (
    <Shell client={d.client} tabs={tabs} tab={tab} setTab={(k) => { setQrOpen(null); setTab(k); }} unread={d.unread} brainOpen={d.brain?.open || 0} preview={!!previewId} previewId={previewId} scopeId={scopeId} businesses={businesses} onSwitch={switchTo} fuel={fuel} refuelOpen={refuelOpen} setRefuelOpen={setRefuelOpen}>
      {audit ? (
        <IntakeView call={call} onClose={() => { setAudit(false); refresh(); }} />
      ) : (
        <ErrorBoundary where="portal tab" resetKey={`${d.client.id}:${tab}`}>
        <div key={`${d.client.id}:${tab}`} className="page-enter">
          {tab === "home" && <PortalHomeV2 d={d} groups={withBadges(groupsFor(tabs.map(([k]) => k), st.locked, st.planLocked ? "HyperCare+" : "Soon"), d)} go={go} call={call} refresh={refresh} preview={!!previewId} unread={d.unread} onAsk={(text) => setNovaAsk((a) => ({ text, n: (a?.n || 0) + 1 }))} />}
          {tab === "brain" && <BrainView call={call} scopeId={scopeId} business={d.client.business} preview={!!previewId} openAudit={() => setAudit(true)} />}
          {tab === "mentions" && <MentionsView d={d} />}
          {tab === "billing" && <BillingView d={d} fuel={fuel} go={go} scopeId={scopeId} preview={!!previewId} onRefuel={() => setRefuelOpen(true)} />}
          {tab === "playbook" && !d.has_playbook && <PlaybookPending business={d.client.business} />}
          {STUDIO_KEYS.has(tab) && tabs.some(([k]) => k === tab) && <div className="mb-6"><StudioDuo label={labelFor(tab)} studio={tab.replace(/^studio_/, "")} state={duoState(tab)} scopeId={scopeId} preview={!!previewId} /></div>}
          {tab === "results" && <ResultsView d={d} previewId={scopeId} admin={!!previewId} />}
          {tab === "gbp" && <PortalGbp call={call} previewId={scopeId} onOpenQr={(code) => { setQrOpen(code.id); setTab("qr"); }} />}
          {tab === "goals" && <GoalsView d={d} />}
          {tab === "files" && (
            <div className="space-y-4">
              <div>
                <p className="label-cross">(Files)</p>
                <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">Your deliverables</h2>
              </div>
              {d.has_brand_kit && (
                <button type="button" onClick={() => go("brand")} className="card-hover flex w-full items-center gap-3 rounded-md border border-hair bg-card p-4 text-left">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md flame-bg text-white"><Palette className="h-[18px] w-[18px]" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Your brand kit</span><span className="block text-[12.5px] text-ink/55">Logo rules, colors, fonts and voice</span></span>
                  <ArrowUpRight className="h-4 w-4 text-ink/40" />
                </button>
              )}
              {d.files.length ? <FileGrid files={d.files} /> : <Panel><Empty>Nothing delivered yet. Your brand kit, SOPs, presentations and other finished work will appear here as we hand it over.</Empty></Panel>}
            </div>
          )}
          {tab === "brand" && d.has_brand_kit && <BrandKitView call={call} previewId={scopeId} business={d.client.business} />}
          {tab === "playbook" && d.has_playbook && <PortalPlaybook call={call} previewId={scopeId} business={d.client.business} />}
          {tab === "resources" && <PortalResources call={call} previewId={scopeId} business={d.client.business} go={setTab} />}
          {tab === "requests" && <div className="space-y-8"><PortalSubmit call={call} scopeId={scopeId} preview={!!previewId} /><RequestsView d={d} call={call} refresh={refresh} previewId={scopeId} /><SelfServeStrip call={call} refresh={refresh} preview={!!previewId} /></div>}
          {tab === "assets" && <BrandAssetsPage tabs={tabs.map(([k]) => k)} go={go} d={d} />}
          {tab === "signatures" && <PortalSignatures call={call} />}
          {tab === "seasons" && <PortalSeasons call={call} />}
          {tab === "qr" && <PortalQr call={call} previewId={scopeId} openId={qrOpen} />}
          {tab === "referrals" && <PortalPrestige call={call} previewId={previewId} />}
          {tab === "messages" && <MessagesView call={call} previewId={previewId} />}
          {tab === "assistant" && <PortalAssistant key={scopeId || "me"} previewId={scopeId} admin={!!previewId} variant="page" />}
          {tab === "account" && <SecurityPanel preview={!!previewId} />}
          {tab === "upgrades" && <PortalUpgrades scopeId={scopeId} preview={!!previewId} call={call} />}
          {/* Training (People): the real workspace once unlocked (HyperCare+ and switched on); otherwise the locked preview below. */}
          {tab === "studio_training" && tabs.some(([k]) => k === tab) && !studioTabs(d.client, fuel).locked.has(tab) && <PortalTraining scopeId={scopeId} business={d.client.business} />}
          {/* Email Studio: the real workspace once unlocked (HyperCare+ and switched on). */}
          {tab === "studio_email" && tabs.some(([k]) => k === tab) && !studioTabs(d.client, fuel).locked.has(tab) && <PortalEmailStudio scopeId={scopeId} business={d.client.business} preview={!!previewId} />}
          {/* Presentations: the AI Presentation Creator once unlocked (HyperCare+ and switched on). */}
          {tab === "studio_presentations" && tabs.some(([k]) => k === tab) && !studioTabs(d.client, fuel).locked.has(tab) && <PortalPresentations scopeId={scopeId} business={d.client.business} preview={!!previewId} />}
          {STUDIO_BY_TAB[tab] && tabs.some(([k]) => k === tab) && !(["studio_training", "studio_email", "studio_presentations"].includes(tab) && !studioTabs(d.client, fuel).locked.has(tab)) && <StudioPreview tab={tab} client={d.client} call={call} preview={!!previewId} previewId={previewId} scopeId={scopeId} fuel={fuel} onRefuel={() => setRefuelOpen(true)} onFuelChanged={refreshFuel} />}
        </div>
        </ErrorBoundary>
      )}
      {tab !== "assistant" && <ErrorBoundary compact where="portal assistant launcher"><AssistantLauncher key={scopeId || "me"} previewId={scopeId} admin={!!previewId} ask={novaAsk} onOpenFull={() => { setQrOpen(null); setTab("assistant"); }} /></ErrorBoundary>}
    </Shell>
  );
}

// Tiles get live badges (unread messages, open Brain questions).
function withBadges(groups, d) {
  return groups.map((g) => ({ ...g, items: g.items.map((i) => (i.k === "brain" && d?.brain?.open ? { ...i, badge: d.brain.open } : i)) }));
}

// Portal v2 header: brand + business on the left; Home, Requests, Messages and the one-tap "Everything" sheet on the
// right (desktop). Phones get one menu button that opens the same sheet. No dropdowns, no nested menus.
function Shell({ client, tabs = TABS, tab, setTab, unread, brainOpen = 0, preview, previewId, scopeId, businesses = [], onSwitch, fuel, refuelOpen = false, setRefuelOpen, children }) {
  const multi = businesses.length > 1 && !!onSwitch;
  const [schedOpen, setSchedOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const groups = useMemo(() => {
    const st = studioTabs(client, fuel);
    return withBadges(groupsFor(tabs.map(([k]) => k), st.locked, st.planLocked ? "HyperCare+" : "Soon"), { brain: { open: brainOpen } });
  }, [tabs, client, fuel, brainOpen]);
  const openRefuel = setRefuelOpen ? () => setRefuelOpen(true) : undefined;
  const go = (k) => { setTab(k); window.scrollTo({ top: 0 }); };
  const current = labelFor(tab);
  return (
    <div className="grid-canvas min-h-screen text-ink" data-trail data-portal-v2>
      <PortalV2Motion />
      <GridTrail />
      {preview && (
        <div className="relative z-30 flex items-center justify-center gap-2 bg-ink px-4 py-2 text-[12px] text-white">
          <Eye className="h-3.5 w-3.5 text-[#ff3c00]" /> Previewing exactly what {client?.business || "this client"} sees.
          <a href={client ? `/clients/${client.id}` : "/"} className="ml-2 underline">Back to Møthership</a>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-hair bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-[64px] max-w-[1280px] items-center gap-3 px-4 md:px-8">
          {/* Møthership mark | [client logo] [Client name]: the client side leads; the switcher sits on it for package owners. */}
          <button type="button" onClick={() => setTab && go("home")} className="flex shrink-0 items-center" aria-label="Home">
            <span className="sm:hidden"><BrandLockup word="" size={14} className="pm-mark-only" /></span>
            <span className="hidden sm:inline-flex"><BrandLockup word="MØTHERSHIP" sub="by Interstellar" size={13} /></span>
          </button>
          <span className="h-8 w-px shrink-0 bg-hair" aria-hidden="true" />
          {client ? <ClientHeaderBrand client={client} businesses={multi ? businesses : []} onSwitch={multi ? onSwitch : null} /> : <p className="truncate text-[14px] font-semibold tracking-[-0.02em]">Client portal</p>}
          {setTab ? (
            <>
              <nav aria-label="Portal" className="ml-auto hidden items-center gap-0.5 lg:flex">
                {HEADER_TABS.map((h) => (
                  <button key={h.k} type="button" data-tab={h.k} aria-current={tab === h.k ? "page" : undefined} onClick={() => go(h.k)} className={`relative flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-medium ${tab === h.k ? "text-ink" : "text-ink/55 hover:text-ink"}`}>
                    {h.label}
                    {h.k === "requests" && unread > 0 && <span className="flex h-4 min-w-4 items-center justify-center bg-[#ff3c00] px-1 font-mono text-[10px] text-white" aria-label={`${unread} unread`}>{unread}</span>}
                    {tab === h.k && <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-[#ff3c00]" aria-hidden="true" />}
                  </button>
                ))}
                <button type="button" data-everything-button onClick={() => setSheet(true)} aria-expanded={sheet} className={`ml-1 flex h-10 items-center gap-2 rounded-md border px-3 text-[13.5px] font-medium ${!["home", ...HEADER_TABS.map((h) => h.k)].includes(tab) ? "border-ink bg-white" : "border-hair bg-card hover:border-ink/30"}`}>
                  <LayoutGrid className="h-4 w-4" /> Everything
                  {brainOpen > 0 && <span className="h-2 w-2 rounded-full bg-[#ff3c00]" aria-label="Something needs you" />}
                </button>
              </nav>
              <div className="ml-auto flex items-center gap-2 lg:ml-2">
                <ScheduleCallButton onClick={() => setSchedOpen(true)} />
                <button type="button" data-portal-menu-button onClick={() => setSheet(true)} aria-expanded={sheet} aria-label={`Open menu${current ? `, current page ${current}` : ""}`} className="relative flex h-11 items-center gap-2 rounded-md border border-hair bg-card px-3 text-[13px] font-medium lg:hidden">
                  <span className="max-w-[96px] truncate sm:max-w-[160px]">{current || "Menu"}</span>
                  <Menu className="h-5 w-5" aria-hidden="true" />
                  {(unread > 0 || brainOpen > 0) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#ff3c00]" aria-hidden="true" />}
                </button>
                <div className="hidden items-center lg:flex">
                  <button type="button" data-tab="account" onClick={() => go("account")} aria-current={tab === "account" ? "page" : undefined} className={`flex h-10 w-10 items-center justify-center ${tab === "account" ? "text-[#ff3c00]" : "text-ink/45 hover:text-ink"}`} title="Account & security" aria-label="Account and security">
                    <UserRound className="h-4 w-4" />
                  </button>
                  {!preview && <button type="button" onClick={() => base44.auth.logout()} className="flex h-10 w-9 items-center justify-center text-ink/45 hover:text-[#ff3c00]" title="Log out" aria-label="Log out"><LogOut className="h-4 w-4" /></button>}
                </div>
              </div>
              <ScheduleCallModal open={schedOpen} onClose={() => setSchedOpen(false)} previewId={scopeId || previewId} preview={preview} />
              <EverythingSheet open={sheet} onClose={() => setSheet(false)} groups={groups} tab={tab} onPick={go} unread={unread} client={client} preview={preview} businesses={businesses} onSwitch={onSwitch} onSchedule={() => setSchedOpen(true)} />
            </>
          ) : (
            !preview && <button onClick={() => base44.auth.logout()} className="ml-auto p-2 text-ink/45 hover:text-[#ff3c00]" title="Log out" aria-label="Log out"><LogOut className="h-4 w-4" /></button>
          )}
        </div>
      </header>
      {setTab && <FuelBanner fuel={fuel} onOpen={openRefuel} />}
      {setRefuelOpen && <RefuelModal open={refuelOpen} onClose={() => setRefuelOpen(false)} fuel={fuel} scopeId={scopeId || previewId} preview={preview} onUpgrade={() => { setRefuelOpen(false); setSchedOpen(true); }} />}
      <main className="relative z-10 mx-auto max-w-[1280px] px-4 pb-28 pt-6 md:px-8 md:pt-8">{children}</main>
    </div>
  );
}

function LeadTier({ d, call, previewId }) {
  const [sched, setSched] = useState(false);
  const track = (args) => { if (!previewId) call("lead_track", args).catch(() => null); };
  return (
    <>
      <LeadPortalView d={d} track={track} preview={!!previewId} onBook={() => setSched(true)} onLogout={() => base44.auth.logout()} />
      <ScheduleCallModal open={sched} onClose={() => setSched(false)} previewId={previewId} preview={!!previewId} />
    </>
  );
}

function PlanInactive({ d, call, previewId }) {
  const [chat, setChat] = useState(false);
  return (
    <Shell client={d.client} preview={!!previewId}>
      <div className="mx-auto max-w-xl py-16 text-center">
        <img src={LOGO_URL} alt="" className="mx-auto h-14 w-20 object-contain" />
        <p className="label-cross mt-6">(Plan inactive)</p>
        <h1 className="mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] md:text-[40px]">Your plan is <span className="text-[#ff3c00]">paused</span>.</h1>
        <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-ink/60">
          {d.client?.business ? `${d.client.business}'s` : "Your"} Interstellar plan isn&apos;t active right now, so your portal tools are switched off. Everything we built and saved for you is kept safe. Message us and we&apos;ll get you back up and running.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => setChat((v) => !v)} className="h-10 bg-[#ff3c00] px-5 text-[13px] font-medium text-white hover:bg-ink">{chat ? "Hide messages" : "Message us"}</button>
          <a href="mailto:hello@interstellar-strategies.com" className="inline-flex h-10 items-center border border-hair px-5 text-[13px] font-medium hover:border-ink/30">hello@interstellar-strategies.com</a>
        </div>
      </div>
      {chat && <div className="mx-auto max-w-3xl"><PortalChats call={call} previewId={previewId} /></div>}
    </Shell>
  );
}

function ResultsView({ d, previewId, admin }) {
  return (
    <div className="space-y-4">
      <p className="label-cross">(Results)</p>
      <h2 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">How people are finding you</h2>
      {/* site_health comes from the portal function (already filtered: no score under 70). Hidden until it's returned. */}
      {d.site_health && <ClientHealthSummary health={d.site_health} businessName={d.client.business} />}
      <PerformanceView snapshots={d.snapshots} compact />
      {/* Instagram: renders nothing until the client has data or was invited to connect. */}
      <PortalInstagram previewId={previewId} admin={admin} />
    </div>
  );
}

function GoalsView({ d }) {
  return (
    <div className="space-y-8">
      <section>
        <p className="label-cross">(Where we&apos;re headed)</p>
        <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">Goals & plan of attack</h2>
        {d.goals.length === 0 ? <Panel className="mt-4"><Empty>We&apos;ll set your goals together and track them here.</Empty></Panel> : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {d.goals.map((g) => {
              const base = g.baseline_value ?? 0;
              const pct = g.target_value ? Math.max(0, Math.min(100, Math.round((((g.current_value ?? base) - base) / ((g.target_value - base) || 1)) * 100))) : 0;
              return (
                <Panel key={g.id} label={[g.year, g.metric || "Goal"].filter(Boolean).join(" · ")} title={g.title}>
                  <div className="px-4 py-4">
                    {/* Numbers only when the goal has a real target; qualitative goals show their plan. */}
                    {g.target_value != null && (
                      <>
                        <p className="text-[26px] font-semibold tabular-nums tracking-[-0.04em]">{g.current_value ?? "—"}<span className="text-[14px] text-ink/45"> / {g.target_value} {g.unit}</span></p>
                        <div className="mt-3 h-1.5 bg-ink/[0.08]"><div className="h-full flame-bg" style={{ width: `${pct}%` }} /></div>
                      </>
                    )}
                    <ul className={`${g.target_value != null ? "mt-4" : ""} space-y-1.5`}>
                      {(g.plan_steps || []).map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px]">
                          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border ${s.done ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-ink/30"}`}>{s.done && <Check className="h-3 w-3" />}</span>
                          <span className={s.done ? "text-ink/45 line-through" : ""}>{s.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <p className="label-cross mb-3">(Cracks we&apos;re fixing)</p>
          <Panel>
            {d.gaps.length === 0 ? <Empty>Nothing flagged right now.</Empty> : (
              <ul className="divide-y divide-hair">
                {d.gaps.map((g) => (
                  <li key={g.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${g.status === "fixed" ? "bg-green-600" : g.severity === "high" ? "bg-red-600" : "bg-amber-500"}`} />
                    <div className="flex-1">
                      <p className={`text-[13.5px] font-medium ${g.status === "fixed" ? "text-ink/45 line-through" : ""}`}>{g.title}</p>
                      {g.recommendation && <p className="text-[12px] text-ink/55">{g.recommendation}</p>}
                    </div>
                    <Tag tone={g.status === "fixed" ? "green" : g.status === "open" ? "muted" : "flame"}>{g.status.replace("_", " ")}</Tag>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
        <section>
          <p className="label-cross mb-3">(Next projects)</p>
          <Panel>
            {d.future.length === 0 ? <Empty>Upcoming projects will show here.</Empty> : (
              <ul className="divide-y divide-hair">
                {d.future.map((p) => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-center gap-2"><Tag>{p.type}</Tag><Tag tone={p.status === "in_progress" ? "flame" : "muted"}>{p.status.replace("_", " ")}</Tag></div>
                    <p className="mt-1 text-[13.5px] font-medium">{p.title}</p>
                    {p.description && <p className="text-[12px] text-ink/55">{p.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </div>
  );
}

function RequestsView({ d, call, refresh, previewId }) {
  const forms = useQuery({ queryKey: ["portal", previewId, "forms"], queryFn: () => call("forms"), retry: false });
  // Every client gets the standard request types; a custom form of the same kind replaces the standard one.
  const list = useMemo(() => portalForms(forms.data?.forms || [], forms.data?.type_overrides || null), [forms.data]);
  const [form, setForm] = useState(null);
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");
  const change = (k, v) => setVals((s) => ({ ...s, [k]: v }));
  const open = (f) => { setForm(f); setVals({ priority: "Normal" }); setErr(""); setSent(""); };
  const submit = async (e) => {
    e.preventDefault();
    if (!form || !isComplete(form, vals)) return;
    setBusy(true); setErr("");
    try {
      await call("create_request", {
        kind: form.kind,
        title: titleFor({ ...form, client_name: d.client.business }, vals),
        details: detailsFor(form, vals),
        fields: vals,
        answers: toAnswers(form.fields, vals),
        attachments: attachmentsFor(form, vals),
        form_id: form.id, form_title: form.title,
        priority: priorityFor(vals),
        due_date: vals.due_date || null,
      });
      setSent(form.title); setForm(null); setVals({}); refresh();
    } catch (e2) {
      setErr(e2?.response?.data?.error || e2?.message || "Could not send. Try again or message us.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="label-cross">(Requests)</p>
        <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">Tell us what you need</h2>
      </div>

      {sent && !form && (
        <div className="flex items-center gap-2 border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-800">
          <Check className="h-4 w-4" /> {sent} sent. We&apos;ll reply within 1 business day.
          <button type="button" onClick={() => setSent("")} className="ml-auto text-green-800/60 hover:text-green-900"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {!form && (
        forms.isLoading ? <p className="text-[13px] text-ink/50">Loading…</p> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((f) => (
              <button key={f.id} type="button" onClick={() => open(f)} className="card-hover flex flex-col items-start border border-hair bg-card p-5 text-left">
                <span className="mono-label text-[9.5px] text-[#ff3c00]">{kindLabel(f.kind)}</span>
                <span className="mt-2 text-[18px] font-semibold tracking-[-0.03em]">{f.title}</span>
                {f.intro && <span className="mt-1.5 text-[12.5px] leading-relaxed text-ink/55">{f.intro}</span>}
                <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-[#ff3c00]">Start <ArrowUpRight className="h-3.5 w-3.5" /></span>
              </button>
            ))}
          </div>
        )
      )}

      {form && (
        <form onSubmit={submit} className="rounded-md border border-hair bg-card">
          <div className="flex items-center justify-between border-b border-hair px-5 py-4">
            <div>
              <p className="mono-label text-[9.5px] text-ink/50">{kindLabel(form.kind)}</p>
              <h3 className="text-[18px] font-semibold tracking-[-0.03em]">{form.title}</h3>
              {form.intro && <p className="mt-1 text-[12.5px] text-ink/55">{form.intro}</p>}
            </div>
            <button type="button" onClick={() => setForm(null)} className="text-ink/50 hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
          <div className="px-5 py-5">
            <RequestFormRenderer form={form} vals={vals} onChange={change} />
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-hair px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-[11.5px] ${err ? "text-red-700" : "text-ink/45"}`}>{err || "We reply within 1 business day."}</p>
            <button type="submit" disabled={busy || !isComplete(form, vals)} className="h-10 whitespace-nowrap bg-[#ff3c00] px-6 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-40">{busy ? "Sending…" : "Send to Interstellar"}</button>
          </div>
        </form>
      )}

      <Panel label="History" title={d.requests.length ? `${d.requests.length} request${d.requests.length === 1 ? "" : "s"}` : "Your requests"}>
        {d.requests.length === 0 ? <Empty>Nothing sent yet. Pick a request type above and it shows up here with its status, from received to live.</Empty> : (
          <ul className="divide-y divide-hair">
            {d.requests.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone={r.status === "complete" ? "green" : r.status === "in_progress" ? "flame" : r.status === "needs_info" ? "amber" : "muted"}>{r.status === "received" ? "Received" : r.status.replace("_", " ")}</Tag>
                  <span className="mono-label text-[9px] text-ink/45">{kindLabel(r.kind)}</span>
                  {(r.priority === "urgent" || r.priority === "high") && <Tag tone={r.priority === "urgent" ? "red" : "amber"}>{r.priority}</Tag>}
                  {r.due_date && <span className="text-[11px] text-ink/50">Needed by {fmtDate(r.due_date)}</span>}
                  <span className="ml-auto font-mono text-[10.5px] text-ink/45">{fmtDate(r.created_date)}</span>
                </div>
                <p className="mt-1 text-[13.5px] font-medium">{r.title}</p>
                {r.client_note && <p className="mt-1 border-l-2 border-[#ff3c00] pl-2 text-[12.5px] text-ink/70">{r.client_note}</p>}
                {r.page_url && <a href={r.page_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12.5px] text-[#ff3c00]">View the live page <ArrowUpRight className="h-3 w-3" /></a>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function BrandKitView({ call, previewId, business }) {
  const q = useQuery({ queryKey: ["portal", previewId, "brand_kit"], queryFn: () => call("brand_kit"), retry: false });
  const k = q.data?.brand_kit;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-cross">(Brand kit)</p>
          <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">How {business} looks and sounds</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-ink/60">Your logo rules, colors, fonts and voice in one place. Share it with anyone making something for your brand.</p>
        </div>
        {k?.version != null && <Tag tone="muted">Version {k.version}</Tag>}
      </div>
      {q.isLoading ? <p className="text-[13px] text-ink/50">Loading…</p> : !k ? (
        <Panel><Empty>Your brand kit isn&apos;t published yet.</Empty></Panel>
      ) : (
        <div className="rounded-md border border-hair bg-card p-5 md:p-7">
          {k.summary && <p className="mb-5 max-w-3xl text-[14.5px] leading-relaxed text-ink/75">{k.summary}</p>}
          <KitView kit={k.kit} body={k.body_md} />
        </div>
      )}
    </div>
  );
}

function MessagesView({ call, previewId }) {
  return <PortalChats call={call} previewId={previewId} />;
}

function IntakeView({ call, onClose }) {
  const [answers, setAnswers] = useState(null);
  const [status, setStatus] = useState("in_progress");
  const [open, setOpen] = useState(INTAKE_SECTIONS[0].id);
  const [saving, setSaving] = useState(false);
  const timer = useRef(null);
  const [saveErr, setSaveErr] = useState("");
  useEffect(() => { call("intake").then((r) => { setAnswers(r?.intake?.answers || {}); setStatus(r?.intake?.status || "in_progress"); }).catch(() => { setAnswers({}); setSaveErr("We couldn't load your saved answers. Anything you type now still saves."); }); }, []);
  const prog = useMemo(() => intakeProgress(answers || {}), [answers]);
  if (!answers) return <p className="py-20 text-center text-ink/50">Loading…</p>;
  const locked = status === "reviewed";
  const change = (k, v) => {
    if (locked) return;
    const next = { ...answers, [k]: v };
    setAnswers(next); setSaving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await call("save_intake", { answers: next }); setSaveErr(""); } catch { setSaveErr("Couldn't save that last change. Check your connection and try again."); } finally { setSaving(false); }
    }, 800);
  };
  const submit = async () => {
    clearTimeout(timer.current);
    try { await call("save_intake", { answers, submit: true }); onClose(); } catch { setSaveErr("Couldn't submit right now. Your answers are saved; try again in a moment."); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button onClick={onClose} className="mono-label block text-[10px] text-ink/50 hover:text-[#ff3c00]">← Back</button>
      <p className="label-cross">(Business audit)</p>
      <h2 className="text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">Tell us how your business runs</h2>
      <p className="text-[14px] text-ink/60">Answer what you can — it saves as you go. This is how we find what to fix, what to automate and what to build next.</p>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 bg-ink/[0.08]"><div className="h-full flame-bg" style={{ width: `${prog.pct}%` }} /></div>
        <span className="font-mono text-[11px] tabular-nums text-ink/55">{prog.answered}/{prog.total} {saving ? "· saving" : ""}</span>
      </div>
      {saveErr && <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">{saveErr}</p>}
      {INTAKE_SECTIONS.map((s) => (
        <section key={s.id} className="rounded-md border border-hair bg-card">
          <button onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span className="text-[15px] font-semibold">{s.title}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open === s.id ? "rotate-180" : ""}`} />
          </button>
          {open === s.id && (
            <div className="space-y-4 border-t border-hair px-4 py-4">
              {s.questions.map((q) => (
                <div key={q.id}>
                  <label className="mb-1.5 block text-[13px] font-medium">{q.label}</label>
                  <Field f={{ ...q, name: q.id }} value={answers[q.id]} onChange={change} />
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
      {!locked && <div className="flex justify-end"><Btn onClick={submit}>Submit to Interstellar</Btn></div>}
    </div>
  );
}
