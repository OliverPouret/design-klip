import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './_lib/supabase-admin.ts'

const INSIGHTS_SYSTEM_PROMPT = `Du er en forretningsanalytiker for en frisørsalon. Du modtager bookingdata.
Du SKAL altid bruge præcis denne struktur. Skriv på naturligt dansk. Vær kortfattet og konkret.
Sammenlign altid de seneste 3 måneder med de foregående 3 måneder.

**Travleste dage:** [Hvilke ugedage der har flest bookinger, med %]
**Stille dage:** [Hvilke ugedage der har færrest bookinger]
**Populære ydelser:** [Top 3 ydelser med %]
**Frisører:** [Hvem har flest bookinger, hvem har færrest]
**Tendens (3 mdr):** [Samlet ændring i bookinger vs. forrige 3 mdr, op/ned/stabilt med %]
**Tendens (6 mdr):** [Samlet udvikling over 6 måneder]
**Udeblivelser:** [Antal og % af totale bookinger. Hvornår sker de oftest?]
**Forslag:** [1-2 konkrete, handlingsrettede forslag baseret på data]

Brug KUN de data du modtager. Gæt ikke. Hvis der ikke er nok data til en sektion, skriv "Ikke nok data endnu."`

interface InsightBooking {
  starts_at: string
  status: string
  source: string
  service: { name_da: string }
  barber: { display_name: string }
}

const DAY_NAMES = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = getSupabaseAdmin()

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      starts_at, status, source,
      service:services!inner(name_da),
      barber:barbers!inner(display_name)
    `)
    .gte('starts_at', sixMonthsAgo.toISOString())
    .order('starts_at', { ascending: false })

  const list = (bookings ?? []) as unknown as InsightBooking[]

  if (list.length === 0) {
    return res.status(200).json({
      insights: 'Ikke nok data endnu. Book de første kunder, så kan vi analysere.',
    })
  }

  const lines = list
    .map((b) => {
      const d = new Date(b.starts_at)
      const day = DAY_NAMES[d.getDay()]
      return `${d.toISOString().split('T')[0]} (${day}): ${b.service.name_da} hos ${b.barber.display_name} [${b.status}] [${b.source}]`
    })
    .join('\n')

  const userMessage = `Bookingdata (seneste 6 måneder, ${list.length} bookinger):\n${lines}`

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: INSIGHTS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!aiResponse.ok) {
    const err = await aiResponse.text()
    console.error('Insights error:', err)
    return res.status(500).json({ error: 'AI generation failed' })
  }

  const aiData = (await aiResponse.json()) as { content?: { text?: string }[] }
  const insights = aiData.content?.[0]?.text ?? ''

  return res.status(200).json({ insights })
}
