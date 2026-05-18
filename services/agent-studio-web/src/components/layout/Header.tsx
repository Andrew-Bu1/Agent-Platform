import { useNavigate, Link } from 'react-router-dom';
import { LogOut, Settings, ChevronDown, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const navigate = useNavigate();
  const { clearAuth, refreshToken, userProfile, setUserProfile } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Fetch profile on mount if not already loaded
  useEffect(() => {
    if (!userProfile) {
      authApi.me().then(setUserProfile).catch(() => {});
    }
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      if (refreshToken) await authApi.logoutSession(refreshToken);
    } catch {
      // best-effort
    } finally {
      clearAuth();
      navigate('/login');
    }
  }

  const initials = userProfile?.name
    ? userProfile.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-sm font-semibold text-gray-900">{title}</h1>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-gray-700
                     hover:bg-gray-50 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate hidden sm:block">
            {userProfile?.name ?? '…'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-10 z-20 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden">
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-medium text-gray-900 truncate">{userProfile?.name ?? '—'}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{userProfile?.email ?? '—'}</p>
              </div>

              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700
                           hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-4 h-4 text-gray-400" />
                Settings
              </Link>

              <div className="border-t border-gray-50 mt-1">
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600
                             hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  <LogOut className="w-4 h-4" />
                  {loggingOut ? 'Logging out…' : 'Log out'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
