import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const PAGE_TITLES: Record<string, string> = {
  '/':              'Dashboard',
  '/workflows':     'Workflows',
  '/agents':        'Agents',
  '/teams':         'Teams',
  '/tools':         'Tools',
  '/knowledge':     'Knowledge',
  '/memory':        'Memory',
  '/templates':     'Templates',
  '/runs':          'Runs',
  '/traces':        'Traces',
  '/evaluations':   'Evaluations',
  '/analytics':     'Analytics',
  '/logs':          'Logs',
  '/deployments':   'Deployments',
  '/access-control':'Access Control',
  '/settings':      'Settings',
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'Agent Studio';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
