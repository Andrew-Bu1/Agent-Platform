import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ChevronRight } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../api/client';
import type { TenantInfo, WorkspaceInfo } from '../types/api';
import AuthLayout from '../components/auth/AuthLayout';
import { Field, PrimaryBtn, BackBtn, ErrorBanner } from '../components/auth/AuthFields';

type Step = 'credentials' | 'tenant' | 'workspace';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setTokens, setContext } = useAuthStore();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [preAuthToken, setPreAuthToken] = useState('');
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantInfo | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceInfo | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1: credentials ──────────────────────────────────────────────────────

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      setPreAuthToken(res.preAuthToken);

      if (res.requireTenantCreation) {
        // No org yet — send to signup bootstrap flow
        navigate('/signup?bootstrap=1&token=' + encodeURIComponent(res.preAuthToken));
        return;
      }

      if (!res.requireTenantSelection && res.singleTenantId) {
        const tenant = res.tenants[0] ?? { id: res.singleTenantId, name: '', slug: '' };
        await selectTenant(res.preAuthToken, tenant);
      } else {
        setTenants(res.tenants);
        setStep('tenant');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: tenant picker ────────────────────────────────────────────────────

  async function selectTenant(token: string, tenant: TenantInfo) {
    setError(null);
    setLoading(true);
    try {
      const wsList = await authApi.workspaces({ preAuthToken: token, tenantId: tenant.id });
      setSelectedTenant(tenant);
      if (wsList.length === 1) {
        await finalizeLogin(token, tenant, wsList[0]);
      } else {
        setWorkspaces(wsList);
        setStep('workspace');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: finalize ─────────────────────────────────────────────────────────

  async function finalizeLogin(token: string, tenant: TenantInfo, workspace: WorkspaceInfo) {
    setError(null);
    setLoading(true);
    try {
      const tokens = await authApi.switchContext({
        preAuthToken: token,
        tenantId: tenant.id,
        workspaceId: workspace.id,
      });
      setTokens(tokens);
      setContext(tenant, workspace);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to switch context.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      {error && <ErrorBanner message={error} />}

      {/* ── Credentials ── */}
      {step === 'credentials' && (
        <form onSubmit={handleCredentials} className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1.5">Sign in to your workspace</p>
          </div>

          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoFocus
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />

          <PrimaryBtn loading={loading} label="Continue" />

          <p className="text-center text-sm text-gray-500 pt-1">
            Don't have an account?{' '}
            <Link to="/signup" className="text-brand-600 font-medium hover:text-brand-700">
              Sign up
            </Link>
          </p>
        </form>
      )}

      {/* ── Tenant picker ── */}
      {step === 'tenant' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Select organisation</h2>
            <p className="text-sm text-gray-500 mt-1.5">Choose where you'd like to sign in</p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tenants.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTenant(t)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selectedTenant?.id === t.id
                    ? 'border-brand-400 bg-brand-50 text-brand-900 ring-1 ring-brand-300'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="font-medium text-sm">{t.name || t.id}</div>
                <div className="text-xs text-gray-400 mt-0.5">{t.slug}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <BackBtn onClick={() => setStep('credentials')} />
            <button
              type="button"
              onClick={() => selectedTenant && selectTenant(preAuthToken, selectedTenant)}
              disabled={!selectedTenant || loading}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                         disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Workspace picker ── */}
      {step === 'workspace' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Select workspace</h2>
            <p className="text-sm text-gray-500 mt-1.5">{selectedTenant?.name}</p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => setSelectedWorkspace(ws)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selectedWorkspace?.id === ws.id
                    ? 'border-brand-400 bg-brand-50 text-brand-900 ring-1 ring-brand-300'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className="font-medium text-sm">{ws.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{ws.slug}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <BackBtn onClick={() => setStep('tenant')} />
            <button
              type="button"
              onClick={() =>
                selectedTenant &&
                selectedWorkspace &&
                finalizeLogin(preAuthToken, selectedTenant, selectedWorkspace)
              }
              disabled={!selectedWorkspace || loading}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                         disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Enter workspace <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
