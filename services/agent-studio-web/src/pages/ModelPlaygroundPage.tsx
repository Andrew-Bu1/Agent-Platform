import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  ChevronDown,
  Cpu,
  Loader2,
  RotateCcw,
  Send,
  Settings2,
  Zap,
} from 'lucide-react';
import { modelsApi, chatApi } from '../api/aihub';
import type { ModelConfig, AihubChatMessage } from '../types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'streaming' | 'done' | 'error';
  latencyMs?: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModelBadge({ model }: { model: ModelConfig }) {
  return (
    <div className="flex items-center gap-2">
      <Cpu className="w-4 h-4 text-brand-500 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{model.display_name}</p>
        <p className="text-xs text-gray-400 font-mono truncate">{model.provider_key} / {model.model_key}</p>
      </div>
    </div>
  );
}

function TokenBadge({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
      {label}: <span className="font-mono font-medium text-gray-700">{value.toLocaleString()}</span>
    </span>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
          isUser
            ? 'bg-brand-600 text-white rounded-br-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
        }`}
      >
        {msg.content || (msg.status === 'streaming' ? (
          <span className="inline-flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
          </span>
        ) : null)}
      </div>

      {msg.status === 'done' && !isUser && (
        <div className="flex items-center gap-2 px-1">
          {msg.latencyMs != null && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Zap className="w-3 h-3" /> {msg.latencyMs}ms
            </span>
          )}
          <TokenBadge label="in" value={msg.promptTokens} />
          <TokenBadge label="out" value={msg.completionTokens} />
        </div>
      )}

      {msg.status === 'error' && (
        <div className="flex items-center gap-1.5 text-xs text-red-500 px-1">
          <AlertCircle className="w-3 h-3" /> {msg.content}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModelPlaygroundPage() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [selectedModelKey, setSelectedModelKey] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystem, setShowSystem] = useState(false);
  const [useStreaming, setUseStreaming] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await modelsApi.list({ operation_type: 'chat' });
        const active = all.filter((m) => m.is_active);
        setModels(active);
        if (active.length > 0) setSelectedModelKey(active[0].model_key);
      } catch { /* ignore */ } finally {
        setLoadingModels(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedModel = models.find((m) => m.model_key === selectedModelKey) ?? null;

  function buildHistory(): AihubChatMessage[] {
    const hist: AihubChatMessage[] = [];
    if (systemPrompt.trim()) hist.push({ role: 'system', content: systemPrompt.trim() });
    for (const m of messages) {
      if (m.status === 'error') continue;
      hist.push({ role: m.role, content: m.content });
    }
    return hist;
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !selectedModelKey || busy) return;
    setInput('');
    setBusy(true);

    const userMsg: Message = { id: makeId(), role: 'user', content: text, status: 'done' };
    const asstMsg: Message = { id: makeId(), role: 'assistant', content: '', status: 'streaming' };
    setMessages((prev) => [...prev, userMsg, asstMsg]);

    const history = buildHistory();
    history.push({ role: 'user', content: text });
    const t0 = Date.now();

    if (useStreaming && selectedModel?.supports_streaming) {
      stopRef.current = chatApi.stream(
        selectedModelKey,
        history,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsg.id ? { ...m, content: m.content + chunk } : m,
            ),
          );
        },
        (usage) => {
          const latencyMs = Date.now() - t0;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsg.id
                ? {
                    ...m,
                    status: 'done',
                    latencyMs,
                    promptTokens: usage?.prompt_tokens,
                    completionTokens: usage?.completion_tokens,
                  }
                : m,
            ),
          );
          setBusy(false);
          stopRef.current = null;
        },
        (err) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstMsg.id ? { ...m, status: 'error', content: err } : m,
            ),
          );
          setBusy(false);
          stopRef.current = null;
        },
      );
    } else {
      try {
        const resp = await chatApi.send(selectedModelKey, history);
        const latencyMs = Date.now() - t0;
        const content = resp.choices[0]?.message?.content ?? '';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsg.id
              ? {
                  ...m,
                  content,
                  status: 'done',
                  latencyMs,
                  promptTokens: resp.usage?.prompt_tokens,
                  completionTokens: resp.usage?.completion_tokens,
                }
              : m,
          ),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsg.id ? { ...m, status: 'error', content: msg } : m,
          ),
        );
      } finally {
        setBusy(false);
      }
    }
  }

  function handleStop() {
    stopRef.current?.();
    stopRef.current = null;
    setBusy(false);
    setMessages((prev) =>
      prev.map((m) => (m.status === 'streaming' ? { ...m, status: 'done' } : m)),
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)] -m-6">
      {/* ── Top bar ── */}
      <div className="shrink-0 px-6 py-3 border-b border-gray-200 bg-white flex items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Model Playground</h2>
          <p className="text-xs text-gray-400">Test any chat model in real time</p>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Model picker */}
          <div className="relative">
            {loadingModels ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading models…
              </div>
            ) : models.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-red-200 bg-red-50 rounded-xl text-sm text-red-600">
                <AlertCircle className="w-4 h-4" /> No active chat models
              </div>
            ) : (
              <>
                <select
                  value={selectedModelKey}
                  onChange={(e) => setSelectedModelKey(e.target.value)}
                  className="pl-8 pr-8 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 outline-none focus:border-brand-400 bg-white appearance-none"
                >
                  {models.map((m) => (
                    <option key={m.model_key} value={m.model_key}>
                      {m.display_name} ({m.provider_key})
                    </option>
                  ))}
                </select>
                <Bot className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-500 pointer-events-none" />
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </>
            )}
          </div>

          {/* Streaming toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
              className="w-4 h-4 rounded accent-brand-600"
            />
            <span className="text-sm text-gray-600">Stream</span>
          </label>

          {/* System prompt toggle */}
          <button
            onClick={() => setShowSystem((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors ${
              showSystem
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" /> System
          </button>

          {/* Clear */}
          <button
            onClick={() => setMessages([])}
            disabled={messages.length === 0 || busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 disabled:opacity-40 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* ── System prompt panel ── */}
      {showSystem && (
        <div className="shrink-0 px-6 py-3 border-b border-gray-200 bg-amber-50">
          <label className="block text-xs font-semibold text-amber-700 mb-1.5 uppercase tracking-wide">
            System prompt
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            placeholder="You are a helpful assistant…"
            className="w-full px-3 py-2 rounded-xl border border-amber-200 bg-white text-sm outline-none focus:border-amber-400 resize-none"
          />
        </div>
      )}

      {/* ── Model info bar ── */}
      {selectedModel && (
        <div className="shrink-0 px-6 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
          <ModelBadge model={selectedModel} />
          <div className="flex items-center gap-3 ml-auto text-xs text-gray-500">
            {selectedModel.context_window_tokens && (
              <span>{(selectedModel.context_window_tokens / 1000).toFixed(0)}k ctx</span>
            )}
            {selectedModel.supports_streaming && (
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">streaming</span>
            )}
            {selectedModel.supports_tools && (
              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">tools</span>
            )}
            {selectedModel.supports_vision && (
              <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">vision</span>
            )}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 select-none">
            <Bot className="w-10 h-10 mb-3 text-gray-300" />
            <p className="text-sm font-medium">Pick a model and start chatting</p>
            <p className="text-xs mt-1">Multi-turn. Latency and token counts shown after each reply.</p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="shrink-0 px-6 py-4 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy || !selectedModelKey}
            placeholder={selectedModelKey ? 'Message… (Enter to send, Shift+Enter for newline)' : 'Select a model first'}
            rows={1}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none disabled:bg-gray-50 disabled:text-gray-400"
            style={{ minHeight: '44px', maxHeight: '160px' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
          />
          {busy ? (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
            >
              <span className="w-3 h-3 border-2 border-white rounded-sm bg-white" />
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !selectedModelKey}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-400 text-right">
          {messages.filter((m) => m.role === 'user').length} turn{messages.filter((m) => m.role === 'user').length !== 1 ? 's' : ''} in this conversation
        </p>
      </div>
    </div>
  );
}
