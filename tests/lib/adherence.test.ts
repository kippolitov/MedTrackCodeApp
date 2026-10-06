import { describe, it, expect } from 'vitest'
import {
  scheduledDosesOnDay,
  takenLogsOnDay,
  adherence7d,
  currentStreak,
  missedToday,
} from '@/lib/adherence'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

// Use local-time constructors to avoid UTC-midnight timezone shifts
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0) // noon local time
}

function localISOString(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 8, 0, 0).toISOString()
}

function makeMed(overrides: Partial<Ppa_medications> = {}): Ppa_medications {
  return {
    ppa_medicationid: 'med1',
    ppa_name: 'TestMed',
    ppa_dosage: '10mg',
    ppa_frequency: 894250000,
    ppa_method: 894250000,
    ppa_isactive: true,
    ownerid: 'u1',
    owneridtype: 'systemuser',
    statecode: 0,
    createdbyyominame: '',
    modifiedbyyominame: '',
    owneridname: '',
    owneridyominame: '',
    owningbusinessunitname: '',
    createdon: localISOString(2026, 1, 1),
    ...overrides,
  }
}

function makeLog(overrides: Partial<Ppa_intakelogs> = {}): Ppa_intakelogs {
  return {
    ppa_intakelogid: 'log1',
    ppa_logname: 'TestMed',
    ppa_loggedat: new Date().toISOString(),
    ppa_scheduledfor: new Date().toISOString(),
    ppa_status: 894250000,
    ownerid: 'u1',
    owneridtype: 'systemuser',
    statecode: 0,
    createdbyyominame: '',
    modifiedbyyominame: '',
    owneridname: '',
    owneridyominame: '',
    owningbusinessunitname: '',
    'ppa_Medication@odata.bind': '/ppa_medications(med1)',
    ...overrides,
  }
}

