import { Link } from 'react-router-dom'

export function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 py-5 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Design Klip" className="h-8 w-auto" />
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-12">
        <h1 className="font-serif text-display-lg text-ink mb-8">Handelsbetingelser</h1>

        <div className="prose prose-sm text-ink-muted space-y-6 text-sm leading-relaxed">
          <p className="text-xs text-ink-subtle">Senest opdateret: april 2026</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Tidsbestilling</h2>
          <p>Du booker en tid via vores hjemmeside. Når du har booket, modtager du en SMS med dato, tidspunkt og et link til at afbestille.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Priser</h2>
          <p>Alle priser er i danske kroner inkl. moms. De gældende priser er dem, der vises på hjemmesiden, når du booker.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Betaling</h2>
          <p>Du betaler i salonen efter dit klip. Vi tager imod kontant, MobilePay og kort.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Afbestilling</h2>
          <p>Du kan afbestille via linket i din SMS. Vi sender også en påmindelse 24 timer før med et afbestillingslink. Kan du ikke finde din SMS, så ring til os på +45 46 35 93 48.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Udeblivelse</h2>
          <p>Hvis du ikke dukker op og ikke har afbestilt, registrerer vi det. Vi opkræver ikke gebyr, men vi kan indføre depositum, hvis det bliver et gentaget problem.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Ændringer fra vores side</h2>
          <p>Hvis vi er nødt til at aflyse din tid, giver vi besked via SMS hurtigst muligt. Du får mulighed for at booke en ny tid med det samme.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Kontakt</h2>
          <p>Design Klip · Holbækvej 39, 4000 Roskilde · Tlf: +45 46 35 93 48 · kontakt@designklip.dk</p>
        </div>

        <div className="mt-12">
          <Link to="/" className="text-sm text-accent-deep underline underline-offset-4 hover:text-ink transition-colors">
            ← Tilbage til forsiden
          </Link>
        </div>
      </main>
    </div>
  )
}
