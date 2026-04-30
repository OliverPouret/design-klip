// Supabase Edge Function — generate-business-overview
//
// POST { period_months: number }
//
// Aggregates booking stats for the period, asks Haiku for a Danish business
// summary, upserts into business_overviews keyed by period_months.
//
// Required env:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ANTHROPIC_API_KEY

// @ts-expect-error Deno std import — valid in the Edge Function runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-expect-error Deno-style URL import — valid in the Edge Function runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

interface JoinedBooking {
  starts_at: string
  status: string
  source: string
  customer_id: string
  barber_id: string
  // Price is on bookings.price_ore (captured at booking time), not services
  price_ore: number
  service: { name_da: string } | null
  barber: { display_name: string } | null
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const { period_months } = (await req.json()) as { period_months?: number }
    const months = Math.max(1, Math.min(60, Number(period_months) || 1))

    // @ts-expect-error Deno global available in Edge Function runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-expect-error Deno global available in Edge Function runtime
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // @ts-expect-error Deno global available in Edge Function runtime
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const periodEnd = new Date()
    const periodStart = new Date()
    periodStart.setMonth(periodStart.getMonth() - months)

    const { data: rows } = await supabase
      .from('bookings')
      .select(`
        starts_at, status, source, customer_id, barber_id, price_ore,
        service:services!inner(name_da),
        barber:barbers!inner(display_name)
      `)
      .gte('starts_at', periodStart.toISOString())
      .lte('starts_at', periodEnd.toISOString())
      .in('status', ['confirmed', 'completed'])

    const bookings = (rows ?? []) as unknown as JoinedBooking[]

    const totalBookings = bookings.length
    const totalRevenueOre = bookings.reduce((sum, b) => sum + (b.price_ore ?? 0), 0)
    const totalRevenueKr = Math.round(totalRevenueOre / 100)
    const onlineCount = bookings.filter((b) => b.source === 'web').length
    const phoneCount = bookings.filter((b) => b.source === 'phone').length
    const onlinePercent = totalBookings > 0 ? Math.round((onlineCount / totalBookings) * 100) : 0
    const phonePercent = totalBookings > 0 ? Math.round((phoneCount / totalBookings) * 100) : 0

    const customerCounts: Record<string, number> = {}
    bookings.forEach((b) => {
      customerCounts[b.customer_id] = (customerCounts[b.customer_id] ?? 0) + 1
    })
    const uniqueCustomers = Object.keys(customerCounts).length
    const repeatCustomers = Object.values(customerCounts).filter((c) => c > 1).length

    const serviceCounts: Record<string, number> = {}
    bookings.forEach((b) => {
      const n = b.service?.name_da
      if (n) serviceCounts[n] = (serviceCounts[n] ?? 0) + 1
    })
    const topServices = Object.entries(serviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    const barberCounts: Record<string, number> = {}
    bookings.forEach((b) => {
      const n = b.barber?.display_name
      if (n) barberCounts[n] = (barberCounts[n] ?? 0) + 1
    })

    const weekdayCounts: Record<string, number> = {}
    bookings.forEach((b) => {
      const d = new Date(b.starts_at)
      const wd = WEEKDAY_NAMES[d.getDay()]
      weekdayCounts[wd] = (weekdayCounts[wd] ?? 0) + 1
    })
    const busiestWeekday =
      Object.entries(weekdayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'monday'

    const stats = {
      total_bookings: totalBookings,
      total_revenue_kr: totalRevenueKr,
      online_count: onlineCount,
      online_percent: onlinePercent,
      phone_count: phoneCount,
      phone_percent: phonePercent,
      unique_customers: uniqueCustomers,
      repeat_customers: repeatCustomers,
      top_services: topServices,
      barber_counts: barberCounts,
      busiest_weekday: busiestWeekday,
    }

    const topServicesLine = topServices.map(([n, c]) => `${n}: ${c}`).join(', ') || 'ingen'
    const barberLine =
      Object.entries(barberCounts)
        .map(([n, c]) => `${n}: ${c} klip`)
        .join(', ') || 'ingen'

    const userMessage = `Periode: seneste ${months} ${months === 1 ? 'måned' : 'måneder'}

Nøgletal:
- Bookinger i alt: ${totalBookings}
- Omsætning: ${totalRevenueKr} kr
- Online bookinger: ${onlineCount} (${onlinePercent}%)
- Telefonbookinger: ${phoneCount} (${phonePercent}%)
- Unikke kunder: ${uniqueCustomers}
- Tilbagevendende kunder: ${repeatCustomers}
- Top ydelser: ${topServicesLine}
- Per frisør: ${barberLine}
- Travleste dag: ${busiestWeekday}

Skriv en analyse der fremhæver: hvad går godt, hvad kan forbedres, og én konkret anbefaling.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system:
          'Du er en forretningsanalytiker for en frisørsalon i Danmark. Skriv en kort, konkret forretningsoversigt på dansk. Brug præcise tal. Undgå generiske råd. Max 300 ord.',
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
    const summaryText = aiData.content?.[0]?.text ?? ''

    if (!summaryText) {
      return new Response(JSON.stringify({ error: 'Empty summary' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const generatedAt = new Date().toISOString()

    const { error: upsertErr } = await supabase.from('business_overviews').upsert(
      {
        period_months: months,
        summary_text: summaryText,
        generated_at: generatedAt,
        stats_json: stats,
      },
      { onConflict: 'period_months' },
    )

    if (upsertErr) {
      return new Response(JSON.stringify({ error: 'Upsert failed', detail: upsertErr.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary_text: summaryText,
        stats_json: stats,
        generated_at: generatedAt,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unexpected', detail: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
