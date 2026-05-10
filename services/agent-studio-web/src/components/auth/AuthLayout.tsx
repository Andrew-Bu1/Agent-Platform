import type { ReactNode } from 'react';
import { Bot, GitBranch, Activity, Zap } from 'lucide-react';

const FEATURES = [
  { icon: GitBranch, text: 'Visual canvas with drag-and-drop flow nodes' },
  { icon: Bot,       text: 'ReAct agents with tools, memory & knowledge' },
  { icon: Activity,  text: 'Real-time streaming with human-in-the-loop' },
  { icon: Zap,       text: 'Multi-tenant with full workspace isolation' },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex w-[46%] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 flex-col justify-between p-14 relative overflow-hidden select-none">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -left-16 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-brand-400/20 blur-2xl" />
          <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full bg-brand-300/10 blur-2xl" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/25">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-white tracking-tight">Agent Studio</span>
          </div>

          <div className="mt-20">
            <h1 className="text-[2.5rem] font-bold text-white leading-[1.18] tracking-tight">
              Build intelligent<br />workflows with AI
            </h1>
            <p className="mt-5 text-brand-100/75 text-base leading-relaxed">
              Design, deploy, and monitor multi-agent<br />systems — visually, without the complexity.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-[15px] h-[15px] text-white" />
                </div>
                <span className="text-white/80 text-sm leading-snug">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-white/25 text-xs">© 2026 Agent Platform. All rights reserved.</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-[390px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Agent Studio</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
