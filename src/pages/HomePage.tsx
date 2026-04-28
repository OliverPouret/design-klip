import { StickyHeader } from '../components/StickyHeader'
import { HeroSection } from '../components/HeroSection'
import { Carousel } from '../components/Carousel'
import { PriceList } from '../components/PriceList'
import { BarberProfiles } from '../components/BarberProfiles'
import { ContactStrip } from '../components/ContactStrip'
import { Footer } from '../components/Footer'

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <StickyHeader />
      <HeroSection />
      <Carousel />
      <PriceList />
      <BarberProfiles />
      <ContactStrip />
      <Footer />
    </div>
  )
}
