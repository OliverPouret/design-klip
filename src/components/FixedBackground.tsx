export function FixedBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <picture>
        <source media="(min-width: 768px)" srcSet="/hero-desktop.jpg" />
        <img
          src="/hero-mobile.jpg"
          alt=""
          className="w-full h-full object-cover"
          style={{ filter: 'grayscale(0.6) brightness(0.95)' }}
          loading="eager"
        />
      </picture>
      <div className="absolute inset-0 bg-white/40" />
    </div>
  )
}
