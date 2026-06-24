/**
 * Mock replacement for the generated Ppa_intakelogsService (mock dev mode only).
 * Aliased in via vite.config.ts when running `vite --mode mock`.
 */
import type { Ppa_intakelogs, Ppa_intakelogsBase } from '@/generated/models/Ppa_intakelogsModel'
import { intakeLogs, newId, delay, medicationNameById } from './mock-data'

type CreateInput = Omit<Ppa_intakelogsBase, 'ppa_intakelogid'>
type UpdateInput = Partial<Omit<Ppa_intakelogsBase, 'ppa_intakelogid'>>

const BIND_KEY = 'ppa_Medication@odata.bind'

function bindToMedId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.match(/ppa_medications\(([^)]+)\)/)?.[1]
}

export class Ppa_intakelogsService {
  static async getAll() {
    return delay({ data: [...intakeLogs], success: true })
  }

  static async get(id: string) {
    return delay({ data: intakeLogs.find((l) => l.ppa_intakelogid === id), success: true })
  }

  static async create(record: CreateInput) {
    const { [BIND_KEY]: bind, ...rest } = record
    const medId = bindToMedId(bind)
    const created = {
      ...rest,
      ppa_intakelogid: newId('log'),
      _ppa_medication_value: medId,
      ppa_medicationname: medicationNameById(medId),
      createdon: new Date().toISOString(),
    } as unknown as Ppa_intakelogs
    intakeLogs.push(created)
    return delay({ data: created, success: true })
  }

  static async update(id: string, fields: UpdateInput) {
    const idx = intakeLogs.findIndex((l) => l.ppa_intakelogid === id)
    if (idx >= 0) {
      const { [BIND_KEY]: bind, ...rest } = fields
      const medId = bindToMedId(bind) ?? intakeLogs[idx]._ppa_medication_value
      intakeLogs[idx] = {
        ...intakeLogs[idx],
        ...rest,
        _ppa_medication_value: medId,
        ppa_medicationname: medicationNameById(medId),
      } as Ppa_intakelogs
    }
    return delay({ data: intakeLogs[idx], success: true })
  }

  static async delete(id: string) {
    const idx = intakeLogs.findIndex((l) => l.ppa_intakelogid === id)
    if (idx >= 0) intakeLogs.splice(idx, 1)
    return delay(undefined)
  }
}

console.info('[MedTrack] MOCK data mode — Ppa_intakelogsService is in-memory')
