import { useSettings } from '../hooks/useSettings'
import { Reveal } from './Reveal'

export function ContactStrip() {
  const { settings } = useSettings()
  const address = settings.shop_address as { street?: string; city?: string; zip?: string } | undefined
  const phone = settings.shop_phone as string | undefined
  const hours = settings.opening_hours_display as Record<string, string> | undefined

  const fullAddress = address ? `${address.street}, ${address.zip} ${address.city}` : ''
  const mapsQuery = encodeURIComponent(fullAddress || 'Holbækvej 39, 4000 Roskilde')
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`

  const hoursLine = hours
    ? `Man–fre ${hours.mon?.split('–')[0]}–${hours.fri?.split('–')[1]} · Lør ${hours.sat} · Søn ${hours.sun}`
    : ''

  return (
    <section id="kontakt" className="border-t border-border">
      {/* Address + hours summary */}
      <Reveal>
        <div className="py-8 px-5 text-center">
          {address && (
            <p className="text-sm text-ink font-medium mb-1">
              {fullAddress}
            </p>
          )}
          {phone && (
            <p className="text-sm text-ink-muted mb-1">
              <a href={`tel:${phone}`} className="hover:text-accent-deep transition-colors">
                {phone.replace('+45', '+45 ')}
              </a>
            </p>
          )}
          {hoursLine && (
            <p className="text-xs text-ink-subtle">{hoursLine}</p>
          )}
        </div>
      </Reveal>

      {/* Embedded map */}
      <div className="relative w-full h-[280px] md:h-[360px] bg-surface">
        <iframe
          title="Design Klip placering på kort"
          src={`https://maps.google.com/maps?q=${mapsQuery}&output=embed&z=15`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0"
        />
      </div>

      {/* Get directions CTA */}
      <div className="py-6 px-5 text-center">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-7 py-3 border border-accent text-accent text-[0.8125rem] font-medium tracking-[0.08em] uppercase hover:bg-accent hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.71 11.29l-9-9a1 1 0 0 0-1.42 0l-9 9a1 1 0 0 0 0 1.42l9 9a1 1 0 0 0 1.42 0l9-9a1 1 0 0 0 0-1.42zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5L17.5 11z" fill="currentColor" />
          </svg>
          Få rute
        </a>
      </div>
    </section>
  )
}
