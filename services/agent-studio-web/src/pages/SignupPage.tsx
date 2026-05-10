import { useState, type FormEvent, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../api/client';
import AuthLayout from '../components/auth/AuthLayout';
import { Field, PrimaryBtn, BackBtn, ErrorBanner, slugify } from '../components/auth/AuthFields';

type Step = 'account' | 'bootstrap';

export default function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setTokens, setContext } = useAuthStore();

  // If redirected here from login with a pre-existing preAuthToken (no-org user)
  const bootstrapToken = params.get('token');
  const [step, setStep] = useState<Step>(bootstrapToken ? 'bootstrap' : 'account');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [preAuthToken, setPreAuthToken] = useState(bootstrapToken ?? '');
  const [orgName, setOrgName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep preAuthToken in sync if the query-param changes (e.g. back/forward nav)
  useEffect(() => {
    if (bootstrapToken) {
      setPreAuthToken(bootstrapToken);
      setStep('bootstrap');
    }
  }, [bootstrapToken]);

  // ── Step 1: create account ───────────────────────────────────────────────────

  async function handleAccount(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
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

  // ── Step 2: bootstrap org ────────────────────────────────────────────────────

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
      setContext(
        { id: tokens.tenantId, name: orgName.trim(), slug: slugify(orgName) },
        { id: tokens.workspaceId, name: wName, slug: slugify(wName) },
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
      {error && <ErrorBanner message={error} />}

      {/* ── Account details ── */}
      {step === 'account' && (
        <form onSubmit={handleAccount} className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
            <p className="text-sm text-gray-500 mt-1.5">Start building AI workflows today</p>
          </div>

          <Field
            label="Full name"
            type="text"
            value={fullName}
            onChange={setFullName}
            placeholder="Jane Smith"
            autoFocus
          />
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
          />
          <Field
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="••••••••"
          />

          <PrimaryBtn loading={loading} label="Create account" />

          <p className="text-center text-sm text-gray-500 pt-1">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </form>
      )}

      {/* ── Bootstrap: set up org ── */}
      {step === 'bootstrap' && (
        <form onSubmit={handleBootstrap} className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Set up your organisation</h2>
            <p className="text-sm text-gray-500 mt-1.5">You can rename these later in settings</p>
          </div>

          <Field
            label="Organisation name"
            type="text"
            value={orgName}
            onChange={setOrgName}
            placeholder="Acme Inc."
            autoFocus
          />

          {orgName.trim() && (
            <p className="text-xs text-gray-400 -mt-2">
              Slug:{' '}
              <span className="font-mono text-gray-500">{slugify(orgName)}</span>
            </p>
          )}

          <Field
            label="Workspace name"
            type="text"
            value={workspaceName}
            onChange={setWorkspaceName}
            placeholder="My Workspace"
          />

          <div className="flex gap-2 pt-1">
            {!bootstrapToken && (
              <BackBtn onClick={() => { setStep('account'); setError(null); }} />
            )}
            <button
              type="submit"
              disabled={!orgName.trim() || loading}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                         disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5
                         rounded-xl transition-colors text-sm"
            >
              Create & enter workspace
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
