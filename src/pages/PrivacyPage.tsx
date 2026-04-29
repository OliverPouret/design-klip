import { Link } from 'react-router-dom'

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 py-5 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Design Klip" className="h-8 w-auto" />
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-12">
        <h1 className="font-serif text-display-lg text-ink mb-8">Privatlivspolitik</h1>

        <div className="prose prose-sm text-ink-muted space-y-6 text-sm leading-relaxed">
          <p className="text-xs text-ink-subtle">Senest opdateret: april 2026</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Hvem er vi?</h2>
          <p>Design Klip er en frisør i Roskilde. Vi er dataansvarlige for de oplysninger, vi indsamler om dig.</p>
          <p>Design Klip · Holbækvej 39, 4000 Roskilde · Tlf: +45 46 35 93 48 · kontakt@designklip.dk</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Hvilke oplysninger indsamler vi?</h2>
          <p>Når du booker en tid, gemmer vi dit navn, telefonnummer, e-mail (hvis du oplyser den), hvilken ydelse du har booket, tidspunkt, barber og eventuelle beskeder.</p>
          <p>Vores frisører kan skrive interne noter om dit klip, så vi husker dine præferencer.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Hvorfor gemmer vi dine oplysninger?</h2>
          <p>Vi bruger dine oplysninger til at bekræfte og administrere din tid (GDPR art. 6, stk. 1, litra b), sende SMS-bekræftelse og påmindelse (art. 6, stk. 1, litra f), og huske dine præferencer (art. 6, stk. 1, litra f).</p>
          <p>Vi bruger ikke dine oplysninger til markedsføring, og vi sælger dem ikke.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Hvem deler vi dine oplysninger med?</h2>
          <p>Pouret Digital (webudvikler), Supabase (database, EU), Vercel (hosting) og GatewayAPI (dansk SMS-udbyder). Alle er underlagt databehandleraftaler.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Hvor længe gemmer vi dine oplysninger?</h2>
          <p>Bookingdata: 24 måneder efter dit seneste besøg. Regnskabsmateriale: 5 år (bogføringsloven). SMS-log: 12 måneder. Herefter anonymiseres dine data.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Dine rettigheder</h2>
          <p>Du har ret til at se, rette, slette, begrænse og få udleveret dine oplysninger. Kontakt os på kontakt@designklip.dk — vi svarer inden 30 dage.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Cookies</h2>
          <p>Vi bruger kun tekniske cookies til bookingsystemet. Ingen tracking eller analyse.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Klageadgang</h2>
          <p>Du kan klage til Datatilsynet: Carl Jacobsens Vej 35, 2500 Valby · dt@datatilsynet.dk · +45 33 19 32 00</p>
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
