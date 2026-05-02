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
          <p className="text-xs text-ink-subtle">Senest opdateret: maj 2026</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Hvem er vi?</h2>
          <p>Design Klip er en frisør i Roskilde. Vi er dataansvarlige for de oplysninger, vi indsamler om dig.</p>
          <p>Design Klip · Holbækvej 39, 4000 Roskilde · Tlf: +45 46 35 93 48 · kontakt@designklip.dk</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Hvilke oplysninger indsamler vi?</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Navn</li>
            <li>Mobilnummer</li>
            <li>E-mail (valgfrit)</li>
            <li>Note til frisøren (valgfrit)</li>
            <li>Booking-historik (hvilke ydelser, hvornår, hos hvem)</li>
          </ul>
          <p>Vores frisører kan derudover skrive interne noter om dit klip, så vi husker dine præferencer.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Formål med behandlingen</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Booking og levering af frisørbehandling.</li>
            <li>Bekræftelse og påmindelse via SMS (servicemeddelelse, nødvendig for at opfylde aftalen).</li>
            <li>Bogføring og opfyldelse af bogføringsloven.</li>
          </ol>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Retsgrundlag for behandlingen</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Booking + SMS-service: GDPR art. 6, stk. 1, litra b (opfyldelse af kontrakt).</li>
            <li>Bogføringsdata: GDPR art. 6, stk. 1, litra c (retlig forpligtelse) sammenholdt med bogføringsloven §10.</li>
          </ul>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Modtagere/databehandlere</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>GatewayAPI (SMS-udsendelse, EU-baseret) — databehandleraftale indgået.</li>
            <li>Supabase (database og hosting, EU/Frankfurt).</li>
            <li>Vercel (web hosting).</li>
          </ul>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Markedsføring via SMS</h2>
          <p>Design Klip sender ikke marketingmeddelelser, tilbud eller nyheder via SMS. Du modtager udelukkende:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>En bookingbekræftelse, når du booker en tid.</li>
            <li>En påmindelse ca. 24 timer før din tid.</li>
          </ol>
          <p>Disse SMS'er er servicemeddelelser nødvendige for at opfylde aftalen og kan ikke fravælges, så længe du har en aktiv booking. Hvis du ikke ønsker at modtage SMS'er, kan du i stedet bestille tid pr. telefon på +45 46 35 93 48.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Hvor længe gemmer vi dine oplysninger?</h2>
          <p>Aktiv kundedata (navn, mobilnummer, evt. e-mail, note og booking-historik) slettes eller anonymiseres senest 24 måneder efter dit seneste besøg hos Design Klip. Bogføringsbilag (faktura/kvittering) opbevares i 5 år fra udgangen af regnskabsåret jf. bogføringsloven §10. SMS-log (afsendelseshistorik) opbevares i 12 måneder af tekniske og dokumentationsmæssige grunde.</p>

          <h2 className="font-serif text-lg text-ink mt-8 mb-2">Dine rettigheder</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Indsigt</li>
            <li>Berigtigelse</li>
            <li>Sletning (i det omfang vi ikke skal gemme oplysningerne af lovkrav)</li>
            <li>Begrænsning af behandling</li>
            <li>Indsigelse</li>
            <li>Dataportabilitet</li>
            <li>Klage til Datatilsynet (datatilsynet.dk)</li>
          </ul>
          <p>Kontakt os på kontakt@designklip.dk — vi svarer inden 30 dage.</p>

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
