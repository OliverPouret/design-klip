export function HomePage() {
  const services = [
    { name: 'Herreklip', price: '200 kr', duration: '30 min' },
    { name: 'Skæg', price: '100 kr', duration: '15 min' },
    { name: 'Herreklip + skæg', price: '300 kr', duration: '45 min' },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Design Klip"
            className="h-10 md:h-14 w-auto"
          />
        </div>
        <button className="inline-flex items-center justify-center px-7 py-3
          bg-accent text-background font-sans text-label tracking-[0.08em] uppercase
          border border-accent transition-colors duration-200
          hover:bg-accent-deep hover:border-accent-deep
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-glow focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          Bestil tid
        </button>
      </header>

      {/* Hero */}
      <main className="flex flex-col items-center justify-center px-6 pt-24 pb-32 text-center md:pt-32 md:pb-40">
        <span className="font-serif-sc text-eyebrow text-accent-deep mb-6">
          Klassisk barberhåndværk · Roskilde
        </span>
        <h1 className="font-serif text-display-xl text-ink max-w-3xl mb-6">
          Et godt klip. Hver gang.
        </h1>
        <p className="font-sans text-body-lg text-ink-muted max-w-xl mb-10">
          Tre barberer. Tidsbestilling i to minutter. Holbækvej 39, 4000 Roskilde.
        </p>
        <button className="inline-flex items-center justify-center px-10 py-4
          bg-accent text-background font-sans text-label tracking-[0.08em] uppercase
          border border-accent transition-colors duration-200
          hover:bg-accent-deep hover:border-accent-deep
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-glow focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          Bestil tid
        </button>
      </main>

      {/* Divider */}
      <div className="flex items-center justify-center gap-4 my-4">
        <span className="h-px w-16 bg-accent-subtle"></span>
        <span className="font-serif-sc text-eyebrow text-accent">✂</span>
        <span className="h-px w-16 bg-accent-subtle"></span>
      </div>

      {/* Services preview */}
      <section className="px-6 py-20 md:px-12 max-w-5xl mx-auto">
        <span className="block font-serif-sc text-eyebrow text-accent-deep mb-4">Ydelser</span>
        <h2 className="font-serif text-display-lg text-ink mb-12">Hvad kan vi hjælpe med?</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service) => (
            <article key={service.name} className="group flex flex-col bg-surface border border-border hover:border-accent transition-colors duration-300">
              <div className="p-6 flex flex-col gap-3">
                <h3 className="font-serif text-display-sm text-ink">{service.name}</h3>
                <p className="font-sans text-body-sm text-ink-muted">{service.duration}</p>
                <div className="flex items-baseline justify-between pt-3 border-t border-accent-subtle">
                  <span className="font-serif text-display-sm text-ink">{service.price}</span>
                  <span className="font-sans text-body-sm uppercase tracking-[0.12em] text-accent-deep">
                    Bestil →
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-12 md:px-12">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:justify-between gap-8">
          <div>
            <span className="font-serif text-display-sm text-ink">Design Klip</span>
            <p className="font-sans text-body-sm text-ink-muted mt-2">
              Holbækvej 39, 4000 Roskilde
            </p>
            <p className="font-sans text-body-sm text-ink-muted">
              Tlf: +45 46 35 93 48
            </p>
          </div>
          <div>
            <span className="font-serif-sc text-eyebrow text-accent-deep mb-3 block">Åbningstider</span>
            <div className="font-sans text-body-sm text-ink-muted space-y-1">
              <p>Man–Fre: 09:00–17:00</p>
              <p>Lørdag: 09:00–14:00</p>
              <p>Søndag: Lukket</p>
            </div>
          </div>
        </div>
        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-accent-subtle">
          <p className="font-sans text-body-sm text-ink-subtle">
            © Design Klip 2026 · Hjemmeside af Pouret Digital
          </p>
        </div>
      </footer>
    </div>
  )
}
