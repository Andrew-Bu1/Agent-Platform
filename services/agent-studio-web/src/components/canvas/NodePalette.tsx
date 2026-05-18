import { type NodeKind } from '../../types/canvas';
import { NODE_META } from './nodes/index';

// Core nodes
const CORE_NODES: NodeKind[] = [
  'agent',
  'agent_team',
  'if_else',
  'human_review',
  'router',
  'parallel',
  'aggregator',
  'end',
];

interface NodePaletteProps {
  onAddNode: (kind: NodeKind) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function NodePalette({
  onAddNode,
  searchQuery,
  onSearchChange,
}: NodePaletteProps) {
  const q = searchQuery.toLowerCase();

  const filteredCore = CORE_NODES.filter((kind) => {
    const meta = NODE_META[kind];

    if (!meta) return false;

    return (
      !q ||
      meta.label.toLowerCase().includes(q) ||
      meta.description.toLowerCase().includes(q)
    );
  });

  return (
    <aside className="w-56 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-2 border-b border-gray-100 shrink-0">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">
          Add nodes
        </p>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search nodes   Cmd+K"
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-100 bg-gray-50"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {filteredCore.length > 0 && (
          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Nodes
            </p>

            <ul className="space-y-1">
              {filteredCore.map((kind) => {
                const meta = NODE_META[kind];
                const Icon = meta.icon;

                return (
                  <li key={kind}>
                    <button
                      type="button"
                      onClick={() => onAddNode(kind)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-gray-50 active:bg-gray-100 transition-colors group"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/node-kind', kind);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                    >
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${meta.bg}`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-medium text-gray-700 group-hover:text-gray-900 leading-tight">
                          {meta.label}
                        </span>

                        <span className="block text-[10px] text-gray-400 leading-tight truncate">
                          {meta.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {filteredCore.length === 0 && (
          <p className="text-xs text-gray-400 text-center pt-4">
            No matches for "{searchQuery}"
          </p>
        )}
      </div>
    </aside>
  );
}