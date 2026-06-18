import { describe, it, expect } from 'vitest'
import { buildCsvString, type IntakeLogRow } from '@/lib/csv-export'

const baseRow: IntakeLogRow = {
  medicationName: 'Aspirin',
  loggedAt: new Date(2026, 5, 17, 8, 30),
  status: 'Taken',
  injectionSite: undefined,
  notes: undefined,
}

describe('buildCsvString', () => {
  it('has correct header row', () => {
    const csv = buildCsvString([])
    const header = csv.split('\n')[0]
    expect(header).toBe('Medication,Date,Time,Status,Injection Site,Notes')
  })

  it('rows contain correct field values', () => {
    const csv = buildCsvString([baseRow])
    const lines = csv.split('\n')
    expect(lines[1]).toContain('Aspirin')
    expect(lines[1]).toContain('2026-06-17')
    expect(lines[1]).toContain('08:30')
    expect(lines[1]).toContain('Taken')
  })

  it('medication name containing a comma is wrapped in double-quotes', () => {
    const csv = buildCsvString([{ ...baseRow, medicationName: 'Aspirin, 500mg' }])
    const line = csv.split('\n')[1]
    expect(line).toContain('"Aspirin, 500mg"')
  })

  it('notes containing a double-quote has the quote escaped', () => {
    const csv = buildCsvString([{ ...baseRow, notes: 'Felt "dizzy"' }])
    const line = csv.split('\n')[1]
    expect(line).toContain('"Felt ""dizzy"""')
  })

  it('empty ppa_injectionsite renders as empty string', () => {
    const csv = buildCsvString([{ ...baseRow, injectionSite: undefined }])
    const line = csv.split('\n')[1]
    // Injection site column should be empty (not "undefined" or "null")
    const fields = line.split(',')
    expect(fields[4]).not.toBe('undefined')
    expect(fields[4]).not.toBe('null')
    expect(fields[4]).toBe('')
  })
})
