import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './_lib/supabase-admin.ts'

const PROFILE_SYSTEM_PROMPT = `Du er en frisørsalons kundeprofilgenerator. Du modtager en kundes bookinghistorik og noter.
Du SKAL altid bruge præcis denne struktur. Udelad en sektion kun hvis der ingen data er.
Skriv på naturligt dansk. Vær kortfattet.

**Mønster:** [Hvor ofte de kommer, hvilke dage de foretrækker]
**Sidst:** [Ydelse — hvad der blev lavet (frisør, dato)]
**Foretrækker:** [Deres typiske klip baseret på al historik]
**Frisør:** [Hvem de oftest booker hos, med antal]
**OBS:** [KUN hvis der er vigtige advarsler — manglende betaling, allergier, osv. Udelad hvis der intet er]

Hvis kunden kun har været én gang, skriv "Første besøg" under Mønster.
Medtag ALDRIG information du ikke har data for. Gæt ikke.`

interface BookingRow {
  starts_at: string
  status: string
  source: string
  service: { name_da: string }
  barber: { display_name: string }
}

interface NoteRow {
  body: string
  tags: string[] | null
  created_at: string
}

const DAY_NAMES = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { customerId } = req.body as { customerId?: string }
  if (!customerId) return res.status(400).json({ error: 'Missing customerId' })

  const supabase = getSupabaseAdmin()

  const { data: customer } = await supabase
    .from('customers')
    .select('id, full_name, total_bookings, created_at')
    .eq('id', customerId)
    .single()
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  const cust = customer as { id: string; full_name: string; total_bookings: number; created_at: string }

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      starts_at, status, source,
      service:services!inner(name_da),
      barber:barbers!inner(display_name)
    `)
    .eq('customer_id', customerId)
    .order('starts_at', { ascending: false })
    .limit(20)

  const { data: notes } = await supabase
    .from('customer_notes')
    .select('body, tags, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(20)

  const bookingsList = (bookings ?? []) as unknown as BookingRow[]
  const notesList = (notes ?? []) as NoteRow[]

  const bookingLines = bookingsList
    .map((b) => {
      const date = new Date(b.starts_at)
      const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
      const dayName = DAY_NAMES[date.getDay()]
      return `${dateStr} (${dayName}): ${b.service.name_da} hos ${b.barber.display_name} [${b.status}]`
    })
    .join('\n')

  const noteLines = notesList
    .map((n) => {
      const date = new Date(n.created_at)
      const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
      const isClip = n.tags?.includes('klip') ? ' [KLIP]' : ''
      return `${dateStr}${isClip}: ${n.body}`
    })
    .join('\n')

  const userMessage = `Kunde: ${cust.full_name}
Antal besøg: ${cust.total_bookings}
Kunde siden: ${new Date(cust.created_at).toLocaleDateString('da-DK')}

Bookinghistorik:
${bookingLines || 'Ingen bookinger endnu'}

Noter:
${noteLines || 'Ingen noter'}`

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
      max_tokens: 300,
      system: PROFILE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!aiResponse.ok) {
    const err = await aiResponse.text()
    console.error('Haiku error:', err)
    return res.status(500).json({ error: 'AI generation failed' })
  }

  const aiData = (await aiResponse.json()) as { content?: { text?: string }[] }
  const summary = aiData.content?.[0]?.text ?? ''

  await supabase.from('customers').update({ notes_summary: summary }).eq('id', customerId)

  return res.status(200).json({ summary })
}
