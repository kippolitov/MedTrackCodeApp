import { isSameLocalDay, startOfLocalDay, weeksBetween } from './date-utils'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

export type MedicationViewModel = Ppa_medications

export interface AdherenceStats {
  adherencePercent7d: number | null
  streak: number
  missedToday: number
  activeMedicationCount: number
}

export interface OverdueMedication {
  medication: MedicationViewModel
  overdueBy: number
}

export interface IntakeLogViewModel extends Ppa_intakelogs {
  loggedAtDate: Date
  scheduledForDate: Date
}

export interface AdherenceDataPoint {
  periodLabel: string
  periodStart: Date
  adherencePercent: number
  scheduledCount: number
  takenCount: number
}

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

export function scheduledDosesOnDay(
  medications: Ppa_medications[],
  date: Date
): Ppa_medications[] {
  return medications.filter((med) => {
    if (!med.ppa_isactive) return false

    switch (med.ppa_frequency) {
      case 894250000: // Daily
        return true
      case 894250001: { // Weekly
        if (med.ppa_scheduledday == null) return false
        return dateToDayEnum(date) === Number(med.ppa_scheduledday)
      }
      case 894250002: { // Biweekly
        // ppa_startdate lets users set their actual first-dose date;
        // fall back to createdon when it's not set.
        const anchorStr = med.ppa_startdate ?? med.createdon
        if (!anchorStr) return false
        const start = new Date(anchorStr)
        if (date < startOfLocalDay(start)) return false
        const weeks = weeksBetween(start, date)
        return weeks % 2 === 0
      }
      case 894250003: // As-Needed
        return false
      default:
        return false
    }
  })
}

export function takenLogsOnDay(
  logs: Ppa_intakelogs[],
  date: Date
): Ppa_intakelogs[] {
  return logs.filter(
    (log) =>
      log.ppa_status === 894250000 && // Taken
      isSameLocalDay(new Date(log.ppa_loggedat), date)
  )
}

// Counts distinct medication IDs with at least one Taken log on the given day.
// Using distinct IDs (rather than raw log count) prevents duplicate submissions
// from inflating adherence above 100%.
function distinctTakenCountOnDay(logs: Ppa_intakelogs[], date: Date): number {
  const ids = new Set<string>()
  for (const log of logs) {
    if (log.ppa_status === 894250000 && log._ppa_medication_value && isSameLocalDay(new Date(log.ppa_loggedat), date)) {
      ids.add(log._ppa_medication_value)
    }
  }
  return ids.size
}

export function adherence7d(
  medications: Ppa_medications[],
  logs: Ppa_intakelogs[],
  referenceDate: Date = new Date()
): number | null {
  let scheduledTotal = 0
  let takenTotal = 0

  for (let i = 0; i < 7; i++) {
    const day = new Date(referenceDate)
    day.setDate(day.getDate() - i)

    const scheduled = scheduledDosesOnDay(medications, day)
    scheduledTotal += scheduled.length
    takenTotal += distinctTakenCountOnDay(logs, day)
  }

  if (scheduledTotal === 0) return null
  return Math.round((takenTotal / scheduledTotal) * 100)
}

export function currentStreak(
  medications: Ppa_medications[],
  logs: Ppa_intakelogs[],
  referenceDate: Date = new Date()
): number {
  let streak = 0
  const day = startOfLocalDay(new Date(referenceDate))

  for (let i = 0; i < 365; i++) {
    const checkDay = new Date(day)
    checkDay.setDate(checkDay.getDate() - i)

    const scheduled = scheduledDosesOnDay(medications, checkDay)
    if (scheduled.length === 0) continue // rest day — skip

    if (distinctTakenCountOnDay(logs, checkDay) < scheduled.length) break // missed — streak ends

    streak++
  }

  return streak
}

export function missedToday(
  medications: Ppa_medications[],
  logs: Ppa_intakelogs[],
  referenceDate: Date = new Date()
): number {
  const scheduled = scheduledDosesOnDay(medications, referenceDate)
  return Math.max(0, scheduled.length - distinctTakenCountOnDay(logs, referenceDate))
}
