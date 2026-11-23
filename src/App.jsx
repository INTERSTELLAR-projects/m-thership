import { Toaster } from "@/components/ui/toaster"
import { lazy as reactLazy, Suspense } from "react";

// Pages loaded on first visit (keeps the main bundle under the release-check budget). Declared before any
// lazyPage() call so the dev server (which evaluates this module top to bottom) never hits it uninitialized.
function lazyPage(load) {
  const C = reactLazy(load);
  return function LazyPage(props) {
    return <Suspense fallback={<div className="p-8 text-[13px] text-ink/45">Loading…</div>}><C {...props} /></Suspense>;
  };
}
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useParams, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import { PresentationControls } from './components/PresentationMode';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Financial from './pages/Financial';
import Legal from './pages/Legal';
import CRM from './pages/CRM';
import Pipeline from './pages/Pipeline';
import Financing from './pages/Financing';
import Comms from './pages/Comms';
import OrbitSEO from './pages/OrbitSEO';

import Performance from './pages/Performance';
import ContentPlans from './pages/ContentPlans';
import SettingsPage from './pages/SettingsPage';
import AutomationsPage from './pages/AutomationsPage';
import IdeaVault from './pages/IdeaVault';
import Requests from './pages/Requests';
import Reviews from './pages/Reviews';
import PublicRequest from './pages/PublicRequest';
import SignaturesPage from '@/features/signatures/SignaturesPage';
import SignatureEditor from '@/features/signatures/EditorPage';
import QrPage, { QrEditorPage } from '@/features/qr/QrPage';
import SocialPage from '@/features/social/SocialPage';
import AdsStudioPage from '@/features/ads/AdsStudioPage';
import EmailStudioPage from '@/features/email/EmailStudioPage';
import SocialPostDetail from '@/features/social/PostDetail';
import PresentationStudio from '@/features/presentations/StudioPage';
import PresentationProjects from '@/features/presentations/ProjectsPage';
import Prestige from './pages/Prestige';
import OutputAnalytics from './pages/OutputAnalytics';
import ClientCockpit from './pages/ClientCockpit';
import PortalApp from '@/features/portal/PortalApp';
import TaskBoard from './pages/TaskBoard';
import TaskPatterns from './pages/TaskPatterns';
import TaskSops from './pages/TaskSops';
const FlightPlan = lazyPage(() => import('./pages/FlightPlan'));
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ClaudeQueue from './pages/ClaudeQueue';
import Security from './pages/Security';
import OutreachPage from '@/features/outreach/OutreachPage';
import LegacyImportBanner from '@/features/tasks/LegacyImportBanner';
import PackagePage from '@/features/packages/PackagePage';
import LoginPage from '@/features/auth/LoginPage';
import HiringPlanPage from '@/features/hiring/HiringPlanPage';
import SmplStudioPage from '@/features/studios/SmplStudioPage';
import ChromeWorkspacePage from '@/features/workspace/ChromeWorkspacePage';
import TrainingAdminPage from '@/features/training/TrainingAdminPage';
import TraineePage from '@/features/training/TraineePage';
import ClientUsagePage from '@/features/usage/ClientUsagePage';
import FuelEconomicsPage from '@/features/fuel/FuelEconomicsPage';
import UpgradeStorePage from '@/features/addons/UpgradeStorePage';
import AgentsPage from '@/features/agents/AgentsPage';
import UniversePage from '@/features/universe/UniversePage';
const UsageCostPage = lazyPage(() => import('@/features/usage/UsageCostPage'));
import PlaybooksPage from '@/features/playbooks/PlaybooksPage';
import SystemsPage from '@/features/systems/SystemsPage';
const ContentPipelinePage = lazyPage(() => import('@/features/content/ContentPipelinePage'));
import ShareImagesPage from '@/features/shareImages/ShareImagesPage';
import CallsPage from '@/features/calls/CallsPage';
import CallPrepPage from '@/features/calls/CallPrepPage';
import IntelligencePage from '@/features/oracle/IntelligencePage';
import LaunchPage from '@/features/launch/LaunchPage';
import OracleTopicPage from '@/features/oracle/TopicPage';
import More from './pages/More';
const UsageInsights = lazyPage(() => import('./pages/UsageInsights'));
import CommandHome from '@/features/command/CommandHome';
import PillarsView from '@/features/command/PillarsView';
import BrainView from '@/features/command/BrainView';
import WalkMode from '@/features/command/WalkMode';
import LaunchWeekPage from '@/features/launchweek/LaunchWeekPage';
import BrandsPage from '@/features/brands/BrandsPage';
import BrandDashboard from '@/features/brands/BrandDashboard';
// Lead Engine (Nov 2026): call sheet, Lead Finder, Sales HQ, industry templates, one page per lead; sales reps get
// their own side (StaffGate → SalesApp).
const CallSheetPage = lazyPage(() => import('@/features/leads/CallSheetPage'));
const LeadFinderPage = lazyPage(() => import('@/features/leads/LeadFinderPage'));
const SalesHQPage = lazyPage(() => import('@/features/leads/SalesHQPage'));
const TemplatesPage = lazyPage(() => import('@/features/leads/TemplatesPage'));
const LeadWorkspacePage = lazyPage(() => import('@/features/leads/LeadWorkspace'));
const StaffGate = lazyPage(() => import('@/features/leads/StaffGate'));

