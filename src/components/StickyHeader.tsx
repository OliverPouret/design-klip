import { Link } from 'react-router-dom'

const ICON_PHONE = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

export function StickyHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border px-5 py-3">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 justify-self-start">
          <img src="/logo.png" alt="Design Klip" className="h-8 w-auto" />
        </Link>

        {/* Centered nav (desktop only) */}
        <nav className="hidden lg:flex items-center justify-center gap-8">
          <a href="/#ydelser" className="text-sm text-ink-muted hover:text-ink transition-colors">Ydelser</a>
          <a href="/#om-os" className="text-sm text-ink-muted hover:text-ink transition-colors">Om os</a>
          <a href="/#kontakt" className="text-sm text-ink-muted hover:text-ink transition-colors">Kontakt</a>
        </nav>

        {/* Spacer for mobile to keep grid balanced */}
        <span className="lg:hidden" aria-hidden="true" />

        {/* Right-side actions */}
        <div className="flex items-center justify-end gap-3 justify-self-end">
          <a
            href="tel:+4546359348"
            aria-label="Ring til Design Klip på +45 46 35 93 48"
            className="inline-flex items-center gap-2 rounded-full border border-accent text-accent hover:bg-accent-subtle transition-colors px-3 md:px-4 py-2 text-sm font-semibold"
          >
            {ICON_PHONE}
            <span className="hidden md:inline">Ring til os</span>
          </a>
          <Link
            to="/bestil"
            className="inline-flex items-center justify-center px-5 py-2 bg-accent text-white text-xs font-medium tracking-[0.08em] uppercase hover:bg-accent-deep transition-colors"
          >
            Book nu
          </Link>
        </div>
      </div>
    </header>
  )
}
