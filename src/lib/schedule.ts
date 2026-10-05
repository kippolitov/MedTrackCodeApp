import { addDays, differenceInCalendarDays } from 'date-fns'
import { isSameLocalDay, startOfLocalDay } from './date-utils'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import type { Ppa_intakelogs, Ppa_intakelogsppa_injectionsite } from '@/generated/models/Ppa_intakelogsModel'

const FREQUENCY_DAILY = 894250000
const FREQUENCY_WEEKLY = 894250001
const FREQUENCY_BIWEEKLY = 894250002
const FREQUENCY_AS_NEEDED = 894250003
const METHOD_INJECTION = 894250001
const STATUS_TAKEN = 894250000
const STATUS_SKIPPED = 894250001

// A follow-up is owed on these days after a Missed Intake, and never after the 7th.
const FOLLOW_UP_DAYS = [1, 3, 5, 7]

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

// The day the schedule starts counting from: the explicit start date, falling
// back to the record creation date (matches the form's "leave blank to use
// creation date"). Week 0 for Biweekly, and the earliest date an intake can
// count as missed.
function scheduleAnchor(med: Ppa_medications): Date | null {
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
    case FREQUENCY_DAILY:
      return true
    case FREQUENCY_WEEKLY: {
      if (med.ppa_scheduledday == null) return false
      return dateToDayEnum(date) === Number(med.ppa_scheduledday)
    }
    case FREQUENCY_BIWEEKLY: {
      const anchor = scheduleAnchor(med)
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
    case FREQUENCY_AS_NEEDED:
      return false
    default:
      return false
  }
}

export type ScheduleKind = 'rolling' | 'fixed' | 'as-needed' | 'inactive' | 'unscheduled'

export type ScheduleStatus = 'due-today' | 'past-due' | 'upcoming' | 'none'

export interface ScheduleDetails {
  kind: ScheduleKind
  /** Latest Taken Intake Log that is not in the future. The site is set for Injections only. */
  lastTaken: { at: Date; site?: Ppa_intakelogsppa_injectionsite } | null
  /** Local start-of-day of the Next Intake; null when there is none to show. */
  nextIntake: Date | null
  status: ScheduleStatus
  /** The date the Missed Intake was due; set only while Past Due. */
  missedDueDate: Date | null
  /** Whole days since `missedDueDate`; set only while Past Due. */
  daysPastDue: number | null
  /** True on the 1st, 3rd, 5th and 7th day after a Missed Intake. */
  followUpDue: boolean
}

export interface LatestIntakeLogs {
  /** Latest log with status Taken and `ppa_loggedat` not in the future. */
  lastTaken: Ppa_intakelogs | null | undefined
  /** Latest log with status Skipped and `ppa_loggedat` not in the future. */
  lastSkipped: Ppa_intakelogs | null | undefined
}

function intervalDays(med: Ppa_medications): number | null {
  switch (med.ppa_frequency) {
    case FREQUENCY_DAILY:
      return 1
    case FREQUENCY_WEEKLY:
      return 7
    case FREQUENCY_BIWEEKLY:
      return 14
    default:
      return null
  }
}

// The local day of a log, or null when the log does not have the expected
// status. Logs with status Missed never resolve an intake.
function resolvedDay(log: Ppa_intakelogs | null | undefined, status: number): Date | null {
  if (!log || log.ppa_status !== status) return null
  return startOfLocalDay(new Date(log.ppa_loggedat))
}

// Scheduled dates are at most 14 days apart (Biweekly), so a 14-day window on
// either side of a day always contains the neighbouring scheduled date.
const SEARCH_WINDOW_DAYS = 14

function nextScheduledAfter(med: Ppa_medications, day: Date, anchor: Date | null): Date | null {
  // A Biweekly schedule that has not started yet begins at its anchor.
  let from = addDays(day, 1)
  if (med.ppa_frequency === FREQUENCY_BIWEEKLY && anchor && anchor > from) from = anchor
  for (let i = 0; i < SEARCH_WINDOW_DAYS; i++) {
    const candidate = addDays(from, i)
    if (isScheduledOn(med, candidate)) return candidate
  }
  return null
}

