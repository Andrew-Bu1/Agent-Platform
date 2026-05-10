import { NavLink } from 'react-router-dom';
import {
  Bot,
  GitBranch,
  Users,
  Wrench,
  BookOpen,
  Brain,
  LayoutTemplate,
  Play,
  Activity,
  CheckCircle,
  BarChart2,
  ScrollText,
  Rocket,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    title: 'Build',
    items: [
      { label: 'Workflows', to: '/workflows', icon: GitBranch },
      { label: 'Agents',    to: '/agents',    icon: Bot },
      { label: 'Teams',     to: '/teams',     icon: Users },
      { label: 'Tools',     to: '/tools',     icon: Wrench },
      { label: 'Knowledge', to: '/knowledge', icon: BookOpen },
      { label: 'Memory',    to: '/memory',    icon: Brain },
      { label: 'Templates', to: '/templates', icon: LayoutTemplate },
    ],
  },
  {
    title: 'Observe',
    items: [
      { label: 'Runs',        to: '/runs',        icon: Play },
      { label: 'Traces',      to: '/traces',      icon: Activity },
      { label: 'Evaluations', to: '/evaluations', icon: CheckCircle },
      { label: 'Analytics',   to: '/analytics',   icon: BarChart2 },
      { label: 'Logs',        to: '/logs',         icon: ScrollText },
    ],
  },
  {
    title: 'Manage',
    items: [
      { label: 'Deployments',    to: '/deployments',    icon: Rocket },
      { label: 'Access Control', to: '/access-control', icon: Shield },
      { label: 'Settings',       to: '/settings',       icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { selectedWorkspace, selectedTenant } = useAuthStore();

  return (
    <aside
      className={`flex flex-col bg-slate-900 text-slate-100 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      } shrink-0 h-screen`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-white text-sm leading-tight truncate">
            Agent Studio
          </span>
        )}
      </div>

      {/* Workspace chip */}
      {!collapsed && selectedWorkspace && (
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-xs text-slate-400 truncate">{selectedTenant?.name}</p>
          <p className="text-sm font-medium text-slate-200 truncate">{selectedWorkspace.name}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-5 px-2">
        {NAV.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-2 mb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map(({ label, to, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                      }`
                    }
                    title={collapsed ? label : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-slate-700 p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
