// Brand-aligned status meta for booking rows. Used by Historik, Overblik
// (recent bookings list), and any future surface that needs a coloured pill
// + dot + Danish label for a booking status.
//
// Keep these colours in sync with success/error/warning/info tokens in
// tailwind.config.js — they are deliberately HEX here because the dot,
// pill background, and pill text are three different shades that don't
// map cleanly to one Tailwind token each.

export type StatusKey = 'completed' | 'cancelled' | 'no_show' | 'dismissed'

export interface StatusMeta {
  key: StatusKey
  label: string
  dot: string
  pillBg: string
  pillColor: string
  verb: string
}

export const STATUS_META: Record<StatusKey, StatusMeta> = {
  completed: {
    key: 'completed',
    label: 'Fuldført',
    dot: '#5C7A4A',
    pillBg: '#E3E8D5',
    pillColor: '#3A5030',
    verb: 'fuldført',
  },
  cancelled: {
    key: 'cancelled',
    label: 'Aflyst',
    dot: '#9A2A2A',
    pillBg: '#EFD8D2',
    pillColor: '#9A2A2A',
    verb: 'aflyst',
  },
  no_show: {
    key: 'no_show',
    label: 'Udeblevet',
    dot: '#A89070',
    pillBg: '#F4F4F4',
    pillColor: '#6B5B45',
    verb: 'markeret udeblevet',
  },
  dismissed: {
    key: 'dismissed',
    label: 'Fjernet',
    dot: '#C8B89A',
    pillBg: '#F4F4F4',
    pillColor: '#9A2A2A',
    verb: 'fjernet',
  },
}

// Live-state mapping used by Overblik's recent bookings: confirmed shows the
// "Bekræftet" pill; pending shares it; otherwise the terminal-state mapping
// from STATUS_META applies.
export interface LiveStatusMeta {
  label: string
  dot: string
  pillBg: string
  pillColor: string
}

const CONFIRMED_META: LiveStatusMeta = {
  label: 'Bekræftet',
  dot: '#B08A3E',
  pillBg: '#F1E2C2',
  pillColor: '#8C6A28',
}

export function liveStatusMeta(status: string, dismissedFromCalendar: boolean): LiveStatusMeta {
  if (status === 'confirmed' || status === 'pending') return CONFIRMED_META
  if (status === 'cancelled' && dismissedFromCalendar) {
    const m = STATUS_META.dismissed
    return { label: m.label, dot: m.dot, pillBg: m.pillBg, pillColor: m.pillColor }
  }
  if (status === 'cancelled') {
    const m = STATUS_META.cancelled
    return { label: m.label, dot: m.dot, pillBg: m.pillBg, pillColor: m.pillColor }
  }
  if (status === 'no_show') {
    const m = STATUS_META.no_show
    return { label: m.label, dot: m.dot, pillBg: m.pillBg, pillColor: m.pillColor }
  }
  if (status === 'completed') {
    const m = STATUS_META.completed
    return { label: m.label, dot: m.dot, pillBg: m.pillBg, pillColor: m.pillColor }
  }
  // Unknown status — fall back to a neutral grey pill rather than crashing.
  return {
    label: status,
    dot: '#9CA3AF',
    pillBg: '#F4F4F4',
    pillColor: '#6B5B45',
  }
}
