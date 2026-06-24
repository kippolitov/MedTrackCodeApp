/**
 * In-memory mock dataset + store for `--mode mock` dev runs.
 *
 * This module is ONLY loaded when Vite runs in mock mode (see vite.config.ts),
 * where it is aliased in place of the generated Dataverse services. It lets the
 * app run end-to-end in the browser with no Power Apps runtime so data flows can
 * be exercised and visually QA'd.
 *
 * Seed data is intentionally shaped to cover the tricky cases:
 *   - A biweekly med with NO start date → relies on the `createdon` anchor (CR-001).
 *   - A weekly med scheduled on a non-today weekday → must NOT be flagged overdue (WR-001).
 *   - An injection med + logs with injection sites → exercises the body map.
 *   - ~4 weeks of mixed Taken/Missed/Skipped logs → adherence, streak, calendar dots, analytics.
 */
import type { Ppa_medications, Ppa_medicationsppa_scheduledday } from '@/generated/models/Ppa_medicationsModel'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

const Freq = { Daily: 894250000, Weekly: 894250001, Biweekly: 894250002, AsNeeded: 894250003 } as const
const Method = { Pill: 894250000, Injection: 894250001 } as const
const Status = { Taken: 894250000, Skipped: 894250001, Missed: 894250002 } as const
const SITES = [894250000, 894250001, 894250002, 894250003, 894250004] as const

// JS getDay() (0=Sun..6=Sat) → Dataverse ppa_scheduledday enum
const DOW_TO_ENUM: Record<number, number> = {
  0: 894250006, 1: 894250000, 2: 894250001, 3: 894250002, 4: 894250003, 5: 894250004, 6: 894250005,
}

function dayAt(daysAgo: number, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(h, m, 0, 0)
  return d
}

function isoNoon(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}

// Pick a weekday that is guaranteed NOT to be today, so the weekly med is never
// scheduled "today" regardless of which day QA runs on (WR-001 stays demonstrable).
const notTodayDayEnum = DOW_TO_ENUM[(new Date().getDay() + 2) % 7] as Ppa_medicationsppa_scheduledday

function med(p: Partial<Ppa_medications>): Ppa_medications {
  return {
    ppa_sortorder: 0,
    ppa_isactive: true,
    ...p,
  } as Ppa_medications
}

export const medications: Ppa_medications[] = [
  med({
    ppa_medicationid: 'med-metformin', ppa_name: 'Metformin', ppa_dosage: '500 mg',
    ppa_frequency: Freq.Daily, ppa_method: Method.Pill, ppa_remindertime: '06:00',
    ppa_instructions: 'Take with breakfast.', createdon: isoNoon(90), ppa_sortorder: 1,
  }),
  med({
    ppa_medicationid: 'med-insulin', ppa_name: 'Insulin Glargine', ppa_dosage: '20 units',
    ppa_frequency: Freq.Daily, ppa_method: Method.Injection, ppa_remindertime: '21:30',
    ppa_instructions: 'Rotate injection sites.', createdon: isoNoon(120), ppa_sortorder: 2,
  }),
  med({
    ppa_medicationid: 'med-vitd', ppa_name: 'Vitamin D', ppa_dosage: '2000 IU',
    ppa_frequency: Freq.Weekly, ppa_scheduledday: notTodayDayEnum, ppa_method: Method.Pill,
    ppa_remindertime: '07:00', createdon: isoNoon(200), ppa_sortorder: 3,
  }),
  med({
    // Biweekly with NO ppa_startdate → scheduling falls back to createdon (CR-001).
    // createdon is 14 days ago → an "on" week today.
    ppa_medicationid: 'med-adalimumab', ppa_name: 'Adalimumab', ppa_dosage: '40 mg',
    ppa_frequency: Freq.Biweekly, ppa_scheduledday: DOW_TO_ENUM[new Date().getDay()] as Ppa_medicationsppa_scheduledday,
    ppa_method: Method.Injection, ppa_remindertime: '20:00',
    ppa_instructions: 'Refrigerate. Let reach room temperature before injecting.',
    createdon: isoNoon(14), ppa_sortorder: 4,
  }),
  med({
    ppa_medicationid: 'med-ibuprofen', ppa_name: 'Ibuprofen', ppa_dosage: '200 mg',
    ppa_frequency: Freq.AsNeeded, ppa_method: Method.Pill, createdon: isoNoon(30), ppa_sortorder: 5,
  }),
  med({
    ppa_medicationid: 'med-lisinopril', ppa_name: 'Lisinopril (discontinued)', ppa_dosage: '10 mg',
    ppa_frequency: Freq.Daily, ppa_method: Method.Pill, ppa_remindertime: '08:00',
    ppa_isactive: false, createdon: isoNoon(300), ppa_sortorder: 6,
  }),
]

function log(p: Partial<Ppa_intakelogs>): Ppa_intakelogs {
  return p as Ppa_intakelogs
}

function buildSeedLogs(): Ppa_intakelogs[] {
  const out: Ppa_intakelogs[] = []
  let n = 0
  const add = (medId: string, name: string, at: Date, status: number, site?: number) => {
    out.push(log({
      ppa_intakelogid: `log-${n++}`,
      ppa_logname: name,
      ppa_loggedat: at.toISOString(),
      ppa_scheduledfor: at.toISOString(),
      ppa_status: status as Ppa_intakelogs['ppa_status'],
      ppa_injectionsite: site as Ppa_intakelogs['ppa_injectionsite'],
      ppa_medicationname: name,
      _ppa_medication_value: medId,
    }))
  }

  // Last 28 days, deterministic pattern (no logs for today → leaves doses pending/overdue).
  for (let d = 1; d <= 28; d++) {
    const date = dayAt(d, '00:00')

    // Metformin (daily pill): mostly taken, occasional miss/skip
    const mStatus = d % 7 === 2 ? Status.Missed : d % 9 === 0 ? Status.Skipped : Status.Taken
    add('med-metformin', 'Metformin', dayAt(d, '06:05'), mStatus)

    // Insulin (daily injection): taken most days, rotating sites, a few gaps
    if (d % 6 !== 0) {
      add('med-insulin', 'Insulin Glargine', dayAt(d, '21:35'), Status.Taken, SITES[d % SITES.length])
    }

    // Vitamin D (weekly): only on its scheduled weekday
    if (DOW_TO_ENUM[date.getDay()] === notTodayDayEnum) {
      add('med-vitd', 'Vitamin D', dayAt(d, '07:05'), Status.Taken)
    }
  }

  // Adalimumab (biweekly injection): on its "on" weeks
  add('med-adalimumab', 'Adalimumab', dayAt(14, '20:05'), Status.Taken, SITES[1])
  add('med-adalimumab', 'Adalimumab', dayAt(28, '20:05'), Status.Taken, SITES[3])

  return out
}

export const intakeLogs: Ppa_intakelogs[] = buildSeedLogs()

export function newId(prefix: string): string {
  return `${prefix}-${(crypto.randomUUID?.() ?? String(Math.random()).slice(2))}`
}

export function medicationNameById(id?: string): string {
  return medications.find((m) => m.ppa_medicationid === id)?.ppa_name ?? 'Unknown'
}

// Simulated network latency so loading states are visible during QA.
export function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
