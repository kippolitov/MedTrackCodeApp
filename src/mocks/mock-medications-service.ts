/**
 * Mock replacement for the generated Ppa_medicationsService (mock dev mode only).
 * Aliased in via vite.config.ts when running `vite --mode mock`.
 */
import type { Ppa_medications, Ppa_medicationsBase } from '@/generated/models/Ppa_medicationsModel'
import { medications, intakeLogs, newId, delay } from './mock-data'

type CreateInput = Omit<Ppa_medicationsBase, 'ppa_medicationid'>
type UpdateInput = Partial<Omit<Ppa_medicationsBase, 'ppa_medicationid'>>

export class Ppa_medicationsService {
  static async getAll() {
    return delay({ data: [...medications], success: true })
  }

  static async get(id: string) {
    return delay({ data: medications.find((m) => m.ppa_medicationid === id), success: true })
  }

  static async create(record: CreateInput) {
    const created = {
      ...record,
      ppa_medicationid: newId('med'),
      createdon: new Date().toISOString(),
    } as unknown as Ppa_medications
    medications.push(created)
    return delay({ data: created, success: true })
  }

  static async update(id: string, fields: UpdateInput) {
    const idx = medications.findIndex((m) => m.ppa_medicationid === id)
    if (idx >= 0) {
      medications[idx] = { ...medications[idx], ...fields } as Ppa_medications
    }
    return delay({ data: medications[idx], success: true })
  }

  static async delete(id: string) {
    // Mirror Dataverse referential integrity: deleting a med that still has
    // intake logs fails. This exercises the medications page's error toast path.
    if (intakeLogs.some((l) => l._ppa_medication_value === id)) {
      throw new Error('Mock: cannot delete medication with related intake logs')
    }
    const idx = medications.findIndex((m) => m.ppa_medicationid === id)
    if (idx >= 0) medications.splice(idx, 1)
    return delay(undefined)
  }
}

console.info('[MedTrack] MOCK data mode — Ppa_medicationsService is in-memory')
