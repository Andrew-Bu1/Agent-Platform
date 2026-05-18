import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Flag,
  GitBranch,
  Layers,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  Share2,
  StopCircle,
  Users,
  XCircle,
} from 'lucide-react';
import { runsApi } from '../api/runs';
import type { Run, RunStatus, NodeRun, PageResponse } from '../types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function durationMs(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  return new Date(to).getTime() - new Date(from).getTime();
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString();
}

// ─── Run status config ────────────────────────────────────────────────────────

const RUN_STATUS: Record<RunStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:           { label: 'Pending',       color: 'bg-gray-100 text-gray-600',       icon: Clock         },
  running:           { label: 'Running',       color: 'bg-blue-100 text-blue-700',       icon: Loader2       },
  completed:         { label: 'Completed',     color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2  },
  failed:            { label: 'Failed',        color: 'bg-red-100 text-red-700',         icon: XCircle       },
  cancelled:         { label: 'Cancelled',     color: 'bg-gray-100 text-gray-500',       icon: StopCircle    },
  waiting_for_human: { label: 'Review needed', color: 'bg-amber-100 text-amber-700',     icon: MessageSquare },
};

function RunStatusBadge({ status }: { status: RunStatus }) {
  const cfg = RUN_STATUS[status] ?? RUN_STATUS.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

// ─── Node type config ─────────────────────────────────────────────────────────

const NODE_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  start:        { icon: Play,         color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200'    },
  end:          { icon: Flag,         color: 'text-gray-600',    bg: 'bg-gray-50 border-gray-200'    },
  agent:        { icon: Bot,          color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-200'},
  agent_team:   { icon: Users,        color: 'text-indigo-600',  bg: 'bg-indigo-50 border-indigo-200'},
  if_else:      { icon: GitBranch,    color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200'  },
  router:       { icon: Share2,       color: 'text-orange-600',  bg: 'bg-orange-50 border-orange-200'},
  parallel:     { icon: Layers,       color: 'text-cyan-600',    bg: 'bg-cyan-50 border-cyan-200'    },
  aggregator:   { icon: Activity,     color: 'text-teal-600',    bg: 'bg-teal-50 border-teal-200'    },
  human_review: { icon: MessageSquare,color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200'  },
};

const DEFAULT_NODE = { icon: Activity, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' };

// ─── Node step status dot ─────────────────────────────────────────────────────

const STEP_STATUS_DOT: Record<string, string> = {
  completed: 'bg-emerald-500',
  failed:    'bg-red-500',
  running:   'bg-blue-500 animate-pulse',
  pending:   'bg-gray-300',
  skipped:   'bg-gray-200',
};

// ─── JSON viewer ──────────────────────────────────────────────────────────────

function JsonBlock({ data }: { data: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-xs text-gray-400 italic">empty</p>;
  }
  return (
    <pre className="text-xs bg-gray-950 text-gray-200 rounded-lg p-3 overflow-auto max-h-48 leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ─── Node step card ───────────────────────────────────────────────────────────

function NodeStepCard({ step, index, isLast }: { step: NodeRun; index: number; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = NODE_TYPE_CONFIG[step.node_type] ?? DEFAULT_NODE;
  const Icon = cfg.icon;
  const duration = durationMs(step.started_at, step.finished_at);
  const dotColor = STEP_STATUS_DOT[step.status] ?? 'bg-gray-300';

  return (
    <div className="flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center w-6 shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full mt-4 shrink-0 ${dotColor}`} />
        {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1" />}
      </div>

      {/* Card */}
      <div className="flex-1 pb-4">
        <div
          className={`rounded-xl border ${cfg.bg} cursor-pointer transition-colors hover:brightness-95`}
          onClick={() => setExpanded((o) => !o)}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Step number + icon */}
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${cfg.bg}`}>
              <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
            </div>

            {/* Name + type */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {step.node_name || step.node_id}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-gray-400 font-mono">{step.node_type}</span>
                {step.branch_key && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                    branch: {step.branch_key}
                  </span>
                )}
                {step.iteration > 0 && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                    iter {step.iteration}
                  </span>
                )}
              </div>
            </div>

            {/* Status + duration + chevron */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className={`inline-block text-xs font-medium capitalize ${
                  step.status === 'completed' ? 'text-emerald-600' :
                  step.status === 'failed'    ? 'text-red-600'     :
                  step.status === 'running'   ? 'text-blue-600'    :
                  'text-gray-500'
                }`}>
                  {step.status}
                </span>
                <p className="text-xs text-gray-400">{fmtDuration(duration)}</p>
              </div>
              {expanded
                ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              }
            </div>
          </div>

          {/* Expanded detail */}
          {expanded && (
            <div className="border-t border-gray-200/60 px-4 py-3 space-y-3">
              <div className="flex gap-6 text-xs text-gray-500">
                <span>Started: {fmtTime(step.started_at)}</span>
                <span>Finished: {fmtTime(step.finished_at)}</span>
                <span className="font-mono text-gray-400">#{index + 1}</span>
              </div>

              {step.input_json && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Input</p>
                  <JsonBlock data={step.input_json} />
                </div>
              )}

              {step.output_json && (
                <div>
                  <p className="text-xs font-semibold text-emerald-600 mb-1.5 uppercase tracking-wide">Output</p>
                  <JsonBlock data={step.output_json} />
                </div>
              )}

              {step.error_json && (
                <div>
                  <p className="text-xs font-semibold text-red-600 mb-1.5 uppercase tracking-wide">Error</p>
                  <JsonBlock data={step.error_json} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Trace detail panel ───────────────────────────────────────────────────────

function TraceDetail({ run }: { run: Run }) {
  const [nodeRuns, setNodeRuns] = useState<NodeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    runsApi.listNodeRuns(run.id)
      .then(setNodeRuns)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load steps.'))
      .finally(() => setLoading(false));
  }, [run.id]);

  useEffect(() => { load(); }, [load]);

  const totalDuration = durationMs(run.startedAt ?? run.createdAt, run.finishedAt ?? (
    run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled'
      ? run.updatedAt : null
  ));

  return (
    <div className="flex flex-col h-full">
      {/* Run header */}
      <div className="border-b border-gray-100 px-5 py-4 space-y-3 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-mono text-gray-400 truncate">{run.id}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <RunStatusBadge status={run.status} />
              {run.threadId && (
                <span className="text-xs text-gray-400 font-mono truncate max-w-[160px]">
                  thread: {run.threadId}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={load}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
            title="Refresh steps"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-4 text-xs text-gray-400">
          <span>Started: {fmtTime(run.startedAt ?? run.createdAt)}</span>
          {totalDuration !== null && <span>Duration: {fmtDuration(totalDuration)}</span>}
          <span>{nodeRuns.length} step{nodeRuns.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && nodeRuns.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
            <Activity className="w-8 h-8" />
            <p className="text-sm">No steps recorded yet.</p>
          </div>
        )}

        {!loading && !error && nodeRuns.length > 0 && (
          <div>
            {nodeRuns.map((step, i) => (
              <NodeStepCard
                key={step.id}
                step={step}
                index={i}
                isLast={i === nodeRuns.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Run list item ────────────────────────────────────────────────────────────

function RunListItem({
  run,
  selected,
  onClick,
}: {
  run: Run;
  selected: boolean;
  onClick: () => void;
}) {
  const cfg = RUN_STATUS[run.status] ?? RUN_STATUS.pending;
  const Icon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
        selected ? 'bg-brand-50 border-l-2 border-l-brand-500' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3 h-3 shrink-0 ${cfg.color.split(' ')[1]} ${run.status === 'running' ? 'animate-spin' : ''}`} />
        <span className={`text-xs font-medium ${cfg.color.split(' ')[1]}`}>
          {cfg.label}
        </span>
      </div>
      <p className="text-xs font-mono text-gray-500 truncate">{run.id}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        {new Date(run.createdAt).toLocaleString()}
      </p>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TracesPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadRuns = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result: PageResponse<Run> = await runsApi.list(p, 30);
      setRuns(result.content);
      setTotalPages(result.totalPages || 1);
      if (p === 0 && result.content.length > 0 && !selectedRun) {
        setSelectedRun(result.content[0]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedRun]);

  useEffect(() => { loadRuns(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50">
            <Activity className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Traces</h2>
            <p className="text-sm text-gray-500">Step-by-step execution trace for each run.</p>
          </div>
        </div>
        <button
          onClick={() => loadRuns(page)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Split panel */}
      <div className="flex gap-4 h-[calc(100vh-13rem)]">

        {/* Left: run list */}
        <div className="w-72 shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Runs</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && runs.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                <Play className="w-7 h-7" />
                <p className="text-xs">No runs yet.</p>
              </div>
            ) : (
              runs.map((run) => (
                <RunListItem
                  key={run.id}
                  run={run}
                  selected={selectedRun?.id === run.id}
                  onClick={() => setSelectedRun(run)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 shrink-0">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="text-xs text-gray-400">{page + 1} / {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Right: trace detail */}
        <div className="flex-1 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {selectedRun ? (
            <TraceDetail key={selectedRun.id} run={selectedRun} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Activity className="w-10 h-10" />
              <p className="text-sm">Select a run to view its trace.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
