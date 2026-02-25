function NodeBadge({ color }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full mr-1.5"
      style={{ backgroundColor: color }}
    />
  )
}

function FlowNode({ title, badge, wide }) {
  return (
    <div
      className={`bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 flex flex-col gap-1.5 shadow-lg ${wide ? 'min-w-[160px]' : 'min-w-[130px]'}`}
    >
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center">
          <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-white text-xs font-medium">{title}</span>
      </div>
      {badge && (
        <div className="flex items-center bg-black/30 rounded-md px-2 py-1">
          <NodeBadge color="#3b82f6" />
          <span className="text-gray-400 text-[10px]">{badge}</span>
        </div>
      )}
    </div>
  )
}

export default function FlowDiagram() {
  return (
    <div className="relative bg-[#0f0f1a] border border-white/10 rounded-2xl p-8 overflow-hidden">
      {/* Canvas controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-1">
        <button className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center text-white text-xs">+</button>
        <button className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center text-white text-xs">✋</button>
        <button className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center text-white text-xs">⊙</button>
      </div>

      {/* Diagram */}
      <div className="flex flex-col items-center gap-6 min-h-[280px] pt-4">
        {/* Top row */}
        <div className="flex items-center gap-6">
          <FlowNode title="Start Flow" />
          {/* Arrow */}
          <svg className="w-8 h-3 text-blue-500" fill="none" viewBox="0 0 32 12">
            <path d="M0 6h28M22 1l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <FlowNode title="Router Agent" badge="deepseek-chat" wide />
          {/* Arrow */}
          <svg className="w-8 h-3 text-blue-500" fill="none" viewBox="0 0 32 12">
            <path d="M0 6h28M22 1l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <FlowNode title="Generate Response" wide />
        </div>

        {/* Divider lines down */}
        <div className="flex items-start gap-16 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 bg-blue-500/50" />
        </div>

        {/* Bottom agents row */}
        <div className="flex items-center gap-4">
          <FlowNode title="Support Agent" badge="gpt-4o" />
          <FlowNode title="Research Agent" badge="claude-3-opus" />
          <div className="flex flex-col gap-2">
            <FlowNode title="Sales Agent" badge="deepseek-coder" />
            <div className="bg-[#1a1a2e] border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 min-w-[130px]">
              <div className="w-4 h-4 rounded bg-white/10 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <span className="text-gray-400 text-[10px]">RAG Knowledge Base</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-gray-500 text-[10px]">Agent Flow Engine Active</span>
      </div>
    </div>
  )
}
