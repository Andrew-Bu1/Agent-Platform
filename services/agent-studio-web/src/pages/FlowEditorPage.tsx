import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type DragEvent,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  BackgroundVariant,
  ConnectionLineType,
  Panel,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  ArrowLeft,
  Save,
  Rocket,
  Loader2,
  AlertCircle,
  GitBranch,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Share2,
  Play,
  Tag,
} from 'lucide-react';

import { flowsApi } from '../api/flows';
import { agentsApi } from '../api/agents';
import { toolsApi } from '../api/tools';
import { runsApi } from '../api/runs';
import { nodeTypes, NODE_META } from '../components/canvas/nodes/index';
import { edgeTypes } from '../components/canvas/edges/index';
import NodePalette from '../components/canvas/NodePalette';
import NodeConfigPanel from '../components/canvas/NodeConfigPanel';
import AgentTeamDrawer from '../components/canvas/AgentTeamDrawer';
import type { Flow, FlowVersion, Agent, Tool, RunStatus } from '../types/api';
import type { CanvasNodeData, NodeKind, GraphJson } from '../types/canvas';

// ─── Default Start node ───────────────────────────────────────────────────────

const DEFAULT_START: Node = {
  id: 'start-1',
  type: 'start',
  position: { x: 300, y: 80 },
  data: { label: 'Start' } as CanvasNodeData,
};

// ─── Convert graph_json ↔ React Flow ─────────────────────────────────────────

function graphToFlow(graph: GraphJson): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = Object.entries(graph.nodes).map(([id, n]) => ({
    id,
    type: n.type,
    position: n.position,
    data: { label: n.label, ...n.data } as CanvasNodeData,
  }));

  const edges: Edge[] = (graph.edges ?? []).map((e) => ({
    id: e.id,
    type: 'smart',
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
    data: e.uiData ?? {},
    markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
  }));

  return { nodes, edges };
}

function flowToGraph(nodes: Node[], edges: Edge[], entryNodeId: string): GraphJson {
  const graphNodes: GraphJson['nodes'] = {};
  for (const n of nodes) {
    const { label, ...rest } = n.data as CanvasNodeData;
    graphNodes[n.id] = {
      type: n.type as NodeKind,
      label: label as string,
      data: rest,
      position: n.position,
    };
  }

  return {
    entry_node_id: entryNodeId,
    nodes: graphNodes,
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: typeof e.label === 'string' ? e.label : undefined,
      uiData: e.data && Object.keys(e.data).length > 0
        ? (e.data as { arcDepth?: number; midYOffset?: number })
        : undefined,
    })),
  };
}

function validateCanvas(nodes: Node[], edges: Edge[]): string | null {
  if (nodes.length === 0) return 'Add at least one node before saving.';
  const entryNode = nodes.find((n) => n.type === 'start') ?? nodes[0];
  if (!entryNode) return 'Workflow needs an entry node.';
  if (nodes.length > 1 && !edges.some((e) => e.source === entryNode.id)) {
    return 'Connect the Start node to the workflow before saving.';
  }
  const invalidEdge = edges.find((edge) =>
    !nodes.some((node) => node.id === edge.source) ||
    !nodes.some((node) => node.id === edge.target)
  );
  if (invalidEdge) return 'Remove broken connections before saving.';
  return null;
}

// ─── ID generators ────────────────────────────────────────────────────────────

let _nodeCounter = 0;
function nextNodeId(kind: NodeKind) {
  return `${kind}-${++_nodeCounter}`;
}

