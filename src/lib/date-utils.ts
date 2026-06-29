import {
  startOfDay,
  endOfDay,
  isSameDay,
  differenceInWeeks,
} from 'date-fns'

export function startOfLocalDay(d: Date): Date {
  return startOfDay(d)
}

export function endOfLocalDay(d: Date): Date {
  return endOfDay(d)
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return isSameDay(a, b)
}

export function weeksBetween(start: Date, end: Date): number {
  return Math.abs(differenceInWeeks(end, start))
}

// How many years back/forward the calendar lets users jump (research R3).
// Wide enough that the year picker pages through multiple 12-year blocks.
const YEARS_BACK = 20
const YEARS_FORWARD = 3

/**
 * Resolve the active BCP-47 locale from the browser, falling back to navigator
 * language and finally 'en-US'. The Power Apps host context exposes no locale,
 * so the browser is authoritative for a web Code App (research R1).
 */
export function resolveLocale(): string {
  try {
    const fromIntl = Intl.DateTimeFormat().resolvedOptions().locale
    if (fromIntl) return fromIntl
  } catch {
    // Intl unavailable — fall through.
  }
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  return 'en-US'
}

/**
 * Format the time-of-day of `date` in the user's (or supplied) locale. Intl
 * decides 12-hour AM/PM vs 24-hour per locale — it is never hardcoded — so US
 * locales render "8:30 AM" and 24-hour locales render "20:30" (FR-009/FR-011).
 */
export function formatTime(date: Date, locale: string = resolveLocale()): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date)
}

/**
 * Format a user-visible date label (month/year heading, selected-day heading)
 * in locale conventions (FR-010). Not for internal keys — those stay on
 * date-fns `yyyy-MM-dd` so grouping is locale-/timezone-stable.
 */
export function formatDateLabel(
  date: Date,
  opts: Intl.DateTimeFormatOptions,
  locale: string = resolveLocale(),
): string {
  return new Intl.DateTimeFormat(locale, opts).format(date)
}

/**
 * Bounded month range offered for navigation: January of (currentYear - YEARS_BACK)
 * through December of (currentYear + YEARS_FORWARD) — i.e. currentYear-20 .. currentYear+3
 * (research R3). Bounds both the header prev/next arrows and the paged year picker (FR-008).
 */
export function getCalendarBounds(reference: Date = new Date()): { startMonth: Date; endMonth: Date } {
  const year = reference.getFullYear()
  return {
    startMonth: new Date(year - YEARS_BACK, 0, 1),
    endMonth: new Date(year + YEARS_FORWARD, 11, 31),
  }
}
