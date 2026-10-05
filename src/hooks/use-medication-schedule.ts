import { useQueries } from '@tanstack/react-query'
import { Ppa_intakelogsService } from '@/generated/services/Ppa_intakelogsService'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import { computeSchedule, type ScheduleDetails } from '@/lib/schedule'

const LATEST_LOG_SELECT = [
  'ppa_intakelogid',
  'ppa_loggedat',
  'ppa_status',
  'ppa_injectionsite',
  '_ppa_medication_value',
] as const

const LATEST_LOG_STATUS = {
  taken: 894250000,
  skipped: 894250001,
} as const

// The newest Intake Log of one status for one Medication, not in the future.
// "Last taken" can be arbitrarily old, so this is a top-1 query rather than a
// date window. Keyed under ['intakelogs'] so the intake-log mutations
// invalidate it, and cached as an array because useUpdateIntakeLog patches
// every ['intakelogs'] entry with `old?.map(...)`.
function latestLogQuery(medicationId: string, kind: keyof typeof LATEST_LOG_STATUS) {
  return {
    queryKey: ['intakelogs', 'latest', medicationId, kind] as const,
    queryFn: async () => {
      const result = await Ppa_intakelogsService.getAll({
        select: [...LATEST_LOG_SELECT],
        filter:
          `_ppa_medication_value eq ${medicationId}` +
          ` and ppa_status eq ${LATEST_LOG_STATUS[kind]}` +
          ` and ppa_loggedat le ${new Date().toISOString()}`,
        orderBy: ['ppa_loggedat desc'],
        top: 1,
      })
      // An unsuccessful result must not read as "no logs": the card would
      // show "Not yet taken" for a Medication that has been taken.
      if (!result.success) {
        throw result.error ?? new Error('Failed to load intake logs')
      }
      return result.data ?? []
    },
    staleTime: 30_000,
  }
}

export interface MedicationSchedule {
  /** Undefined while loading and when either query failed. */
  details: ScheduleDetails | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  /** Re-runs only the queries that failed. */
  refetch: () => Promise<void>
}

export function useMedicationSchedule(medication: Ppa_medications): MedicationSchedule {
  const id = medication.ppa_medicationid
  const [taken, skipped] = useQueries({
    queries: [latestLogQuery(id, 'taken'), latestLogQuery(id, 'skipped')],
  })

  // A failed query that is being retried shows as loading, not as an error.
  const isRetrying = [taken, skipped].some((query) => query.isError && query.isFetching)
  const isError = !isRetrying && (taken.isError || skipped.isError)
  const isLoading = isRetrying || (!isError && (taken.isPending || skipped.isPending))

  const details =
    !isError && !isLoading && taken.data && skipped.data
      ? computeSchedule(
          medication,
          { lastTaken: taken.data[0] ?? null, lastSkipped: skipped.data[0] ?? null },
          new Date(),
        )
      : undefined

  async function refetch() {
    await Promise.all([taken, skipped].filter((query) => query.isError).map((query) => query.refetch()))
  }

  return { details, isLoading, isError, error: taken.error ?? skipped.error ?? null, refetch }
}
