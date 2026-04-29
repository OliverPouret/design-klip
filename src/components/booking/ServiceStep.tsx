import { useServices } from '../../hooks/useServices'
import { formatDKK } from '../../types/database'
import type { BookingState } from '../../pages/BookingPage'

export function ServiceStep({
  state,
  onSelect,
}: {
  state: BookingState
  onSelect: (slug: string) => void
}) {
  const { services, loading } = useServices()

  if (loading) {
    return <p className="text-center text-sm text-ink-subtle py-12">Henter ydelser…</p>
  }

  return (
    <div>
      <h2 className="font-serif text-display-md text-ink text-center mb-2">
        Vælg ydelse
      </h2>
      <p className="text-center text-sm text-ink-muted mb-8">
        Hvad skal du have lavet?
      </p>

      <div className="space-y-2">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => onSelect(service.slug)}
            className={`w-full flex items-center justify-between py-4 px-4 border rounded-sm transition-colors text-left ${
              state.serviceSlug === service.slug
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/50 hover:bg-surface'
            }`}
          >
            <div>
              <span className="block text-sm font-medium text-ink">{service.name_da}</span>
              <span className="block text-xs text-ink-subtle mt-0.5">
                {service.duration_minutes} min
                {service.description_da && ` · ${service.description_da}`}
              </span>
            </div>
            <span className="text-sm font-medium text-ink whitespace-nowrap ml-3">
              {formatDKK(service.price_ore)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
