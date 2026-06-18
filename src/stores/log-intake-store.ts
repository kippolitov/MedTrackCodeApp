import { create } from 'zustand'

export interface LogIntakePrePopulation {
  medicationId?: string
  dateTime?: Date
  calendarDate?: Date
  // Edit mode — set when opening the dialog to update an existing log
  editingLogId?: string
  loggedAt?: Date
  initialStatus?: import('@/generated/models/Ppa_intakelogsModel').Ppa_intakelogsppa_status
  initialInjectionSite?: import('@/generated/models/Ppa_intakelogsModel').Ppa_intakelogsppa_injectionsite
  initialNotes?: string
}

interface LogIntakeStore {
  prePopulation: LogIntakePrePopulation
  setPrePopulation: (p: LogIntakePrePopulation) => void
  clearPrePopulation: () => void
}

export const useLogIntakeStore = create<LogIntakeStore>((set) => ({
  prePopulation: {},
  setPrePopulation: (p) => set({ prePopulation: p }),
  clearPrePopulation: () => set({ prePopulation: {} }),
}))
