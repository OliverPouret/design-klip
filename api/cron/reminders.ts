import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from '../_lib/supabase-admin.ts'
import { sendSms } from '../_lib/sms.ts'
import { interpolateTemplate, formatDateDanish, formatTimeDanish } from '../_lib/templates.ts'

interface ShopAddress {
  street?: string
  city?: string
  zip?: string
}

interface BookingJoined {
  id: string
  short_code: string
  starts_at: string
  cancel_token: string
  reminder_sent_at: string | null
  customer: { phone_e164: string; full_name: string }
  barber: { display_name: string }
  service: { name_da: string }
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseAdmin()

  // Find bookings starting in 23.5–24.5 hours that haven't been reminded
  const now = new Date()
  const from = new Date(now.getTime() + 23.5 * 60 * 60 * 1000)
  const to = new Date(now.getTime() + 24.5 * 60 * 60 * 1000)

  const { data: bookingsRaw, error } = await supabase
    .from('bookings')
    .select(`
      id, short_code, starts_at, cancel_token, reminder_sent_at,
      customer:customers!inner(phone_e164, full_name),
      barber:barbers!inner(display_name),
      service:services!inner(name_da)
    `)
    .in('status', ['confirmed', 'pending'])
    .is('reminder_sent_at', null)
    .gte('starts_at', from.toISOString())
    .lte('starts_at', to.toISOString())

  if (error) {
    console.error('Reminder query failed:', error)
    return res.status(500).json({ error: 'Query failed' })
  }

  const bookings = (bookingsRaw ?? []) as unknown as BookingJoined[]

  if (bookings.length === 0) {
    return res.status(200).json({ sent: 0 })
  }

  // Fetch reminder template
  const { data: template } = await supabase
    .from('sms_templates')
    .select('body_da')
    .eq('id', 'reminder_24h')
    .single()

  if (!template) {
    return res.status(500).json({ error: 'Template not found' })
  }

  // Fetch shop settings
  const { data: settingsRows } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['shop_name', 'shop_phone', 'shop_address'])

  const settings: Record<string, unknown> = {}
  settingsRows?.forEach((r: { key: string; value: unknown }) => { settings[r.key] = r.value })

  const shopAddress = settings.shop_address as ShopAddress | undefined
  const address = shopAddress
    ? `${shopAddress.street}, ${shopAddress.zip} ${shopAddress.city}`
    : 'Holbækvej 39, 4000 Roskilde'

  const appUrl = process.env.VITE_APP_URL || 'https://design-klip.vercel.app'

  let sentCount = 0

  for (const booking of bookings) {
    const startsAt = new Date(booking.starts_at)

    const message = interpolateTemplate((template as { body_da: string }).body_da, {
      customer_name: booking.customer.full_name,
      barber_name: booking.barber.display_name,
      service: booking.service.name_da,
      date: formatDateDanish(startsAt),
      time: formatTimeDanish(startsAt),
      address: address,
      cancel_link: `${appUrl}/afbestil/${booking.cancel_token}`,
      rebook_link: `${appUrl}/bestil`,
      shop_name: (settings.shop_name as string) || 'Design Klip',
      shop_phone: (settings.shop_phone as string) || '+45 46 35 93 48',
    })

    const result = await sendSms({
      to: booking.customer.phone_e164,
      message,
    })

    // Log
    await supabase.from('sms_log').insert({
      booking_id: booking.id,
      template_id: 'reminder_24h',
      to_phone: booking.customer.phone_e164,
      body: message,
      provider: 'gatewayapi',
      provider_message_id: result.messageId || null,
      status: result.success ? 'sent' : 'failed',
      error: result.error || null,
      sent_at: result.success ? new Date().toISOString() : null,
    })

    // Mark as reminded only if send succeeded — we don't want to spam retries,
    // but a failed send shouldn't permanently block the reminder either.
    if (result.success) {
      await supabase
        .from('bookings')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('id', booking.id)
      sentCount++
    }
  }

  return res.status(200).json({ sent: sentCount, total: bookings.length })
}
