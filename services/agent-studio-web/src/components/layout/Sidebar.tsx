import { NavLink } from 'react-router-dom';
import {
  Bot, GitBranch, Wrench, Database,
  MessageSquare, Activity, BarChart2, Shield, Settings,
  ChevronLeft, ChevronRight, Cpu, Crown,
} from 'lucide-react';
import { useState } from 'react';
import WorkspaceSwitcher from './WorkspaceSwitcher';

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
      { label: 'Tools',     to: '/tools',     icon: Wrench },
      { label: 'Datasources', to: '/datasources', icon: Database },
    ],
  },
  {
    title: 'Observe',
    items: [
      { label: 'Chat',      to: '/chat',      icon: MessageSquare },
      { label: 'Traces',    to: '/traces',    icon: Activity },
      { label: 'Analytics', to: '/analytics', icon: BarChart2 },
    ],
  },
  {
    title: 'Manage',
    items: [
      { label: 'Models',         to: '/models',         icon: Cpu },
      { label: 'Platform',       to: '/platform',       icon: Crown },
      { label: 'Access Control', to: '/access-control', icon: Shield },
      { label: 'Settings',       to: '/settings',       icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-slate-900 text-slate-100 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      } shrink-0 h-screen`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-3 py-4 border-b border-slate-700/60 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <Bot className="w-4.5 h-4.5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-white text-sm tracking-tight truncate">
            Agent Studio
          </span>
        )}
      </div>

      {/* Workspace switcher */}
      <div className={`border-b border-slate-700/60 ${collapsed ? 'px-2 py-2' : 'px-2 py-2'}`}>
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
        {NAV.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
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
                      } ${collapsed ? 'justify-center' : ''}`
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
      <div className="border-t border-slate-700/60 p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400
                     hover:bg-slate-800 hover:text-slate-100 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
