import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, LogOut, Plus, X, ChevronDown, Check, Eye, Gift, PenLine, QrCode, Presentation } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { LOGO_URL } from "@/lib/nav";
import { WORK_KINDS, SERVICE_LABELS, fmtDate, timeAgo } from "@/lib/useData";
import { Panel, Empty, Tag, Btn, Field } from "@/features/clients/ui";
import { PerformanceView, FileGrid } from "@/features/clients/tabsGrowth";
import PortalChats from "@/features/portal/PortalChats";
import { INTAKE_SECTIONS, intakeProgress } from "@/features/clients/intakeQuestions";
import GridTrail from "@/components/GridTrail";
import BrandLockup from "@/components/brand/BrandLockup";
import PortalSignatures from "@/features/signatures/PortalSignatures";
import PortalQr from "@/features/qr/PortalQr";
import PortalPrestige from "@/features/portal/PortalPrestige";
import ClientHealthSummary from "@/features/performance/ClientHealthSummary";
import RequestFormRenderer, { isComplete } from "@/features/requests/RequestFormRenderer";
import { kindLabel, portalForms, priorityFor, toAnswers, titleFor, detailsFor, attachmentsFor } from "@/features/requests/formSchema";
import { KitView } from "@/features/clients/BrandKitTab";
import PortalPlaybook from "@/features/portal/PortalPlaybook";
import { PortalGbp, ReviewLinkQuick } from "@/features/gbp/GbpPanel";

// Free-for-life bonus tools: tagged in the nav and listed together on Home.
const BONUS_TABS = ["signatures", "qr"];

const TABS = [["home", "Home"], ["results", "Results"], ["gbp", "Google Business"], ["goals", "Goals"], ["files", "Files"], ["brand", "Brand kit"], ["playbook", "Playbook"], ["requests", "Requests"], ["signatures", "Signatures"], ["qr", "QR Codes"], ["referrals", "Referrals"], ["messages", "Messages"]];

function usePortal(previewId) {
  const call = async (action, args = {}) => (await base44.functions.invoke("portal", { action, client_id: previewId, ...args })).data;
  const home = useQuery({ queryKey: ["portal", previewId, "home"], queryFn: () => call("home"), retry: false });
  return { call, home };
}

export default function PortalApp({ previewId }) {
  const { call, home } = usePortal(previewId);
  const [tab, setTab] = useState("home");
  const [audit, setAudit] = useState(false);
  const [qrOpen, setQrOpen] = useState(null); // a QR code to open on the QR tab (from Google Business)
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["portal", previewId] });
  const d = home.data;
  // The Brand kit tab only exists when an approved, portal-visible kit does.
  const tabs = TABS.filter(([k]) => (k !== "brand" || d?.has_brand_kit) && (k !== "playbook" || d?.has_playbook));

  if (home.isLoading) return <Shell><p className="py-24 text-center text-ink/50">Loading your portal…</p></Shell>;
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

  return (
    <Shell client={d.client} tabs={tabs} tab={tab} setTab={(k) => { setQrOpen(null); setTab(k); }} unread={d.unread} preview={!!previewId}>
      {audit ? (
        <IntakeView call={call} onClose={() => { setAudit(false); refresh(); }} />
      ) : (
        <div key={tab} className="page-enter">
          {tab === "home" && <HomeView d={d} go={setTab} call={call} previewId={previewId} openAudit={() => setAudit(true)} />}
          {tab === "results" && <ResultsView d={d} />}
          {tab === "gbp" && <PortalGbp call={call} previewId={previewId} onOpenQr={(code) => { setQrOpen(code.id); setTab("qr"); }} />}
          {tab === "goals" && <GoalsView d={d} />}
          {tab === "files" && (d.files.length ? <FileGrid files={d.files} /> : <Panel><Empty>Your brand kit, SOPs, presentations and other deliverables will appear here.</Empty></Panel>)}
          {tab === "brand" && d.has_brand_kit && <BrandKitView call={call} previewId={previewId} business={d.client.business} />}
          {tab === "playbook" && d.has_playbook && <PortalPlaybook call={call} previewId={previewId} business={d.client.business} />}
          {tab === "requests" && <RequestsView d={d} call={call} refresh={refresh} previewId={previewId} />}
          {tab === "signatures" && (
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 flame-bg px-3 py-1.5 text-[12px] font-medium text-white"><Gift className="h-3.5 w-3.5" /> Bonus tool · Free for life with Interstellar</span>
              <PortalSignatures call={call} />
            </div>
          )}
          {tab === "qr" && <PortalQr call={call} previewId={previewId} openId={qrOpen} />}
          {tab === "referrals" && <PortalPrestige call={call} previewId={previewId} />}
          {tab === "messages" && <MessagesView call={call} previewId={previewId} />}
        </div>
      )}
    </Shell>
  );
}

