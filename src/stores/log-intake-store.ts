import { create } from 'zustand'

export interface LogIntakePrePopulation {
  medicationId?: string
  dateTime?: Date
  calendarDate?: Date
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
