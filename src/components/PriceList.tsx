import { Link } from 'react-router-dom'
import { useServices } from '../hooks/useServices'
import { formatDKK } from '../types/database'
import { Reveal } from './Reveal'

export function PriceList() {
  const { services, loading } = useServices()

  if (loading) {
    return (
      <section className="py-10 px-5 max-w-xl mx-auto">
        <p className="text-center text-sm text-ink-subtle">Henter ydelser…</p>
      </section>
    )
  }

  return (
    <section id="ydelser" className="py-10 px-5 max-w-xl mx-auto">
      <Reveal>
        <p className="text-center text-[0.6875rem] tracking-[0.14em] uppercase text-ink-subtle mb-1">
          Ydelser
        </p>
        <h2 className="text-center font-serif text-display-md text-ink mb-6">
          Priser
        </h2>

        <div>
          {services.map((service) => (
            <Link
              key={service.id}
              to={`/bestil?service=${service.slug}`}
              className="flex items-center justify-between py-3.5 border-b border-border last:border-b-0 group hover:bg-surface/50 transition-colors -mx-3 px-3"
            >
              <div>
                <span className="text-sm text-ink group-hover:text-accent-deep transition-colors">
                  {service.name_da}
                </span>
                <span className="text-xs text-ink-subtle ml-2">
                  {service.duration_minutes} min
                </span>
              </div>
              <span className="text-sm text-ink font-medium">
                {formatDKK(service.price_ore)}
              </span>
            </Link>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link to="/bestil" className="inline-flex items-center justify-center px-10 py-3.5 bg-accent text-white text-[0.8125rem] font-medium tracking-[0.08em] uppercase hover:bg-accent-deep transition-colors">
            Book nu
          </Link>
        </div>
      </Reveal>
    </section>
  )
}
