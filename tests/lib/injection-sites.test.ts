import { describe, it, expect } from 'vitest'
import {
  INJECTION_SITES,
  getSiteLabel,
  getRecentSites,
} from '@/lib/injection-sites'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

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

describe('injection-sites.ts', () => {
  it('INJECTION_SITES array contains exactly 5 entries in canonical order', () => {
    expect(INJECTION_SITES).toHaveLength(5)
    expect(INJECTION_SITES[0]).toBe(894250000) // RightHip
    expect(INJECTION_SITES[1]).toBe(894250001) // LeftHip
    expect(INJECTION_SITES[2]).toBe(894250002) // AbdominalRight
    expect(INJECTION_SITES[3]).toBe(894250003) // AbdominalCenter
    expect(INJECTION_SITES[4]).toBe(894250004) // AbdominalLeft
  })

  it('getSiteLabel returns correct display string for each enum value', () => {
    expect(getSiteLabel(894250000)).toBe('Right Hip')
    expect(getSiteLabel(894250001)).toBe('Left Hip')
    expect(getSiteLabel(894250002)).toBe('Abdominal Right')
    expect(getSiteLabel(894250003)).toBe('Abdominal Center')
    expect(getSiteLabel(894250004)).toBe('Abdominal Left')
  })

  it('getRecentSites returns sites from intake logs within past 7 days', () => {
    const now = new Date()
    const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    const logs = [
      makeLog({ ppa_loggedat: recent.toISOString(), ppa_injectionsite: 894250000 }),
    ]
    expect(getRecentSites(logs, now)).toContain(894250000)
  })

  it('getRecentSites excludes sites from logs older than 7 days', () => {
    const now = new Date()
    const old = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
    const logs = [
      makeLog({ ppa_loggedat: old.toISOString(), ppa_injectionsite: 894250001 }),
    ]
    expect(getRecentSites(logs, now)).not.toContain(894250001)
  })

  it('getRecentSites returns empty array when no recent logs', () => {
    expect(getRecentSites([], new Date())).toHaveLength(0)
  })
})
