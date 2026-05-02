import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { formatDanishDate, formatDanishDateTime } from '../../utils/revenueUtils'

interface CustomerRow {
  id: string
  full_name: string
  phone_e164: string
  total_bookings: number
  last_booking_at: string | null
  notes_summary: string | null
}

interface CustomerDetail {
  id: string
  full_name: string
  phone_e164: string
  email: string | null
  total_bookings: number
  last_booking_at: string | null
  notes_summary: string | null
  created_at: string
  sms_opt_out: boolean
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
  created_at: string
}

interface BookingLinkedNote {
  id: string
  body: string
  created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Bekræftet',
  pending: 'Afventer',
  completed: 'Fuldført',
  no_show: 'Udeblevet',
  cancelled: 'Afbestilt',
}

export function CustomersPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [bookings, setBookings] = useState<BookingHistory[]>([])
  const [notes, setNotes] = useState<CustNote[]>([])
  // V2-PARKED: AI customer profile state
  // const [aiProfile, setAiProfile] = useState<{ text: string; generatedAt: Date } | null>(null)
  const [lastKlipNote, setLastKlipNote] = useState<{
    body: string
    bookingStartsAt: string
    barberName: string
  } | null>(null)
  // Bookings that have linked notes (for showing the expand arrow)
  const [bookingsWithNotes, setBookingsWithNotes] = useState<Set<string>>(new Set())
  // Expanded booking rows + their lazy-loaded notes
  const [expandedNotes, setExpandedNotes] = useState<Map<string, BookingLinkedNote[]>>(new Map())
  const [expandedBookings, setExpandedBookings] = useState<Set<string>>(new Set())
  const [newNote, setNewNote] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  // const [aiLoading, setAiLoading] = useState(false) // unused after auto-trigger refactor

  useEffect(() => {
    supabase
      .from('customers')
      .select('id, full_name, phone_e164, total_bookings, last_booking_at, notes_summary')
      .order('last_booking_at', { ascending: false, nullsFirst: false })
      .limit(200)
      .then(({ data }) => {
        setCustomers((data as CustomerRow[] | null) ?? [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedId) return

    const fetchDetail = async () => {
      const { data: cust } = await supabase
        .from('customers')
        .select('id, full_name, phone_e164, email, total_bookings, last_booking_at, notes_summary, created_at, sms_opt_out')
        .eq('id', selectedId)
        .single()
      if (cust) setDetail(cust as CustomerDetail)

      const { data: bk } = await supabase
        .from('bookings')
        .select(
          'id, starts_at, status, source, customer_notes, service:services!inner(name_da), barber:barbers!inner(display_name)',
        )
        .eq('customer_id', selectedId)
        .order('starts_at', { ascending: false })
        .limit(50)
      if (bk) setBookings(bk as unknown as BookingHistory[])

      // Find which bookings have linked notes (so we know where to show the arrow).
      const { data: linkedRows } = await supabase
        .from('customer_notes')
        .select('booking_id')
        .eq('customer_id', selectedId)
        .not('booking_id', 'is', null)
      const linkedSet = new Set<string>()
      ;(linkedRows as { booking_id: string | null }[] | null)?.forEach((r) => {
        if (r.booking_id) linkedSet.add(r.booking_id)
      })
      setBookingsWithNotes(linkedSet)
      setExpandedNotes(new Map())
      setExpandedBookings(new Set())

      // V2-PARKED: AI customer profile fetch
      // const { data: ai } = await supabase
      //   .from('customer_ai_profiles')
      //   .select('profile_text, generated_at')
      //   .eq('customer_id', selectedId)
      //   .maybeSingle()
      // const aiRow = ai as { profile_text: string; generated_at: string } | null
      // setAiProfile(
      //   aiRow ? { text: aiRow.profile_text, generatedAt: new Date(aiRow.generated_at) } : null,
      // )

      // Sidste klip — most recent klip-tagged note from a completed booking
      const { data: klipNotes } = await supabase
        .from('customer_notes')
        .select('body, created_at, booking_id, bookings!inner(starts_at, status, barbers(display_name))')
        .eq('customer_id', selectedId)
        .contains('tags', ['klip'])
        .not('booking_id', 'is', null)
        .eq('bookings.status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)

      if (klipNotes && klipNotes.length > 0) {
        const n = klipNotes[0] as unknown as {
          body: string
          bookings: { starts_at: string; barbers: { display_name: string } | null } | null
        }
        setLastKlipNote({
          body: n.body,
          bookingStartsAt: n.bookings?.starts_at ?? '',
          barberName: n.bookings?.barbers?.display_name ?? 'Ukendt',
        })
      } else {
        setLastKlipNote(null)
      }

      // Kundenoter section: only general notes (not linked to a specific booking).
      // Booking-linked notes appear in the booking's Historik row instead.
      const { data: cn } = await supabase
        .from('customer_notes')
        .select('id, body, created_at')
        .eq('customer_id', selectedId)
        .is('booking_id', null)
        .order('created_at', { ascending: false })
      if (cn) setNotes(cn as CustNote[])

      setDetailLoading(false)
    }
    fetchDetail()
  }, [selectedId])

  const toggleBookingNotes = async (bookingId: string) => {
    if (expandedBookings.has(bookingId)) {
      const next = new Set(expandedBookings)
      next.delete(bookingId)
      setExpandedBookings(next)
      return
    }

    if (!expandedNotes.has(bookingId)) {
      const { data } = await supabase
        .from('customer_notes')
        .select('id, body, created_at')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
      const next = new Map(expandedNotes)
      next.set(bookingId, (data as BookingLinkedNote[] | null) ?? [])
      setExpandedNotes(next)
    }

    const next = new Set(expandedBookings)
    next.add(bookingId)
    setExpandedBookings(next)
  }

  const handleToggleSmsOptOut = async () => {
    if (!detail) return
    const newValue = !detail.sms_opt_out
    const confirmMessage = newValue
      ? `Bekræft: ${detail.full_name} afmeldes SMS. Ingen bekræftelse eller påmindelse sendes på fremtidige bookinger.`
      : `Bekræft: ${detail.full_name} tilmeldes SMS igen. Bekræftelse og påmindelse sendes på fremtidige bookinger.`
    if (!confirm(confirmMessage)) return

    const { error } = await supabase
      .from('customers')
      .update({
        sms_opt_out: newValue,
        sms_opt_out_at: newValue ? new Date().toISOString() : null,
      })
      .eq('id', detail.id)

    if (error) {
      alert('Fejl ved opdatering: ' + error.message)
      return
    }

    setDetail({ ...detail, sms_opt_out: newValue })
  }

  const handleAddNote = async () => {
    if (!selectedId || !newNote.trim() || !user) return
    const { data } = await supabase
      .from('customer_notes')
      .insert({ customer_id: selectedId, author_id: user.id, body: newNote.trim(), tags: [] })
      .select()
      .single()
    if (data) {
      setNotes([data as CustNote, ...notes])
      setNewNote('')

      // V2-PARKED: AI customer profile auto-generation
      // Reactivate by uncommenting and importing the relevant flow.
      // supabase.functions
      //   .invoke('generate-customer-profile', { body: { customer_id: selectedId } })
      //   .then(() => {
      //     if (!selectedId) return
      //     supabase
      //       .from('customer_ai_profiles')
      //       .select('profile_text, generated_at')
      //       .eq('customer_id', selectedId)
      //       .maybeSingle()
      //       .then(({ data: profile }) => {
      //         const row = profile as { profile_text: string; generated_at: string } | null
      //         if (row) {
      //           setAiProfile({ text: row.profile_text, generatedAt: new Date(row.generated_at) })
      //         }
      //       })
      //   })
      //   .catch(console.error)
    }
  }

  // Manual profile generation kept commented for reference. AI profile is now
  // generated automatically on note save by the generate-customer-profile Edge Function.
  /*
  const handleGenerateProfile = async () => {
    if (!selectedId || !detail) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedId }),
      })
      const data = (await res.json()) as { summary?: string }
      if (data.summary) setDetail({ ...detail, notes_summary: data.summary })
    } finally {
      setAiLoading(false)
    }
  }
  */

  const filtered = search.trim()
    ? customers.filter(
        (c) =>
          c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone_e164.includes(search.replace(/\s/g, '')),
      )
    : customers

  // Calculate usual service from booking history
  const usualService = (() => {
    const counts: Record<string, number> = {}
    bookings
      .filter((b) => b.status !== 'cancelled')
      .forEach((b) => {
        const n = b.service.name_da
        counts[n] = (counts[n] || 0) + 1
      })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  })()

  const lastVisit = bookings.find((b) => b.status === 'completed' || b.status === 'confirmed')

  return (
    <div className="md:h-full md:flex md:flex-col md:min-h-0 flex-1 -m-4 md:-m-6">
      <div className="flex flex-1 md:min-h-0 h-full">
        {/* LEFT: Customer list */}
        <div className="w-full md:w-72 lg:w-80 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white md:h-full">
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-400 flex-shrink-0"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søg kunder…"
                className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-xs text-gray-400 p-4">Henter kunder…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 p-4">Ingen kunder fundet.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    if (c.id === selectedId) return
                    setSelectedId(c.id)
                    setDetail(null)
                    setBookings([])
                    setNotes([])
                    setLastKlipNote(null)
                    setDetailLoading(true)
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                    selectedId === c.id
                      ? 'bg-[#B08A3E]/10 border-l-2 border-l-[#B08A3E]'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{c.full_name}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-gray-400">{c.phone_e164}</p>
                    <p className="text-xs text-gray-400">{c.total_bookings} besøg</p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-3 border-t border-gray-200">
            <p className="text-[11px] text-gray-400">{customers.length} kunder i alt</p>
          </div>
        </div>

        {/* RIGHT: Customer detail */}
        <div className="flex-1 flex flex-col md:h-full md:min-h-0 md:overflow-y-auto bg-[#F9FAFB]">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">Vælg en kunde fra listen</p>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400">Henter kundeprofil…</p>
            </div>
          ) : detail ? (
            <div className="p-4 lg:p-6 space-y-4">
              {/* Profile header */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">{detail.full_name}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      <a href={`tel:${detail.phone_e164}`} className="text-[#B08A3E]">
                        {detail.phone_e164}
                      </a>
                      {detail.email && <span className="ml-2">· {detail.email}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-medium text-gray-900">{detail.total_bookings}</p>
                    <p className="text-xs text-gray-400">besøg</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {usualService && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Får som regel</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">{usualService}</p>
                    </div>
                  )}
                  {lastVisit && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Sidst her</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {new Date(lastVisit.starts_at).toLocaleDateString('da-DK', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {lastVisit.service.name_da} hos {lastVisit.barber.display_name}
                      </p>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Kunde siden</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {new Date(detail.created_at).toLocaleDateString('da-DK', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <div className="min-w-0 pr-3">
                    <span className="text-sm font-medium text-gray-900">SMS-kommunikation</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {detail.sms_opt_out
                        ? 'Kunden modtager ikke SMS’er.'
                        : 'Kunden modtager bekræftelse og påmindelse.'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleSmsOptOut}
                    className={`flex-shrink-0 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      detail.sms_opt_out
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-[#B08A3E] text-white hover:bg-[#8C6A28]'
                    }`}
                  >
                    {detail.sms_opt_out ? 'Tilmeld SMS igen' : 'Afmeld SMS'}
                  </button>
                </div>
              </div>

              {/* V2-PARKED: AI customer profile section
                  Reactivate by uncommenting this block and re-adding the customer_ai_profiles fetch in fetchDetail.
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-900 mb-3">AI-profil</h3>
                {aiProfile ? (
                  <>
                    <div className="border-l-2 border-[#B08A3E] pl-3">
                      <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                        {aiProfile.text}
                      </p>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-3">
                      Sidst opdateret:{' '}
                      {aiProfile.generatedAt.toLocaleDateString('da-DK', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Ingen profil endnu. Profilen genereres automatisk efter første klip.
                  </p>
                )}
              </div>
              */}

              {lastKlipNote && (
                <section className="bg-white rounded-lg border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <h3 className="text-sm font-medium text-gray-900">Sidste klip</h3>
                    <span className="text-xs text-gray-400">
                      {lastKlipNote.barberName} ·{' '}
                      {formatDanishDate(new Date(lastKlipNote.bookingStartsAt))}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {lastKlipNote.body}
                  </p>
                </section>
              )}

              {/* Notes */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Kundenoter</h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Skriv en note…"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#B08A3E] transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="px-4 py-2 bg-[#B08A3E] text-white text-xs rounded-lg hover:bg-[#8C6A28] transition-colors disabled:opacity-40"
                  >
                    Tilføj
                  </button>
                </div>
                {notes.length === 0 ? (
                  <p className="text-xs text-gray-400">Ingen noter endnu.</p>
                ) : (
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div key={n.id} className="border-b border-gray-100 pb-2 last:border-0">
                        <p className="text-sm text-gray-700">{n.body}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(n.created_at).toLocaleDateString('da-DK', {
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
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h3 className="text-sm font-medium text-gray-900 mb-3">
                  Historik ({bookings.length} bookinger)
                </h3>
                {bookings.length === 0 ? (
                  <p className="text-xs text-gray-400">Ingen bookinger endnu.</p>
                ) : (
                  <div className="space-y-2">
                    {bookings.map((bk) => {
                      const hasNotes = bookingsWithNotes.has(bk.id)
                      const isExpanded = expandedBookings.has(bk.id)
                      const notesForBooking = expandedNotes.get(bk.id) ?? []
                      const bookingDateLabel = formatDanishDateTime(new Date(bk.starts_at))
                      return (
                        <div key={bk.id}>
                          <div className="grid grid-cols-3 items-center gap-3 py-2 border-b border-gray-100">
                            <div className="min-w-0">
                              <p className="text-sm text-gray-700 truncate">
                                {bk.service.name_da} · {bk.barber.display_name}
                                {bk.source === 'phone' && ' · 📞'}
                              </p>
                            </div>
                            <div className="min-w-0 text-center">
                              <p className="text-xs text-gray-500 truncate">{bookingDateLabel}</p>
                            </div>
                            <div className="flex items-center justify-end gap-3 min-w-0">
                              <span className="text-[10px] text-gray-400 uppercase tracking-wide whitespace-nowrap">
                                {STATUS_LABEL[bk.status] ?? bk.status}
                              </span>
                              <button
                                onClick={() => hasNotes && toggleBookingNotes(bk.id)}
                                disabled={!hasNotes}
                                className={`text-xs leading-none transition-colors ${
                                  hasNotes
                                    ? 'text-[#B08A3E] hover:text-[#8C6A28] cursor-pointer'
                                    : 'text-gray-300 cursor-default'
                                }`}
                                aria-label={
                                  hasNotes
                                    ? isExpanded
                                      ? 'Skjul note'
                                      : 'Vis note'
                                    : 'Ingen note'
                                }
                              >
                                {isExpanded && hasNotes ? '▼' : '▶'}
                              </button>
                            </div>
                          </div>
                          {isExpanded && hasNotes && (
                            <div className="bg-gray-50 border-l-2 border-[#B08A3E] p-4 mt-2">
                              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                                Hvad blev lavet
                              </div>
                              {notesForBooking.length === 0 ? (
                                <p className="text-xs text-gray-400">Henter note…</p>
                              ) : (
                                <div className="space-y-3">
                                  {notesForBooking.map((n) => (
                                    <p
                                      key={n.id}
                                      className="text-sm text-gray-800 leading-relaxed whitespace-pre-line"
                                    >
                                      {n.body}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
