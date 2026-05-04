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
          <p className="text-xs text-ink-subtle">Senest opdateret: maj 2026</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Tidsbestilling</h2>
          <p>Du booker en tid via vores hjemmeside. Når du har booket, modtager du en SMS med dato og tidspunkt.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">SMS-kommunikation om din booking</h2>
          <p>Når du booker en tid hos Design Klip, sender vi dig:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>En bekræftelses-SMS umiddelbart efter bookingen er gennemført.</li>
            <li>En påmindelses-SMS ca. 24 timer før din tid.</li>
          </ol>
          <p>Disse SMS'er er nødvendige for at opfylde aftalen om frisørbehandling og kan ikke fravælges, så længe du har en aktiv booking. SMS'erne sendes via vores tekniske partner GatewayAPI fra afsendernavn 'DesignKlip' til det mobilnummer, du har angivet ved bookingen.</p>
          <p>
            Hvis du ikke ønsker at modtage SMS'er, kan du bestille tid pr. telefon på{' '}
            <a
              href="tel:+4546359348"
              className="text-accent-deep underline underline-offset-2 hover:text-ink"
            >
              +45 46 35 93 48
            </a>
            . Har du allerede en aktiv booking og vil afmeldes SMS, så ring til os og bed om at blive afmeldt.
          </p>
          <p>Design Klip sender ikke markedsføring, tilbud eller nyheder via SMS uden særskilt samtykke. Se vores <Link to="/privatlivspolitik" className="underline underline-offset-2 hover:text-ink">Privatlivspolitik</Link> for detaljer om databehandling.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Priser</h2>
          <p>Alle priser er i danske kroner inkl. moms. De gældende priser er dem, der vises på hjemmesiden, når du booker.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Betaling</h2>
          <p>Du betaler i salonen efter dit klip. Vi tager imod kontant og MobilePay.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Afbestilling</h2>
          <p>
            Du kan afbestille din tid på to måder: via det personlige link i din SMS-bekræftelse,
            eller ved at ringe til os på{' '}
            <a
              href="tel:+4546359348"
              className="text-accent-deep underline underline-offset-2 hover:text-ink"
            >
              +45 46 35 93 48
            </a>
            . Vi sender også en påmindelse via SMS 24 timer før din tid.
          </p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Udeblivelse</h2>
          <p>Hvis du ikke dukker op og ikke har afbestilt, registrerer vi det. Vi opkræver ikke gebyr, men vi kan indføre depositum, hvis det bliver et gentaget problem.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Ændringer fra vores side</h2>
          <p>Hvis vi er nødt til at aflyse din tid, ringer vi til dig hurtigst muligt for at finde en ny tid sammen.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Kontakt</h2>
          <p>
            Design Klip · Holbækvej 39, 4000 Roskilde · Tlf:{' '}
            <a
              href="tel:+4546359348"
              className="text-accent-deep underline underline-offset-2 hover:text-ink"
            >
              +45 46 35 93 48
            </a>
            ·{' '}
            <a
              href="mailto:kontakt@designklip.dk"
              className="text-accent-deep underline underline-offset-2 hover:text-ink"
            >
              kontakt@designklip.dk
            </a>
          </p>
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
