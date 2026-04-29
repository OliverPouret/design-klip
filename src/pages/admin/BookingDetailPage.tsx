import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { formatDateLong, formatTime } from '../../lib/danishDates'
import { formatDKK } from '../../types/database'

interface BookingDetail {
  id: string
  short_code: string
  starts_at: string
  ends_at: string
  duration_minutes: number
  price_ore: number
  status: string
  source: string
  customer_notes: string | null
  cancel_token: string
  customer: { id: string; full_name: string; phone_e164: string; total_bookings: number }
  barber: { display_name: string }
  service: { name_da: string }
}

interface CustNote {
  id: string
  body: string
  tags: string[]
  author_id: string | null
  created_at: string
}

export function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [custNotes, setCustNotes] = useState<CustNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [cutDetails, setCutDetails] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!bookingId) return
    const fetchData = async () => {
      const { data } = await supabase
        .from('bookings')
        .select(`
          id, short_code, starts_at, ends_at, duration_minutes, price_ore, status, source, customer_notes, cancel_token,
          customer:customers!inner(id, full_name, phone_e164, total_bookings),
          barber:barbers!inner(display_name),
          service:services!inner(name_da)
        `)
        .eq('id', bookingId)
        .single()

      if (data) {
        const b = data as unknown as BookingDetail
        setBooking(b)

        const { data: notes } = await supabase
          .from('customer_notes')
          .select('id, body, tags, author_id, created_at')
          .eq('customer_id', b.customer.id)
          .order('created_at', { ascending: false })

        setCustNotes((notes as CustNote[] | null) ?? [])
      }
      setLoading(false)
    }
    fetchData()
  }, [bookingId])

  const handleComplete = async () => {
    if (!booking) return
    setActionLoading(true)

    if (cutDetails.trim() && user) {
      await supabase.from('customer_notes').insert({
        customer_id: booking.customer.id,
        author_id: user.id,
        body: `Klip: ${cutDetails.trim()}`,
        tags: ['klip'],
      })
    }
    await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', booking.id)

    // Auto-regenerate AI profile (fire-and-forget)
    fetch('/api/generate-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: booking.customer.id }),
    }).catch(() => {})

    setBooking({ ...booking, status: 'completed' })
    setActionLoading(false)
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!booking) return
    setActionLoading(true)
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'cancelled') {
      updates.cancelled_at = new Date().toISOString()
      updates.cancelled_by = 'admin'
    }
    await supabase.from('bookings').update(updates).eq('id', booking.id)
    setBooking({ ...booking, status: newStatus })
    setActionLoading(false)
  }

  const handleAddNote = async () => {
    if (!booking || !newNote.trim() || !user) return
    const { data } = await supabase
      .from('customer_notes')
      .insert({
        customer_id: booking.customer.id,
        author_id: user.id,
        body: newNote.trim(),
        tags: [],
      })
      .select()
      .single()

    if (data) {
      setCustNotes([data as CustNote, ...custNotes])
      setNewNote('')

      // Auto-regenerate AI profile (fire-and-forget)
      fetch('/api/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: booking.customer.id }),
      }).catch(() => {})
    }
  }

  if (loading) return <p className="text-sm text-ink-subtle">Henter booking…</p>
  if (!booking) return <p className="text-sm text-ink-muted">Booking ikke fundet.</p>

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="text-xs text-ink-subtle hover:text-ink mb-4"
      >
        ← Tilbage
      </button>

      <div className="bg-white border border-border rounded-sm p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <h1 className="font-serif text-lg text-ink">Booking #{booking.short_code}</h1>
          <span className="text-xs px-2 py-1 rounded-full bg-surface text-ink-muted font-medium">
            {booking.source === 'phone' ? '📞 Telefon' : '🌐 Web'}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <Row label="Kunde" value={booking.customer.full_name} />
          <div className="flex justify-between">
            <span className="text-ink-muted">Telefon</span>
            <a href={`tel:${booking.customer.phone_e164}`} className="text-accent-deep">
              {booking.customer.phone_e164}
            </a>
          </div>
          <Row label="Ydelse" value={booking.service.name_da} />
          <Row label="Pris" value={formatDKK(booking.price_ore)} />
          <Row label="Frisør" value={booking.barber.display_name} />
          <Row label="Dato" value={formatDateLong(new Date(booking.starts_at))} />
          <Row label="Tid" value={formatTime(new Date(booking.starts_at))} />
          {booking.customer_notes && (
            <div className="flex justify-between">
              <span className="text-ink-muted">Kundens besked</span>
              <span className="text-ink italic text-right max-w-[60%]">"{booking.customer_notes}"</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {booking.status === 'confirmed' && (
        <div className="bg-white border border-border rounded-sm p-6 mb-4">
          <div className="mb-4">
            <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-1.5">
              Hvad blev lavet?{' '}
              <span className="text-ink-subtle font-normal normal-case">(udfyldes ved fuldførelse)</span>
            </label>
            <input
              type="text"
              value={cutDetails}
              onChange={(e) => setCutDetails(e.target.value)}
              placeholder="f.eks. fade 2, lang top, skæg trimmet kort"
              className="w-full border border-border rounded-sm px-3 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleComplete}
              disabled={actionLoading}
              className="flex-1 py-3 bg-accent text-white text-xs font-medium uppercase tracking-[0.08em] hover:bg-accent-deep transition-colors disabled:opacity-60"
            >
              Markér som fuldført
            </button>
            <button
              onClick={() => handleStatusChange('no_show')}
              disabled={actionLoading}
              className="flex-1 py-3 bg-red-500 text-white text-xs font-medium uppercase tracking-[0.08em] hover:bg-red-600 transition-colors disabled:opacity-60"
            >
              Udeblevet
            </button>
            <button
              onClick={() => handleStatusChange('cancelled')}
              disabled={actionLoading}
              className="flex-1 py-3 border border-border text-ink-muted text-xs font-medium uppercase tracking-[0.08em] hover:bg-surface transition-colors disabled:opacity-60"
            >
              Afbestil
            </button>
          </div>
        </div>
      )}

      {/* Customer notes */}
      <div className="bg-white border border-border rounded-sm p-6">
        <h2 className="text-sm font-medium text-ink mb-4">
          Kundenoter — {booking.customer.full_name}
          <span className="text-ink-subtle font-normal ml-1">
            ({booking.customer.total_bookings} besøg)
          </span>
        </h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Skriv en note om denne kunde…"
            className="flex-1 border border-border rounded-sm px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
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

        {custNotes.length === 0 ? (
          <p className="text-xs text-ink-subtle">Ingen noter endnu.</p>
        ) : (
          <div className="space-y-2">
            {custNotes.map((note) => (
              <div key={note.id} className="border-b border-border pb-2 last:border-0">
                <p className="text-sm text-ink">{note.body}</p>
                <p className="text-[0.625rem] text-ink-subtle mt-0.5">
                  {new Date(note.created_at).toLocaleDateString('da-DK')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  )
}
