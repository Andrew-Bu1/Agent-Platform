import type { LucideIcon } from 'lucide-react';
import {
  GitBranch, Bot, Users, Wrench, BookOpen, Brain, LayoutTemplate,
  Play, Activity, CheckCircle, BarChart2, ScrollText, Rocket, Shield, Settings,
} from 'lucide-react';

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  auth: boolean;
  sse?: boolean;
}

interface ApiGroup {
  label: string;
  icon: LucideIcon;
  color: string;
  endpoints: ApiEndpoint[];
}

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-sky-100 text-sky-700',
  POST:   'bg-green-100 text-green-700',
  PUT:    'bg-amber-100 text-amber-700',
  PATCH:  'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
};

const API_GROUPS: ApiGroup[] = [
  {
    label: 'Auth', icon: Settings, color: 'text-gray-600',
    endpoints: [
      { method: 'POST', path: '/api/v1/auth/login',           description: 'Login → preAuthToken + tenants',        auth: false },
      { method: 'POST', path: '/api/v1/auth/workspaces',      description: 'List workspaces for tenant',            auth: false },
      { method: 'POST', path: '/api/v1/auth/switch-context',  description: 'Select tenant + workspace → JWT',       auth: false },
      { method: 'POST', path: '/api/v1/auth/refresh',         description: 'Refresh access token',                  auth: false },
      { method: 'POST', path: '/api/v1/auth/logout/session',  description: 'Revoke current session',                auth: false },
      { method: 'POST', path: '/api/v1/auth/logout',          description: 'Revoke all sessions',                   auth: true  },
      { method: 'GET',  path: '/api/v1/auth/me',              description: 'Get current user profile',              auth: true  },
      { method: 'PATCH',path: '/api/v1/auth/me/password',     description: 'Change password',                       auth: true  },
      { method: 'POST', path: '/api/v1/auth/signup',          description: 'Create user account',                   auth: false },
    ],
  },
  {
    label: 'Workflows', icon: GitBranch, color: 'text-violet-600',
    endpoints: [
      { method: 'GET',    path: '/api/v1/flows',                        description: 'List flows (paginated)',      auth: true },
      { method: 'POST',   path: '/api/v1/flows',                        description: 'Create flow',                auth: true },
      { method: 'GET',    path: '/api/v1/flows/{id}',                   description: 'Get flow by ID',             auth: true },
      { method: 'PUT',    path: '/api/v1/flows/{id}',                   description: 'Update flow metadata',       auth: true },
      { method: 'DELETE', path: '/api/v1/flows/{id}',                   description: 'Delete flow',                auth: true },
      { method: 'POST',   path: '/api/v1/flows/{id}/publish',           description: 'Publish latest version',     auth: true },
      { method: 'GET',    path: '/api/v1/flows/{id}/versions',          description: 'List all versions',          auth: true },
      { method: 'POST',   path: '/api/v1/flows/{id}/versions',          description: 'Save new version (graph)',   auth: true },
      { method: 'GET',    path: '/api/v1/flows/{id}/versions/{version}','description': 'Get specific version',    auth: true },
    ],
  },
  {
    label: 'Agents', icon: Bot, color: 'text-blue-600',
    endpoints: [
      { method: 'GET',    path: '/api/v1/agents',       description: 'List agents (paginated)', auth: true },
      { method: 'POST',   path: '/api/v1/agents',       description: 'Create agent',            auth: true },
      { method: 'GET',    path: '/api/v1/agents/{id}',  description: 'Get agent',               auth: true },
      { method: 'PUT',    path: '/api/v1/agents/{id}',  description: 'Update agent',            auth: true },
      { method: 'DELETE', path: '/api/v1/agents/{id}',  description: 'Delete agent',            auth: true },
    ],
  },
  {
    label: 'Teams', icon: Users, color: 'text-teal-600',
    endpoints: [
      { method: 'GET',  path: '/api/v1/teams',       description: 'List teams',   auth: true },
      { method: 'POST', path: '/api/v1/teams',       description: 'Create team',  auth: true },
      { method: 'GET',  path: '/api/v1/teams/{id}',  description: 'Get team',     auth: true },
      { method: 'PUT',  path: '/api/v1/teams/{id}',  description: 'Update team',  auth: true },
      { method: 'DELETE',path:'/api/v1/teams/{id}',  description: 'Delete team',  auth: true },
    ],
  },
  {
    label: 'Tools', icon: Wrench, color: 'text-orange-600',
    endpoints: [
      { method: 'GET',    path: '/api/v1/tools',       description: 'List tools (paginated)', auth: true },
      { method: 'POST',   path: '/api/v1/tools',       description: 'Create tool',            auth: true },
      { method: 'GET',    path: '/api/v1/tools/{id}',  description: 'Get tool',               auth: true },
      { method: 'PUT',    path: '/api/v1/tools/{id}',  description: 'Update tool',            auth: true },
      { method: 'DELETE', path: '/api/v1/tools/{id}',  description: 'Delete tool',            auth: true },
    ],
  },
  {
    label: 'Knowledge (DataHub)', icon: BookOpen, color: 'text-emerald-600',
    endpoints: [
      { method: 'GET',    path: '/api/v1/datahub/**', description: 'DataHub proxy — all routes forwarded', auth: true },
    ],
  },
  {
    label: 'Templates', icon: LayoutTemplate, color: 'text-indigo-600',
    endpoints: [
      { method: 'GET', path: '/api/v1/templates/**', description: 'Templates — coming soon', auth: true },
    ],
  },
  {
    label: 'Threads', icon: Play, color: 'text-cyan-600',
    endpoints: [
      { method: 'GET',  path: '/api/v1/orchestrator/threads',             description: 'List threads',           auth: true },
      { method: 'POST', path: '/api/v1/orchestrator/threads',             description: 'Create thread',          auth: true },
      { method: 'GET',  path: '/api/v1/orchestrator/threads/{id}',        description: 'Get thread',             auth: true },
      { method: 'GET',  path: '/api/v1/orchestrator/threads/{id}/runs',   description: 'List runs in thread',    auth: true },
    ],
  },
  {
    label: 'Runs', icon: Activity, color: 'text-purple-600',
    endpoints: [
      { method: 'POST', path: '/api/v1/orchestrator/runs',                description: 'Create run',             auth: true },
      { method: 'GET',  path: '/api/v1/orchestrator/runs/{id}',           description: 'Get run',                auth: true },
      { method: 'POST', path: '/api/v1/orchestrator/runs/{id}/cancel',    description: 'Cancel run',             auth: true },
      { method: 'POST', path: '/api/v1/orchestrator/runs/{id}/resume',    description: 'Resume (human-in-loop)', auth: true },
      { method: 'GET',  path: '/api/v1/orchestrator/runs/{id}/events',    description: 'Stream SSE events',      auth: true, sse: true },
      { method: 'GET',  path: '/api/v1/orchestrator/runs/pending-review', description: 'Pending human review',   auth: true },
    ],
  },
  {
    label: 'Evaluations', icon: CheckCircle, color: 'text-yellow-600',
    endpoints: [
      { method: 'GET', path: '/api/v1/evaluations/**', description: 'Evaluations — coming soon', auth: true },
    ],
  },
  {
    label: 'Analytics', icon: BarChart2, color: 'text-rose-600',
    endpoints: [
      { method: 'GET', path: '/api/v1/analytics/**', description: 'Analytics — coming soon', auth: true },
    ],
  },
  {
    label: 'Logs', icon: ScrollText, color: 'text-slate-600',
    endpoints: [
      { method: 'GET', path: '/api/v1/logs/**', description: 'Logs — coming soon', auth: true },
    ],
  },
  {
    label: 'Deployments', icon: Rocket, color: 'text-red-600',
    endpoints: [
      { method: 'GET', path: '/api/v1/deployments/**', description: 'Deployments — coming soon', auth: true },
    ],
  },
  {
    label: 'Access Control', icon: Shield, color: 'text-gray-700',
    endpoints: [
      { method: 'GET',  path: '/api/v1/tenants',                       description: 'List tenants',        auth: true },
      { method: 'POST', path: '/api/v1/tenants',                       description: 'Create tenant',       auth: true },
      { method: 'GET',  path: '/api/v1/tenants/{id}',                  description: 'Get tenant',          auth: true },
      { method: 'GET',  path: '/api/v1/tenants/{id}/workspaces',       description: 'List workspaces',     auth: true },
      { method: 'POST', path: '/api/v1/tenants/{id}/workspaces',       description: 'Create workspace',    auth: true },
      { method: 'GET',  path: '/api/v1/tenants/{id}/members',          description: 'List members',        auth: true },
      { method: 'POST', path: '/api/v1/tenants/{id}/members/invite',   description: 'Invite member',       auth: true },
      { method: 'GET',  path: '/api/v1/tenants/{id}/roles',            description: 'List roles',          auth: true },
    ],
  },
  {
    label: 'AIHub (Models)', icon: Brain, color: 'text-fuchsia-600',
    endpoints: [
      { method: 'GET', path: '/api/v1/aihub/**', description: 'AIHub proxy — models, inference', auth: true },
    ],
  },
];

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">API Reference</h2>
        <p className="text-sm text-gray-500 mt-1">
          All endpoints exposed by Agent Studio BFF&nbsp;·&nbsp;Base: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">http://localhost:8082</code>
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(METHOD_COLORS).map(([m, cls]) => (
          <span key={m} className={`px-2 py-0.5 rounded font-mono font-bold ${cls}`}>{m}</span>
        ))}
        <span className="px-2 py-0.5 rounded font-mono font-bold bg-purple-100 text-purple-700">SSE</span>
        <span className="ml-4 text-gray-400">🔒 requires Bearer token</span>
      </div>

      {/* Groups */}
      {API_GROUPS.map((group) => {
        const Icon = group.icon;
        return (
          <div key={group.label} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
              <Icon className={`w-4 h-4 ${group.color}`} />
              <span className="font-semibold text-gray-800 text-sm">{group.label}</span>
              <span className="ml-auto text-xs text-gray-400">{group.endpoints.length} endpoint{group.endpoints.length !== 1 ? 's' : ''}</span>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {group.endpoints.map((ep, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-2.5 w-24">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono ${METHOD_COLORS[ep.method]}`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-700 w-80">
                      {ep.path}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs flex-1">
                      {ep.description}
                      {ep.sse && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-bold">SSE</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {ep.auth && <span className="text-gray-300 text-base">🔒</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