function previousScheduledBefore(med: Ppa_medications, day: Date, anchor: Date | null): Date | null {
  // Without an anchor there is no way to tell whether the Medication existed
  // on an earlier scheduled date, so nothing counts as missed.
  if (!anchor) return null
  for (let i = 1; i <= SEARCH_WINDOW_DAYS; i++) {
    const candidate = addDays(day, -i)
    if (candidate < anchor) return null
    if (isScheduledOn(med, candidate)) return candidate
  }
  return null
}

function pastDue(missedDueDate: Date, day: Date) {
  const daysPastDue = differenceInCalendarDays(day, missedDueDate)
  return { missedDueDate, daysPastDue, followUpDue: FOLLOW_UP_DAYS.includes(daysPastDue) }
}

/**
 * When `medication` was last taken, when it is next due, and whether an
 * intake was missed. The rules and their decision table are in
 * specs/004-schedule-page-reminders/contracts/schedule-rules.contract.md; the
 * "MedTrack – Daily Reminder" cloud flow implements the same rules.
 *
 * Pure: `today` is passed in and only its calendar day is used.
 */
export function computeSchedule(
  medication: Ppa_medications,
  { lastTaken, lastSkipped }: LatestIntakeLogs,
  today: Date,
): ScheduleDetails {
  const day = startOfLocalDay(today)
  const takenDay = resolvedDay(lastTaken, STATUS_TAKEN)
  const skippedDay = resolvedDay(lastSkipped, STATUS_SKIPPED)
  // The later of the two: the last day the intake was dealt with either way.
  const resolved = takenDay && skippedDay ? (takenDay > skippedDay ? takenDay : skippedDay) : (takenDay ?? skippedDay)
  const isInjection = medication.ppa_method === METHOD_INJECTION

  const details: ScheduleDetails = {
    kind: 'fixed',
    lastTaken:
      lastTaken && takenDay
        ? {
            at: new Date(lastTaken.ppa_loggedat),
            ...(isInjection && lastTaken.ppa_injectionsite != null ? { site: lastTaken.ppa_injectionsite } : {}),
          }
        : null,
    nextIntake: null,
    status: 'none',
    missedDueDate: null,
    daysPastDue: null,
    followUpDue: false,
  }

  // Step 1 — kind, first match wins.
  if (!medication.ppa_isactive) return { ...details, kind: 'inactive' }
  if (medication.ppa_frequency === FREQUENCY_AS_NEEDED) return { ...details, kind: 'as-needed' }

  const interval = intervalDays(medication)
  const anchor = scheduleAnchor(medication)

  // Step 2 — rolling schedule: an Injection counts from the last dose.
  if (isInjection && resolved && interval != null) {
    const due = addDays(resolved, interval)
    if (due > day) return { ...details, kind: 'rolling', status: 'upcoming', nextIntake: due }
    if (isSameLocalDay(due, day)) return { ...details, kind: 'rolling', status: 'due-today', nextIntake: day }
    return { ...details, kind: 'rolling', status: 'past-due', ...pastDue(due, day) }
  }

  const unscheduled =
    interval == null ||
    (medication.ppa_frequency === FREQUENCY_WEEKLY && medication.ppa_scheduledday == null) ||
    (medication.ppa_frequency === FREQUENCY_BIWEEKLY && medication.ppa_scheduledday == null && !anchor)
  if (unscheduled) return { ...details, kind: 'unscheduled' }

  // Step 3 — fixed schedule.
  const resolvedToday = resolved != null && isSameLocalDay(resolved, day)
  if (isScheduledOn(medication, day) && !resolvedToday) {
    return { ...details, status: 'due-today', nextIntake: day }
  }

  const nextIntake = nextScheduledAfter(medication, day, anchor)
  const previousDue = previousScheduledBefore(medication, day, anchor)
  const missed = previousDue != null && !(resolved != null && resolved >= previousDue)
  if (missed) return { ...details, status: 'past-due', nextIntake, ...pastDue(previousDue, day) }

  return { ...details, status: 'upcoming', nextIntake }
}
