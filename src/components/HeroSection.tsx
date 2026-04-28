export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6">
      {/* Background image */}
      <picture className="absolute inset-0 z-0">
        <source media="(min-width: 768px)" srcSet="/hero-desktop.jpg" />
        <img
          src="/hero-mobile.jpg"
          alt=""
          className="w-full h-full object-cover"
          loading="eager"
        />
      </picture>

      {/* Overlay for text readability */}
      <div className="absolute inset-0 z-[1] bg-white/30" />

      {/* Content */}
      <div className="relative z-[2] flex flex-col items-center">
        <img src="/logo.png" alt="Design Klip" className="h-20 md:h-28 w-auto mb-4" />
        <h1 className="font-serif text-[2rem] md:text-[3.5rem] font-medium tracking-[0.06em] text-ink leading-tight mb-2">
          DESIGN KLIP
        </h1>
        <p className="font-sans text-sm md:text-base text-ink-muted mb-8">
          Barbershop i Roskilde
        </p>
        <a href="/bestil" className="inline-flex items-center justify-center px-10 py-4 bg-accent text-white text-sm font-medium tracking-[0.1em] uppercase hover:bg-accent-deep transition-colors">
          Book nu
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
