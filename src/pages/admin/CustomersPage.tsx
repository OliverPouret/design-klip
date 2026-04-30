import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'

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
  const [newNote, setNewNote] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

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
        .select('id, full_name, phone_e164, email, total_bookings, last_booking_at, notes_summary, created_at')
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

      const { data: cn } = await supabase
        .from('customer_notes')
        .select('id, body, created_at')
        .eq('customer_id', selectedId)
        .order('created_at', { ascending: false })
      if (cn) setNotes(cn as CustNote[])

      setDetailLoading(false)
    }
    fetchDetail()
  }, [selectedId])

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

      // Auto-regenerate AI profile
      fetch('/api/generate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedId }),
      })
        .then((r) => r.json())
        .then((d: { summary?: string }) => {
          if (d.summary && detail) setDetail({ ...detail, notes_summary: d.summary })
        })
        .catch(() => {})
    }
  }

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
              </div>

              {/* AI Profile */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900">AI-profil</h3>
                  <button
                    onClick={handleGenerateProfile}
                    disabled={aiLoading}
                    className="px-3 py-1.5 bg-[#B08A3E] hover:bg-[#8C6A28] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? 'Genererer…' : detail.notes_summary ? '↻ Opdatér' : '✨ Generér profil'}
                  </button>
                </div>
                {detail.notes_summary ? (
                  <div className="border-l-2 border-[#B08A3E] pl-3">
                    <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                      {detail.notes_summary}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    Ingen AI-profil endnu. Tryk "Generér profil" for at oprette en.
                  </p>
                )}
              </div>

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
                    {bookings.map((bk) => (
                      <div
                        key={bk.id}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                      >
                        <div>
                          <p className="text-sm text-gray-700">
                            {bk.service.name_da} hos {bk.barber.display_name}
                            {bk.source === 'phone' && ' · 📞'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(bk.starts_at).toLocaleDateString('da-DK', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })}
                            {' kl. '}
                            {new Date(bk.starts_at).toLocaleTimeString('da-DK', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                          {STATUS_LABEL[bk.status] ?? bk.status}
                        </span>
                      </div>
                    ))}
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
