import { create } from 'zustand'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'

export type MedicationViewModel = Ppa_medications

interface UiStore {
  isMedicationFormOpen: boolean
  medicationFormMode: 'add' | 'edit'
  editingMedication: MedicationViewModel | null
  selectedCalendarDate: Date | null
  isLogIntakeOpen: boolean
  setMedicationFormOpen: (open: boolean) => void
  setMedicationFormMode: (mode: 'add' | 'edit') => void
  setEditingMedication: (medication: MedicationViewModel | null) => void
  setSelectedCalendarDate: (date: Date | null) => void
  setLogIntakeOpen: (open: boolean) => void
}

export const useUiStore = create<UiStore>((set) => ({
  isMedicationFormOpen: false,
  medicationFormMode: 'add',
  editingMedication: null,
  selectedCalendarDate: null,
  isLogIntakeOpen: false,
  setMedicationFormOpen: (open) => set({ isMedicationFormOpen: open }),
  setMedicationFormMode: (mode) => set({ medicationFormMode: mode }),
  setEditingMedication: (medication) => set({ editingMedication: medication }),
  setSelectedCalendarDate: (date) => set({ selectedCalendarDate: date }),
  setLogIntakeOpen: (open) => set({ isLogIntakeOpen: open }),
}))
