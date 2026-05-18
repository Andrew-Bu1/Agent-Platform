import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  CheckCircle, ScrollText,
} from 'lucide-react';
import { useAuthStore } from './store/authStore';
import { tryRefresh } from './api/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import PlaceholderPage from './pages/PlaceholderPage';
import SettingsPage from './pages/SettingsPage';
import AgentsPage from './pages/AgentsPage';
import ToolsPage from './pages/ToolsPage';
import WorkflowsPage from './pages/WorkflowsPage';
import RunsPage from './pages/RunsPage';
import AccessControlPage from './pages/AccessControlPage';
import DatasourcesPage from './pages/DatasourcesPage';
import ModelsPage from './pages/ModelsPage';
import FlowEditorPage from './pages/FlowEditorPage';
import ChatPage from './pages/ChatPage';
import ModelPlaygroundPage from './pages/ModelPlaygroundPage';
import PlatformPage from './pages/PlatformPage';
import AnalyticsPage from './pages/AnalyticsPage';
import TracesPage from './pages/TracesPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { accessToken, refreshToken } = useAuthStore();
  const needsRefresh = !accessToken && !!refreshToken;
  const [initializing, setInitializing] = useState(needsRefresh);

  useEffect(() => {
    if (needsRefresh) {
      tryRefresh().finally(() => setInitializing(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (!accessToken && !refreshToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Full-screen canvas editor — outside Layout */}
          <Route
            path="/workflows/:flowId/edit"
            element={
              <RequireAuth>
                <FlowEditorPage />
              </RequireAuth>
            }
          />

          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            {/* Dashboard */}
            <Route index element={<DashboardPage />} />

            {/* Build */}
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="agents"    element={<AgentsPage />} />
            <Route path="tools"     element={<ToolsPage />} />
            <Route path="knowledge"    element={<Navigate to="/datasources" replace />} />
            <Route path="datasources" element={<DatasourcesPage />} />

            {/* Observe */}
            <Route path="chat"        element={<ChatPage />} />
            <Route path="playground"  element={<ModelPlaygroundPage />} />
            <Route path="runs"        element={<RunsPage />} />
            <Route path="traces"      element={<TracesPage />} />
            <Route path="evaluations" element={<PlaceholderPage title="Evaluations" description="Score and compare agent outputs against benchmarks."        icon={CheckCircle} color="text-yellow-600" />} />
            <Route path="analytics"   element={<AnalyticsPage />} />
            <Route path="logs"        element={<PlaceholderPage title="Logs"        description="Structured logs from all services."                         icon={ScrollText}  color="text-slate-600"  />} />

            {/* Manage */}
            <Route path="models"          element={<ModelsPage />} />
            <Route path="platform"        element={<PlatformPage />} />
            <Route path="access-control" element={<AccessControlPage />} />
            <Route path="settings" element={<SettingsPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
