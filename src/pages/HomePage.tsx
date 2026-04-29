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

      {/* Full-width sections with small gaps so the fixed background shows between them */}
      <div className="relative space-y-3 pb-12">
        <div className="bg-white"><Carousel /></div>
        <div className="bg-white"><PriceList /></div>
        <BarberProfiles />
        <div className="bg-white"><ContactStrip /></div>
        <Footer />
      </div>
    </div>
  )
}
