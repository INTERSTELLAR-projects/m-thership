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
import CredentialManager from './pages/CredentialManager';
import Documents from './pages/Documents';
import Financial from './pages/Financial';
import Legal from './pages/Legal';
import CRM from './pages/CRM';
import Analytics from './pages/Analytics';
import Comms from './pages/Comms';
import OrbitSEO from './pages/OrbitSEO';

import Performance from './pages/Performance';
import SettingsPage from './pages/SettingsPage';
import IdeaVault from './pages/IdeaVault';
import Requests from './pages/Requests';
import ToDo from './pages/ToDo';
import ClientComms from './pages/ClientComms';
import Prestige from './pages/Prestige';
import OutputAnalytics from './pages/OutputAnalytics';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

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

  // Block all non-admin users from the entire app
  if (user && user.role !== 'admin') {
    return (
      <div className="fixed inset-0 bg-ink flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <span className="text-red-600 text-xl">⛔</span>
        </div>
        <h1 className="font-orbitron text-ink font-bold text-lg tracking-widest">ACCESS DENIED</h1>
        <p className="text-ink/[0.58] text-sm text-center max-w-xs">This terminal is restricted to authorized personnel only. You do not have permission to access this system.</p>
        <button onClick={() => base44.auth.logout()} className="mt-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-600 text-sm rounded-lg hover:bg-red-500/20 transition-all">Log Out</button>
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/logins" element={<ProtectedRoute><CredentialManager /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
        <Route path="/legal" element={<ProtectedRoute><Legal /></ProtectedRoute>} />
        <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/comms" element={<ProtectedRoute><Comms /></ProtectedRoute>} />
        <Route path="/orbit-seo" element={<ProtectedRoute><OrbitSEO /></ProtectedRoute>} />

        <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/idea-vault" element={<ProtectedRoute><IdeaVault /></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
        <Route path="/todo" element={<ProtectedRoute><ToDo /></ProtectedRoute>} />
        <Route path="/client-comms" element={<ProtectedRoute><ClientComms /></ProtectedRoute>} />
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