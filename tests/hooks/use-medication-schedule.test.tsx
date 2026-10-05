import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMedicationSchedule } from '@/hooks/use-medication-schedule'
import { Ppa_intakelogsService } from '@/generated/services/Ppa_intakelogsService'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

vi.mock('@/generated/services/Ppa_intakelogsService', () => ({
  Ppa_intakelogsService: {
    getAll: vi.fn(),
  },
}))

const TAKEN = 894250000
const SKIPPED = 894250001
const MED_ID = '11111111-1111-1111-1111-111111111111'

function makeMedication(overrides: Partial<Ppa_medications> = {}): Ppa_medications {
  return {
    ppa_medicationid: MED_ID,
    ppa_name: 'Aspirin',
    ppa_dosage: '100mg',
    ppa_frequency: 894250000,
    ppa_method: 894250000,
    ppa_isactive: true,
    createdon: '2026-01-01T12:00:00Z',
    ...overrides,
  } as Ppa_medications
}

function takenLog(daysAgo: number): Ppa_intakelogs {
  const at = new Date()
  at.setDate(at.getDate() - daysAgo)
  at.setHours(8, 30, 0, 0)
  return {
    ppa_intakelogid: `log-${daysAgo}`,
    ppa_loggedat: at.toISOString(),
    ppa_status: TAKEN,
    _ppa_medication_value: MED_ID,
  } as Ppa_intakelogs
}

function setup(medication = makeMedication()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const view = renderHook(() => useMedicationSchedule(medication), { wrapper })
  return { queryClient, ...view }
}

function callsFor(status: number) {
  return vi
    .mocked(Ppa_intakelogsService.getAll)
    .mock.calls.map(([options]) => options)
    .filter((options) => options?.filter?.includes(`ppa_status eq ${status}`))
}

beforeEach(() => {
  vi.mocked(Ppa_intakelogsService.getAll).mockResolvedValue({ data: [], success: true })
})

describe('useMedicationSchedule', () => {
  it('runs one top-1 query for the latest Taken log and one for the latest Skipped log', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(Ppa_intakelogsService.getAll).toHaveBeenCalledTimes(2)
    for (const status of [TAKEN, SKIPPED]) {
      const [options] = callsFor(status)
      expect(options).toBeDefined()
      expect(options?.select).toEqual([
        'ppa_intakelogid',
        'ppa_loggedat',
        'ppa_status',
        'ppa_injectionsite',
        '_ppa_medication_value',
      ])
      expect(options?.filter).toContain(`_ppa_medication_value eq ${MED_ID}`)
      expect(options?.filter).toContain(`ppa_status eq ${status}`)
      // Not in the future: bounded by the time of the request.
      expect(options?.filter).toMatch(/ppa_loggedat le \d{4}-\d{2}-\d{2}T[\d:.]+Z/)
      expect(options?.orderBy).toEqual(['ppa_loggedat desc'])
      expect(options?.top).toBe(1)
    }
  })

  it('caches each result as an array under an intakelogs key', async () => {
    const log = takenLog(1)
    vi.mocked(Ppa_intakelogsService.getAll).mockImplementation(async (options) => ({
      data: options?.filter?.includes(`ppa_status eq ${TAKEN}`) ? [log] : [],
      success: true,
    }))

    const { result, queryClient } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(queryClient.getQueryData(['intakelogs', 'latest', MED_ID, 'taken'])).toEqual([log])
    expect(queryClient.getQueryData(['intakelogs', 'latest', MED_ID, 'skipped'])).toEqual([])
  })

  it('computes the schedule from the two latest logs', async () => {
    const log = takenLog(1)
    vi.mocked(Ppa_intakelogsService.getAll).mockImplementation(async (options) => ({
      data: options?.filter?.includes(`ppa_status eq ${TAKEN}`) ? [log] : [],
      success: true,
    }))

    const { result } = setup()
    expect(result.current.details).toBeUndefined()
    await waitFor(() => expect(result.current.details).toBeDefined())

    // Daily pill taken yesterday: due today.
    expect(result.current.details?.kind).toBe('fixed')
    expect(result.current.details?.status).toBe('due-today')
    expect(result.current.details?.lastTaken?.at.toISOString()).toBe(log.ppa_loggedat)
    expect(result.current.isError).toBe(false)
  })

  it('surfaces a rejected call as isError, with no details, and refetch recovers', async () => {
    vi.mocked(Ppa_intakelogsService.getAll).mockRejectedValue(new Error('network down'))

    const { result } = setup()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.details).toBeUndefined()
    expect(result.current.isLoading).toBe(false)

    vi.mocked(Ppa_intakelogsService.getAll).mockResolvedValue({ data: [], success: true })
    await act(async () => {
      await result.current.refetch()
    })

    await waitFor(() => expect(result.current.isError).toBe(false))
    expect(result.current.details).toBeDefined()
  })

  it('treats an unsuccessful result as an error, never as "no logs"', async () => {
    vi.mocked(Ppa_intakelogsService.getAll).mockResolvedValue({
      data: [],
      success: false,
      error: new Error('403'),
    })

    const { result } = setup()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.details).toBeUndefined()
  })

  it('refetch re-runs only the failed query', async () => {
    vi.mocked(Ppa_intakelogsService.getAll).mockImplementation(async (options) => {
      if (options?.filter?.includes(`ppa_status eq ${SKIPPED}`)) throw new Error('boom')
      return { data: [], success: true }
    })

    const { result } = setup()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(callsFor(TAKEN)).toHaveLength(1)
    expect(callsFor(SKIPPED)).toHaveLength(1)

    await act(async () => {
      await result.current.refetch()
    })

    expect(callsFor(TAKEN)).toHaveLength(1)
    expect(callsFor(SKIPPED)).toHaveLength(2)
  })

  it('refetches both queries when the intakelogs cache is invalidated', async () => {
    const { result, queryClient } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.details?.lastTaken).toBeNull()

    // A log created elsewhere in the app invalidates ['intakelogs'] (see
    // useCreateIntakeLog); the card must pick it up without a reload.
    const log = takenLog(0)
    vi.mocked(Ppa_intakelogsService.getAll).mockImplementation(async (options) => ({
      data: options?.filter?.includes(`ppa_status eq ${TAKEN}`) ? [log] : [],
      success: true,
    }))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['intakelogs'] })
    })

    await waitFor(() =>
      expect(result.current.details?.lastTaken?.at.toISOString()).toBe(log.ppa_loggedat),
    )
    expect(callsFor(TAKEN)).toHaveLength(2)
    expect(callsFor(SKIPPED)).toHaveLength(2)
  })
})
