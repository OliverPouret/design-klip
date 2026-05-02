import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type CancelState = 'idle' | 'cancelling' | 'done' | 'error'

export function CancelPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<CancelState>('idle')

  const handleCancel = async () => {
    if (!token) return
    setState('cancelling')
    const { data, error } = await supabase.rpc('cancel_booking_by_token', {
      p_token: token,
    })
    if (error) {
      setState('error')
      return
    }
    const ok = Array.isArray(data) ? data[0]?.ok : data?.ok
    setState(ok ? 'done' : 'error')
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
            {state === 'idle' && (
              <>
                <h1 className="font-serif text-2xl text-ink mb-2">Afbestil din tid</h1>
                <p className="text-sm text-ink-muted mb-8">
                  Er du sikker? Afbestillingen kan ikke fortrydes.
                </p>
                <button
                  onClick={handleCancel}
                  className="w-full py-4 bg-ink text-white text-sm font-medium tracking-[0.08em] uppercase hover:bg-ink/90 transition-colors mb-4"
                >
                  Ja, afbestil min tid
                </button>
                <Link to="/" className="block text-sm text-ink-muted hover:text-ink transition-colors">
                  Nej, behold min tid
                </Link>
              </>
            )}

            {state === 'cancelling' && (
              <p className="text-sm text-ink-subtle">Afbestiller din tid…</p>
            )}

            {state === 'done' && (
              <>
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-border/50 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-muted">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                </div>
                <h2 className="font-serif text-xl text-ink mb-2">Tid afbestilt</h2>
                <p className="text-sm text-ink-muted mb-8">
                  Din tid er afbestilt. Du er altid velkommen igen.
                </p>
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

            {state === 'error' && (
              <>
                <h2 className="font-serif text-xl text-ink mb-2">Noget gik galt</h2>
                <p className="text-sm text-ink-muted mb-8">
                  Vi kunne ikke afbestille din tid. Måske er den allerede afbestilt, eller linket er udløbet. Ring til os på{' '}
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
