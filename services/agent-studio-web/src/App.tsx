import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  Bot, GitBranch, Users, Wrench, BookOpen, Brain, LayoutTemplate,
  Play, Activity, CheckCircle, BarChart2, ScrollText, Rocket, Shield, Settings,
} from 'lucide-react';
import { useAuthStore } from './store/authStore';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import PlaceholderPage from './pages/PlaceholderPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { accessToken, refreshToken } = useAuthStore();
  // Allow in if we have at least a refresh token (will re-hydrate on first request)
  if (!accessToken && !refreshToken) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          {/* Dashboard = API overview */}
          <Route index element={<DashboardPage />} />

          {/* Build */}
          <Route path="workflows" element={<PlaceholderPage title="Workflows" description="Design and manage agent workflows on the canvas. Coming next." icon={GitBranch} color="text-violet-600" />} />
          <Route path="agents"    element={<PlaceholderPage title="Agents"    description="Create and configure AI agents with tools and models."        icon={Bot}           color="text-blue-600"   />} />
          <Route path="teams"     element={<PlaceholderPage title="Teams"     description="Compose multi-agent teams with routing and coordination."      icon={Users}         color="text-teal-600"   />} />
          <Route path="tools"     element={<PlaceholderPage title="Tools"     description="Register API tools and functions available to agents."         icon={Wrench}        color="text-orange-600" />} />
          <Route path="knowledge" element={<PlaceholderPage title="Knowledge" description="Manage document collections for retrieval-augmented agents."   icon={BookOpen}      color="text-emerald-600"/>} />
          <Route path="memory"    element={<PlaceholderPage title="Memory"    description="Persistent memory stores for long-running agent sessions."      icon={Brain}         color="text-pink-600"   />} />
          <Route path="templates" element={<PlaceholderPage title="Templates" description="Pre-built workflow patterns to accelerate development."         icon={LayoutTemplate}color="text-indigo-600" />} />

          {/* Observe */}
          <Route path="runs"        element={<PlaceholderPage title="Runs"        description="Monitor live and historical workflow execution runs."       icon={Play}        color="text-purple-600" />} />
          <Route path="traces"      element={<PlaceholderPage title="Traces"      description="Distributed traces across nodes and agents."               icon={Activity}    color="text-cyan-600"   />} />
          <Route path="evaluations" element={<PlaceholderPage title="Evaluations" description="Score and compare agent outputs against benchmarks."        icon={CheckCircle} color="text-yellow-600" />} />
          <Route path="analytics"   element={<PlaceholderPage title="Analytics"   description="Usage metrics, token costs, and performance dashboards."    icon={BarChart2}   color="text-rose-600"   />} />
          <Route path="logs"        element={<PlaceholderPage title="Logs"        description="Structured logs from all services."                         icon={ScrollText}  color="text-slate-600"  />} />

          {/* Manage */}
          <Route path="deployments"    element={<PlaceholderPage title="Deployments"    description="Deploy agents and workflows to production environments." icon={Rocket}  color="text-red-600"  />} />
          <Route path="access-control" element={<PlaceholderPage title="Access Control" description="Manage tenants, workspaces, members and roles."         icon={Shield}  color="text-gray-700" />} />
          <Route path="settings"       element={<PlaceholderPage title="Settings"       description="Application and workspace configuration."                icon={Settings}color="text-gray-600" />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
