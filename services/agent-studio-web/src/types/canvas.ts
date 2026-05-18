// ─── Canvas / Graph types ─────────────────────────────────────────────────────

export type NodeKind =
  | 'start'
  | 'agent'
  | 'agent_team'
  | 'if_else'
  | 'human_review'
  | 'router'
  | 'parallel'
  | 'aggregator'
  | 'end';

export interface CanvasNodeData {
  label: string;
  description?: string;
  // agent / agent_team shared — agentId is the main agent; for agent_team it is the supervisor
  agentId?: string;
  agentKind?: string;
  modelId?: string;
  // agent_team node — supervisor-driven handoff only
  supervisorAgentId?: string;
  memberAgentIds?: string[];
  entryAgentId?: string;
  exitAgentId?: string;
  maxIterations?: number;
  // if_else node
  ifExpression?: string;
  // router node
  routes?: { label: string; handle: string }[];
  // parallel node
  branchCount?: number;
  // aggregator node (waits for all inputs then runs)
  strategy?: string;
  // inputs (displayed in the right panel)
  inputs?: { name: string; type: string; required: boolean }[];
  outputs?: { name: string; type: string; required: boolean }[];
  // arbitrary extra data from graph_json
  [key: string]: unknown;
}

// ─── Graph JSON (persisted to DB) ─────────────────────────────────────────────

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  /** UI-only bend positions — not used by the backend engine */
  uiData?: { arcDepth?: number; midYOffset?: number };
}

export interface GraphNode {
  type: NodeKind;
  label: string;
  data: Omit<CanvasNodeData, 'label'>;
  position: { x: number; y: number };
}

export interface GraphJson {
  [key: string]: unknown;
  entry_node_id: string;
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
}