function nextEdgeId() {
  return `edge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function syncNodeCounter(nodes: Node[]) {
  const max = nodes.reduce((acc, node) => {
    const match = /-(\d+)$/.exec(node.id);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, _nodeCounter);
  _nodeCounter = max;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function VersionBadge({ version }: { version: FlowVersion }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
      <Tag className="w-3 h-3" />
      v{version.version}
      {version.status === 'published' ? (
        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full font-semibold ml-1">
          Published
        </span>
      ) : (
        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full font-semibold ml-1">
          Draft
        </span>
      )}
    </div>
  );
}

// ─── Test panel ───────────────────────────────────────────────────────────────

function TestPanel({
  flowId,
  version,
  onClose,
}: {
  flowId: string;
  version: FlowVersion;
  onClose: () => void;
}) {
  const [input, setInput] = useState('{\n  "message": ""\n}');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<RunStatus | 'idle'>('idle');
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [output, setOutput] = useState<Record<string, unknown> | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopStreamRef.current?.(), []);

  function readSseData(raw: string) {
    return raw
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
  }

  async function runWorkflow() {
    setRunError(null);
    setOutput(null);
    setEvents([]);

    if (version.status !== 'published') {
      setRunError('Publish the workflow before running a test.');
      return;
    }

    let parsedInput: Record<string, unknown>;
    try {
      const parsed = JSON.parse(input);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Input must be a JSON object.');
      }
      parsedInput = parsed as Record<string, unknown>;
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Input must be valid JSON.');
      return;
    }

    setRunning(true);
    setStatus('pending');
    stopStreamRef.current?.();
    try {
      const run = await runsApi.create({
        flowVersionId: version.id,
        input: parsedInput,
      });
      setRunId(run.id);
      setStatus(run.status);

      stopStreamRef.current = runsApi.streamEvents(
        run.id,
        (raw) => {
          const data = readSseData(raw);
          if (!data) return;
          try {
            const parsed = JSON.parse(data) as {
              type?: string;
              data?: Record<string, unknown>;
              nodeId?: string;
            };
            const label = parsed.nodeId
              ? `${parsed.type ?? 'Event'} · ${parsed.nodeId}`
              : parsed.type ?? 'Event';
            setEvents((prev) => [label, ...prev].slice(0, 50));

            const nextStatus = parsed.data?.status;
            if (typeof nextStatus === 'string') setStatus(nextStatus as RunStatus);
            if (parsed.type === 'RunCompleted' || parsed.type === 'FlowCompleted') {
              setStatus('completed');
              if (parsed.data?.output && typeof parsed.data.output === 'object') {
                setOutput(parsed.data.output as Record<string, unknown>);
              } else {
                setOutput(parsed.data ?? {});
              }
              setRunning(false);
            }
            if (parsed.type === 'RunFailed' || parsed.type === 'FlowFailed') {
              setStatus('failed');
              setRunError(String(parsed.data?.error ?? parsed.data?.message ?? 'Run failed.'));
              setRunning(false);
            }
          } catch {
            setEvents((prev) => [data, ...prev].slice(0, 50));
          }
        },
        (err) => {
          setRunError(err.message);
          setRunning(false);
        },
      );
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to start run.');
      setRunning(false);
    }
  }

  return (
    <div className="absolute bottom-0 left-56 right-72 bg-white border-t border-gray-200 shadow-xl z-10">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div className="flex gap-4">
          {['Test & Trace', 'Runs', 'Evaluations', 'Logs', 'Metrics'].map((t) => (
            <button
              key={t}
              className={`text-xs pb-1 border-b-2 ${t === 'Test & Trace' ? 'border-brand-500 text-brand-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">
          ✕
        </button>
      </div>
      <div className="flex gap-4 p-4">
        <div className="flex-1">
          <p className="text-[10px] text-gray-400 mb-1 font-medium">Test input</p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            className="w-full text-xs font-mono border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-brand-400 resize-none"
          />
          {runError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {runError}
            </div>
          )}
          <button
            onClick={runWorkflow}
            disabled={running || version.status !== 'published'}
            className="mt-2 flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Run workflow
          </button>
          {version.status !== 'published' && (
            <p className="mt-1.5 text-[10px] text-amber-600">Publish this version before testing it.</p>
          )}
        </div>
        <div className="flex-1 border border-gray-100 rounded-lg p-3 bg-gray-50 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-400 font-medium">Run output</p>
            <span className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">
              {status}
            </span>
          </div>
          <p className="text-[10px] text-gray-300">
            Flow: {flowId.slice(0, 8)}… | Version: {version.id.slice(0, 8)}…
          </p>
          {runId && <p className="text-[10px] text-gray-300 mt-0.5">Run: {runId.slice(0, 8)}…</p>}
          {output && (
            <pre className="mt-2 max-h-24 overflow-auto text-[10px] font-mono text-gray-700 bg-white border border-gray-100 rounded-lg p-2">
              {JSON.stringify(output, null, 2)}
            </pre>
          )}
          {events.length > 0 && (
            <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
              {events.map((event, idx) => (
                <p key={`${event}-${idx}`} className="text-[10px] text-gray-500 truncate">{event}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FlowEditorPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // ── State ────────────────────────────────────────────────────────────────
  const [flow, setFlow] = useState<Flow | null>(null);
  const [version, setVersion] = useState<FlowVersion | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showTest, setShowTest] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([DEFAULT_START]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);

  // ── Load flow + latest draft version ────────────────────────────────────
  useEffect(() => {
    if (!flowId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      flowsApi.get(flowId),
      flowsApi.listVersions(flowId, 0, 50),
      agentsApi.list(0, 100),
      toolsApi.list(0, 100),
    ])
      .then(([f, vPage, aPage, tPage]) => {
        setFlow(f);
        setAgents(aPage.content);
        setTools(tPage.content);

        const sortedVersions = [...vPage.content].sort((a, b) => b.version - a.version);
        const draft = sortedVersions.find((v) => v.status === 'draft') ?? sortedVersions[0];
        if (draft) {
          setVersion(draft);
          if (draft.graph && Object.keys(draft.graph).length > 0) {
            const { nodes: n, edges: e } = graphToFlow(draft.graph as unknown as GraphJson);
            if (n.length > 0) {
              syncNodeCounter(n);
              setNodes(n);
              setEdges(e);
            }
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load workflow'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId]);

  // ── Mark dirty on canvas change ──────────────────────────────────────────
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      setDirty(true);
    },
    [onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes);
      setDirty(true);
    },
    [onEdgesChange],
  );

  // ── Connect nodes ────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: nextEdgeId(),
            type: 'smart',
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          },
          eds,
        ),
      );
      setDirty(true);
    },
    [setEdges],
  );

  // ── Node selection ───────────────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // ── Add node via palette click ────────────────────────────────────────────
  const addNode = useCallback(
    (kind: NodeKind, position?: { x: number; y: number }) => {
      const meta = NODE_META[kind];
      const id = nextNodeId(kind);
      const newNode: Node = {
        id,
        type: kind,
        position: position ?? { x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 },
        data: { label: meta.label, description: meta.description } as CanvasNodeData,
      };
      setNodes((nds) => [...nds, newNode]);
      setSelectedNode(newNode);
      setDirty(true);
    },
    [setNodes],
  );

  // ── Drag-and-drop from palette ────────────────────────────────────────────
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData('application/node-kind') as NodeKind;
      if (!kind || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = flowInstance
        ? flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: event.clientX - bounds.left - 80, y: event.clientY - bounds.top - 30 };
      addNode(kind, position);
    },
    [addNode, flowInstance],
  );

  // ── Pattern templates ────────────────────────────────────────────────────
  const addPattern = useCallback(
    (patternId: string) => {
      const BASE_X = 300;
      const BASE_Y = 200 + Math.random() * 60;

      const patterns: Record<string, { kind: NodeKind; dx: number; dy: number }[]> = {
        // Pattern 1 — Sequential
        sequential: [
          { kind: 'agent', dx: 0, dy: 0 },
          { kind: 'agent', dx: 220, dy: 0 },
        ],
        // Pattern 2 — Parallel fan-out
        parallel_fanout: [
          { kind: 'parallel', dx: 0, dy: 0 },
          { kind: 'agent', dx: 220, dy: -80 },
          { kind: 'agent', dx: 220, dy: 80 },
          { kind: 'aggregator', dx: 440, dy: 0 },
        ],
        // Pattern 3 — Hierarchical (agent_team node)
        hierarchical: [
          { kind: 'agent_team', dx: 0, dy: 0 },
        ],
        // Pattern 4 — Self-correct loop (agent → if_else → back-edge)
        self_correct: [
          { kind: 'agent', dx: 0, dy: 0 },
          { kind: 'if_else', dx: 220, dy: 0 },
        ],
        // Human-in-the-loop
        human_in_loop: [
          { kind: 'agent', dx: 0, dy: 0 },
          { kind: 'human_review', dx: 220, dy: 0 },
          { kind: 'agent', dx: 440, dy: 0 },
        ],
      };

      const steps = patterns[patternId];
      if (!steps) return;

      const newNodes: Node[] = steps.map(({ kind, dx, dy }) => {
        const meta = NODE_META[kind];
        const id = nextNodeId(kind);
        return {
          id,
          type: kind,
          position: { x: BASE_X + dx, y: BASE_Y + dy },
          data: { label: meta.label } as CanvasNodeData,
        };
      });

      // Connect them linearly
      const newEdges: Edge[] = newNodes.slice(0, -1).map((n, i) => ({
        id: nextEdgeId(),
        type: 'smart',
        source: n.id,
        target: newNodes[i + 1].id,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      }));

      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
      setDirty(true);
    },
    [setNodes, setEdges],
  );

  // ── Update node data from config panel ────────────────────────────────────
  const updateNodeData = useCallback(
    (nodeId: string, partial: Partial<CanvasNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...partial } } : n,
        ),
      );
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...partial } } : prev,
      );
      setDirty(true);
    },
    [setNodes],
  );

  // ── Delete node ───────────────────────────────────────────────────────────
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
      setDirty(true);
    },
    [setNodes, setEdges],
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!flowId) return;
    setSaving(true);
    setError(null);
    try {
      const validationError = validateCanvas(nodes, edges);
      if (validationError) throw new Error(validationError);
      const entryNode = nodes.find((n) => n.type === 'start') ?? nodes[0];
      const graph = flowToGraph(nodes, edges, entryNode?.id ?? 'start-1');

      let saved: FlowVersion;
      if (version && version.status === 'draft') {
        saved = await flowsApi.updateVersion(flowId, version.id, { graph });
      } else {
        saved = await flowsApi.createVersion(flowId, { graph });
      }
      setVersion(saved);
      setDirty(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [flowId, nodes, edges, version]);

  // ── Publish ───────────────────────────────────────────────────────────────
  const publish = useCallback(async () => {
    if (!flowId || !version) return;
    const validationError = validateCanvas(nodes, edges);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Auto-save first if dirty
    let vid = version.id;
    if (dirty) {
      setSaving(true);
      try {
        const validationError = validateCanvas(nodes, edges);
        if (validationError) throw new Error(validationError);
        const entryNode = nodes.find((n) => n.type === 'start') ?? nodes[0];
        const graph = flowToGraph(nodes, edges, entryNode?.id ?? 'start-1');
        const saved = version.status === 'draft'
          ? await flowsApi.updateVersion(flowId, version.id, { graph })
          : await flowsApi.createVersion(flowId, { graph });
        setVersion(saved);
        vid = saved.id;
        setDirty(false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save before publish');
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    setPublishing(true);
    try {
      const published = await flowsApi.publishVersion(flowId, vid);
      setVersion(published);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }, [flowId, version, dirty, nodes, edges]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save]);

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !flow) {
    return (
      <div className="flex flex-col items-center gap-3 justify-center h-screen bg-gray-50">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={() => navigate('/workflows')} className="text-xs text-brand-600 underline">
          Back to workflows
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shrink-0 z-20">
        {/* Back */}
        <button
          onClick={() => navigate('/workflows')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Workflows
        </button>
        <span className="text-gray-300">/</span>

        {/* Flow name */}
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-gray-900">{flow?.name ?? 'Workflow'}</span>
        </div>

        {/* Version */}
        {version && <VersionBadge version={version} />}

        {dirty && (
          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Unsaved changes
          </span>
        )}

        {error && (
          <div className="flex items-center gap-1 text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}

        <div className="flex-1" />

        {/* Actions */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
        <button
          onClick={() => setShowTest((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Test
        </button>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
        <button
          onClick={publish}
          disabled={publishing || saving || version?.status === 'published'}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors font-medium"
        >
          {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
          Publish
        </button>
      </header>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left palette */}
        <NodePalette
          onAddNode={addNode}
          searchQuery={paletteSearch}
          onSearchChange={setPaletteSearch}
        />

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="flex-1 relative"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setFlowInstance}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            defaultEdgeOptions={{
              type: 'smart',
              markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
            }}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 1.5 }}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            className="bg-gray-50"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={16}
              size={1}
              color="#e2e8f0"
            />
            <Controls
              showInteractive={false}
              className="!shadow-md !rounded-xl !border !border-gray-200 !bg-white"
            />
            {/* Toolbar panel */}
            <Panel position="top-right" className="flex gap-1 mr-[290px]">
              <button
                title="Zoom in"
                onClick={() => flowInstance?.zoomIn()}
                className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 shadow-sm"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                title="Zoom out"
                onClick={() => flowInstance?.zoomOut()}
                className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 shadow-sm"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                title="Fit view"
                onClick={() => flowInstance?.fitView({ padding: 0.2 })}
                className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 shadow-sm"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                title="Reset"
                onClick={() => flowInstance?.setViewport({ x: 0, y: 0, zoom: 1 })}
                className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </Panel>

            {/* Empty state hint */}
            {nodes.length <= 1 && (
              <Panel position="bottom-center">
                <div className="mb-8 px-4 py-2.5 bg-white border border-gray-200 rounded-xl shadow text-xs text-gray-500 text-center">
                  Drag nodes from the left panel onto the canvas, or click a node to add it
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Right config panel — normal nodes */}
        {selectedNode && selectedNode.type !== 'agent_team' && (
          <NodeConfigPanel
            node={selectedNode}
            agents={agents}
            onUpdate={updateNodeData}
            onClose={() => setSelectedNode(null)}
            onDelete={deleteNode}
          />
        )}

        {/* Agent Team drawer — wide overlay */}
        {selectedNode?.type === 'agent_team' && (
          <AgentTeamDrawer
            node={selectedNode}
            agents={agents}
            onUpdate={updateNodeData}
            onClose={() => setSelectedNode(null)}
            onDelete={deleteNode}
            onAgentCreated={(agent) => setAgents((prev) => [...prev, agent])}
          />
        )}
      </div>

      {/* ── Test panel ─────────────────────────────────────────────────────── */}
      {showTest && version && (
        <TestPanel
          flowId={flowId ?? ''}
          version={version}
          onClose={() => setShowTest(false)}
        />
      )}
    </div>
  );
}
