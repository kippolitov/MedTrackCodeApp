import { describe, it, expect } from 'vitest'
import { addDays, format, startOfDay } from 'date-fns'
import fixture from '../fixtures/schedule-cases.json'
import { computeSchedule, type ScheduleDetails } from '@/lib/schedule'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

// The contract's decision table is written for Monday 5 October 2026. The
// fixture stores offsets, so any day works; this one keeps failures readable
// against specs/004-schedule-page-reminders/contracts/schedule-rules.contract.md.
const NOW = new Date(2026, 9, 5, 12, 0, 0, 0)
const TODAY = startOfDay(NOW)

const FREQUENCY = { Daily: 894250000, Weekly: 894250001, Biweekly: 894250002, AsNeeded: 894250003 } as const
const METHOD = { Pill: 894250000, Injection: 894250001 } as const
const STATUS = { Taken: 894250000, Skipped: 894250001, Missed: 894250002 } as const
// JS getDay() (0=Sun..6=Sat) → Dataverse ppa_scheduledday
const DOW_TO_ENUM = [894250006, 894250000, 894250001, 894250002, 894250003, 894250004, 894250005] as const

type Case = (typeof fixture.cases)[number]
type CaseLog = Case['logs'][number]

function day(offset: number): Date {
  return addDays(TODAY, offset)
}

function at(offset: number, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = day(offset)
  d.setHours(h, m, 0, 0)
  return d
}

function toMedication(c: Case): Ppa_medications {
  return {
    ppa_medicationid: c.id,
    ppa_name: `${c.id} ${c.label}`,
    ppa_dosage: '1 unit',
    ppa_frequency: FREQUENCY[c.frequency as keyof typeof FREQUENCY],
    ppa_method: METHOD[c.method as keyof typeof METHOD],
    ppa_isactive: c.active,
    ppa_scheduledday:
      c.scheduledDayOffset == null ? undefined : DOW_TO_ENUM[day(c.scheduledDayOffset).getDay()],
    ppa_startdate: c.startDateOffset == null ? undefined : format(day(c.startDateOffset), 'yyyy-MM-dd'),
    createdon: at(c.createdOffset, '12:00').toISOString(),
  } as Ppa_medications
}

function toLog(c: Case, log: CaseLog, index: number): Ppa_intakelogs {
  return {
    ppa_intakelogid: `${c.id}-log-${index}`,
    ppa_loggedat: at(log.dayOffset, log.time).toISOString(),
    ppa_status: STATUS[log.status as keyof typeof STATUS],
    ppa_injectionsite: log.site ?? undefined,
    _ppa_medication_value: c.id,
  } as Ppa_intakelogs
}

// What the two card queries return: the newest log of one status that is not
// in the future (`ppa_loggedat le <now>`, newest first, top 1).
function latest(c: Case, status: keyof typeof STATUS): Ppa_intakelogs | null {
  const logs = c.logs
    .map((log, i) => toLog(c, log, i))
    .filter((log) => log.ppa_status === STATUS[status] && new Date(log.ppa_loggedat) <= NOW)
    .sort((a, b) => Date.parse(b.ppa_loggedat) - Date.parse(a.ppa_loggedat))
  return logs[0] ?? null
}

function run(c: Case): ScheduleDetails {
  return computeSchedule(
    toMedication(c),
    { lastTaken: latest(c, 'Taken'), lastSkipped: latest(c, 'Skipped') },
    NOW,
  )
}

function offsetOf(date: Date | null): number | null {
  if (date == null) return null
  return Math.round((startOfDay(date).getTime() - TODAY.getTime()) / 86_400_000)
}

// What the daily email does with a Medication, derived from the same details.
function emailFor(details: ScheduleDetails): 'due' | 'follow-up' | 'none' {
  if (details.status === 'due-today') return 'due'
  if (details.followUpDue) return 'follow-up'
  return 'none'
}

