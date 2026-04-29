import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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

  if (loading) return <p className="text-sm text-ink-subtle">Henter kunder…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-xl text-ink">Kunder</h1>
        <span className="text-xs text-ink-subtle">{customers.length} kunder</span>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg på navn eller telefonnummer…"
          className="w-full border border-border rounded-sm px-4 py-3 text-sm outline-none focus:border-accent transition-colors bg-white"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-border rounded-sm p-8 text-center">
          <p className="text-sm text-ink-muted">{search ? 'Ingen kunder fundet.' : 'Ingen kunder endnu.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((customer) => (
            <Link
              key={customer.id}
              to={`/admin/kunder/${customer.id}`}
              className="block bg-white border border-border rounded-sm p-4 hover:border-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink">{customer.full_name}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{customer.phone_e164}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-ink">{customer.total_bookings} besøg</p>
                  {customer.last_booking_at && (
                    <p className="text-xs text-ink-subtle mt-0.5">
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
      )}
    </div>
  )
}
