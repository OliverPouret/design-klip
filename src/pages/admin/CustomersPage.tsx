import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card } from '../../components/admin/Card'

interface CustomerRow {
  id: string
  full_name: string
  phone_e164: string
  total_bookings: number
  last_booking_at: string | null
  created_at: string
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('customers')
      .select('id, full_name, phone_e164, total_bookings, last_booking_at, created_at')
      .order('last_booking_at', { ascending: false, nullsFirst: false })
      .limit(100)
      .then(({ data }) => {
        setCustomers((data as CustomerRow[] | null) ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = search.trim()
    ? customers.filter(
        (c) =>
          c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone_e164.includes(search.replace(/\s/g, '')),
      )
    : customers

  if (loading) return <p className="text-sm text-[#8A8A8A]">Henter kunder…</p>

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[22px] text-ink">Kunder</h1>
        <span className="text-[12px] text-[#8A8A8A]">{customers.length} kunder</span>
      </div>

      <Card padding="sm">
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8A8A]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søg på navn eller telefonnummer…"
            className="w-full border border-[#E8E8E5] rounded-lg pl-10 pr-3.5 py-2.5 text-sm outline-none focus:border-[#B08A3E] focus:ring-2 focus:ring-[#B08A3E]/15 transition-all"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-[#5F5E5A] text-center">
            {search ? 'Ingen kunder fundet.' : 'Ingen kunder endnu.'}
          </p>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-[#F0F0ED]">
            {filtered.map((customer) => (
              <Link
                key={customer.id}
                to={`/admin/kunder/${customer.id}`}
                className="block px-5 py-3.5 hover:bg-[#FAFAF8] transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{customer.full_name}</p>
                    <p className="text-[12px] text-[#8A8A8A] mt-0.5">{customer.phone_e164}</p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-[0.08em] uppercase bg-[#F0F0ED] text-[#5F5E5A]">
                      {customer.total_bookings} besøg
                    </span>
                    {customer.last_booking_at && (
                      <p className="text-[11px] text-[#8A8A8A]">
                        Sidst:{' '}
                        {new Date(customer.last_booking_at).toLocaleDateString('da-DK', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
