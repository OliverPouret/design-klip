export function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-center font-serif text-display-md text-ink mb-6">
      {children}
    </h2>
  )
}
