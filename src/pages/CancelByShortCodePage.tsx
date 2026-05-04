import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDateLong, formatTime } from '../lib/danishDates'

type CancelState = 'loading' | 'idle' | 'cancelling' | 'done' | 'not_found' | 'error'

interface BookingDisplay {
  starts_at: string
  status: string
  service_name: string
  barber_name: string
}

export function CancelByShortCodePage() {
  const { shortCode } = useParams<{ shortCode: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<CancelState>('loading')
  const [booking, setBooking] = useState<BookingDisplay | null>(null)

  useEffect(() => {
    if (!shortCode) {
      setState('not_found')
      return
    }
    let cancelled = false
    supabase
      .rpc('get_booking_by_short_code', { p_code: shortCode })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState('error')
          return
        }
        const row = (Array.isArray(data) ? data[0] : data) as BookingDisplay | undefined
        if (!row) {
          setState('not_found')
          return
        }
        setBooking(row)
        setState(row.status === 'cancelled' ? 'not_found' : 'idle')
      })
    return () => {
      cancelled = true
    }
  }, [shortCode])

  const handleCancel = async () => {
    if (!shortCode) return
    setState('cancelling')
    const { data, error } = await supabase.rpc('cancel_booking_by_short_code', {
      p_code: shortCode,
    })
    if (error) {
      setState('error')
      return
    }
    const ok = Array.isArray(data) ? data[0]?.ok : data?.ok
    setState(ok ? 'done' : 'not_found')
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white/95 backdrop-blur-sm border-b border-border px-5 py-3 flex items-center fixed top-0 left-0 right-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Design Klip" className="h-8 w-auto" />
        </Link>
      </header>

      <div className="pt-24 pb-12 px-4 md:px-6">
        <div className="max-w-md mx-auto bg-white shadow-xl border border-border/50">
          <div className="px-6 py-10 text-center">
            {state === 'loading' && (
              <p className="text-sm text-ink-subtle">Henter din booking…</p>
            )}

            {state === 'idle' && booking && (
              <>
                <h1 className="font-serif text-2xl text-ink mb-2">
                  Vil du afbestille din tid hos Design Klip?
                </h1>
                <p className="text-sm text-ink-muted mb-6">
                  Afbestillingen kan ikke fortrydes.
                </p>

                <div className="bg-surface border border-border rounded-sm divide-y divide-border text-left mb-8">
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-ink-muted">Ydelse</span>
                    <span className="text-sm text-ink font-medium">{booking.service_name}</span>
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

                <button
                  onClick={handleCancel}
                  className="w-full py-4 bg-ink text-white text-sm font-medium tracking-[0.08em] uppercase hover:bg-ink/90 transition-colors mb-4"
                >
                  Ja, afbestil
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="block w-full text-sm text-ink-muted hover:text-ink transition-colors"
                >
                  Nej, behold tiden
                </button>
              </>
            )}

            {state === 'cancelling' && (
              <p className="text-sm text-ink-subtle">Afbestiller din tid…</p>
            )}

            {state === 'done' && (
              <>
                <h2 className="font-serif text-xl text-ink mb-2">Din tid er afbestilt</h2>
                <p className="text-sm text-ink-muted mb-8">Vi ses næste gang.</p>
                <Link
                  to="/bestil"
                  className="block w-full py-3.5 text-center bg-accent text-white text-xs font-medium tracking-[0.08em] uppercase hover:bg-accent-deep transition-colors mb-3"
                >
                  Book en ny tid
                </Link>
                <Link to="/" className="block text-sm text-ink-muted hover:text-ink transition-colors">
                  Tilbage til forsiden
                </Link>
              </>
            )}

            {state === 'not_found' && (
              <>
                <h2 className="font-serif text-xl text-ink mb-2">Vi kunne ikke finde din booking</h2>
                <p className="text-sm text-ink-muted mb-8">
                  Måske er den allerede afbestilt? Ring til os på{' '}
                  <a href="tel:+4546359348" className="text-accent-deep underline">
                    +45 46 35 93 48
                  </a>{' '}
                  hvis noget er galt.
                </p>
                <Link to="/" className="text-sm text-accent-deep underline">
                  Tilbage til forsiden
                </Link>
              </>
            )}

            {state === 'error' && (
              <>
                <h2 className="font-serif text-xl text-ink mb-2">Noget gik galt</h2>
                <p className="text-sm text-ink-muted mb-8">
                  Vi kunne ikke afbestille din tid. Ring til os på{' '}
                  <a href="tel:+4546359348" className="text-accent-deep underline">
                    +45 46 35 93 48
                  </a>
                  .
                </p>
                <Link to="/" className="text-sm text-accent-deep underline">
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
