import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { base44 } from '@/api/base44Client';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Financial from './pages/Financial';
import Legal from './pages/Legal';
import CRM from './pages/CRM';
import Comms from './pages/Comms';
import OrbitSEO from './pages/OrbitSEO';

import Performance from './pages/Performance';
import SettingsPage from './pages/SettingsPage';
import IdeaVault from './pages/IdeaVault';
import Requests from './pages/Requests';
import Reviews from './pages/Reviews';
import PublicRequest from './pages/PublicRequest';
import SignaturesPage from '@/features/signatures/SignaturesPage';
import SignatureEditor from '@/features/signatures/EditorPage';
import PresentationStudio from '@/features/presentations/StudioPage';
import PresentationProjects from '@/features/presentations/ProjectsPage';
import Prestige from './pages/Prestige';
import OutputAnalytics from './pages/OutputAnalytics';
import ClientCockpit from './pages/ClientCockpit';
import PortalApp from '@/features/portal/PortalApp';
import TaskBoard from './pages/TaskBoard';
import TaskInbox from './pages/TaskInbox';
import TaskPatterns from './pages/TaskPatterns';
import TaskSops from './pages/TaskSops';
import FlightPlan from './pages/FlightPlan';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import ClaudeQueue from './pages/ClaudeQueue';
import LegacyImportBanner from '@/features/tasks/LegacyImportBanner';
import PackagePage from '@/features/packages/PackagePage';
import { Navigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';

function PortalPreview() {
  const { clientId } = useParams();
  return <PortalApp previewId={clientId} />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  // Public request forms (/r/<id>?k=...) need no login: client sites link straight to them.
  if (window.location.pathname.startsWith('/r/')) {
    return <Routes><Route path="/r/:id" element={<PublicRequest />} /></Routes>;
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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

  // Clients (non-admins) only ever get their own portal
  if (user && user.role !== 'admin') {
    return <PortalApp />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/portal/:clientId" element={<PortalPreview />} />
      <Route path="/r/:id" element={<PublicRequest />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
        <Route path="/legal" element={<ProtectedRoute><Legal /></ProtectedRoute>} />
        <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
        <Route path="/clients/:id" element={<ProtectedRoute><ClientCockpit /></ProtectedRoute>} />
        <Route path="/comms" element={<ProtectedRoute><Comms /></ProtectedRoute>} />
        <Route path="/orbit-seo" element={<Navigate to="/packages/orbit-seo" replace />} />
        <Route path="/orbit-seo/manage" element={<ProtectedRoute><OrbitSEO /></ProtectedRoute>} />
        <Route path="/packages" element={<Navigate to="/packages/orbit-seo" replace />} />
        <Route path="/packages/:key" element={<ProtectedRoute><PackagePage /></ProtectedRoute>} />
        <Route path="/packages/:key/:clientId" element={<ProtectedRoute><PackagePage /></ProtectedRoute>} />

        <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/idea-vault" element={<ProtectedRoute><IdeaVault /></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
        <Route path="/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
        <Route path="/signatures" element={<ProtectedRoute><SignaturesPage /></ProtectedRoute>} />
        <Route path="/signatures/new" element={<ProtectedRoute><SignatureEditor /></ProtectedRoute>} />
        <Route path="/signatures/:id" element={<ProtectedRoute><SignatureEditor /></ProtectedRoute>} />
        <Route path="/presentations" element={<ProtectedRoute><PresentationStudio /></ProtectedRoute>} />
        <Route path="/presentations/deck/:id" element={<ProtectedRoute><PresentationStudio /></ProtectedRoute>} />
        <Route path="/presentations/projects" element={<ProtectedRoute><PresentationProjects /></ProtectedRoute>} />
        <Route path="/todo" element={<Navigate to="/tasks" replace />} />
        <Route path="/tasks" element={<ProtectedRoute><LegacyImportBanner /><TaskBoard /></ProtectedRoute>} />
        <Route path="/tasks/inbox" element={<ProtectedRoute><TaskInbox /></ProtectedRoute>} />
        <Route path="/tasks/patterns" element={<ProtectedRoute><TaskPatterns /></ProtectedRoute>} />
        <Route path="/tasks/sops" element={<ProtectedRoute><TaskSops /></ProtectedRoute>} />
        <Route path="/flight-plan" element={<ProtectedRoute><FlightPlan /></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
        <Route path="/claude" element={<ProtectedRoute><ClaudeQueue /></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
        <Route path="/prestige" element={<ProtectedRoute><Prestige /></ProtectedRoute>} />
        <Route path="/output-analytics" element={<ProtectedRoute><OutputAnalytics /></ProtectedRoute>} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App