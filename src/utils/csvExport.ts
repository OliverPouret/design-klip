export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (cell: string | number): string => {
    if (typeof cell === 'number') return String(cell)
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`
    }
    return cell
  }

  const csv = [headers.join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n')

  // BOM so Excel reads UTF-8 correctly (preserves æøå)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
