import type { SupabaseClient } from '@supabase/supabase-js'

interface TemplateVars {
  customer_name: string
  barber_name: string
  service: string
  date: string        // "torsdag d. 30. april"
  time: string        // "kl. 11:30"
  address: string     // "Holbækvej 39, 4000 Roskilde"
  cancel_link: string
  rebook_link: string
  shop_name: string
  shop_phone: string
}

export const FALLBACK_TEMPLATES: Record<string, string> = {
  confirmation:
    'Hej {customer_name}. Din tid hos {barber_name} ({service}) er bekræftet {date} {time}. Adresse: {address}. Afbestil: {cancel_link} – {shop_name}',
  reminder_24h:
    'Påmindelse: i morgen {time} hos {barber_name}, {shop_name}. {address}. Afbestil: {cancel_link}',
  customer_cancelled:
    'Din tid {date} {time} hos {barber_name} er afbestilt. Velkommen tilbage. Bestil ny tid: {rebook_link} – {shop_name}',
  shop_cancelled:
    'Vi må desværre aflyse din tid {date} {time}. Vi beklager. Book ny tid uden ventetid: {rebook_link} – {shop_name}',
}

export async function getTemplate(
  id: string,
  supabase: SupabaseClient,
): Promise<{ body: string; source: 'db' | 'fallback'; enabled: boolean }> {
  const { data, error } = await supabase
    .from('sms_templates')
    .select('body_da, enabled')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    console.warn(
      `[templates] getTemplate fallback for id="${id}" (error=${error?.message ?? 'no row'})`,
    )
    return {
      body: FALLBACK_TEMPLATES[id] ?? '',
      source: 'fallback',
      enabled: true,
    }
  }

  return {
    body: (data as { body_da: string; enabled: boolean }).body_da,
    source: 'db',
    enabled: (data as { body_da: string; enabled: boolean }).enabled,
  }
}

export function interpolateTemplate(template: string, vars: TemplateVars): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '')
  }
  return result
}

const WEEKDAY_FULL = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
const MONTH_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
]

export function formatDateDanish(date: Date): string {
  return `${WEEKDAY_FULL[date.getDay()]} d. ${date.getDate()}. ${MONTH_FULL[date.getMonth()]}`
}

export function formatTimeDanish(date: Date): string {
  return `kl. ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}
