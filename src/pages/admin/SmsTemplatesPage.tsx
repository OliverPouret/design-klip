import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface SmsTemplate {
  id: string
  name_da: string
  body_da: string
  enabled: boolean
  updated_at: string
}

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  confirmation: 'Sendes umiddelbart efter en booking er oprettet.',
  reminder_24h: 'Sendes automatisk 24 timer før kundens tid.',
  customer_cancelled: 'Sendes når kunden selv aflyser via SMS-link.',
  shop_cancelled: 'Sendes når salonen aflyser en kundes tid.',
}

const TEMPLATE_ORDER = ['confirmation', 'reminder_24h', 'customer_cancelled', 'shop_cancelled']

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function SmsTemplatesPage() {
  const [templates, setTemplates] = useState<SmsTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('sms_templates')
      .select('id, name_da, body_da, enabled, updated_at')
      .in('id', TEMPLATE_ORDER)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
          return
        }
        const rows = (data ?? []) as SmsTemplate[]
        const sorted = [...rows].sort(
          (a, b) => TEMPLATE_ORDER.indexOf(a.id) - TEMPLATE_ORDER.indexOf(b.id),
        )
        setTemplates(sorted)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="max-w-4xl">
        <p className="text-sm text-error">Kunne ikke hente skabeloner: {error}</p>
      </div>
    )
  }

  if (!templates) {
    return (
      <div className="max-w-4xl">
        <p className="text-sm text-ink-muted">Henter skabeloner…</p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="font-serif-sc text-eyebrow text-accent">Indstillinger</p>
        <h2 className="font-serif text-display-md text-ink">SMS-skabeloner</h2>
        <p className="text-sm text-ink-muted max-w-2xl leading-relaxed">
          Tilpas teksten i de fire SMS-beskeder kunderne modtager. Variabler som
          kundens navn og tidspunkt udfyldes automatisk og kan ikke fjernes.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((tpl) => {
          const description = TEMPLATE_DESCRIPTIONS[tpl.id] ?? ''
          return (
            <article
              key={tpl.id}
              className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-serif text-[20px] text-ink leading-tight">
                    {tpl.name_da}
                  </h3>
                  <p className="text-[13px] text-ink-muted leading-snug">{description}</p>
                </div>
                <EnabledPill enabled={tpl.enabled} />
              </div>

              <p
                className="text-[13px] text-ink leading-relaxed overflow-hidden"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {collapseWhitespace(tpl.body_da)}
              </p>

              <div className="mt-auto pt-2">
                <Link
                  to={`/admin/sms/${tpl.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-accent text-white px-5 py-2 text-[13px] font-semibold hover:bg-accent-deep transition-colors"
                >
                  Rediger
                </Link>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function EnabledPill({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span
        className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full"
        style={{ backgroundColor: '#E3E8D5', color: '#5C7A4A' }}
      >
        Aktiveret
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}
    >
      Slået fra
    </span>
  )
}