function Shell({ client, tabs = TABS, tab, setTab, unread, preview, children }) {
  return (
    <div className="grid-canvas min-h-screen text-ink" data-trail>
      <GridTrail />
      {preview && (
        <div className="relative z-30 flex items-center justify-center gap-2 bg-ink px-4 py-2 text-[12px] text-white">
          <Eye className="h-3.5 w-3.5 text-[#ff3c00]" /> Previewing exactly what {client?.business || "this client"} sees.
          <a href={client ? `/clients/${client.id}` : "/"} className="ml-2 underline">Back to Møthership</a>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-hair bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-[1280px] items-center gap-4 px-4 md:px-8">
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <BrandLockup word="MØTHERSHIP" sub="by Interstellar" size={18} />
            <span className="hidden h-7 w-px bg-hair sm:block" aria-hidden="true" />
            <p className="hidden max-w-[180px] truncate text-[13px] font-medium tracking-[-0.02em] text-ink/70 sm:block">{client?.business || "Client Portal"}</p>
          </div>
          {setTab && (
            <nav className="no-scrollbar ml-auto flex overflow-x-auto">
              {tabs.map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`relative whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors ${tab === k ? "text-ink" : "text-ink/50 hover:text-ink"}`}>
                  {l}
                  {BONUS_TABS.includes(k) && <span className="mono-label ml-1.5 inline-flex items-center bg-[#ff3c00]/10 px-1 py-[1px] align-middle text-[8px] text-[#ff3c00]">Bonus</span>}
                  {k === "messages" && unread > 0 && <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center bg-[#ff3c00] px-1 text-[10px] text-white">{unread}</span>}
                  {tab === k && <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-[#ff3c00]" />}
                </button>
              ))}
            </nav>
          )}
          {!preview && <button onClick={() => base44.auth.logout()} className="p-2 text-ink/45 hover:text-[#ff3c00]" title="Log out"><LogOut className="h-4 w-4" /></button>}
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-[1280px] px-4 pb-20 pt-8 md:px-8">{children}</main>
    </div>
  );
}

function Counter({ value, label, total }) {
  return (
    <div className="border-r border-hair px-5 py-6 last:border-r-0">
      <p className="text-[44px] font-semibold leading-none tracking-[-0.05em] tabular-nums">{value}</p>
      <p className="mono-label mt-3 text-[10px] text-ink/55">{label}</p>
      {total != null && <p className="mt-1 text-[12px] text-ink/45">{total} all time</p>}
    </div>
  );
}

function HomeView({ d, go, call, previewId, openAudit }) {
  const ms = new Date(); ms.setDate(1);
  const monthStart = ms.toISOString().slice(0, 10);
  const month = d.work.filter((w) => (w.date || "") >= monthStart);
  const c = (...k) => month.filter((w) => k.includes(w.kind)).length;
  const t = (...k) => d.work.filter((w) => k.includes(w.kind) && w.status === "live").length;
  const monthName = new Date().toLocaleDateString("en-US", { month: "long" });
  const allTime = d.work.length;
  const openReq = d.requests.filter((r) => !["complete", "declined"].includes(r.status));

  return (
    <div className="space-y-8">
      <section>
        <p className="label-cross">(Your {monthName})</p>
        <h1 className="mt-3 text-[36px] font-semibold leading-[0.98] tracking-[-0.045em] md:text-[56px]">
          Here&apos;s what we did for <span className="text-[#ff3c00]">{d.client.business}</span>.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] text-ink/60">Every blog, Google post, site update and listing we publish for you shows up here as it happens. {allTime ? `${allTime} pieces of work logged so far.` : ""}</p>
        <div className="mt-6 grid overflow-hidden rounded-md border border-hair bg-card sm:grid-cols-2 lg:grid-cols-4">
          <Counter value={c("blog")} total={t("blog")} label={`Blogs published in ${monthName}`} />
          <Counter value={c("gbp_post")} total={t("gbp_post")} label={`Google posts in ${monthName}`} />
          <Counter value={c("site_edit", "new_page", "project_page")} total={t("site_edit", "new_page", "project_page", "deliverable")} label={`Website updates in ${monthName}`} />
          <Counter value={c("citation", "press", "mention", "backlink")} total={t("citation", "press", "mention", "backlink")} label={`Listings & press in ${monthName}`} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel label="Latest" title="Work feed">
          {d.work.length === 0 ? <Empty>Your work feed fills up as we publish for you.</Empty> : (
            <ul className="divide-y divide-hair">
              {d.work.slice(0, 12).map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                  <Tag tone={w.kind === "blog" || w.kind === "gbp_post" ? "flame" : "muted"}>{WORK_KINDS[w.kind] || w.kind}</Tag>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{w.title}</span>
                  <span className="font-mono text-[10.5px] text-ink/45">{fmtDate(w.date)}</span>
                  {w.url && <a href={w.url} target="_blank" rel="noreferrer" className="text-ink/40 hover:text-[#ff3c00]"><ArrowUpRight className="h-4 w-4" /></a>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-5">
          <div className="band-dark grain rounded-md p-5">
            <p className="mono-label text-[10px] text-white/50">Need something?</p>
            <p className="mt-2 text-[20px] font-semibold leading-tight tracking-[-0.03em]">Website edits, content, Google posts, design, fixes: send a request or a message.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => go("requests")} className="btn-roll is-flame"><span className="roll"><span>New request</span><span>New request</span></span><span className="box"><Plus className="h-3.5 w-3.5" /></span></button>
              <button onClick={() => go("messages")} className="h-10 border border-white/25 px-4 text-[13px] text-white hover:bg-white hover:text-ink">Message us</button>
            </div>
          </div>
          <Panel label="Running for you" title="Active services">
            <ul className="divide-y divide-hair">
              {(d.client.services_managed || []).map((s) => <li key={s} className="flex items-center gap-2 px-4 py-2.5 text-[13px]"><Check className="h-3.5 w-3.5 text-[#ff3c00]" />{SERVICE_LABELS[s] || s}</li>)}
              {d.automations.map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
                  <span className="h-2 w-2 rounded-full bg-green-600" /> <span className="flex-1">{a.name}</span>
                  <span className="text-[11px] text-ink/45">{a.last_run_at ? timeAgo(a.last_run_at) : a.schedule}</span>
                </li>
              ))}
              {!(d.client.services_managed || []).length && !d.automations.length && <li className="px-4 py-4 text-[12.5px] text-ink/50">Your services will be listed here.</li>}
            </ul>
          </Panel>
          {(openReq.length > 0 || d.upcoming.length > 0) && (
            <Panel label="In motion" title="Coming up">
              <ul className="divide-y divide-hair">
                {openReq.slice(0, 4).map((r) => <li key={r.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px]"><Tag tone={r.status === "in_progress" ? "flame" : "muted"}>{r.status.replace("_", " ")}</Tag><span className="truncate">{r.title}</span></li>)}
                {d.upcoming.slice(0, 4).map((t) => <li key={t.id} className="flex items-center gap-2 px-4 py-2.5 text-[13px]"><Tag>Planned</Tag><span className="flex-1 truncate">{t.title}</span><span className="text-[11px] text-ink/45">{t.due_date ? fmtDate(t.due_date) : ""}</span></li>)}
              </ul>
            </Panel>
          )}
          <ReviewLinkQuick call={call} previewId={previewId} go={go} />
          <BonusTools go={go} />
          <button onClick={openAudit} className="card-hover w-full rounded-md border border-hair bg-card p-4 text-left">
            <p className="mono-label text-[9.5px] text-ink/50">Business audit</p>
            <p className="mt-1 text-[14.5px] font-semibold">Tell us about your business →</p>
            <p className="text-[12px] text-ink/55">The more we know, the more we can automate for you.</p>
          </button>
        </div>
      </div>
    </div>
  );
}

// Bonus tools: free for life with Interstellar. The presentation creator is a placeholder (no functionality yet).
function BonusTools({ go }) {
  const tools = [
    { k: "signatures", icon: PenLine, title: "Email signatures", text: "Animated, on-brand signatures for your whole team." },
    { k: "qr", icon: QrCode, title: "QR codes", text: "Branded, trackable QR codes you can re-point after printing." },
    { k: null, icon: Presentation, title: "AI Presentation Creator", text: "Decks in your brand, written with you.", soon: true },
  ];
  return (
    <section className="rounded-md border border-hair bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <p className="mono-label text-[9.5px] text-ink/50">Bonus tools</p>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Free for life with Interstellar</h3>
        </div>
        <Gift className="h-4 w-4 text-[#ff3c00]" />
      </header>
      <ul className="divide-y divide-hair">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <li key={t.title}>
              <button
                type="button"
                disabled={t.soon}
                aria-disabled={t.soon}
                onClick={() => t.k && go(t.k)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left ${t.soon ? "cursor-not-allowed opacity-55" : "hover:bg-paper"}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center ${t.soon ? "bg-ink/[0.07] text-ink/50" : "flame-bg text-white"}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{t.title}</span>
                  <span className="block text-[11.5px] text-ink/55">{t.text}</span>
                </span>
                {t.soon ? <Tag tone="muted">Coming soon</Tag> : <ArrowUpRight className="h-4 w-4 text-ink/40" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ResultsView({ d }) {
  return (
    <div className="space-y-4">
      <p className="label-cross">(Results)</p>
      <h2 className="text-[32px] font-semibold tracking-[-0.04em]">How people are finding you</h2>
      {/* site_health comes from the portal function (already filtered: no score under 70). Hidden until it's returned. */}
      {d.site_health && <ClientHealthSummary health={d.site_health} businessName={d.client.business} />}
      <PerformanceView snapshots={d.snapshots} compact />
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
                <Panel key={g.id} label={`${g.year || ""} · ${g.metric || "Goal"}`} title={g.title}>
                  <div className="px-4 py-4">
                    <p className="text-[26px] font-semibold tabular-nums tracking-[-0.04em]">{g.current_value ?? "—"}<span className="text-[14px] text-ink/45"> / {g.target_value ?? "—"} {g.unit}</span></p>
                    <div className="mt-3 h-1.5 bg-ink/[0.08]"><div className="h-full flame-bg" style={{ width: `${pct}%` }} /></div>
                    <ul className="mt-4 space-y-1.5">
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
          <div className="flex items-center justify-between border-t border-hair px-5 py-4">
            <p className={`text-[11.5px] ${err ? "text-red-700" : "text-ink/45"}`}>{err || "We reply within 1 business day."}</p>
            <button type="submit" disabled={busy || !isComplete(form, vals)} className="h-10 bg-[#ff3c00] px-6 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-40">{busy ? "Sending…" : "Send to Interstellar"}</button>
          </div>
        </form>
      )}

      <Panel label="History" title={`${d.requests.length} request${d.requests.length === 1 ? "" : "s"}`}>
        {d.requests.length === 0 ? <Empty>Nothing submitted yet.</Empty> : (
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
  useEffect(() => { call("intake").then((r) => { setAnswers(r?.intake?.answers || {}); setStatus(r?.intake?.status || "in_progress"); }); }, []);  
  const prog = useMemo(() => intakeProgress(answers || {}), [answers]);
  if (!answers) return <p className="py-20 text-center text-ink/50">Loading…</p>;
  const locked = status === "reviewed";
  const change = (k, v) => {
    if (locked) return;
    const next = { ...answers, [k]: v };
    setAnswers(next); setSaving(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { await call("save_intake", { answers: next }); setSaving(false); }, 800);
  };
  const submit = async () => { clearTimeout(timer.current); await call("save_intake", { answers, submit: true }); onClose(); };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button onClick={onClose} className="mono-label text-[10px] text-ink/50 hover:text-[#ff3c00]">← Back</button>
      <p className="label-cross">(Business audit)</p>
      <h2 className="text-[32px] font-semibold tracking-[-0.04em]">Tell us how your business runs</h2>
      <p className="text-[14px] text-ink/60">Answer what you can — it saves as you go. This is how we find what to fix, what to automate and what to build next.</p>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 bg-ink/[0.08]"><div className="h-full flame-bg" style={{ width: `${prog.pct}%` }} /></div>
        <span className="font-mono text-[11px] tabular-nums text-ink/55">{prog.answered}/{prog.total} {saving ? "· saving" : ""}</span>
      </div>
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