describe('adherence.ts', () => {
  it('Daily med always contributes to scheduled count', () => {
    const med = makeMed({ ppa_frequency: 894250000 })
    expect(scheduledDosesOnDay([med], localDate(2026, 6, 17))).toHaveLength(1)
  })

  it('Weekly med contributes only on its ppa_scheduledday', () => {
    // Tuesday = enum 894250001
    const med = makeMed({ ppa_frequency: 894250001, ppa_scheduledday: 894250001 })
    const tuesday = localDate(2026, 6, 16) // June 16 2026 is a Tuesday
    const wednesday = localDate(2026, 6, 17)
    expect(scheduledDosesOnDay([med], tuesday)).toHaveLength(1)
    expect(scheduledDosesOnDay([med], wednesday)).toHaveLength(0)
  })

  it('Biweekly med is scheduled in alternating weeks counted from createdon', () => {
    const med = makeMed({
      ppa_frequency: 894250002,
      createdon: localISOString(2026, 6, 1),
    })
    const week0 = localDate(2026, 6, 1)
    const week1 = localDate(2026, 6, 8)
    const week2 = localDate(2026, 6, 15)
    expect(scheduledDosesOnDay([med], week0)).toHaveLength(1)
    expect(scheduledDosesOnDay([med], week1)).toHaveLength(0)
    expect(scheduledDosesOnDay([med], week2)).toHaveLength(1)
  })

  it('Biweekly med is scheduled on one day per fortnight, not every day of an "on" week', () => {
    // No scheduled day set → falls back to the anchor's weekday (Monday June 1 2026).
    const med = makeMed({
      ppa_frequency: 894250002,
      createdon: localISOString(2026, 6, 1),
    })
    const scheduledDays: number[] = []
    for (let day = 1; day <= 28; day++) {
      if (scheduledDosesOnDay([med], localDate(2026, 6, day)).length > 0) scheduledDays.push(day)
    }
    expect(scheduledDays).toEqual([1, 15])
  })

  it('Biweekly med follows ppa_scheduledday when it differs from the anchor weekday', () => {
    // Start Wednesday June 3 2026, scheduled Monday (enum 894250000):
    // first Monday on/after the start is June 8, then every 14 days.
    const med = makeMed({
      ppa_frequency: 894250002,
      ppa_scheduledday: 894250000,
      ppa_startdate: '2026-06-03',
    })
    const scheduledDays: number[] = []
    for (let day = 1; day <= 30; day++) {
      if (scheduledDosesOnDay([med], localDate(2026, 6, day)).length > 0) scheduledDays.push(day)
    }
    expect(scheduledDays).toEqual([8, 22])
  })

  it('Biweekly med reads a date-only ppa_startdate as that calendar day in every time zone', () => {
    // '2026-06-01' must anchor on Monday June 1, not on May 31 west of UTC.
    const med = makeMed({ ppa_frequency: 894250002, ppa_startdate: '2026-06-01' })
    expect(scheduledDosesOnDay([med], localDate(2026, 5, 31))).toHaveLength(0)
    expect(scheduledDosesOnDay([med], localDate(2026, 6, 1))).toHaveLength(1)
    expect(scheduledDosesOnDay([med], localDate(2026, 6, 15))).toHaveLength(1)
  })

  it('As-Needed med contributes 0 to scheduled count', () => {
    const med = makeMed({ ppa_frequency: 894250003 })
    expect(scheduledDosesOnDay([med], localDate(2026, 6, 17))).toHaveLength(0)
  })

  it('adherence7d returns null when scheduled count = 0', () => {
    const med = makeMed({ ppa_frequency: 894250003 })
    expect(adherence7d([med], [])).toBeNull()
  })

  it('streak increments on consecutive fully-adherent days', () => {
    const med = makeMed({ ppa_frequency: 894250000 })
    const today = localDate(2026, 6, 17)
    const logs = [
      makeLog({ ppa_loggedat: localISOString(2026, 6, 17), ppa_status: 894250000, _ppa_medication_value: 'med1' }),
      makeLog({ ppa_intakelogid: 'log2', ppa_loggedat: localISOString(2026, 6, 16), ppa_status: 894250000, _ppa_medication_value: 'med1' }),
      makeLog({ ppa_intakelogid: 'log3', ppa_loggedat: localISOString(2026, 6, 15), ppa_status: 894250000, _ppa_medication_value: 'med1' }),
    ]
    expect(currentStreak([med], logs, today)).toBeGreaterThanOrEqual(3)
  })

  it('streak breaks on first day with missing Taken log', () => {
    const med = makeMed({ ppa_frequency: 894250000 })
    const today = localDate(2026, 6, 17)
    const logs = [
      makeLog({ ppa_loggedat: localISOString(2026, 6, 17), ppa_status: 894250000, _ppa_medication_value: 'med1' }),
      // June 16 missing
      makeLog({ ppa_intakelogid: 'log3', ppa_loggedat: localISOString(2026, 6, 15), ppa_status: 894250000, _ppa_medication_value: 'med1' }),
    ]
    expect(currentStreak([med], logs, today)).toBe(1)
  })

  it('streak skips rest days (scheduledCount === 0)', () => {
    // Weekly on Tuesday (enum 894250001); today is Wednesday
    const med = makeMed({ ppa_frequency: 894250001, ppa_scheduledday: 894250001 })
    const wednesday = localDate(2026, 6, 17)
    const logs = [
      makeLog({ ppa_loggedat: localISOString(2026, 6, 16), ppa_status: 894250000, _ppa_medication_value: 'med1' }),
    ]
    // Wednesday is rest day; Tuesday was taken — streak ≥ 1
    expect(currentStreak([med], logs, wednesday)).toBeGreaterThanOrEqual(1)
  })
})

describe('takenLogsOnDay', () => {
  it('returns only Taken logs on the given day', () => {
    const todayLog = makeLog({ ppa_loggedat: localISOString(2026, 6, 17), ppa_status: 894250000 })
    const yesterdayLog = makeLog({ ppa_intakelogid: 'log2', ppa_loggedat: localISOString(2026, 6, 16), ppa_status: 894250000 })
    const today = localDate(2026, 6, 17)
    expect(takenLogsOnDay([todayLog, yesterdayLog], today)).toHaveLength(1)
  })
})

describe('missedToday', () => {
  it('counts scheduled meds with no Taken log today', () => {
    const med = makeMed({ ppa_frequency: 894250000 })
    const today = localDate(2026, 6, 17)
    expect(missedToday([med], [], today)).toBe(1)
  })
})
