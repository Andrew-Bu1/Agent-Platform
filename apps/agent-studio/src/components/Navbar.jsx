import { Link } from '@tanstack/react-router'

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span className="text-white font-semibold text-base">Agent Flow</span>
      </div>

      {/* Nav links */}
      <div className="hidden md:flex items-center gap-8">
        {['Platform','Docs'].map((item) => (
          <a
            key={item}
            href="#"
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            {item}
          </a>
        ))}
      </div>

      {/* Auth buttons */}
      <div className="flex items-center gap-3">
        <a href="#" className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2">
          Log In
        </a>
        <Link
          to="/login"
          className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors font-medium"
        >
          Get Started
        </Link>
      </div>
    </nav>
  )
}
