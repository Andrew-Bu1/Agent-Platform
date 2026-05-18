import { useState, type FormEvent, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ChevronRight, Eye, EyeOff, Check } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../api/client';
import AuthLayout from '../components/auth/AuthLayout';
import { slugify } from '../components/auth/AuthFields';

// ─── Step bar ─────────────────────────────────────────────────────────────────

const STEPS = ['Account', 'Organisation'];

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

// ─── Input ────────────────────────────────────────────────────────────────────

function Input({
  label, type, value, onChange, placeholder, autoFocus, suffix, helper,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  suffix?: React.ReactNode;
  helper?: React.ReactNode;
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
      {helper}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
      {message}
    </div>
  );
}

// ─── Password strength ────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="flex gap-3 mt-2">
      {checks.map(({ label, ok }) => (
        <div key={label} className={`flex items-center gap-1 text-[11px] ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          {label}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = 'account' | 'bootstrap';

export default function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setTokens, setContext } = useAuthStore();

  const bootstrapToken = params.get('token');
  const [step, setStep] = useState<Step>(bootstrapToken ? 'bootstrap' : 'account');
  const stepIndex = step === 'account' ? 0 : 1;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  const [preAuthToken, setPreAuthToken] = useState(bootstrapToken ?? '');
  const [orgName, setOrgName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bootstrapToken) {
      setPreAuthToken(bootstrapToken);
      setStep('bootstrap');
    }
  }, [bootstrapToken]);

  // ── Account step ─────────────────────────────────────────────────────────────

  async function handleAccount(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError(null);
    setLoading(true);
    try {
      await authApi.signup({ name: fullName, email, password });
      const res = await authApi.login({ email, password });
      setPreAuthToken(res.preAuthToken);
      setStep('bootstrap');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Bootstrap step ────────────────────────────────────────────────────────────

  async function handleBootstrap(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const wName = workspaceName.trim() || 'Default';
    try {
      const tokens = await authApi.bootstrap({
        preAuthToken,
        tenantCode: slugify(orgName),
        tenantName: orgName.trim(),
        workspaceCode: slugify(wName),
        workspaceName: wName,
      });
      setTokens(tokens);
      const tenantCode = slugify(orgName);
      const workspaceCode = slugify(wName);
      setContext(
        { id: tokens.tenantId, name: orgName.trim(), code: tenantCode, slug: tenantCode },
        { id: tokens.workspaceId, name: wName, code: workspaceCode, slug: workspaceCode },
      );
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create organisation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <StepBar current={stepIndex} />

      {error && <ErrorBanner message={error} />}

      {/* ── Account ── */}
      {step === 'account' && (
        <form onSubmit={handleAccount} className="space-y-4">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="text-sm text-gray-500 mt-1.5">Start building AI workflows today</p>
          </div>

          <Input
            label="Full name"
            type="text"
            value={fullName}
            onChange={setFullName}
            placeholder="Jane Smith"
            autoFocus
          />

          <Input
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
          />

          <Input
            label="Password"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
            suffix={
              <button type="button" onClick={() => setShowPw((s) => !s)} className="text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            helper={<PasswordStrength password={password} />}
          />

          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="••••••••"
          />

          <button
            type="submit"
            disabled={loading || !fullName || !email || !password || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                       disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5
                       rounded-xl transition-colors text-sm mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create account
            {!loading && <ChevronRight className="w-4 h-4" />}
          </button>

          <p className="text-center text-sm text-gray-500 pt-1">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </form>
      )}

      {/* ── Bootstrap ── */}
      {step === 'bootstrap' && (
        <form onSubmit={handleBootstrap} className="space-y-5">
          <div className="mb-2">
            <h2 className="text-2xl font-bold text-gray-900">Set up your organisation</h2>
            <p className="text-sm text-gray-500 mt-1.5">You can rename these later in settings</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Organisation name *</label>
            <input
              type="text"
              required
              autoFocus
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Inc."
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                         transition-shadow bg-gray-50 focus:bg-white"
            />
            {orgName.trim() && (
              <p className="mt-1.5 text-xs text-gray-400">
                Slug: <span className="font-mono text-gray-600">{slugify(orgName)}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Workspace name</label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="My Workspace"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                         transition-shadow bg-gray-50 focus:bg-white"
            />
            <p className="mt-1.5 text-xs text-gray-400">Defaults to "Default" if left blank</p>
          </div>

          <div className="flex gap-2 pt-1">
            {!bootstrapToken && (
              <button
                type="button"
                onClick={() => { setStep('account'); setError(null); }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-800
                           border border-gray-200 rounded-xl transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={!orgName.trim() || loading}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                         disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5
                         rounded-xl transition-colors text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create &amp; enter workspace
              {!loading && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
