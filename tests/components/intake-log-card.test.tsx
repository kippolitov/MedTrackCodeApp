import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import IntakeLogCard from '@/components/intake/intake-log-card'
import { formatTime } from '@/lib/date-utils'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

function makeLog(date: Date): Ppa_intakelogs {
  return {
    ppa_intakelogid: 'log1',
    ppa_logname: 'Metformin',
    ppa_loggedat: date.toISOString(),
    ppa_status: 894250000,
  } as Ppa_intakelogs
}

function logAt(hours: number, minutes: number): { log: Ppa_intakelogs; date: Date } {
  const d = new Date()
  d.setHours(hours, minutes, 0, 0)
  return { log: makeLog(d), date: d }
}

describe('IntakeLogCard localized time', () => {
  it('renders the time via the shared locale-aware formatter (not raw HH:mm)', () => {
    const { log, date } = logAt(20, 30)
    render(<IntakeLogCard log={log} onEdit={() => {}} onDelete={async () => {}} />)
    // The card must show exactly what formatTime produces for the runtime locale...
    expect(screen.getByText(formatTime(date))).toBeInTheDocument()
  })

  it('does not render the old zero-padded 24h string under a 12-hour locale', () => {
    const { log, date } = logAt(20, 30)
    render(<IntakeLogCard log={log} onEdit={() => {}} onDelete={async () => {}} />)
    const localized = formatTime(date, 'en-US')
    // Under en-US the formatter yields "8:30 PM"; assert that form is what's shown
    // (skips only if the test environment locale is not 12-hour).
    if (/AM|PM/i.test(localized)) {
      expect(screen.getByText(/8:30\s?PM/i)).toBeInTheDocument()
      expect(screen.queryByText('20:30')).not.toBeInTheDocument()
    }
  })
})
