import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ChevronRight, Eye, EyeOff, Building2, Layers, Check } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../api/client';
import AuthLayout from '../components/auth/AuthLayout';
import type { TenantInfo, WorkspaceInfo } from '../types/api';

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Sign in', 'Organisation', 'Workspace'];

function codeOrSlug(item: { code?: string; slug?: string }) {
  return item.code ?? item.slug ?? '';
}

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  done
                    ? 'bg-brand-600 text-white'
                    : active
                    ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-400'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-brand-700' : done ? 'text-gray-500' : 'text-gray-300'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-10 mb-4 mx-1 ${done ? 'bg-brand-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared input ─────────────────────────────────────────────────────────────

function Input({
  label, type, value, onChange, placeholder, autoFocus, suffix,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  suffix?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={type}
          required
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400
                     focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                     transition-shadow bg-gray-50 focus:bg-white pr-10"
        />
        {suffix && <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
      {message}
    </div>
  );
}

// ─── Selectable card ──────────────────────────────────────────────────────────

function SelectCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  selected,
  onClick,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border text-left transition-all ${
        selected
          ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-300'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${selected ? 'text-brand-900' : 'text-gray-800'}`}>
          {title || '(unnamed)'}
        </p>
        {subtitle && <p className="text-xs text-gray-400 truncate mt-0.5">{subtitle}</p>}
      </div>
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
        selected ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
      }`}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = 'credentials' | 'tenant' | 'workspace';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setTokens, setContext } = useAuthStore();

  const [step, setStep] = useState<Step>('credentials');
  const stepIndex = { credentials: 0, tenant: 1, workspace: 2 }[step];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [preAuthToken, setPreAuthToken] = useState('');
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantInfo | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceInfo | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True when the tenant was auto-detected (single-tenant path) so the
  // workspace step's "Back" button returns to credentials, not tenant.
  const [isAutoPath, setIsAutoPath] = useState(false);

  // ── Step 1: credentials ──────────────────────────────────────────────────────

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      setPreAuthToken(res.preAuthToken);

      if (res.requireTenantCreation) {
        navigate('/signup?bootstrap=1&token=' + encodeURIComponent(res.preAuthToken));
        return;
      }

      const resolvedTenantId = res.singleTenantId ?? res.tenantId ?? null;
      const loginTenants = Array.isArray(res.tenants) ? res.tenants : [];

      if (!res.requireTenantSelection && resolvedTenantId) {
        // Single-tenant: auto-detect without showing the tenant picker.
        const tenant = loginTenants[0] ?? { id: resolvedTenantId, code: '', name: 'Organisation' };
        setIsAutoPath(true);
        await pickTenant(res.preAuthToken, tenant, /* isAuto */ true);
      } else if (loginTenants.length > 0) {
        setIsAutoPath(false);
        setTenants(loginTenants);
        setStep('tenant');
      } else {
        setError('Login succeeded, but no organisations are accessible for this account.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: tenant → load workspaces ────────────────────────────────────────

  async function pickTenant(token: string, tenant: TenantInfo, isAuto = false) {
    setError(null);
    setLoading(true);
    try {
      const wsList = await authApi.workspaces({ preAuthToken: token, tenantId: tenant.id });
      setSelectedTenant(tenant);
      const workspaceList = Array.isArray(wsList) ? wsList : [];

      if (workspaceList.length === 1) {
        await finalizeLogin(token, tenant, workspaceList[0]);
      } else if (workspaceList.length === 0) {
        // No workspaces: show the error where the user can act on it.
        // In auto-path, stay on credentials; in manual path, show workspace step.
        setError('This organisation has no workspaces available for your account.');
        if (!isAuto) {
          setWorkspaces([]);
          setSelectedWorkspace(null);
          setStep('workspace');
        }
      } else {
        // Multiple workspaces: let the user pick.
        setWorkspaces(workspaceList);
        setSelectedWorkspace(null);
        setStep('workspace');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load workspaces.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTenantContinue() {
    if (!selectedTenant) return;
    await pickTenant(preAuthToken, selectedTenant);
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
      // Commit auth state before navigating so RequireAuth always sees the tokens.
      setTokens(tokens);
      setContext(tenant, workspace);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to enter workspace.');
    } finally {
      setLoading(false);
    }
  }

  async function handleWorkspaceContinue() {
    if (!selectedTenant || !selectedWorkspace) return;
    await finalizeLogin(preAuthToken, selectedTenant, selectedWorkspace);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AuthLayout>
      {/* Step bar — show only after credentials step */}
      {step !== 'credentials' && <StepBar current={stepIndex} />}

      {error && <ErrorBanner message={error} />}

      {/* ── Step 1: Sign in ── */}
      {step === 'credentials' && (
        <form onSubmit={handleCredentials} className="space-y-5">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
            <p className="text-sm text-gray-500 mt-1.5">Sign in to Agent Studio</p>
          </div>

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoFocus
          />

          <Input
            label="Password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            suffix={
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                       disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5
                       rounded-xl transition-colors text-sm mt-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Signing in…' : 'Continue'}
            {!loading && <ChevronRight className="w-4 h-4" />}
          </button>

          <p className="text-center text-sm text-gray-500 pt-1">
            No account?{' '}
            <Link to="/signup" className="text-brand-600 font-medium hover:text-brand-700">
              Sign up free
            </Link>
          </p>
        </form>
      )}

      {/* ── Step 2: Choose organisation ── */}
      {step === 'tenant' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Choose organisation</h2>
            <p className="text-sm text-gray-500 mt-1.5">
              Signed in as <span className="font-medium text-gray-700">{email}</span>
            </p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
            {tenants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                No organisations found.
              </div>
            ) : (
              tenants.map((t) => (
                <SelectCard
                  key={t.id}
                  icon={Building2}
                  iconBg="bg-slate-100"
                  iconColor="text-slate-600"
                  title={t.name || t.id}
                  subtitle={codeOrSlug(t)}
                  selected={selectedTenant?.id === t.id}
                  onClick={() => setSelectedTenant(t)}
                />
              ))
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setStep('credentials'); setError(null); }}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-800
                         border border-gray-200 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleTenantContinue}
              disabled={!selectedTenant || loading}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                         disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium
                         py-2.5 rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Continue
              {!loading && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Choose workspace ── */}
      {step === 'workspace' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Choose workspace</h2>
            <p className="text-sm text-gray-500 mt-1.5">
              Organisation:{' '}
              <span className="font-medium text-gray-700">
                {selectedTenant?.name || (selectedTenant ? codeOrSlug(selectedTenant) : '')}
              </span>
            </p>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
            {workspaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                No workspaces found.
              </div>
            ) : (
              workspaces.map((ws) => (
                <SelectCard
                  key={ws.id}
                  icon={Layers}
                  iconBg="bg-brand-50"
                  iconColor="text-brand-600"
                  title={ws.name}
                  subtitle={codeOrSlug(ws)}
                  selected={selectedWorkspace?.id === ws.id}
                  onClick={() => setSelectedWorkspace(ws)}
                />
              ))
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                // In auto-path the tenant step was skipped, so go back to credentials.
                if (isAutoPath) {
                  setStep('credentials');
                  setIsAutoPath(false);
                } else {
                  setStep('tenant');
                }
                setError(null);
                setSelectedWorkspace(null);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-800
                         border border-gray-200 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleWorkspaceContinue}
              disabled={!selectedWorkspace || loading}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                         disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium
                         py-2.5 rounded-xl transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Enter workspace
              {!loading && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