// Branded sign-in routes. They render without a session. While the platform's hosted login owns /login for this
// private app (custom auth not enrolled), the server answers these paths itself; the page takes over as soon as
// the app is switched to its own login.
const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

function PortalPreview() {
  const { clientId } = useParams();
  return <PortalApp previewId={clientId} />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();
  const location = useLocation();

  if (AUTH_PATHS.includes(location.pathname.replace(/\/+$/, ''))) {
    return <Routes>{AUTH_PATHS.map((p) => <Route key={p} path={p} element={<LoginPage />} />)}</Routes>;
  }

  // Public request forms (/r/<id>?k=...) need no login: client sites link straight to them.
  // Trainee links (/t/<assignment>?k=...) need no login: new hires open their training on their phone.
  if (window.location.pathname.startsWith('/t/')) {
    return <Routes><Route path="/t/:id" element={<TraineePage />} /></Routes>;
  }

  if (window.location.pathname.startsWith('/r/')) {
    return <Routes><Route path="/r/:id" element={<PublicRequest />} /></Routes>;
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-hair border-t-[#ff3c00]" aria-label="Loading"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Non-admins: a sales rep gets the sales side (server-checked); clients and leads get their own portal.
  if (user && user.role !== 'admin') {
    return <StaffGate />;
  }

  // Render the main app
  return (
    <>
    <PresentationControls />
    <Routes>
      <Route path="/portal/:clientId" element={<PortalPreview />} />
      <Route path="/r/:id" element={<PublicRequest />} />
      {/* Walk Mode is full-screen, outside the layout (docs/command/01-vision-and-architecture.md). */}
      <Route path="/walk" element={<ProtectedRoute><WalkMode /></ProtectedRoute>} />
      <Route element={<Layout />}>
        {/* Møthership Command is the home; the old Mission Control dashboard lives at /classic. */}
        <Route path="/" element={<CommandHome />} />
        <Route path="/classic" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/pillars" element={<ProtectedRoute><PillarsView /></ProtectedRoute>} />
        <Route path="/brain" element={<ProtectedRoute><BrainView /></ProtectedRoute>} />
        <Route path="/command/launch-week" element={<ProtectedRoute><LaunchWeekPage /></ProtectedRoute>} />
        {/* Hub shortcuts (see src/lib/nav.js and docs/cleanup-2026-11-12.md). Every older route below is unchanged. */}
        <Route path="/today" element={<Navigate to="/" replace />} />
        <Route path="/clients" element={<Navigate to="/crm" replace />} />
        <Route path="/work" element={<Navigate to="/tasks" replace />} />
        <Route path="/marketing" element={<Navigate to="/performance" replace />} />
        <Route path="/sales" element={<Navigate to="/pipeline" replace />} />
        <Route path="/money" element={<Navigate to="/financial" replace />} />
        <Route path="/more" element={<ProtectedRoute><More /></ProtectedRoute>} />
        <Route path="/more/usage" element={<ProtectedRoute><UsageInsights /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
        <Route path="/legal" element={<ProtectedRoute><Legal /></ProtectedRoute>} />
        <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
        <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
        <Route path="/financing" element={<ProtectedRoute><Financing /></ProtectedRoute>} />
        <Route path="/clients/:id" element={<ProtectedRoute><ClientCockpit /></ProtectedRoute>} />
        {/* House of Brands: Interstellar + its niche brands (DIALD first). */}
        <Route path="/brands" element={<ProtectedRoute><BrandsPage /></ProtectedRoute>} />
        <Route path="/brands/:slug" element={<ProtectedRoute><BrandDashboard /></ProtectedRoute>} />
        <Route path="/client-usage" element={<ProtectedRoute><ClientUsagePage /></ProtectedRoute>} />
        <Route path="/fuel-economics" element={<ProtectedRoute><FuelEconomicsPage /></ProtectedRoute>} />
        <Route path="/upgrades" element={<ProtectedRoute><UpgradeStorePage /></ProtectedRoute>} />
        <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
        {/* Universe: Claude -> Møthership -> brands -> clients -> departments -> agents, one zoomable tree. */}
        <Route path="/universe" element={<ProtectedRoute><UniversePage /></ProtectedRoute>} />
        <Route path="/usage-cost" element={<ProtectedRoute><UsageCostPage /></ProtectedRoute>} />
        <Route path="/playbooks" element={<ProtectedRoute><PlaybooksPage /></ProtectedRoute>} />
        <Route path="/systems" element={<ProtectedRoute><SystemsPage /></ProtectedRoute>} />
        <Route path="/launch" element={<ProtectedRoute><LaunchPage /></ProtectedRoute>} />
        <Route path="/comms" element={<ProtectedRoute><Comms /></ProtectedRoute>} />
        <Route path="/leads" element={<Navigate to="/leads/desk" replace />} />
        <Route path="/leads/desk" element={<ProtectedRoute><CallSheetPage /></ProtectedRoute>} />
        <Route path="/leads/finder" element={<ProtectedRoute><LeadFinderPage /></ProtectedRoute>} />
        <Route path="/leads/hq" element={<ProtectedRoute><SalesHQPage /></ProtectedRoute>} />
        <Route path="/leads/templates" element={<ProtectedRoute><TemplatesPage /></ProtectedRoute>} />
        <Route path="/leads/lead/:id" element={<ProtectedRoute><LeadWorkspacePage /></ProtectedRoute>} />
        <Route path="/orbit-seo" element={<Navigate to="/packages/orbit-seo" replace />} />
        <Route path="/orbit-seo/manage" element={<ProtectedRoute><OrbitSEO /></ProtectedRoute>} />
        <Route path="/packages" element={<Navigate to="/packages/orbit-seo" replace />} />
        <Route path="/packages/:key" element={<ProtectedRoute><PackagePage /></ProtectedRoute>} />
        <Route path="/packages/:key/:clientId" element={<ProtectedRoute><PackagePage /></ProtectedRoute>} />

        <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
        <Route path="/content-plans" element={<ProtectedRoute><ContentPlans /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/automations" element={<ProtectedRoute><AutomationsPage /></ProtectedRoute>} />
        <Route path="/idea-vault" element={<ProtectedRoute><IdeaVault /></ProtectedRoute>} />
        <Route path="/intelligence" element={<ProtectedRoute><IntelligencePage /></ProtectedRoute>} />
        <Route path="/intelligence/:topicKey" element={<ProtectedRoute><OracleTopicPage /></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
        <Route path="/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
        <Route path="/client-posts" element={<ProtectedRoute><ContentPipelinePage /></ProtectedRoute>} />
        <Route path="/share-images" element={<ProtectedRoute><ShareImagesPage /></ProtectedRoute>} />
        <Route path="/calls" element={<ProtectedRoute><CallsPage /></ProtectedRoute>} />
        <Route path="/calls/:id" element={<ProtectedRoute><CallPrepPage /></ProtectedRoute>} />
        <Route path="/signatures" element={<ProtectedRoute><SignaturesPage /></ProtectedRoute>} />
        <Route path="/signatures/templates/:id" element={<ProtectedRoute><SignatureEditor mode="template" /></ProtectedRoute>} />
        <Route path="/signatures/new" element={<ProtectedRoute><SignatureEditor /></ProtectedRoute>} />
        <Route path="/signatures/:id" element={<ProtectedRoute><SignatureEditor /></ProtectedRoute>} />
        <Route path="/qr" element={<ProtectedRoute><QrPage /></ProtectedRoute>} />
        <Route path="/qr/:id" element={<ProtectedRoute><QrEditorPage /></ProtectedRoute>} />
        <Route path="/social" element={<ProtectedRoute><SocialPage /></ProtectedRoute>} />
        <Route path="/ads" element={<ProtectedRoute><AdsStudioPage /></ProtectedRoute>} />
        <Route path="/email" element={<ProtectedRoute><EmailStudioPage /></ProtectedRoute>} />
        <Route path="/social/:id" element={<ProtectedRoute><SocialPostDetail /></ProtectedRoute>} />
        <Route path="/presentations" element={<ProtectedRoute><PresentationStudio /></ProtectedRoute>} />
        <Route path="/presentations/deck/:id" element={<ProtectedRoute><PresentationStudio /></ProtectedRoute>} />
        <Route path="/presentations/projects" element={<ProtectedRoute><PresentationProjects /></ProtectedRoute>} />
        <Route path="/todo" element={<Navigate to="/tasks" replace />} />
        <Route path="/tasks" element={<ProtectedRoute><LegacyImportBanner /><TaskBoard /></ProtectedRoute>} />
        {/* Voice inbox retired: the Command Ask bar replaces it; unsure commands land in Needs you. */}
        <Route path="/tasks/inbox" element={<Navigate to="/" replace />} />
        <Route path="/tasks/patterns" element={<ProtectedRoute><TaskPatterns /></ProtectedRoute>} />
        <Route path="/tasks/sops" element={<ProtectedRoute><TaskSops /></ProtectedRoute>} />
        <Route path="/flight-plan" element={<ProtectedRoute><FlightPlan /></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
        <Route path="/claude" element={<ProtectedRoute><ClaudeQueue /></ProtectedRoute>} />
        <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
        <Route path="/backlinks" element={<ProtectedRoute><OutreachPage /></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
        <Route path="/prestige" element={<ProtectedRoute><Prestige /></ProtectedRoute>} />
        <Route path="/output-analytics" element={<ProtectedRoute><OutputAnalytics /></ProtectedRoute>} />
        <Route path="/growth" element={<Navigate to="/growth/hiring" replace />} />
        <Route path="/growth/hiring" element={<ProtectedRoute><HiringPlanPage /></ProtectedRoute>} />
        <Route path="/studios/smpl" element={<ProtectedRoute><SmplStudioPage /></ProtectedRoute>} />
        <Route path="/training" element={<ProtectedRoute><TrainingAdminPage /></ProtectedRoute>} />
        <Route path="/studios/simple-social" element={<Navigate to="/studios/smpl" replace />} />
        <Route path="/tools/chrome-workspace" element={<ProtectedRoute><ChromeWorkspacePage /></ProtectedRoute>} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
    </>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        {/* Site film grain over every screen (admin, portal, sign-in): see "SITE SKIN" in index.css. */}
        <div className="ms-grain" aria-hidden="true" />
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App