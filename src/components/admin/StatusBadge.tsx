const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  confirmed: { label: 'Bekræftet', bg: '#DEF7EC', text: '#03543F' },
  pending: { label: 'Afventer', bg: '#FEF3C7', text: '#92400E' },
  completed: { label: 'Fuldført', bg: '#F3F4F6', text: '#6B7280' },
  no_show: { label: 'Udeblevet', bg: '#FDE8E8', text: '#9B1C1C' },
  cancelled: { label: 'Afbestilt', bg: '#F3F4F6', text: '#9CA3AF' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span
      className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  )
}
