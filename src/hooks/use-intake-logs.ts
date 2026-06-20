import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ppa_intakelogsService } from '@/generated/services/Ppa_intakelogsService'
import type { Ppa_intakelogs, Ppa_intakelogsBase } from '@/generated/models/Ppa_intakelogsModel'

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
  refetchInterval?: number
}

export function useIntakeLogs({ from, to, medicationId, refetchInterval }: UseIntakeLogsOptions) {
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
    ...(refetchInterval ? { refetchInterval } : {}),
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
    onSuccess: (_result, { id, fields }) => {
      // Patch the in-memory cache immediately with the saved values.
      queryClient.setQueriesData<Ppa_intakelogs[]>(
        { queryKey: ['intakelogs'] },
        (old) => old?.map((log) =>
          log.ppa_intakelogid === id ? { ...log, ...fields } : log
        )
      )
      // Mark stale without an immediate refetch: Dataverse option-set fields
      // have a short replication delay, so an instant GET would overwrite the
      // patch above with the old value. Stale queries re-fetch on next mount.
      queryClient.invalidateQueries({ queryKey: ['intakelogs'], refetchType: 'none' })
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
