import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { StickyHeader } from '../components/StickyHeader'
import { ServiceStep } from '../components/booking/ServiceStep'
import { BarberStep } from '../components/booking/BarberStep'
import { DateTimeStep } from '../components/booking/DateTimeStep'
import { StepIndicator } from '../components/booking/StepIndicator'

export type BookingStep = 'service' | 'barber' | 'datetime' | 'customer' | 'confirm'

export interface BookingState {
  step: BookingStep
  serviceSlug: string | null
  barberSlug: string | null
  anyBarber: boolean
  startsAt: string | null
  resolvedBarberId: string | null
}

export function BookingPage() {
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<BookingState>(() => {
    const serviceFromUrl = searchParams.get('service')
    const barberFromUrl = searchParams.get('barber')

    let step: BookingStep = 'service'
    if (serviceFromUrl && barberFromUrl) step = 'datetime'
    else if (serviceFromUrl) step = 'barber'

    return {
      step,
      serviceSlug: serviceFromUrl,
      barberSlug: barberFromUrl,
      anyBarber: false,
      startsAt: null,
      resolvedBarberId: null,
    }
  })

  const update = (patch: Partial<BookingState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }

  const goBack = () => {
    setState((prev) => {
      if (prev.step === 'barber') return { ...prev, step: 'service' }
      if (prev.step === 'datetime') return { ...prev, step: 'barber' }
      if (prev.step === 'customer') return { ...prev, step: 'datetime' }
      if (prev.step === 'confirm') return { ...prev, step: 'customer' }
      return prev
    })
  }

  return (
    <div className="min-h-screen">
      <StickyHeader />

      <div className="pt-20 pb-12 px-4 md:px-6">
        <div className="max-w-2xl mx-auto bg-white shadow-xl border border-border/50">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="text-xs text-ink-subtle hover:text-ink transition-colors">
                ← Tilbage til forsiden
              </Link>
              {state.step !== 'service' && (
                <button
                  onClick={goBack}
                  className="text-xs text-accent-deep hover:text-ink transition-colors"
                >
                  ← Forrige skridt
                </button>
              )}
            </div>
            <StepIndicator currentStep={state.step} />
          </div>

          <div className="px-5 py-8 md:px-8 md:py-10">
            {state.step === 'service' && (
              <ServiceStep
                state={state}
                onSelect={(slug) => update({ serviceSlug: slug, step: 'barber' })}
              />
            )}
            {state.step === 'barber' && (
              <BarberStep
                state={state}
                onSelect={(slug, anyBarber) =>
                  update({ barberSlug: slug, anyBarber, step: 'datetime' })
                }
              />
            )}
            {state.step === 'datetime' && (
              <DateTimeStep
                state={state}
                onSelect={(startsAt, resolvedBarberId) =>
                  update({ startsAt, resolvedBarberId, step: 'customer' })
                }
              />
            )}
            {state.step === 'customer' && (
              <div className="text-center py-12">
                <p className="font-serif text-xl text-ink mb-2">Næsten færdig</p>
                <p className="text-sm text-ink-muted">
                  Næste session: Kundeinfo + bekræftelse
                </p>
                <p className="text-xs text-ink-subtle mt-4">
                  (Du har valgt: {state.serviceSlug} hos{' '}
                  {state.anyBarber ? 'først ledige frisør' : state.barberSlug} kl.{' '}
                  {state.startsAt && new Date(state.startsAt).toLocaleString('da-DK')})
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
