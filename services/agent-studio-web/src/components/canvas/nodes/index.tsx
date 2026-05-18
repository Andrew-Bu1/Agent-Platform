import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Bot, Users, GitBranch, Layers, Columns2,
  CircleDot, StopCircle, GitMerge, UserCheck,
} from 'lucide-react';
import type { CanvasNodeData, NodeKind } from '../../../types/canvas';

// ─── Colour map ───────────────────────────────────────────────────────────────

export const NODE_META: Record<NodeKind, {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  iconColor: string;
  label: string;
  description: string;
}> = {
  start:        { icon: CircleDot,  bg: 'bg-emerald-50',  border: 'border-emerald-300', iconColor: 'text-emerald-600', label: 'Start',        description: 'Entry point' },
  agent:        { icon: Bot,        bg: 'bg-violet-50',   border: 'border-violet-300',  iconColor: 'text-violet-600',  label: 'Agent',        description: 'LLM agent with tools' },
  agent_team:   { icon: Users,      bg: 'bg-blue-50',     border: 'border-blue-300',    iconColor: 'text-blue-600',    label: 'Agent Team',   description: 'Hierarchical multi-agent team' },
  if_else:      { icon: GitMerge,   bg: 'bg-amber-50',    border: 'border-amber-300',   iconColor: 'text-amber-600',   label: 'If / Else',    description: 'Conditional branch by expression' },
  human_review: { icon: UserCheck,  bg: 'bg-teal-50',     border: 'border-teal-300',    iconColor: 'text-teal-600',    label: 'Human Review', description: 'Pause and wait for human input' },
  router:       { icon: GitBranch,  bg: 'bg-orange-50',   border: 'border-orange-300',  iconColor: 'text-orange-600',  label: 'Router',       description: 'Route to next node by output field' },
  parallel:     { icon: Columns2,   bg: 'bg-cyan-50',     border: 'border-cyan-300',    iconColor: 'text-cyan-600',    label: 'Parallel',     description: 'Run branches in parallel' },
  aggregator:   { icon: Layers,     bg: 'bg-indigo-50',   border: 'border-indigo-300',  iconColor: 'text-indigo-600',  label: 'Aggregator',   description: 'Waits for all inputs then runs' },
  end:          { icon: StopCircle, bg: 'bg-red-50',      border: 'border-red-300',     iconColor: 'text-red-500',     label: 'End',          description: 'Workflow end' },
};

// ─── Handle styles ────────────────────────────────────────────────────────────

const handleStyle = {
  width: 10,
  height: 10,
  borderRadius: '50%',
  border: '2px solid #94a3b8',
  background: '#fff',
};

const sourceHandleStyle = {
  ...handleStyle,
  border: '2px solid #6366f1',
};

// ─── Base node ────────────────────────────────────────────────────────────────

interface BaseNodeProps {
  kind: NodeKind;
  data: CanvasNodeData;
  selected: boolean;
  children?: React.ReactNode;
  /** Extra source handles rendered below the default output */
  extraHandles?: { id: string; label: string; style?: React.CSSProperties }[];
  /** Replaces the single bottom handle with custom ones */
  customSourceHandles?: React.ReactNode;
  /** Hide bottom output handle (e.g., for End node) */
  noOutput?: boolean;
  /** Hide top input handle (e.g., for Start node) */
  noInput?: boolean;
}

