import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="bg-surface px-5 py-10 border-t border-border/50">
      <div className="max-w-xl mx-auto text-center">
        <p className="font-serif text-base text-ink mb-2">Design Klip</p>
        <p className="text-xs text-ink-muted mb-1">Holbækvej 39, 4000 Roskilde</p>
        <p className="text-xs text-ink-muted mb-1">
          <a href="tel:+4546359348" className="hover:text-ink transition-colors">
            +45 46 35 93 48
          </a>
          {' · '}
          <a href="mailto:kontakt@designklip.dk" className="hover:text-ink transition-colors">
            kontakt@designklip.dk
          </a>
        </p>

        <div className="flex justify-center gap-5 mt-4 mb-6 text-xs text-ink-subtle">
          <Link to="/privatlivspolitik" className="underline underline-offset-4 hover:text-ink transition-colors">
            Privatlivspolitik
          </Link>
          <Link to="/handelsbetingelser" className="underline underline-offset-4 hover:text-ink transition-colors">
            Handelsbetingelser
          </Link>
        </div>

        <p className="text-[0.625rem] text-ink-subtle">
          © Design Klip 2026
        </p>
      </div>
    </footer>
  )
}
