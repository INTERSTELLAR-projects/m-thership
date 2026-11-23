// The sales team's side of Møthership. A sales rep (SalesRep row, non-admin login) sees only: the call sheet,
// their leads, Lead Finder, Templates (read + suggest), the lead workspace (build preview, pack, deal), their pay
// and their training. Every screen goes through the lead-engine / lead-finder / sales-team functions, which scope
// a rep to their own leads. No agency finances, settings, price floors or other clients' data.
import { Link, NavLink, Route, Routes, Navigate } from "react-router-dom";
import { GraduationCap, Layers, LogOut, MapPinned, PhoneCall, Users, Wallet } from "lucide-react";
import { base44 } from "@/api/base44Client";
import BrandLockup from "@/components/brand/BrandLockup";
import GridTrail from "@/components/GridTrail";
import CallSheetPage from "./CallSheetPage";
import LeadFinderPage from "./LeadFinderPage";
import TemplatesPage from "./TemplatesPage";
import LeadWorkspacePage from "./LeadWorkspace";
import { Statements } from "./SalesHQPage";
import { useEngine, useSales, leadHref, ago } from "./api";
import { Card, Pill, Loading, ErrorNote, Empty, STATUS_TONE } from "./ui";

const NAV = [["/", "Call sheet", PhoneCall], ["/leads", "My leads", Users], ["/finder", "Lead Finder", MapPinned], ["/templates", "Templates", Layers], ["/pay", "My pay", Wallet], ["/training", "Training", GraduationCap]];

export default function SalesApp({ me }) {
  const rep = me?.rep || {};
  return (
    <div className="grid-canvas min-h-screen text-ink" data-trail data-sales-app>
      <GridTrail />
      <header className="sticky top-0 z-30 border-b border-hair bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-[1440px] items-center gap-3 px-4 md:px-8">
          <Link to="/" className="flex shrink-0 items-center"><BrandLockup word="MØTHERSHIP" sub="Sales" size={13} /></Link>
          <nav aria-label="Sales" className="ml-4 hidden items-center gap-0.5 lg:flex">
            {NAV.map(([to, l]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `relative flex h-10 items-center px-3 text-[13px] font-medium ${isActive ? "text-ink after:absolute after:inset-x-3 after:-bottom-[11px] after:h-[2px] after:bg-[#ff3c00]" : "text-ink/55 hover:text-ink"}`}>{l}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-2"><span className="hidden text-right sm:block"><span className="block text-[12.5px] font-medium">{rep.name}</span><span className="block font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/45">{rep.mode === "both" ? "builder + closer" : rep.mode}</span></span><button type="button" onClick={() => base44.auth.logout()} aria-label="Log out" className="grid h-10 w-9 place-items-center text-ink/45 hover:text-[#ff3c00]"><LogOut className="h-4 w-4" /></button></div>
        </div>
        <nav aria-label="Sales" className="flex gap-1 overflow-x-auto border-t border-hair px-3 py-1.5 lg:hidden">{NAV.map(([to, l, I]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-[12.5px] ${isActive ? "bg-ink text-white" : "text-ink/60"}`}><I className="h-3.5 w-3.5" />{l}</NavLink>)}</nav>
      </header>
      <main className="relative z-10 mx-auto max-w-[1440px]">
        <Routes>
          <Route path="/" element={<Page title="Call sheet"><CallSheetPage embedded me={rep} /></Page>} />
          <Route path="/leads" element={<Page title="My leads"><MyLeads /></Page>} />
          <Route path="/leads/lead/:id" element={<LeadWorkspacePage />} />
          <Route path="/leads/desk" element={<Navigate to="/" replace />} />
          <Route path="/finder" element={<Page title="Lead Finder"><LeadFinderPage embedded /></Page>} />
          <Route path="/templates" element={<Page title="Templates"><TemplatesPage embedded /></Page>} />
          <Route path="/pay" element={<Page title="My pay"><MyPay /></Page>} />
          <Route path="/training" element={<Page title="Training"><MyTraining rep={rep} /></Page>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Page({ title, children }) {
  return (
    <div className="px-4 pb-20 pt-6 md:px-8">
      <p className="ms-kicker">Sales<span className="text-ink/30">·</span><span className="text-ink/45">{title}</span></p>
      <h1 className="mb-5 mt-2 text-[32px] font-semibold leading-[0.95] tracking-[-0.045em] md:text-[40px]">{title.split(" ").slice(0, -1).join(" ")} <span className="text-[#ff3c00]">/{title.split(" ").slice(-1)}</span></h1>
      {children}
    </div>
  );
}

function MyLeads() {
  const q = useEngine("leads");
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const leads = q.data?.leads || [];
  if (!leads.length) return <Card><Empty icon={Users} title="No leads yet" hint="Leads routed to you and leads you add from Lead Finder show up here." /></Card>;
  return (
    <Card pad={false}>
      <ul className="divide-y divide-hair">{leads.map((l) => (
        <li key={l.id} className="grid items-center gap-2 px-4 py-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
          <div className="min-w-0"><Link to={leadHref(l.id)} className="truncate text-[14px] font-medium hover:text-[#ff3c00]">{l.business}</Link><p className="text-[11.5px] text-ink/50">{[l.city, l.state].filter(Boolean).join(", ")}{l.desk_last_call_at ? ` · called ${ago(l.desk_last_call_at)}` : ""}</p></div>
          <div>{l.preview ? <Pill tone={STATUS_TONE[l.preview.status]}>preview {l.preview.status}</Pill> : <Pill>no preview</Pill>}</div>
          <p className="text-[12px] text-ink/60">{l.next?.label}</p>
          <Link to={leadHref(l.id)} className="text-[12px] text-[#ff3c00] hover:underline">Open</Link>
        </li>
      ))}</ul>
    </Card>
  );
}

function MyPay() {
  const me = useSales("me");
  const st = useSales("statement", {}, { enabled: me.data?.kind === "sales" });
  if (me.isLoading || st.isLoading) return <Loading />;
  if (st.isError) return <ErrorNote error={st.error} />;
  return <Card title="Earnings statement" kicker="Base retainer + commission + SEO bonus, per month">{st.data ? <Statements data={st.data} /> : null}</Card>;
}

function MyTraining({ rep }) {
  return (
    <Card title="Your training" kicker="Finish it before your first call block">
      {rep.training_path ? <a href={rep.training_path} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 bg-[#ff3c00] px-4 text-[13px] font-medium text-white hover:bg-ink"><GraduationCap className="h-4 w-4" />Open your training</a> : <p className="text-[13px] text-ink/60">Justin hasn't assigned your training track yet.</p>}
      <ul className="mt-4 space-y-1.5 text-[12.5px] text-ink/70">
        <li>1. Read the script on the call sheet and the objections.</li>
        <li>2. Open three previews in your industry: website, Command System, their portal.</li>
        <li>3. Practice the opener with whoever answers: the goal is that the owner looks at the email.</li>
        <li>4. Log every dial with one key. Never promise rankings or results; never quote on the first call.</li>
      </ul>
    </Card>
  );
}
