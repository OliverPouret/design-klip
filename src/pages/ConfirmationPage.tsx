import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateLong, formatTime } from '../lib/danishDates'
import { formatDKK } from '../types/database'

interface BookingSummary {
  short_code: string
  service_name_da: string
  barber_name: string
  starts_at: string
  duration_minutes: number
  price_ore: number
  cancel_token: string
  status: string
}

export function ConfirmationPage() {
  const { shortCode } = useParams<{ shortCode: string }>()
  const [booking, setBooking] = useState<BookingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!shortCode) return
    supabase
      .rpc('get_booking_summary', { p_short_code: shortCode })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setBooking(data[0])
        } else {
          setNotFound(true)
        }
        setLoading(false)
      })
  }, [shortCode])

  return (
    <div className="min-h-screen">
      <header className="bg-white/95 backdrop-blur-sm border-b border-border px-5 py-3 flex items-center justify-between fixed top-0 left-0 right-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Design Klip" className="h-8 w-auto" />
        </Link>
      </header>

      <div className="pt-24 pb-12 px-4 md:px-6">
        <div className="max-w-md mx-auto bg-white shadow-xl border border-border/50">
          <div className="px-6 py-10">
            {loading && (
              <p className="text-center text-sm text-ink-subtle">Henter din booking…</p>
            )}

            {notFound && (
              <div className="text-center">
                <p className="font-serif text-xl text-ink mb-2">Booking ikke fundet</p>
                <p className="text-sm text-ink-muted mb-6">
                  Vi kunne ikke finde denne booking. Den er muligvis afbestilt.
                </p>
                <Link to="/" className="text-sm text-accent-deep underline">
                  Tilbage til forsiden
                </Link>
              </div>
            )}

            {booking && (
              <>
                {/* Success icon */}
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>

                <h1 className="font-serif text-2xl text-ink text-center mb-1">
                  Din tid er bekræftet
                </h1>
                <p className="text-center text-sm text-ink-muted mb-8">
                  Du modtager snart en SMS-bekræftelse
                </p>

                {/* Booking details */}
                <div className="border border-border rounded-sm divide-y divide-border mb-8">
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-ink-muted">Ydelse</span>
                    <span className="text-sm text-ink font-medium">{booking.service_name_da}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-ink-muted">Pris</span>
                    <span className="text-sm text-ink font-medium">{formatDKK(booking.price_ore)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-ink-muted">Frisør</span>
                    <span className="text-sm text-ink font-medium">{booking.barber_name}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-ink-muted">Dato</span>
                    <span className="text-sm text-ink font-medium">
                      {formatDateLong(new Date(booking.starts_at))}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-ink-muted">Tidspunkt</span>
                    <span className="text-sm text-ink font-medium">
                      {formatTime(new Date(booking.starts_at))}
                    </span>
                  </div>
                </div>

                <div className="text-center mb-6">
                  <p className="text-xs text-ink-subtle mb-3">
                    Kan du ikke alligevel? Afbestil gratis her:
                  </p>
                  <Link
                    to={`/afbestil/${booking.cancel_token}`}
                    className="inline-block text-xs text-accent-deep underline underline-offset-4"
                  >
                    Afbestil denne tid
                  </Link>
                </div>

                <Link
                  to="/"
                  className="block w-full py-3.5 text-center border border-accent text-accent text-xs font-medium tracking-[0.08em] uppercase hover:bg-accent hover:text-white transition-colors"
                >
                  Tilbage til forsiden
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
