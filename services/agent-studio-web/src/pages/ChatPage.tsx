import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  ChevronDown,
  GitBranch,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
} from 'lucide-react';
import { flowsApi } from '../api/flows';
import { runsApi } from '../api/runs';
import { threadsApi } from '../api/threads';
import type { Flow, FlowVersion, RunStatus } from '../types/api';

type ChatRole = 'user' | 'assistant';

interface ChatEvent {
  id: string;
  type: string;
  nodeId?: string;
  data: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  status?: 'streaming' | 'complete' | 'failed';
  runId?: string;
  events: ChatEvent[];
}

interface WorkflowChoice {
  flow: Flow;
  versions: FlowVersion[];
  selectedVersionId: string;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function extractEvent(raw: string): { type: string; data: Record<string, unknown> } | null {
  if (!raw.trim()) return null;

  // Backend sends proper SSE: "event: <type>\ndata: <json>"
  // Parse event type and data lines independently (do NOT strip data: before matching).
  const eventMatch = /(?:^|\n)event:\s*([^\n]+)/.exec(raw);
  const dataMatch = /(?:^|\n)data:\s*([\s\S]+)/.exec(raw);
  const eventType = eventMatch?.[1]?.trim();
  const dataRaw = dataMatch?.[1]?.trim() ?? raw.trim();

  try {
    const parsed = JSON.parse(dataRaw);
    // Envelope format: {type, data} (not currently used by backend but handle gracefully)
    if (parsed?.type && parsed?.data !== undefined) {
      return { type: String(parsed.type), data: asRecord(parsed.data) };
    }
    return { type: eventType ?? 'message', data: asRecord(parsed) };
  } catch {
    return { type: eventType ?? 'message', data: { content: dataRaw } };
  }
}

function eventText(event: { type: string; data: Record<string, unknown> }) {
  const content = event.data.content ?? event.data.token ?? event.data.delta;
  return typeof content === 'string' ? content : '';
}

function finalOutputText(event: { data: Record<string, unknown> }) {
  const output = event.data.output ?? event.data.output_json ?? event.data.result;
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object') return JSON.stringify(output, null, 2);
  return '';
}

function WorkflowPicker({
  onSelect,
}: {
  onSelect: (flow: Flow, version: FlowVersion) => void;
}) {
  const [choices, setChoices] = useState<WorkflowChoice[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const flowPage = await flowsApi.list(0, 100);
      const loaded = await Promise.all(
        flowPage.content.map(async (flow) => {
          const versionPage = await flowsApi.listVersions(flow.id, 0, 50);
          const published = versionPage.content
            .filter((v) => v.status === 'published')
            .sort((a, b) => b.version - a.version);
          return {
            flow,
            versions: published,
            selectedVersionId: published[0]?.id ?? '',
          };
        }),
      );
      const runnable = loaded.filter((choice) => choice.versions.length > 0);
      setChoices(runnable);
      if (runnable[0]) {
        setSelectedFlowId(runnable[0].flow.id);
        setSelectedVersionId(runnable[0].selectedVersionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selectedChoice = useMemo(
    () => choices.find((choice) => choice.flow.id === selectedFlowId),
    [choices, selectedFlowId],
  );

  function changeFlow(flowId: string) {
    const choice = choices.find((item) => item.flow.id === flowId);
    setSelectedFlowId(flowId);
    setSelectedVersionId(choice?.selectedVersionId ?? '');
  }

  function startChat() {
    const version = selectedChoice?.versions.find((v) => v.id === selectedVersionId);
    if (selectedChoice && version) onSelect(selectedChoice.flow, version);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col justify-center px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50">
          <MessageSquare className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Chat with a workflow</h2>
          <p className="text-sm text-gray-500">Select a published workflow before starting a conversation.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {choices.length === 0 ? (
          <div className="py-8 text-center">
            <GitBranch className="mx-auto mb-3 h-9 w-9 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">No published workflows available</p>
            <p className="mt-1 text-sm text-gray-400">Publish a workflow from the editor, then return to Chat.</p>
            <button
              onClick={load}
              className="mx-auto mt-4 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Workflow</label>
              <div className="relative">
                <select
                  value={selectedFlowId}
                  onChange={(e) => changeFlow(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 pr-9 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                >
                  {choices.map(({ flow }) => (
                    <option key={flow.id} value={flow.id}>{flow.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              {selectedChoice?.flow.description && (
                <p className="mt-1.5 text-xs text-gray-400">{selectedChoice.flow.description}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Version</label>
              <div className="relative">
                <select
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 pr-9 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                >
                  {selectedChoice?.versions.map((version) => (
                    <option key={version.id} value={version.id}>
                      v{version.version} · published
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <button
              onClick={startChat}
              disabled={!selectedFlowId || !selectedVersionId}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatEventList({ events }: { events: ChatEvent[] }) {
  const visibleEvents = events.filter((event) => event.type !== 'token').slice(-5);
  if (visibleEvents.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
      {visibleEvents.map((event) => (
        <div key={event.id} className="flex items-center gap-2 text-[11px] text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
          <span className="truncate">
            {event.type}
            {event.nodeId ? ` · ${event.nodeId}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-brand-600 text-white'
            : 'rounded-bl-sm border border-gray-100 bg-white text-gray-800 shadow-sm'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.status === 'streaming' && (
          <span className="mt-1 inline-flex items-center gap-1 text-xs opacity-70">
            <Loader2 className="h-3 w-3 animate-spin" />
            running
          </span>
        )}
        {!isUser && <ChatEventList events={message.events} />}
      </div>
    </div>
  );
}

function ChatInterface({
  flow,
  version,
  onReset,
}: {
  flow: Flow;
  version: FlowVersion;
  onReset: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runStatus, setRunStatus] = useState<RunStatus | 'idle'>('idle');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => stopStreamRef.current?.(), []);

  function patchMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((message) => (
      message.id === id ? { ...message, ...patch } : message
    )));
  }

  function appendEvent(id: string, event: ChatEvent) {
    setMessages((prev) => prev.map((message) => (
      message.id === id
        ? { ...message, events: [...message.events, event] }
        : message
    )));
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    setInput('');
    setError(null);
    setBusy(true);
    setRunStatus('pending');

    const userMessage: ChatMessage = {
      id: makeId('user'),
      role: 'user',
      content: text,
      status: 'complete',
      events: [],
    };
    const assistantId = makeId('assistant');
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      events: [],
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      let activeThreadId = threadId;
      if (!activeThreadId) {
        const thread = await threadsApi.create({
          title: `Chat with ${flow.name}`,
          metadata: { flowId: flow.id, flowVersionId: version.id },
        });
        activeThreadId = thread.id;
        setThreadId(thread.id);
      }

      const run = await runsApi.create({
        threadId: activeThreadId,
        flowVersionId: version.id,
        input: { message: text },
      });

      let textBuffer = '';
      patchMessage(assistantId, { runId: run.id });
      setRunStatus(run.status);
      stopStreamRef.current?.();

      stopStreamRef.current = runsApi.streamEvents(
        run.id,
        (raw) => {
          const event = extractEvent(raw);
          if (!event) return;

          appendEvent(assistantId, {
            id: makeId('event'),
            type: event.type,
            nodeId: typeof event.data.node_id === 'string' ? event.data.node_id : undefined,
            data: event.data,
          });

          if (event.type === 'token' || event.type === 'TokenStream') {
            textBuffer += eventText(event);
            patchMessage(assistantId, { content: textBuffer, status: 'streaming' });
            return;
          }

          if (event.type === 'RunCreated' || event.type === 'RunStarted') {
            setRunStatus('running');
            return;
          }

          if (event.type === 'RunCompleted' || event.type === 'FlowCompleted') {
            const finalText = finalOutputText(event);
            patchMessage(assistantId, {
              content: textBuffer || finalText || 'Done.',
              status: 'complete',
            });
            setRunStatus('completed');
            setBusy(false);
            stopStreamRef.current?.();
            stopStreamRef.current = null;
            return;
          }

          if (event.type === 'RunFailed' || event.type === 'FlowFailed') {
            const message = String(event.data.error ?? event.data.message ?? 'Run failed.');
            patchMessage(assistantId, { content: message, status: 'failed' });
            setError(message);
            setRunStatus('failed');
            setBusy(false);
            stopStreamRef.current?.();
            stopStreamRef.current = null;
          }
        },
        (err) => {
          const message = err.message || 'Stream disconnected.';
          patchMessage(assistantId, {
            content: textBuffer || message,
            status: textBuffer ? 'complete' : 'failed',
          });
          setError(message);
          setBusy(false);
        },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message.';
      patchMessage(assistantId, { content: message, status: 'failed' });
      setError(message);
      setRunStatus('failed');
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <Bot className="h-4 w-4 text-brand-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-gray-900">{flow.name}</p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                v{version.version}
              </span>
            </div>
            <p className="text-xs text-gray-400">Run status: {runStatus}</p>
          </div>
        </div>
        <button
          onClick={onReset}
          disabled={busy}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Change workflow
        </button>
      </header>

      <main className="flex-1 overflow-y-auto bg-gray-50 px-5 py-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-400">
            <MessageSquare className="h-9 w-9 text-gray-300" />
            <p>Send a message to start this workflow chat.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {error && (
        <div className="shrink-0 border-t border-red-100 bg-red-50 px-5 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <footer className="shrink-0 border-t border-gray-100 px-5 py-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            rows={1}
            placeholder="Type a message. Enter sends, Shift+Enter adds a line."
            className="max-h-40 flex-1 resize-none overflow-y-auto rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-gray-50 disabled:text-gray-400"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={send}
            disabled={!input.trim() || busy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default function ChatPage() {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [version, setVersion] = useState<FlowVersion | null>(null);

  if (!flow || !version) {
    return (
      <div className="h-full">
        <WorkflowPicker
          onSelect={(selectedFlow, selectedVersion) => {
            setFlow(selectedFlow);
            setVersion(selectedVersion);
          }}
        />
      </div>
    );
  }

  return (
    <div className="-m-6 h-[calc(100vh-4rem)] bg-gray-50">
      <ChatInterface
        flow={flow}
        version={version}
        onReset={() => {
          setFlow(null);
          setVersion(null);
        }}
      />
    </div>
  );
}
