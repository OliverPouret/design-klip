export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-[0.6875rem] tracking-[0.14em] uppercase text-ink-subtle mb-1">
      {children}
    </p>
  )
}
