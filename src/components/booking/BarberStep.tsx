import { useBarbers } from '../../hooks/useBarbers'
import type { BookingState } from '../../pages/BookingPage'

export function BarberStep({
  state,
  onSelect,
}: {
  state: BookingState
  onSelect: (slug: string | null, anyBarber: boolean) => void
}) {
  const { barbers, loading } = useBarbers()

  if (loading) {
    return <p className="text-center text-sm text-ink-subtle py-12">Henter frisører…</p>
  }

  return (
    <div>
      <h2 className="font-serif text-display-md text-ink text-center mb-2">
        Vælg frisør
      </h2>
      <p className="text-center text-sm text-ink-muted mb-8">
        Hvem skal klippe dig?
      </p>

      <div className="space-y-2">
        {/* "Første ledige" option — first card */}
        <button
          onClick={() => onSelect(null, true)}
          className={`w-full flex items-center gap-4 py-4 px-4 border rounded-sm transition-colors text-left ${
            state.anyBarber
              ? 'border-accent bg-accent/5'
              : 'border-border hover:border-accent/50 hover:bg-surface'
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <span className="block text-sm font-medium text-ink">Første ledige frisør</span>
            <span className="block text-xs text-ink-subtle mt-0.5">
              Få den tidligst mulige tid
            </span>
          </div>
        </button>

        {/* Individual barbers */}
        {barbers.map((barber) => (
          <button
            key={barber.id}
            onClick={() => onSelect(barber.slug, false)}
            className={`w-full flex items-center gap-4 py-4 px-4 border rounded-sm transition-colors text-left ${
              state.barberSlug === barber.slug && !state.anyBarber
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/50 hover:bg-surface'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-border/50 flex-shrink-0 overflow-hidden">
              {barber.photo_url && (
                <img src={barber.photo_url} alt={barber.display_name} className="w-full h-full object-cover" />
              )}
            </div>
            <div>
              <span className="block text-sm font-medium text-ink">{barber.display_name}</span>
              {barber.bio && (
                <span className="block text-xs text-ink-subtle mt-0.5">{barber.bio}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
