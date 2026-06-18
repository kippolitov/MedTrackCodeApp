export interface IntakeLogRow {
  medicationName: string
  loggedAt: Date
  status: string
  injectionSite?: string
  notes?: string
}

export function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function buildCsvString(rows: IntakeLogRow[]): string {
  const header = 'Medication,Date,Time,Status,Injection Site,Notes'
  const lines = rows.map((r) =>
    [
      csvEscape(r.medicationName),
      csvEscape(formatDate(r.loggedAt)),
      csvEscape(formatTime(r.loggedAt)),
      csvEscape(r.status),
      csvEscape(r.injectionSite ?? ''),
      csvEscape(r.notes ?? ''),
    ].join(',')
  )
  return [header, ...lines].join('\n')
}

export function downloadCsv(rows: IntakeLogRow[], filename: string): void {
  const csv = buildCsvString(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
