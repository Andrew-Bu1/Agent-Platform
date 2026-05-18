import { useState, type FormEvent, useEffect } from 'react';
import { User, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../api/client';

function SectionCard({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', disabled = false, placeholder = '' }: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors outline-none
          ${disabled
            ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed'
            : 'bg-white border-gray-200 text-gray-900 focus:border-brand-400 focus:ring-2 focus:ring-brand-100'
          }`}
      />
    </div>
  );
}

function Toast({ type, message }: { type: 'success' | 'error'; message: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${
      type === 'success'
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      {type === 'success'
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <AlertCircle className="w-4 h-4 shrink-0" />}
      {message}
    </div>
  );
}

export default function SettingsPage() {
  const { userProfile, setUserProfile, selectedTenant, selectedWorkspace } = useAuthStore();

  // Load profile on mount
  useEffect(() => {
    if (!userProfile) {
      authApi.me().then(setUserProfile).catch(() => {});
    }
  }, []);

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwFeedback, setPwFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwFeedback({ type: 'error', msg: 'New passwords do not match.' });
      return;
    }
    if (newPw.length < 8) {
      setPwFeedback({ type: 'error', msg: 'Password must be at least 8 characters.' });
      return;
    }
    setPwFeedback(null);
    setPwLoading(true);
    try {
      await authApi.changePassword({ currentPassword: currentPw, newPassword: newPw });
      setPwFeedback({ type: 'success', msg: 'Password changed. Please log in again on other devices.' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwFeedback({
        type: 'error',
        msg: err instanceof ApiError ? err.message : 'Failed to change password.',
      });
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 space-y-6">

      {/* Profile */}
      <SectionCard
        title="Profile"
        description="Your account information"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-brand-600" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">
              {userProfile?.name ?? '—'}
            </p>
            <p className="text-sm text-gray-500">{userProfile?.email ?? '—'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Full name" value={userProfile?.name ?? ''} disabled />
          <InputField label="Email" value={userProfile?.email ?? ''} disabled />
        </div>
      </SectionCard>

      {/* Workspace */}
      <SectionCard
        title="Current workspace"
        description="The organisation and workspace you're signed into"
      >
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Organisation" value={selectedTenant?.name ?? '—'} disabled />
          <InputField label="Workspace" value={selectedWorkspace?.name ?? '—'} disabled />
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Use the workspace switcher in the sidebar to switch between workspaces.
        </p>
      </SectionCard>

      {/* Password */}
      <SectionCard
        title="Password"
        description="Change your account password"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <InputField
            label="Current password"
            type="password"
            value={currentPw}
            onChange={setCurrentPw}
            placeholder="Enter current password"
          />
          <InputField
            label="New password"
            type="password"
            value={newPw}
            onChange={setNewPw}
            placeholder="At least 8 characters"
          />
          <InputField
            label="Confirm new password"
            type="password"
            value={confirmPw}
            onChange={setConfirmPw}
            placeholder="Repeat new password"
          />

          {pwFeedback && <Toast type={pwFeedback.type} message={pwFeedback.msg} />}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={pwLoading || !currentPw || !newPw || !confirmPw}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700
                         disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm
                         font-medium rounded-xl transition-colors"
            >
              {pwLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <Lock className="w-4 h-4" />
              Update password
            </button>
          </div>
        </form>
      </SectionCard>

    </div>
  );
}
