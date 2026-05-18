import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart2,
  CheckCircle2,
  Clock,
  Cpu,
  DollarSign,
  Loader2,
  Zap,
} from 'lucide-react';
import { analyticsApi } from '../api/aihub';
import { iamApi } from '../api/iam';
import type { PlatformUsageSummary, TenantDto } from '../types/api';

const DAYS_OPTIONS = [
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<PlatformUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    iamApi.listPlatformTenants().then(setTenants).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    analyticsApi
      .platformUsage({ tenant_id: selectedTenantId || undefined, days })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics.'))
      .finally(() => setLoading(false));
  }, [selectedTenantId, days]);

  const t = data?.totals;
  const errorRate = t && t.request_count > 0
    ? (((t.failed_count + t.rejected_count + t.timeout_count) / t.request_count) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
            <BarChart2 className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
            <p className="text-sm text-gray-500">Token usage, costs, and model performance.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-brand-400"
          >
            <option value="">All tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
          </select>

          <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden">
            {DAYS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3.5 py-2 text-sm font-medium transition-colors ${
                  days === opt.value
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex h-64 items-center justify-center text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Activity}
              label="Total requests"
              value={fmt(t!.request_count)}
              sub={`${errorRate}% error rate`}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon={Zap}
              label="Input tokens"
              value={fmt(t!.input_tokens)}
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              icon={Cpu}
              label="Output tokens"
              value={fmt(t!.output_tokens)}
              color="bg-indigo-50 text-indigo-600"
            />
            <StatCard
              icon={DollarSign}
              label="Estimated cost"
              value={`$${Number(t!.cost).toFixed(4)}`}
              sub={`avg ${Math.round(t!.avg_latency_ms)}ms`}
              color="bg-emerald-50 text-emerald-600"
            />
          </div>

          {/* Status breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Request status</h3>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Success',  count: t!.success_count,  color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
                { label: 'Failed',   count: t!.failed_count,   color: 'bg-red-50 text-red-700 border-red-200',             icon: AlertCircle },
                { label: 'Rejected', count: t!.rejected_count, color: 'bg-orange-50 text-orange-700 border-orange-200',    icon: AlertCircle },
                { label: 'Timeout',  count: t!.timeout_count,  color: 'bg-gray-50 text-gray-600 border-gray-200',          icon: Clock },
              ].map(({ label, count, color, icon: Icon }) => (
                <div key={label} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${color}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {label}: {fmt(count)}
                </div>
              ))}
            </div>
          </div>

          {/* By model table */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">Usage by model</h3>
            </div>
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Model</th>
                    <th className="px-4 py-3 text-left">Operation</th>
                    <th className="px-4 py-3 text-right">Requests</th>
                    <th className="px-4 py-3 text-right">Input tokens</th>
                    <th className="px-4 py-3 text-right">Output tokens</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">Avg latency</th>
                    <th className="px-4 py-3 text-right">Success</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.by_model.map((row, i) => {
                    const successPct = row.request_count > 0
                      ? Math.round((row.success_count / row.request_count) * 100)
                      : 0;
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.model_key}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {row.operation_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(row.request_count)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(row.input_tokens)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(row.output_tokens)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">${Number(row.cost).toFixed(4)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{Math.round(row.avg_latency_ms)}ms</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-medium ${successPct >= 95 ? 'text-emerald-600' : successPct >= 80 ? 'text-orange-600' : 'text-red-600'}`}>
                            {successPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {data.by_model.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                        No usage data for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-tenant breakdown (only shown when viewing all tenants) */}
          {!selectedTenantId && data.by_tenant.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-5 py-4">
                <h3 className="text-sm font-semibold text-gray-900">Usage by tenant</h3>
              </div>
              <div className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Tenant</th>
                      <th className="px-4 py-3 text-right">Requests</th>
                      <th className="px-4 py-3 text-right">Input tokens</th>
                      <th className="px-4 py-3 text-right">Output tokens</th>
                      <th className="px-4 py-3 text-right">Cost</th>
                      <th className="px-4 py-3 text-right">Token share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const totalInput = data.by_tenant.reduce((s, r) => s + r.input_tokens, 0);
                      return data.by_tenant.map((row, i) => {
                        const tenant = tenants.find((t) => t.id === row.tenant_id);
                        const share = totalInput > 0
                          ? Math.round((row.input_tokens / totalInput) * 100)
                          : 0;
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              {tenant ? (
                                <span className="font-medium text-gray-800">{tenant.name}
                                  <span className="ml-1.5 font-mono text-xs text-gray-400">({tenant.code})</span>
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-gray-500">{row.tenant_id}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(row.request_count)}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(row.input_tokens)}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(row.output_tokens)}</td>
                            <td className="px-4 py-3 text-right text-gray-700">${Number(row.cost).toFixed(4)}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${share}%` }} />
                                </div>
                                <span className="text-xs text-gray-500">{share}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
