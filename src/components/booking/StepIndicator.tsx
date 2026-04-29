import type { BookingStep } from '../../pages/BookingPage'

const STEPS: { key: BookingStep; label: string }[] = [
  { key: 'service', label: 'Ydelse' },
  { key: 'barber', label: 'Frisør' },
  { key: 'datetime', label: 'Tidspunkt' },
  { key: 'customer', label: 'Info' },
  { key: 'confirm', label: 'Bekræft' },
]

export function StepIndicator({ currentStep }: { currentStep: BookingStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <div className="flex items-center justify-between mt-3 gap-2">
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex
        const isCurrent = i === currentIndex
        return (
          <div key={step.key} className="flex-1 flex flex-col items-center">
            <div
              className={`h-1 w-full mb-1 ${
                isDone ? 'bg-accent' : isCurrent ? 'bg-accent' : 'bg-border'
              }`}
            />
            <span
              className={`text-[0.625rem] tracking-[0.08em] uppercase ${
                isCurrent ? 'text-ink font-medium' : 'text-ink-subtle'
              }`}
            >
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
