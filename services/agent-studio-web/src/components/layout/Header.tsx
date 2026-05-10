import { useNavigate } from 'react-router-dom';
import { LogOut, User, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const navigate = useNavigate();
  const { clearAuth, refreshToken } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      if (refreshToken) {
        await authApi.logoutSession(refreshToken);
      }
    } catch {
      // best-effort
    } finally {
      clearAuth();
      navigate('/login');
    }
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
            <User className="w-4 h-4 text-brand-600" />
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {menuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-10 z-20 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-hidden">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                <LogOut className="w-4 h-4" />
                {loggingOut ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