function BaseNode({
  kind,
  data,
  selected,
  children,
  extraHandles,
  customSourceHandles,
  noOutput,
  noInput,
}: BaseNodeProps) {
  const meta = NODE_META[kind];
  const Icon = meta.icon;

  return (
    <div
      className={`
        relative rounded-xl border-2 shadow-sm min-w-[160px] max-w-[220px]
        ${meta.bg} ${selected ? 'border-brand-500 shadow-md ring-2 ring-brand-300' : meta.border}
        transition-all duration-150 cursor-pointer
      `}
    >
      {!noInput && (
        <Handle
          type="target"
          position={Position.Top}
          style={handleStyle}
        />
      )}

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${meta.bg}`}>
            <Icon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{data.label}</p>
            {data.description && (
              <p className="text-[10px] text-gray-500 truncate leading-tight mt-0.5">{data.description}</p>
            )}
          </div>
        </div>
        {children}
      </div>

      {customSourceHandles}

      {!noOutput && !customSourceHandles && !extraHandles && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={sourceHandleStyle}
        />
      )}

      {extraHandles && (
        <div className="flex justify-around pb-1">
          {extraHandles.map((h) => (
            <div key={h.id} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-gray-500">{h.label}</span>
              <Handle
                type="source"
                position={Position.Bottom}
                id={h.id}
                style={h.style ?? sourceHandleStyle}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Start node ───────────────────────────────────────────────────────────────

export const StartNode = memo(({ data, selected }: NodeProps) => (
  <BaseNode kind="start" data={data as CanvasNodeData} selected={selected} noInput>
    <p className="text-[10px] text-emerald-600 font-medium mt-1">Entry point</p>
  </BaseNode>
));
StartNode.displayName = 'StartNode';

// ─── Agent node ───────────────────────────────────────────────────────────────

export const AgentNode = memo(({ data, selected }: NodeProps) => {
  const d = data as CanvasNodeData;
  return (
    <BaseNode kind="agent" data={d} selected={selected}>
      {d.agentKind && (
        <span className="mt-1 inline-block px-1.5 py-0.5 bg-violet-100 text-violet-700 text-[9px] rounded-full font-medium">
          {d.agentKind}
        </span>
      )}
      {d.modelId && (
        <p className="text-[9px] text-gray-400 mt-0.5 truncate">{d.modelId}</p>
      )}
    </BaseNode>
  );
});
AgentNode.displayName = 'AgentNode';

// ─── Agent Team node ──────────────────────────────────────────────────────────

export const AgentTeamNode = memo(({ data, selected }: NodeProps) => {
  const d = data as CanvasNodeData;
  const memberCount = d.memberAgentIds?.length ?? 0;
  return (
    <BaseNode kind="agent_team" data={d} selected={selected}>
      <p className="text-[9px] text-gray-400 mt-0.5">
        {memberCount > 0
          ? `${memberCount} member${memberCount !== 1 ? 's' : ''} · handoff`
          : 'handoff'}
      </p>
    </BaseNode>
  );
});
AgentTeamNode.displayName = 'AgentTeamNode';

// ─── Router node ──────────────────────────────────────────────────────────────

export const RouterNode = memo(({ data, selected }: NodeProps) => {
  const d = data as CanvasNodeData;
  const routes = d.routes ?? [];
  return (
    <BaseNode
      kind="router"
      data={d}
      selected={selected}
      extraHandles={
        routes.length > 0
          ? routes.map((r) => ({ id: r.handle, label: r.label }))
          : [{ id: 'default', label: 'output' }]
      }
    >
      {routes.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {routes.map((r) => (
            <span key={r.handle} className="px-1 py-0.5 bg-orange-100 text-orange-700 text-[9px] rounded">
              {r.label}
            </span>
          ))}
        </div>
      )}
    </BaseNode>
  );
});
RouterNode.displayName = 'RouterNode';

// ─── Parallel node ────────────────────────────────────────────────────────────

export const ParallelNode = memo(({ data, selected }: NodeProps) => {
  const d = data as CanvasNodeData;
  const count = d.branchCount ?? 2;
  const handles = Array.from({ length: count }, (_, i) => ({
    id: `branch-${i}`,
    label: `${i + 1}`,
  }));
  return (
    <BaseNode kind="parallel" data={d} selected={selected} extraHandles={handles}>
      <p className="text-[10px] text-cyan-600 mt-1">{count} branches</p>
    </BaseNode>
  );
});
ParallelNode.displayName = 'ParallelNode';

// ─── Aggregator node ──────────────────────────────────────────────────────────

export const AggregatorNode = memo(({ data, selected }: NodeProps) => {
  const d = data as CanvasNodeData;
  return (
    <BaseNode kind="aggregator" data={d} selected={selected}>
      <p className="text-[10px] text-indigo-500 mt-1">waits all → runs</p>
      {d.strategy && (
        <span className="mt-0.5 inline-block px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] rounded-full font-medium">
          {d.strategy}
        </span>
      )}
    </BaseNode>
  );
});
AggregatorNode.displayName = 'AggregatorNode';

// ─── If/Else node ────────────────────────────────────────────────────────────

export const IfElseNode = memo(({ data, selected }: NodeProps) => {
  const d = data as CanvasNodeData;
  return (
    <BaseNode
      kind="if_else"
      data={d}
      selected={selected}
      extraHandles={[
        { id: 'true',  label: 'true',  style: { ...{width:10,height:10,borderRadius:'50%',border:'2px solid #6366f1',background:'#fff'}, border: '2px solid #22c55e' } },
        { id: 'false', label: 'false', style: { ...{width:10,height:10,borderRadius:'50%',border:'2px solid #6366f1',background:'#fff'}, border: '2px solid #ef4444' } },
      ]}
    >
      {d.ifExpression && (
        <p className="text-[9px] text-amber-600 mt-1 truncate font-mono">{d.ifExpression}</p>
      )}
    </BaseNode>
  );
});
IfElseNode.displayName = 'IfElseNode';

// ─── Human Review node ────────────────────────────────────────────────────────

export const HumanReviewNode = memo(({ data, selected }: NodeProps) => (
  <BaseNode kind="human_review" data={data as CanvasNodeData} selected={selected}>
    <p className="text-[10px] text-teal-600 mt-1">Awaits human decision</p>
  </BaseNode>
));
HumanReviewNode.displayName = 'HumanReviewNode';

// ─── End node ─────────────────────────────────────────────────────────────────

export const EndNode = memo(({ data, selected }: NodeProps) => (
  <BaseNode kind="end" data={data as CanvasNodeData} selected={selected} noOutput>
    <p className="text-[10px] text-red-500 mt-1">Workflow end</p>
  </BaseNode>
));
EndNode.displayName = 'EndNode';

// ─── nodeTypes map (pass to ReactFlow) ───────────────────────────────────────

export const nodeTypes = {
  start:        StartNode,
  agent:        AgentNode,
  agent_team:   AgentTeamNode,
  if_else:      IfElseNode,
  human_review: HumanReviewNode,
  router:       RouterNode,
  parallel:     ParallelNode,
  aggregator:   AggregatorNode,
  end:          EndNode,
};