describe('computeSchedule — decision table S01–S33', () => {
  it('the fixture has one case per row', () => {
    expect(fixture.cases.map((c) => c.id)).toEqual(
      Array.from({ length: 33 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
    )
  })

  it.each(fixture.cases.map((c) => [c.id, c.label, c] as const))('%s %s', (_id, _label, c) => {
    const details = run(c)

    expect(details.kind).toBe(c.expect.kind)
    expect(details.status).toBe(c.expect.status)
    expect(offsetOf(details.nextIntake)).toBe(c.expect.nextIntakeOffset)
    expect(offsetOf(details.missedDueDate)).toBe(c.expect.missedDueOffset)
    expect(details.daysPastDue).toBe(c.expect.daysPastDue)
    expect(details.followUpDue).toBe(c.expect.followUpDue)
    expect(offsetOf(details.lastTaken?.at ?? null)).toBe(c.expect.lastTakenOffset)
    expect(emailFor(details)).toBe(c.expect.email)
  })

  it('produces the email lists the contract expects for the full table', () => {
    const listed = (kind: 'due' | 'follow-up') =>
      fixture.cases.filter((c) => emailFor(run(c)) === kind).map((c) => c.id)

    expect(listed('due')).toEqual(['S01', 'S03', 'S04', 'S12', 'S17', 'S18', 'S25', 'S27', 'S29'])
    expect(listed('follow-up')).toEqual(['S06', 'S08', 'S09', 'S13', 'S21', 'S23', 'S26'])
  })
})

describe('computeSchedule — rules', () => {
  function med(overrides: Partial<Ppa_medications> = {}): Ppa_medications {
    return {
      ppa_medicationid: 'm1',
      ppa_name: 'Test',
      ppa_dosage: '1 unit',
      ppa_frequency: FREQUENCY.Weekly,
      ppa_method: METHOD.Pill,
      ppa_isactive: true,
      ppa_scheduledday: DOW_TO_ENUM[TODAY.getDay()],
      createdon: at(-34, '12:00').toISOString(),
      ...overrides,
    } as Ppa_medications
  }

  function log(status: keyof typeof STATUS, offset: number, site?: number): Ppa_intakelogs {
    return {
      ppa_intakelogid: `${status}-${offset}`,
      ppa_loggedat: at(offset, '08:30').toISOString(),
      ppa_status: STATUS[status],
      ppa_injectionsite: site,
      _ppa_medication_value: 'm1',
    } as Ppa_intakelogs
  }

  const none = { lastTaken: null, lastSkipped: null }

  it('ignores a log with status Missed even when it is passed in as the latest log', () => {
    // A Missed log never resolves an intake: an injection whose only log is
    // Missed has no rolling anchor, and a pill is still due.
    const missed = log('Missed', 0)
    const pill = computeSchedule(med(), { lastTaken: missed, lastSkipped: null }, NOW)
    expect(pill.status).toBe('due-today')
    expect(pill.lastTaken).toBeNull()

    const injection = computeSchedule(
      med({ ppa_method: METHOD.Injection }),
      { lastTaken: null, lastSkipped: missed },
      NOW,
    )
    expect(injection.kind).toBe('fixed')
  })

  it('kind precedence: inactive beats as-needed', () => {
    const details = computeSchedule(
      med({ ppa_isactive: false, ppa_frequency: FREQUENCY.AsNeeded, ppa_method: METHOD.Injection }),
      { lastTaken: log('Taken', -3), lastSkipped: null },
      NOW,
    )
    expect(details.kind).toBe('inactive')
  })

  it('kind precedence: as-needed beats rolling', () => {
    const details = computeSchedule(
      med({ ppa_frequency: FREQUENCY.AsNeeded, ppa_method: METHOD.Injection }),
      { lastTaken: log('Taken', -3), lastSkipped: null },
      NOW,
    )
    expect(details.kind).toBe('as-needed')
  })

  it('kind precedence: rolling beats unscheduled', () => {
    // Weekly injection with no scheduled day would be unscheduled, but a log
    // gives it a rolling schedule.
    const details = computeSchedule(
      med({ ppa_method: METHOD.Injection, ppa_scheduledday: undefined }),
      { lastTaken: log('Taken', -3), lastSkipped: null },
      NOW,
    )
    expect(details.kind).toBe('rolling')
  })

  it('kind precedence: unscheduled beats fixed', () => {
    expect(computeSchedule(med({ ppa_scheduledday: undefined }), none, NOW).kind).toBe('unscheduled')
    expect(computeSchedule(med(), none, NOW).kind).toBe('fixed')
  })

  it('a Skipped log anchors the rolling schedule when it is the later one', () => {
    const details = computeSchedule(
      med({ ppa_method: METHOD.Injection }),
      { lastTaken: log('Taken', -10), lastSkipped: log('Skipped', -2) },
      NOW,
    )
    expect(details.kind).toBe('rolling')
    expect(offsetOf(details.nextIntake)).toBe(5)
    expect(offsetOf(details.lastTaken?.at ?? null)).toBe(-10)
  })

  it('reports the injection site for an Injection and omits it for other methods', () => {
    const taken = log('Taken', -3, 894250001)
    const injection = computeSchedule(
      med({ ppa_method: METHOD.Injection }),
      { lastTaken: taken, lastSkipped: null },
      NOW,
    )
    expect(injection.lastTaken?.site).toBe(894250001)

    const pill = computeSchedule(med(), { lastTaken: taken, lastSkipped: null }, NOW)
    expect(pill.lastTaken?.site).toBeUndefined()
  })

  it('inactive, as-needed and unscheduled Medications are never Past Due and have no next intake', () => {
    const variants = [
      med({ ppa_isactive: false }),
      med({ ppa_frequency: FREQUENCY.AsNeeded }),
      med({ ppa_scheduledday: undefined }),
    ]
    for (const m of variants) {
      const details = computeSchedule(m, { lastTaken: log('Taken', -30), lastSkipped: null }, NOW)
      expect(details.status).toBe('none')
      expect(details.nextIntake).toBeNull()
      expect(details.missedDueDate).toBeNull()
      expect(details.daysPastDue).toBeNull()
      expect(details.followUpDue).toBe(false)
    }
  })

  it('does not count a scheduled date before the anchor as missed', () => {
    // Weekly on yesterday's weekday, created today: last week's date is before
    // the Medication existed.
    const details = computeSchedule(
      med({ ppa_scheduledday: DOW_TO_ENUM[day(-1).getDay()], createdon: at(0, '09:00').toISOString() }),
      none,
      NOW,
    )
    expect(details.status).toBe('upcoming')
    expect(details.missedDueDate).toBeNull()
  })

  it('uses the time of day in `today` only to pick the calendar day', () => {
    const m = med({ ppa_scheduledday: DOW_TO_ENUM[day(2).getDay()] })
    const morning = computeSchedule(m, none, at(0, '00:05'))
    const night = computeSchedule(m, none, at(0, '23:55'))
    expect(offsetOf(morning.nextIntake)).toBe(2)
    expect(offsetOf(night.nextIntake)).toBe(2)
  })
})
