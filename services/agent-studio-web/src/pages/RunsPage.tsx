import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Plus, X, Loader2, AlertCircle, CheckCircle2, XCircle,
  Clock, StopCircle, RefreshCw, ChevronDown, ChevronRight,
  MessageSquare,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { runsApi } from '../api/runs';
import { flowsApi } from '../api/flows';
import { threadsApi } from '../api/threads';
import type { Run, RunStatus, Flow, FlowVersion, Thread } from '../types/api';

// ─── Status display ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RunStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:            { label: 'Pending',       color: 'bg-gray-100 text-gray-600',       icon: Clock        },
  running:            { label: 'Running',       color: 'bg-blue-100 text-blue-700',       icon: Loader2      },
  completed:          { label: 'Completed',     color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  failed:             { label: 'Failed',        color: 'bg-red-100 text-red-700',         icon: XCircle      },
  cancelled:          { label: 'Cancelled',     color: 'bg-gray-100 text-gray-500',       icon: StopCircle   },
  waiting_for_human:  { label: 'Review needed', color: 'bg-amber-100 text-amber-700',     icon: MessageSquare },
};

function StatusBadge({ status }: { status: RunStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className={`w-3 h-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {cfg.label}
    </span>
  );
}

// ─── SSE event log ────────────────────────────────────────────────────────────

interface ParsedEvent {
  type: string;
  nodeId?: string;
  data: Record<string, unknown>;
  timestamp: string;
  raw: string;
}

function parseSSEBlock(raw: string): ParsedEvent | null {
  const lines = raw.split('\n');
  let data = '';
  for (const line of lines) {
    if (line.startsWith('data:')) {
      data = line.slice(5).trim();
    }
  }
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    return {
      type: parsed.type ?? 'unknown',
      nodeId: parsed.nodeId,
      data: parsed.data ?? {},
      timestamp: parsed.timestamp ?? new Date().toISOString(),
      raw: data,
    };
  } catch {
    return { type: 'raw', data: {}, timestamp: new Date().toISOString(), raw: data };
  }
}

const EVENT_COLORS: Record<string, string> = {
  RunStarted:            'text-blue-600',
  AgentStarted:          'text-blue-500',
  AgentStepStarted:      'text-violet-500',
  AgentStepCompleted:    'text-violet-600',
  ToolCallStarted:       'text-orange-500',
  ToolCallCompleted:     'text-orange-600',
  AgentCompleted:        'text-emerald-600',
  NodeStarted:           'text-violet-600',
  NodeCompleted:         'text-emerald-600',
  token:                 'text-gray-400',
  RunCompleted:          'text-emerald-700',
  RunFailed:             'text-red-600',
  HumanReviewRequested:  'text-amber-600',
};

function EventLog({ events }: { events: ParsedEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
        No events yet
      </div>
    );
  }

  return (
    <div className="space-y-1 font-mono text-xs p-3 max-h-64 overflow-y-auto bg-gray-950 rounded-xl">
      {events.map((ev, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-gray-500 shrink-0">
            {new Date(ev.timestamp).toLocaleTimeString()}
          </span>
          <span className={EVENT_COLORS[ev.type] ?? 'text-gray-300'}>
            [{ev.type}]
          </span>
          {ev.nodeId && <span className="text-gray-500">@{ev.nodeId}</span>}
          {ev.type === 'token' && ev.data.content ? (
            <span className="text-gray-100">{String(ev.data.content)}</span>
          ) : (
            <span className="text-gray-400 truncate">{ev.raw.slice(0, 120)}</span>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ─── Human review panel ───────────────────────────────────────────────────────

function HumanReviewPanel({ run, onResumed }: { run: Run; onResumed: () => void }) {
  const [decision, setDecision] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleResume(approved: boolean) {
    if (!run.humanWaitTaskId) {
      alert('No pending review task found for this run.');
      return;
    }
    setSubmitting(true);
    try {
      await runsApi.resume(run.id, run.humanWaitTaskId, {
        approved,
        decision: decision.trim() || undefined,
      });
      onResumed();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to resume run.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <MessageSquare className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Human review required</p>
          <p className="text-xs text-amber-600 mt-0.5">This run is paused and waiting for your decision.</p>
        </div>
      </div>
      <textarea
        value={decision}
        onChange={(e) => setDecision(e.target.value)}
        placeholder="Optional notes or decision context…"
        rows={2}
        className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm bg-white outline-none focus:border-amber-400 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => handleResume(false)}
          disabled={submitting}
          className="flex-1 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          Reject
        </button>
        <button
          onClick={() => handleResume(true)}
          disabled={submitting}
          className="flex-1 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Approve'}
        </button>
      </div>
    </div>
  );
}

// ─── Run row (expandable) ─────────────────────────────────────────────────────

function RunRow({ run: initialRun, onRefresh }: { run: Run; onRefresh: () => void }) {
  const [run, setRun] = useState(initialRun);
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<ParsedEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setRun(initialRun);
  }, [initialRun]);

  function startStream() {
    if (streaming) return;
    setStreaming(true);
    setEvents([]);
    const stop = runsApi.streamEvents(
      run.id,
      (raw) => {
        const ev = parseSSEBlock(raw);
        if (!ev) return;
        setEvents((prev) => [...prev, ev]);
        if (ev.type === 'RunCompleted' || ev.type === 'RunFailed' || ev.type === 'RunCancelled' || ev.type === 'HumanReviewRequested') {
          setStreaming(false);
          onRefresh();
        }
      },
      () => setStreaming(false),
    );
    stopRef.current = stop;
  }

  function stopStream() {
    stopRef.current?.();
    stopRef.current = null;
    setStreaming(false);
  }

  async function doCancel() {
    try {
      await runsApi.cancel(run.id);
      onRefresh();
    } catch {
      // ignore
    }
  }

  const isActive = run.status === 'running' || run.status === 'pending';
  const needsReview = run.status === 'waiting_for_human';

  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={() => setExpanded((o) => !o)}
      >
        <td className="px-5 py-3.5 w-5">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />
          }
        </td>
        <td className="px-3 py-3.5 font-mono text-xs text-gray-500 max-w-[140px] truncate">{run.id}</td>
        <td className="px-3 py-3.5"><StatusBadge status={run.status} /></td>
        <td className="px-3 py-3.5 font-mono text-xs text-gray-500 truncate max-w-[120px]">{run.threadId}</td>
        <td className="px-3 py-3.5 text-xs text-gray-400">{new Date(run.createdAt).toLocaleString()}</td>
        <td className="px-5 py-3.5 text-right">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {isActive && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Cancel"
              >
                <StopCircle className="w-3.5 h-3.5" />
              </button>
            )}
            {(isActive || needsReview) && !streaming && (
              <button
                onClick={startStream}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Stream events"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            {streaming && (
              <button
                onClick={stopStream}
                className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 transition-colors"
                title="Stop streaming"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={6} className="px-5 pb-4 pt-0">
            <div className="space-y-3 mt-1">
              {needsReview && (
                <HumanReviewPanel
                  run={run}
                  onResumed={() => { onRefresh(); setExpanded(false); }}
                />
              )}
              <EventLog events={events} />
              {events.length === 0 && !streaming && (isActive || needsReview) && (
                <button
                  onClick={startStream}
                  className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  <Play className="w-4 h-4" />
                  Start streaming events
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
      {showCancelConfirm && (
        <ConfirmDialog
          title="Cancel Run"
          message="Cancel this run?"
          confirmLabel="Cancel run"
          variant="warning"
          onConfirm={() => { setShowCancelConfirm(false); doCancel(); }}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}
    </>
  );
}

// ─── Create run modal ─────────────────────────────────────────────────────────

function CreateRunModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState('');
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState('');
  const [inputRaw, setInputRaw] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([flowsApi.list(0, 100), threadsApi.list(100, 0)])
      .then(([fr, tr]) => {
        setFlows(fr.content);
        setThreads(tr);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedFlow) { setVersions([]); return; }
    setLoadingVersions(true);
    flowsApi.listVersions(selectedFlow)
      .then((page) => {
        const vs = page.content;
        setVersions(vs);
        if (vs.length > 0) setSelectedVersion(vs[vs.length - 1].id);
      })
      .finally(() => setLoadingVersions(false));
  }, [selectedFlow]);

  async function handleSubmit() {
    setError(null);
    if (!selectedThread) { setError('Select a thread.'); return; }
    if (!selectedVersion) { setError('Select a flow version.'); return; }

    let input: Record<string, unknown> = {};
    try {
      input = JSON.parse(inputRaw);
    } catch {
      setError('Input must be valid JSON.');
      return;
    }

    setLoading(true);
    try {
      await runsApi.create({ threadId: selectedThread, flowVersionId: selectedVersion, input });
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create run.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New run</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Thread</label>
            <select
              value={selectedThread}
              onChange={(e) => setSelectedThread(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
            >
              <option value="">Select a thread…</option>
              {threads.map((t) => (
                <option key={t.id} value={t.id}>{t.title || t.id}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Workflow</label>
            <select
              value={selectedFlow}
              onChange={(e) => setSelectedFlow(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
            >
              <option value="">Select a workflow…</option>
              {flows.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {selectedFlow && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Version</label>
              {loadingVersions ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading versions…
                </div>
              ) : (
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 bg-white"
                >
                  <option value="">Select a version…</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>v{v.version} — {new Date(v.createdAt).toLocaleDateString()}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Input (JSON)</label>
            <textarea
              value={inputRaw}
              onChange={(e) => setInputRaw(e.target.value)}
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none font-mono"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Start run
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingReview, setPendingReview] = useState<Run[]>([]);

  const load = useCallback(async () => {
    try {
      const [page, pr] = await Promise.all([
        runsApi.list(0, 50),
        runsApi.pendingReview(),
      ]);
      setRuns(page.content);
      setPendingReview(pr);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Runs</h2>
          <p className="text-sm text-gray-500 mt-0.5">Monitor and manage agent workflow executions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          New run
        </button>
      </div>

      {/* Pending review banner */}
      {pendingReview.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {pendingReview.length} run{pendingReview.length !== 1 ? 's' : ''} waiting for human review
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Expand the run row below to approve or reject.</p>
          </div>
        </div>
      )}

      {/* Runs table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : pendingReview.length === 0 && runs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-gray-400">
            <Play className="w-10 h-10" />
            <p className="text-sm">No runs yet. Start your first workflow run.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 w-5" />
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Run ID</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Thread</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Started</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...pendingReview, ...runs.filter((r) => !pendingReview.find((p) => p.id === r.id))].map((run) => (
                <RunRow key={run.id} run={run} onRefresh={load} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateRunModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
