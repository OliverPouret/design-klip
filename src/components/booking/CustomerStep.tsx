import { useEffect, useRef, useState } from 'react'
import type { BookingState } from '../../pages/BookingPage'
import { formatDateLong, formatTime } from '../../lib/danishDates'
import { formatDKK } from '../../types/database'
import { useServices } from '../../hooks/useServices'
import { useBarbers } from '../../hooks/useBarbers'
import { supabase } from '../../lib/supabase'

export interface CustomerInfo {
  fullName: string
  phone: string
  email: string
  notes: string
  remember: boolean
  // V2-PARKED: marketing SMS consent — see /agency/v2-roadmap/
  // marketingOptIn: boolean
}

// localStorage on the user's own device is "strictly necessary" GDPR-wise
// because the user explicitly opted in via the checkbox. No cookie banner
// required. Wrapped in try/catch — Safari private mode throws if disabled.
const REMEMBER_KEY = 'designklip:remembered_customer'

function readRemembered(): { name: string; phone: string; email: string } | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { name?: string; phone?: string; email?: string }
    if (!parsed || typeof parsed !== 'object') return null
    return {
      name: parsed.name ?? '',
      phone: parsed.phone ?? '',
      email: parsed.email ?? '',
    }
  } catch {
    return null
  }
}

