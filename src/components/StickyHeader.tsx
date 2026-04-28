import { Link } from 'react-router-dom'

export function StickyHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border px-5 py-3 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <img src="/logo.png" alt="Design Klip" className="h-8 w-auto" />
      </Link>

      {/* Desktop nav links */}
      <nav className="hidden lg:flex items-center gap-8">
        <a href="/#ydelser" className="text-sm text-ink-muted hover:text-ink transition-colors">Ydelser</a>
        <a href="/#om-os" className="text-sm text-ink-muted hover:text-ink transition-colors">Om os</a>
        <a href="/#kontakt" className="text-sm text-ink-muted hover:text-ink transition-colors">Kontakt</a>
      </nav>

      <Link to="/bestil" className="inline-flex items-center justify-center px-5 py-2 bg-accent text-white text-xs font-medium tracking-[0.08em] uppercase hover:bg-accent-deep transition-colors">
        Book nu
      </Link>
    </header>
  )
}
