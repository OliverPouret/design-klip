const CAROUSEL_IMAGES = [
  { src: '/carousel-1.jpg', alt: 'Fade med skæg' },
  { src: '/carousel-2.jpg', alt: 'Kort fade' },
  { src: '/carousel-3.jpg', alt: 'Skin fade' },
  { src: '/carousel-4.jpg', alt: 'Klassisk herreklip' },
  { src: '/carousel-5.jpg', alt: 'Lav fade' },
  { src: '/carousel-6.jpg', alt: 'Krøllet fade' },
  { src: '/carousel-7.jpg', alt: 'Textured crop' },
  { src: '/carousel-8.jpg', alt: 'Kort med fade' },
]

export function Carousel() {
  // Duplicate for seamless loop
  const items = [...CAROUSEL_IMAGES, ...CAROUSEL_IMAGES]

  return (
    <section className="py-10 overflow-hidden">
      <p className="text-center text-[0.6875rem] tracking-[0.14em] uppercase text-ink-subtle mb-5">
        Vores arbejde
      </p>

      <div className="relative">
        <div className="flex gap-3 animate-marquee">
          {items.map((item, i) => (
            <div
              key={`${item.src}-${i}`}
              className="flex-shrink-0 w-[160px] h-[210px] md:w-[200px] md:h-[260px] overflow-hidden"
            >
              <img
                src={item.src}
                alt={item.alt}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
