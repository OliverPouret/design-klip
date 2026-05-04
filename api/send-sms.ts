import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './_lib/supabase-admin.js'
import { sendSms } from './_lib/sms.js'
import { interpolateTemplate, formatDateDanish, formatTimeDanish } from './_lib/templates.js'

const VALID_TYPES = ['confirmation', 'cancellation_customer'] as const
type SmsType = typeof VALID_TYPES[number]

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
  customer: { phone_e164: string; full_name: string }
  barber: { display_name: string }
  service: { name_da: string }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { type, bookingId } = req.body as { type?: string; bookingId?: string }

  if (!type || !VALID_TYPES.includes(type as SmsType)) {
    return res.status(400).json({ error: 'Invalid type' })
  }
  if (!bookingId) {
    return res.status(400).json({ error: 'Missing bookingId' })
  }

  const supabase = getSupabaseAdmin()

  // Rate limit: same SMS already sent for this booking?
  const { data: existingLog } = await supabase
    .from('sms_log')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('template_id', type)
    .limit(1)

  if (existingLog && existingLog.length > 0) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'already_sent' })
  }

  // Fetch booking with customer, service, barber
  const { data: bookingRaw, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id, short_code, starts_at, cancel_token,
      customer:customers!inner(phone_e164, full_name),
      barber:barbers!inner(display_name),
      service:services!inner(name_da)
    `)
    .eq('id', bookingId)
    .single()

  if (bookingError || !bookingRaw) {
    return res.status(404).json({ error: 'Booking not found' })
  }

  const booking = bookingRaw as unknown as BookingJoined

  // Rate limit: max 5 SMS per phone in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('sms_log')
    .select('id', { count: 'exact', head: true })
    .eq('to_phone', booking.customer.phone_e164)
    .gte('created_at', oneHourAgo)

  if ((recentCount ?? 0) >= 5) {
    return res.status(429).json({ error: 'Rate limit exceeded' })
  }

  // Fetch template
  const { data: template } = await supabase
    .from('sms_templates')
    .select('body_da')
    .eq('id', type)
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

  const startsAt = new Date(booking.starts_at)
  const appUrl = process.env.VITE_APP_URL || 'https://design-klip.vercel.app'

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

  // Send
  const result = await sendSms({
    to: booking.customer.phone_e164,
    message,
  })

  // Log
  await supabase.from('sms_log').insert({
    booking_id: bookingId,
    template_id: type,
    to_phone: booking.customer.phone_e164,
    body: message,
    provider: 'gatewayapi',
    provider_message_id: result.messageId || null,
    status: result.success ? 'sent' : 'failed',
    error: result.error || null,
    sent_at: result.success ? new Date().toISOString() : null,
  })

  return res.status(200).json({ ok: result.success, messageId: result.messageId })
}
