import { describe, it, expect } from 'vitest'
import { formatTime, formatDateLabel, getCalendarBounds, resolveLocale } from '@/lib/date-utils'

// Helper: a Date at a specific local wall-clock time today.
function at(hours: number, minutes: number): Date {
  const d = new Date()
  d.setHours(hours, minutes, 0, 0)
  return d
}

describe('resolveLocale', () => {
  it('returns a non-empty BCP-47 locale string usable by Intl', () => {
    const locale = resolveLocale()
    expect(typeof locale).toBe('string')
    expect(locale.length).toBeGreaterThan(0)
    // Must not throw when handed to Intl.
    expect(() => new Intl.DateTimeFormat(locale)).not.toThrow()
  })
})

describe('formatTime', () => {
  it('uses 12-hour AM/PM for en-US', () => {
    expect(formatTime(at(8, 30), 'en-US')).toMatch(/8:30\s?AM/i)
    expect(formatTime(at(20, 30), 'en-US')).toMatch(/8:30\s?PM/i)
  })

  it('uses 24-hour (no AM/PM) for en-GB and de-DE', () => {
    const gb = formatTime(at(20, 30), 'en-GB')
    expect(gb).toMatch(/20:30/)
    expect(gb).not.toMatch(/AM|PM/i)

    const de = formatTime(at(20, 30), 'de-DE')
    expect(de).toMatch(/20:30/)
    expect(de).not.toMatch(/AM|PM/i)
  })

  it('renders noon correctly per locale', () => {
    expect(formatTime(at(12, 0), 'en-US')).toMatch(/12:00\s?PM/i)
    expect(formatTime(at(12, 0), 'en-GB')).toMatch(/12:00/)
  })

  it('renders midnight correctly per locale', () => {
    expect(formatTime(at(0, 0), 'en-US')).toMatch(/12:00\s?AM/i)
    const gb = formatTime(at(0, 0), 'en-GB')
    // 24-hour midnight: hour 0 (with or without leading zero), never 24-hour AM/PM.
    expect(gb).toMatch(/^0?0:00/)
    expect(gb).not.toMatch(/AM|PM/i)
  })
})

describe('formatDateLabel', () => {
  const d = new Date(2026, 5, 25) // 25 June 2026

  it('formats a long date in en-US conventions', () => {
    const out = formatDateLabel(d, { year: 'numeric', month: 'long', day: 'numeric' }, 'en-US')
    expect(out).toMatch(/June/)
    expect(out).toMatch(/25/)
    expect(out).toMatch(/2026/)
  })

  it('formats a long date in de-DE conventions', () => {
    const out = formatDateLabel(d, { year: 'numeric', month: 'long', day: 'numeric' }, 'de-DE')
    expect(out).toMatch(/Juni/)
    expect(out).toMatch(/2026/)
  })
})

describe('getCalendarBounds', () => {
  it('spans currentYear-20 (January) to currentYear+3 (December)', () => {
    const ref = new Date(2026, 5, 1)
    const { startMonth, endMonth } = getCalendarBounds(ref)
    expect(startMonth.getFullYear()).toBe(2006)
    expect(startMonth.getMonth()).toBe(0)
    expect(endMonth.getFullYear()).toBe(2029)
    expect(endMonth.getMonth()).toBe(11)
  })
})
