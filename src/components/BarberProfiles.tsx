import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBarbers } from '../hooks/useBarbers'
import { Reveal } from './Reveal'

export function BarberProfiles() {
  const { barbers, loading } = useBarbers()
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  if (loading) {
    return (
      <section className="py-10 px-5">
        <p className="text-center text-sm text-ink-subtle">Henter frisører…</p>
      </section>
    )
  }

  const selected = barbers.find(b => b.slug === selectedSlug)

  return (
    <section id="om-os" className="py-10 px-5 bg-surface">
      <Reveal>
        <p className="text-center text-[0.6875rem] tracking-[0.14em] uppercase text-ink-subtle mb-1">
          Om os
        </p>
        <h2 className="text-center font-serif text-display-md text-ink mb-6">
          Vores frisører
        </h2>

        {/* Barber portrait grid */}
        <div className="flex justify-center gap-3 md:gap-4 max-w-md mx-auto mb-6">
          {barbers.map((barber) => (
            <button
              key={barber.id}
              onClick={() => setSelectedSlug(selectedSlug === barber.slug ? null : barber.slug)}
              className={`flex flex-col items-center flex-1 max-w-[130px] transition-all duration-200 ${
                selectedSlug === barber.slug ? 'ring-2 ring-accent' : ''
              }`}
            >
              {/* Photo placeholder */}
              <div className="w-full aspect-[3/4] bg-border/30 flex items-center justify-center mb-2">
                {barber.photo_url ? (
                  <img src={barber.photo_url} alt={barber.display_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-ink-subtle">Foto</span>
                )}
              </div>
              <span className="text-sm font-medium text-ink">{barber.display_name}</span>
            </button>
          ))}
        </div>
      </Reveal>

      {/* Expanded bio */}
      {selected && (
        <div className="text-center max-w-sm mx-auto animate-fadeIn">
          <p className="font-serif text-lg text-ink mb-2">{selected.display_name}</p>
          <p className="text-sm text-ink-muted leading-relaxed mb-4">{selected.bio}</p>
          <Link
            to={`/bestil?barber=${selected.slug}`}
            className="inline-flex items-center justify-center px-8 py-2.5 border border-accent text-accent text-xs font-medium tracking-[0.08em] uppercase hover:bg-accent hover:text-white transition-colors"
          >
            Book hos {selected.display_name}
          </Link>
        </div>
      )}
    </section>
  )
}
