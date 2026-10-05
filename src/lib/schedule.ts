import { differenceInCalendarDays } from 'date-fns'
import { startOfLocalDay } from './date-utils'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'

// Maps JS getDay() (0=Sun, 1=Mon, ..., 6=Sat) to Dataverse ppa_scheduledday enum keys
const DOW_TO_SCHEDULED_DAY: Record<number, number> = {
  0: 894250006, // Sun
  1: 894250000, // Mon
  2: 894250001, // Tue
  3: 894250002, // Wed
  4: 894250003, // Thu
  5: 894250004, // Fri
  6: 894250005, // Sat
}

function dateToDayEnum(date: Date): number {
  return DOW_TO_SCHEDULED_DAY[date.getDay()] ?? -1
}

// ppa_startdate is a DateOnly column ("2026-06-01"). `new Date()` would read
// that as UTC midnight, which is the previous calendar day west of UTC, so
// build the local date from its parts instead.
function parseDateOnly(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// Week-0 anchor for Biweekly: the explicit start date, falling back to the
// record creation date (matches the form's "leave blank to use creation date").
function biweeklyAnchor(med: Ppa_medications): Date | null {
  if (med.ppa_startdate) return parseDateOnly(med.ppa_startdate)
  if (med.createdon) return startOfLocalDay(new Date(med.createdon))
  return null
}

/**
 * Whether `med` has a Dose scheduled on `date` under the fixed schedule.
 * Ignores ppa_isactive — callers decide whether paused medications count.
 */
export function isScheduledOn(med: Ppa_medications, date: Date): boolean {
  switch (med.ppa_frequency) {
    case 894250000: // Daily
      return true
    case 894250001: { // Weekly
      if (med.ppa_scheduledday == null) return false
      return dateToDayEnum(date) === Number(med.ppa_scheduledday)
    }
    case 894250002: { // Biweekly
      const anchor = biweeklyAnchor(med)
      if (!anchor) return false // no anchor available — not schedulable
      const days = differenceInCalendarDays(date, anchor)
      if (days < 0) return false
      // Seven-day blocks counted from the anchor; only even blocks are "on".
      if (Math.floor(days / 7) % 2 !== 0) return false
      // One Dose per "on" block: the scheduled day, or the anchor's own
      // weekday when none is set.
      const scheduledDay =
        med.ppa_scheduledday != null ? Number(med.ppa_scheduledday) : dateToDayEnum(anchor)
      return dateToDayEnum(date) === scheduledDay
    }
    case 894250003: // As-Needed
      return false
    default:
      return false
  }
}
