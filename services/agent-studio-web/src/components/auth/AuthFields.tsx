import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'default';
}

export function Field({
  label, type, value, onChange, placeholder, autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        required
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400
                   focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                   transition-shadow bg-gray-50 focus:bg-white"
      />
    </div>
  );
}

export function PrimaryBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700
                 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5
                 rounded-xl transition-colors text-sm mt-1"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      {label}
      {!loading && <ChevronRight className="w-4 h-4" />}
    </button>
  );
}

export function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-800
                 border border-gray-200 rounded-xl transition-colors"
    >
      <ChevronLeft className="w-4 h-4" /> Back
    </button>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
      {message}
    </div>
  );
}