export function CustomerStep({
  state,
  onNext,
}: {
  state: BookingState
  onNext: (info: CustomerInfo) => void
}) {
  const { services } = useServices()
  const { barbers } = useBarbers()
  const [form, setForm] = useState<CustomerInfo>({
    fullName: '',
    phone: '',
    email: '',
    notes: '',
    remember: false,
    // V2-PARKED: marketing SMS consent — see /agency/v2-roadmap/
    // marketingOptIn: false,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({})
  const [returningCustomer, setReturningCustomer] = useState(false)
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Prefill from localStorage if the user has previously opted in.
  useEffect(() => {
    const remembered = readRemembered()
    if (!remembered) return
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || remembered.name,
      phone: prev.phone || remembered.phone,
      email: prev.email || remembered.email,
      remember: true,
    }))
  }, [])

  const service = services.find((s) => s.slug === state.serviceSlug)
  const barber = state.anyBarber ? null : barbers.find((b) => b.slug === state.barberSlug)

  const set = (field: keyof CustomerInfo, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handlePhoneChange = (value: string) => {
    set('phone', value)
    setReturningCustomer(false)

    const cleaned = value.replace(/[\s\-+]/g, '')
    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current)
    if (cleaned.length < 8) return

    // Debounce: only lookup after 500ms of no typing
    lookupTimerRef.current = setTimeout(async () => {
      const last8 = cleaned.slice(-8)
      const { data } = await supabase
        .from('customers')
        .select('full_name')
        .ilike('phone_e164', `%${last8}`)
        .limit(1)

      if (data && data.length > 0) {
        const matched = (data[0] as { full_name: string }).full_name
        setReturningCustomer(true)
        // Only auto-fill if the name field is currently empty
        setForm((prev) => (prev.fullName ? prev : { ...prev, fullName: matched }))
      }
    }, 500)
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof CustomerInfo, string>> = {}
    if (!form.fullName.trim() || form.fullName.trim().length < 2)
      errs.fullName = 'Skriv dit fulde navn'
    const cleaned = form.phone.replace(/\s|-/g, '')
    if (!cleaned || cleaned.replace(/^\+45/, '').length < 8)
      errs.phone = 'Skriv et gyldigt dansk mobilnummer'
    const trimmedEmail = form.email.trim()
    if (!trimmedEmail) {
      errs.email = 'Indtast din email-adresse'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) || trimmedEmail.length > 200) {
      errs.email = 'Indtast en gyldig email-adresse'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = () => {
    if (validate()) onNext(form)
  }

  return (
    <div>
      <h2 className="font-serif text-display-md text-ink text-center mb-2">
        Dine oplysninger
      </h2>

      {/* Booking summary mini card */}
      {service && state.startsAt && (
        <div className="bg-surface border border-border rounded-sm px-4 py-3 mb-8 text-sm">
          <p className="text-ink font-medium">
            {service.name_da} — {formatDKK(service.price_ore)}
          </p>
          <p className="text-ink-muted mt-0.5">
            {formatDateLong(new Date(state.startsAt))} {formatTime(new Date(state.startsAt))}
          </p>
          <p className="text-ink-muted">
            {state.anyBarber ? 'Første ledige frisør' : barber?.display_name}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-1.5">
            Navn <span className="text-accent">*</span>
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            placeholder="Anders Andersen"
            className={`w-full border rounded-sm px-4 py-3 text-sm text-ink placeholder:text-ink-subtle/60 outline-none transition-colors ${
              errors.fullName ? 'border-red-400' : 'border-border focus:border-accent'
            }`}
          />
          {errors.fullName && (
            <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-1.5">
            Mobilnummer <span className="text-accent">*</span>
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="12 34 56 78"
            inputMode="numeric"
            className={`w-full border rounded-sm px-4 py-3 text-sm text-ink placeholder:text-ink-subtle/60 outline-none transition-colors ${
              errors.phone ? 'border-red-400' : 'border-border focus:border-accent'
            }`}
          />
          {errors.phone && (
            <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
          )}
          {returningCustomer && form.fullName && (
            <p className="text-xs text-green-600 mt-1">Velkommen tilbage!</p>
          )}
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">
            Vi sender dig en bookingbekræftelse og en påmindelse 24 timer før din tid via SMS til dette nummer.
          </p>
        </div>

        {/* Email (required) */}
        <div>
          <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-1.5">
            E-mail <span className="text-accent">*</span>
          </label>
          <input
            type="email"
            required
            maxLength={200}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="anders@example.dk"
            className={`w-full border rounded-sm px-4 py-3 text-sm text-ink placeholder:text-ink-subtle/60 outline-none transition-colors ${
              errors.email ? 'border-red-400' : 'border-border focus:border-accent'
            }`}
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email}</p>
          )}
        </div>

        {/* Notes (optional) */}
        <div>
          <label className="block text-xs tracking-[0.08em] uppercase text-ink-subtle mb-1.5">
            Type af klipning <span className="text-ink-subtle font-normal normal-case">(valgfrit)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder='F.eks. "Low fade, lineup, lidt af toppen"'
            rows={3}
            className="w-full border border-border rounded-sm px-4 py-3 text-sm text-ink placeholder:text-ink-subtle/60 outline-none focus:border-accent transition-colors resize-none"
          />
        </div>

        {/* V2-PARKED: marketing SMS consent checkbox — see /agency/v2-roadmap/
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.marketingOptIn}
            onChange={(e) => set('marketingOptIn', e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-accent"
          />
          <span className="text-xs text-ink-muted leading-relaxed">
            Jeg vil gerne modtage tilbud og nyheder fra Design Klip via SMS
          </span>
        </label>
        */}
      </div>

      <div className="mt-8 space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(e) => setForm((prev) => ({ ...prev, remember: e.target.checked }))}
            className="mt-1 w-4 h-4 accent-accent"
          />
          <span className="text-sm text-ink-muted leading-snug">
            Husk navn, telefon og email på denne enhed til næste gang jeg booker her.
          </span>
        </label>

        <div className="text-sm text-ink-muted space-y-2">
          <p>
            Ved at booke accepterer du vores{' '}
            <a href="/privatlivspolitik" className="underline hover:text-accent">
              privatlivspolitik
            </a>{' '}
            og{' '}
            <a href="/handelsbetingelser" className="underline hover:text-accent">
              handelsbetingelser
            </a>
            .
          </p>
          <p>Betaling sker i salonen ved fremmøde — vi tager imod kontant og MobilePay.</p>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full inline-flex items-center justify-center gap-2 py-4 bg-accent text-white text-sm font-medium tracking-[0.08em] uppercase hover:bg-accent-deep transition-colors"
        >
          Bekræft booking
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
