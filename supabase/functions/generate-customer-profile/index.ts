// Supabase Edge Function — generate-customer-profile
//
// POST { customer_id: string }
//
// Pulls the customer's note + booking history, asks Haiku to write a profile
// in Danish, and upserts the result into customer_ai_profiles.
//
// Required env (set with `supabase secrets set ...`):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ANTHROPIC_API_KEY

// @ts-expect-error Deno std import — valid in the Edge Function runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-expect-error Deno-style URL import — valid in the Edge Function runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MONTHS = [
  'jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.',
  'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.',
]

function fmtDanishDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { customer_id } = (await req.json()) as { customer_id?: string }
    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'Missing customer_id' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // @ts-expect-error Deno global available in Edge Function runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-expect-error Deno global available in Edge Function runtime
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // @ts-expect-error Deno global available in Edge Function runtime
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    // Customer
    const { data: customer } = await supabase
      .from('customers')
      .select('id, full_name')
      .eq('id', customer_id)
      .single()

    if (!customer) {
      return new Response(JSON.stringify({ error: 'Customer not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Notes (only those linked to a booking)
    const { data: notes } = await supabase
      .from('customer_notes')
      .select('body, created_at')
      .eq('customer_id', customer_id)
      .not('booking_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    // Booking history
    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        starts_at, status,
        service:services!inner(name_da)
      `)
      .eq('customer_id', customer_id)
      .eq('status', 'completed')
      .order('starts_at', { ascending: false })
      .limit(20)

    const noteCount = notes?.length ?? 0

    const bookingLines = ((bookings ?? []) as { starts_at: string; service: { name_da: string } }[])
      .map((b) => `${fmtDanishDate(b.starts_at)} — ${b.service.name_da}`)
      .join('\n')

    const noteLines = ((notes ?? []) as { body: string; created_at: string }[])
      .map((n) => `${fmtDanishDate(n.created_at)}: ${n.body}`)
      .join('\n')

    const userMessage = `Kunde: ${customer.full_name}

Besøgshistorik:
${bookingLines || '(ingen besøg endnu)'}

Noter fra frisøren:
${noteLines || '(ingen noter endnu)'}

Skriv en profil der beskriver: hvilken klipning kunden foretrækker, eventuelle særpræg eller præferencer, og hvad frisøren bør huske til næste besøg.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system:
          'Du er en AI-assistent for en frisørsalon. Skriv en kort kundeprofil på dansk baseret på kundens besøgshistorik og noter. Vær konkret og præcis. Max 200 ord.',
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      return new Response(JSON.stringify({ error: 'Anthropic error', detail: errText }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const aiData = (await aiRes.json()) as { content?: { text?: string }[] }
    const profileText = aiData.content?.[0]?.text ?? ''

    if (!profileText) {
      return new Response(JSON.stringify({ error: 'Empty profile' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { error: upsertErr } = await supabase.from('customer_ai_profiles').upsert(
      {
        customer_id,
        profile_text: profileText,
        generated_at: new Date().toISOString(),
        note_count: noteCount,
      },
      { onConflict: 'customer_id' },
    )

    if (upsertErr) {
      return new Response(JSON.stringify({ error: 'Upsert failed', detail: upsertErr.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unexpected', detail: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
