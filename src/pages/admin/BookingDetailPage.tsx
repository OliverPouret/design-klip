import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { formatDateLong, formatTime } from '../../lib/danishDates'
import { formatDKK } from '../../types/database'
import { Card } from '../../components/admin/Card'
import { StatusBadge } from '../../components/admin/StatusBadge'

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
        booking_id: booking.id,
      })
    }
    await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', booking.id)

    // V2-PARKED: AI customer profile auto-generation
    // Reactivate by uncommenting and importing the relevant flow.
    // supabase.functions
    //   .invoke('generate-customer-profile', { body: { customer_id: booking.customer.id } })
    //   .catch(console.error)

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

      // V2-PARKED: AI customer profile auto-generation
      // Reactivate by uncommenting and importing the relevant flow.
      // supabase.functions
      //   .invoke('generate-customer-profile', { body: { customer_id: booking.customer.id } })
      //   .catch(console.error)
    }
  }

  if (loading) return <p className="text-sm text-[#8A8A8A]">Henter booking…</p>
  if (!booking) return <p className="text-sm text-[#5F5E5A]">Booking ikke fundet.</p>

  return (
    <div className="max-w-3xl md:h-full md:flex md:flex-col md:min-h-0 md:overflow-y-auto md:pr-1 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="text-[12px] text-[#5F5E5A] hover:text-ink transition-colors flex-shrink-0 self-start"
      >
        ← Tilbage
      </button>

      <Card>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-[20px] font-semibold text-ink">Booking #{booking.short_code}</h1>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={booking.status} />
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#8A8A8A]">
                {booking.source === 'phone' ? '📞 Telefon' : '🌐 Web'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 text-sm">
          <Row label="Kunde" value={booking.customer.full_name} />
          <div className="flex justify-between">
            <span className="text-[#8A8A8A]">Telefon</span>
            <a href={`tel:${booking.customer.phone_e164}`} className="text-[#B08A3E] hover:text-[#8C6A28]">
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
              <span className="text-[#8A8A8A]">Kundens besked</span>
              <span className="text-ink italic text-right max-w-[60%]">"{booking.customer_notes}"</span>
            </div>
          )}
        </div>
      </Card>

      {/* Actions */}
      {booking.status === 'confirmed' && (
        <Card>
          <div className="mb-5">
            <label className="block text-[11px] tracking-[0.08em] uppercase text-[#8A8A8A] font-medium mb-2">
              Hvad blev lavet?{' '}
              <span className="text-[#8A8A8A] font-normal normal-case">(udfyldes ved fuldførelse)</span>
            </label>
            <input
              type="text"
              value={cutDetails}
              onChange={(e) => setCutDetails(e.target.value)}
              placeholder="f.eks. fade 2, lang top, skæg trimmet kort"
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleComplete}
              disabled={actionLoading}
              className="flex-1 py-3 bg-[#B08A3E] text-white text-[13px] font-medium tracking-[0.04em] rounded-lg hover:bg-[#8C6A28] transition-colors disabled:opacity-60"
            >
              Markér som fuldført
            </button>
            <button
              onClick={() => handleStatusChange('no_show')}
              disabled={actionLoading}
              className="flex-1 py-3 bg-[#DC3545] text-white text-[13px] font-medium tracking-[0.04em] rounded-lg hover:bg-[#B82C3A] transition-colors disabled:opacity-60"
            >
              Udeblevet
            </button>
            <button
              onClick={() => handleStatusChange('cancelled')}
              disabled={actionLoading}
              className="flex-1 py-3 bg-white border border-gray-200 text-[#5F5E5A] text-[13px] font-medium tracking-[0.04em] rounded-lg hover:bg-[#F6F6F3] transition-colors disabled:opacity-60"
            >
              Afbestil
            </button>
          </div>
        </Card>
      )}

      {/* Customer notes */}
      <Card>
        <h2 className="text-[13px] font-medium text-ink mb-4">
          Kundenoter — {booking.customer.full_name}
          <span className="text-[#8A8A8A] font-normal ml-1">
            ({booking.customer.total_bookings} besøg)
          </span>
        </h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Skriv en note om denne kunde…"
            className="flex-1 border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
          />
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim()}
            className="px-4 py-2.5 bg-[#B08A3E] text-white text-[12px] font-medium rounded-lg hover:bg-[#8C6A28] transition-colors disabled:opacity-40"
          >
            Tilføj
          </button>
        </div>

        {custNotes.length === 0 ? (
          <p className="text-[12px] text-[#8A8A8A]">Ingen noter endnu.</p>
        ) : (
          <div className="space-y-3">
            {custNotes.map((note) => (
              <div key={note.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <p className="text-sm text-ink">{note.body}</p>
                <p className="text-[11px] text-[#8A8A8A] mt-1">
                  {new Date(note.created_at).toLocaleDateString('da-DK')}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#8A8A8A]">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  )
}
