import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { formatDateLong, formatTime } from '../../lib/danishDates'

interface Customer {
  id: string
  full_name: string
  phone_e164: string
  email: string | null
  total_bookings: number
  last_booking_at: string | null
  marketing_opt_in: boolean
  notes_summary: string | null
  created_at: string
}

interface BookingHistory {
  id: string
  starts_at: string
  status: string
  source: string
  customer_notes: string | null
  service: { name_da: string }
  barber: { display_name: string }
}

interface CustNote {
  id: string
  body: string
  author_id: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Bekræftet',
  pending: 'Afventer',
  completed: 'Fuldført',
  no_show: 'Udeblevet',
  cancelled: 'Afbestilt',
}

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const { user } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [bookings, setBookings] = useState<BookingHistory[]>([])
  const [notes, setNotes] = useState<CustNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (!customerId) return
    const fetchAll = async () => {
      const { data: cust } = await supabase
        .from('customers')
        .select('id, full_name, phone_e164, email, total_bookings, last_booking_at, marketing_opt_in, notes_summary, created_at')
        .eq('id', customerId)
        .single()
      if (cust) setCustomer(cust as Customer)

      const { data: bk } = await supabase
        .from('bookings')
        .select(`
          id, starts_at, status, source, customer_notes,
          service:services!inner(name_da),
          barber:barbers!inner(display_name)
        `)
        .eq('customer_id', customerId)
        .order('starts_at', { ascending: false })
        .limit(50)
      if (bk) setBookings(bk as unknown as BookingHistory[])

      const { data: cn } = await supabase
        .from('customer_notes')
        .select('id, body, author_id, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
      if (cn) setNotes(cn as CustNote[])

      setLoading(false)
    }
    fetchAll()
  }, [customerId])

  const handleAddNote = async () => {
    if (!customerId || !newNote.trim() || !user) return
    const { data } = await supabase
      .from('customer_notes')
      .insert({
        customer_id: customerId,
        author_id: user.id,
        body: newNote.trim(),
        tags: [],
      })
      .select()
      .single()
    if (data) {
      setNotes([data as CustNote, ...notes])
      setNewNote('')

      // Auto-regenerate AI profile (fire-and-forget)
      fetch('/api/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      }).catch(() => {})
    }
  }

  const handleRegenerateProfile = async () => {
    if (!customerId) return
    setRegenerating(true)
    try {
      const res = await fetch('/api/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      })
      const data = (await res.json()) as { summary?: string }
      if (data.summary && customer) {
        setCustomer({ ...customer, notes_summary: data.summary })
      }
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) return <p className="text-sm text-ink-subtle">Henter kundeprofil…</p>
  if (!customer) return <p className="text-sm text-ink-muted">Kunde ikke fundet.</p>

  // "Usual" service — most frequent
  const serviceCounts: Record<string, number> = {}
  bookings
    .filter((b) => b.status !== 'cancelled')
    .forEach((b) => {
      const name = b.service.name_da
      serviceCounts[name] = (serviceCounts[name] || 0) + 1
    })
  const sortedServices = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])
  const usualService = sortedServices[0]?.[0] || null

  const lastVisit = bookings.find((b) => b.status === 'completed' || b.status === 'confirmed')

  return (
    <div>
      <Link to="/admin/kunder" className="text-xs text-ink-subtle hover:text-ink mb-4 block">
        ← Alle kunder
      </Link>

      {/* Profile header */}
      <div className="bg-white border border-border rounded-sm p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-xl text-ink">{customer.full_name}</h1>
            <p className="text-sm text-ink-muted mt-1">
              <a href={`tel:${customer.phone_e164}`} className="text-accent-deep">
                {customer.phone_e164}
              </a>
              {customer.email && ` · ${customer.email}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-serif text-ink">{customer.total_bookings}</p>
            <p className="text-xs text-ink-subtle">besøg</p>
          </div>
        </div>

        {/* AI Profile Summary */}
        {customer.notes_summary ? (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs tracking-[0.08em] uppercase text-ink-subtle">AI-profil</p>
              <button
                onClick={handleRegenerateProfile}
                disabled={regenerating}
                className="text-[0.625rem] text-accent-deep hover:text-ink transition-colors"
              >
                {regenerating ? 'Opdaterer…' : '↻ Opdatér'}
              </button>
            </div>
            <div className="text-sm text-ink leading-relaxed whitespace-pre-line">
              {customer.notes_summary}
            </div>
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={handleRegenerateProfile}
              disabled={regenerating}
              className="text-sm text-accent-deep hover:text-ink transition-colors"
            >
              {regenerating ? 'Genererer profil…' : '✨ Generér AI-profil'}
            </button>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
          {usualService && (
            <div>
              <p className="text-xs text-ink-subtle">Får som regel</p>
              <p className="text-sm text-ink font-medium">{usualService}</p>
            </div>
          )}
          {lastVisit && (
            <div>
              <p className="text-xs text-ink-subtle">Sidst her</p>
              <p className="text-sm text-ink font-medium">{formatDateLong(new Date(lastVisit.starts_at))}</p>
              <p className="text-xs text-ink-muted">
                {lastVisit.service.name_da} hos {lastVisit.barber.display_name}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-ink-subtle">Kunde siden</p>
            <p className="text-sm text-ink font-medium">
              {new Date(customer.created_at).toLocaleDateString('da-DK', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          {sortedServices.length > 1 && (
            <div>
              <p className="text-xs text-ink-subtle">Alle ydelser</p>
              <p className="text-sm text-ink">
                {sortedServices.map(([name, count]) => `${name} (×${count})`).join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white border border-border rounded-sm p-6 mb-4">
        <h2 className="text-sm font-medium text-ink mb-3">Kundenoter</h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Skriv en note om denne kunde…"
            className="flex-1 border border-border rounded-sm px-3 py-2 text-sm outline-none focus:border-accent"
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
          />
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim()}
            className="px-4 py-2 bg-accent text-white text-xs font-medium uppercase hover:bg-accent-deep transition-colors disabled:opacity-40"
          >
            Tilføj
          </button>
        </div>

        {notes.length === 0 ? (
          <p className="text-xs text-ink-subtle">Ingen noter endnu.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="border-b border-border pb-2 last:border-0">
                <p className="text-sm text-ink">{note.body}</p>
                <p className="text-[0.625rem] text-ink-subtle mt-0.5">
                  {new Date(note.created_at).toLocaleDateString('da-DK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Booking history */}
      <div className="bg-white border border-border rounded-sm p-6">
        <h2 className="text-sm font-medium text-ink mb-3">Historik ({bookings.length} bookinger)</h2>

        {bookings.length === 0 ? (
          <p className="text-xs text-ink-subtle">Ingen bookinger endnu.</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((bk) => (
              <Link
                key={bk.id}
                to={`/admin/booking/${bk.id}`}
                className="block border-b border-border pb-2 last:border-0 hover:bg-surface/50 -mx-2 px-2 py-1 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ink">
                      {bk.service.name_da} hos {bk.barber.display_name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatDateLong(new Date(bk.starts_at))} {formatTime(new Date(bk.starts_at))}
                      {bk.source === 'phone' && ' · 📞'}
                    </p>
                  </div>
                  <span className="text-[0.625rem] text-ink-subtle">{STATUS_LABEL[bk.status] ?? bk.status}</span>
                </div>
                {bk.customer_notes && (
                  <p className="text-xs text-ink-subtle italic mt-0.5">"{bk.customer_notes}"</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
