import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ppa_medicationsService } from '@/generated/services/Ppa_medicationsService'
import type { Ppa_medicationsBase } from '@/generated/models/Ppa_medicationsModel'

const MEDICATIONS_SELECT = [
  'ppa_medicationid',
  'ppa_name',
  'ppa_dosage',
  'ppa_frequency',
  'ppa_scheduledday',
  'ppa_method',
  'ppa_remindertime',
  'ppa_instructions',
  'ppa_isactive',
  'ppa_startdate',
  'ppa_sortorder',
] as const

export function useMedications(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: ['medications'],
    queryFn: async () => {
      const result = await Ppa_medicationsService.getAll({
        select: [...MEDICATIONS_SELECT],
      })
      return result.data ?? []
    },
    staleTime: 5 * 60 * 1000,
    ...options,
  })
}

export function useCreateMedication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (record: Omit<Ppa_medicationsBase, 'ppa_medicationid'>) =>
      Ppa_medicationsService.create(record),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] })
    },
  })
}

export function useUpdateMedication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<Omit<Ppa_medicationsBase, 'ppa_medicationid'>> }) =>
      Ppa_medicationsService.update(id, fields),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['medications'] })
      queryClient.invalidateQueries({ queryKey: ['medications', id] })
    },
  })
}

export function useDeleteMedication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => Ppa_medicationsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications'] })
    },
  })
}
