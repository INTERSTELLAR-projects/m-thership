import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CredentialManager from './pages/CredentialManager';
import Documents from './pages/Documents';
import Financial from './pages/Financial';
import Legal from './pages/Legal';
import CRM from './pages/CRM';
import Analytics from './pages/Analytics';
import Comms from './pages/Comms';
import OrbitSEO from './pages/OrbitSEO';
import WebOps from './pages/WebOps';
import Forge from './pages/Forge';
import Performance from './pages/Performance';
import SettingsPage from './pages/SettingsPage';
import IdeaVault from './pages/IdeaVault';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/logins" element={<CredentialManager />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/financial" element={<Financial />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/comms" element={<Comms />} />
        <Route path="/orbit-seo" element={<OrbitSEO />} />
        <Route path="/web-ops" element={<WebOps />} />
        <Route path="/forge" element={<Forge />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/idea-vault" element={<IdeaVault />} />
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