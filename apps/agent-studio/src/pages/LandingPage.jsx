import { Link } from '@tanstack/react-router'
import Navbar from '../components/Navbar'
import FlowDiagram from '../components/FlowDiagram'

// ── Hero ─────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative flex flex-col items-center justify-center text-center px-6 pt-40 pb-20 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/20 rounded-full blur-[120px]" />
      </div>


      {/* Eyebrow */}
      <p className="text-xs tracking-[0.25em] text-gray-400 uppercase mb-4">
        Agent Flow Platform
      </p>

      {/* Headline */}
      <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight max-w-3xl mb-4">
        Orchestrate Intelligent{' '}
        <span className="text-blue-400">AI Workflows</span>
      </h1>

      {/* Sub-headline */}
      <p className="text-gray-400 text-lg max-w-xl mb-10 leading-relaxed">
        Build production-ready Multi-Agent Systems visually with{' '}
        <strong className="text-white">Agent Flow</strong>. Connect LLMs, RAG knowledge
        bases, and tools into powerful autonomous workflows.
      </p>

      {/* CTA buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/login"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          Start Building Free
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
        <a
          href="#"
          className="flex items-center gap-2 border border-white/15 hover:border-white/30 text-white font-medium px-6 py-3 rounded-lg transition-colors bg-white/5"
        >
          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7L8 5z" />
          </svg>
          Watch Demo
        </a>
      </div>

      {/* Flow diagram */}
      <div className="mt-16 w-full max-w-3xl">
        <FlowDiagram />
      </div>
    </section>
  )
}

// ── Features ─────────────────────────────────────────────────────────────────
const features = [
  {
    icon: (
      <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M4 6h16M4 10h16M4 14h16M4 18h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
    ),
    iconBg: 'bg-blue-500/15',
    title: 'Rag Integration',
    description:
      'Connect your unstructured data with a single click. Agent Flow\'s advanced RAG pipeline handles chunking, embedding, and retrieval automatically.',
    checks: ['Vector Database Included', 'PDF, Notion, & Web Sources'],
  },
  {
    icon: (
      <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
    iconBg: 'bg-purple-500/15',
    title: 'Multi-Agent Workflows',
    description:
      'Design complex behaviors where specialized agents collaborate. Route tasks based on intent and manage state across conversations.',
    checks: ['Visual Node Editor', 'Conditional Routing'],
  },
  {
    icon: (
      <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 11-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
      </svg>
    ),
    iconBg: 'bg-pink-500/15',
    title: 'Integrated Tools',
    description:
      'Give your agents hands. Equip them with capabilities to search the web, execute code, call APIs, and interact with your software.',
    checks: ['50+ Pre-built Integrations', 'Custom Python Functions'],
  },
]

function FeaturesSection() {
  return (
    <section className="px-6 py-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Why Choose Agent Flow?</h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Everything you need to build context-aware, autonomous agents in minutes, not months.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-[#0f0f1a] border border-white/8 rounded-2xl p-6 flex flex-col gap-4 hover:border-white/15 transition-colors"
            >
              <div className={`w-12 h-12 rounded-xl ${f.iconBg} flex items-center justify-center`}>
                {f.icon}
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.description}</p>
              </div>
              <ul className="flex flex-col gap-2 mt-auto">
                {f.checks.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Social Proof / Logos ──────────────────────────────────────────────────────
const logos = ['ACME CORP', 'Globex', 'Soylent.io', 'UMBRELLA', 'MassiveDynamic']

function LogosSection() {
  return (
    <section className="py-16 border-t border-b border-white/5">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <p className="text-xs tracking-[0.2em] text-gray-600 uppercase mb-10">
          Powering Next-Gen AI Startups
        </p>
        <div className="flex flex-wrap items-center justify-center gap-10">
          {logos.map((logo) => (
            <span key={logo} className="text-gray-600 font-semibold text-sm tracking-wide select-none">
              {logo}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Bottom CTA ────────────────────────────────────────────────────────────────
function CtaSection() {
  return (
    <section className="py-28 px-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-600/15 rounded-full blur-[100px]" />
      </div>
      <div className="max-w-2xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
          Ready to build your first Agent Flow?
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          Join thousands of developers building the future of autonomous workflows today.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/login"
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-7 py-3.5 rounded-lg transition-colors"
          >
            Start Building Now
          </Link>
          <a
            href="#"
            className="border border-white/15 hover:border-white/30 text-white font-medium px-7 py-3.5 rounded-lg transition-colors bg-white/5"
          >
            Read Documentation
          </a>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
const footerLinks = {
  Product: ['Features', 'Integrations', 'Changelog'],
  Resources: ['Documentation', 'API Reference', 'Community', 'Blog'],
}

function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-14">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-white font-semibold">Agent Flow</span>
          </div>
          <p className="text-gray-500 text-sm leading-relaxed">
            Empowering developers to build sophisticated AI agents with drag-and-drop simplicity
            and code-level control.
          </p>
          <div className="flex gap-3">
            <a href="#" className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="#" className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.165 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.378.202 2.397.1 2.65.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Link columns */}
        {Object.entries(footerLinks).map(([col, links]) => (
          <div key={col}>
            <h4 className="text-white font-semibold text-sm mb-4">{col}</h4>
            <ul className="flex flex-col gap-2.5">
              {links.map((link) => (
                <li key={link}>
                  <a href="#" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="text-gray-600 text-xs">© 2024 Agent Flow Inc. All rights reserved.</p>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-gray-600 text-xs">Systems Operational</span>
        </div>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080810] text-white">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <LogosSection />
      <CtaSection />
      <Footer />
    </div>
  )
}
