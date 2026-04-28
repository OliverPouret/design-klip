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
