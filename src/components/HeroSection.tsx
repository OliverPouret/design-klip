import { Link } from 'react-router-dom'

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6">
      {/* Content */}
      <div className="relative z-[2] flex flex-col items-center">
        <img src="/logo.png" alt="Design Klip" className="h-20 md:h-28 w-auto mb-4" />
        <h1 className="font-serif text-[2rem] md:text-[3.5rem] font-medium tracking-[0.06em] text-ink leading-tight mb-2">
          DESIGN KLIP
        </h1>
        <p className="font-sans text-sm md:text-base text-ink-muted mb-8">
          Frisør i Roskilde
        </p>
        <Link to="/bestil" className="inline-flex items-center justify-center px-10 py-4 bg-accent text-white text-sm font-medium tracking-[0.1em] uppercase hover:bg-accent-deep transition-colors">
          Book nu
        </Link>
        <a
          href="tel:+4546359348"
          className="inline-flex items-center justify-center gap-2 mt-3 px-8 py-3 bg-white/60 backdrop-blur-sm text-ink text-xs font-medium tracking-[0.08em] uppercase border border-ink/15 hover:bg-white hover:border-ink/40 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
          </svg>
          Ring til os
        </a>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 z-[2] animate-bounce">
        <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
          <path d="M1 1L10 10L19 1" stroke="currentColor" strokeWidth="1.5" className="text-ink-muted" />
        </svg>
      </div>
    </section>
  )
}
