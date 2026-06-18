import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ppa_intakelogsService } from '@/generated/services/Ppa_intakelogsService'
import type { Ppa_intakelogsBase } from '@/generated/models/Ppa_intakelogsModel'

const INTAKE_LOGS_SELECT = [
  'ppa_intakelogid',
  'ppa_loggedat',
  'ppa_scheduledfor',
  'ppa_status',
  'ppa_injectionsite',
  'ppa_logname',
  'ppa_notes',
  '_ppa_medication_value',
] as const

interface UseIntakeLogsOptions {
  from: Date
  to: Date
  medicationId?: string
}

export function useIntakeLogs({ from, to, medicationId }: UseIntakeLogsOptions) {
  const fromISO = from.toISOString()
  const toISO = to.toISOString()

  let filter = `ppa_loggedat ge ${fromISO} and ppa_loggedat le ${toISO}`
  if (medicationId) {
    filter += ` and _ppa_medication_value eq ${medicationId}`
  }

  return useQuery({
    queryKey: medicationId
      ? ['intakelogs', { from: fromISO, to: toISO, medicationId }]
      : ['intakelogs', { from: fromISO, to: toISO }],
    queryFn: async () => {
      const result = await Ppa_intakelogsService.getAll({
        select: [...INTAKE_LOGS_SELECT],
        filter,
      })
      return result.data ?? []
    },
    staleTime: 30_000,
  })
}

export function useCreateIntakeLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (record: Omit<Ppa_intakelogsBase, 'ppa_intakelogid'>) =>
      Ppa_intakelogsService.create(record),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intakelogs'] })
    },
  })
}

export function useUpdateIntakeLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<Omit<Ppa_intakelogsBase, 'ppa_intakelogid'>> }) =>
      Ppa_intakelogsService.update(id, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intakelogs'] })
    },
  })
}

export function useDeleteIntakeLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => Ppa_intakelogsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intakelogs'] })
    },
  })
}
