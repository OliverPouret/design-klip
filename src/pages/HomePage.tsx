import { StickyHeader } from '../components/StickyHeader'
import { HeroSection } from '../components/HeroSection'
import { Carousel } from '../components/Carousel'
import { PriceList } from '../components/PriceList'
import { BarberProfiles } from '../components/BarberProfiles'
import { ContactStrip } from '../components/ContactStrip'
import { Footer } from '../components/Footer'

export function HomePage() {
  return (
    <div className="min-h-screen">
      <StickyHeader />
      <HeroSection />

      {/* Content card — centered, max-width, sits on top of fixed background */}
      <div className="relative px-0 md:px-8 lg:px-12 pb-12">
        <div className="max-w-4xl mx-auto bg-white shadow-2xl border-x border-border/50">
          <Carousel />
          <PriceList />
          <BarberProfiles />
          <ContactStrip />
          <Footer />
        </div>
      </div>
    </div>
  )
}
