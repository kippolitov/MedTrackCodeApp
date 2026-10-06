import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import MedicationSchedule from '@/components/medications/medication-schedule'
import { Ppa_intakelogsService } from '@/generated/services/Ppa_intakelogsService'
import { formatDateLabel, formatTime } from '@/lib/date-utils'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

vi.mock('@/generated/services/Ppa_intakelogsService', () => ({
  Ppa_intakelogsService: {
    getAll: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

const FREQ = { Daily: 894250000, Weekly: 894250001, Biweekly: 894250002, AsNeeded: 894250003 } as const
const METHOD = { Pill: 894250000, Injection: 894250001 } as const
const TAKEN = 894250000
const SKIPPED = 894250001
const LEFT_HIP = 894250001
// JS getDay() (0=Sun..6=Sat) → Dataverse ppa_scheduledday
const DOW_TO_ENUM = [894250006, 894250000, 894250001, 894250002, 894250003, 894250004, 894250005] as const

function at(dayOffset: number, hours = 8, minutes = 30): Date {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hours, minutes, 0, 0)
  return d
}

function weekdayOf(dayOffset: number) {
  return DOW_TO_ENUM[at(dayOffset).getDay()]
}

// The label the section must show for a date (UI contract, "Formatting").
function dateLabel(date: Date): string {
  return formatDateLabel(date, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}),
  })
}

function makeMedication(overrides: Partial<Ppa_medications> = {}): Ppa_medications {
  return {
    ppa_medicationid: 'med-1',
    ppa_name: 'Aspirin',
    ppa_dosage: '100mg',
    ppa_frequency: FREQ.Daily,
    ppa_method: METHOD.Pill,
    ppa_isactive: true,
    createdon: at(-34, 12, 0).toISOString(),
    ...overrides,
  } as Ppa_medications
}

function takenLog(loggedAt: Date, site?: number): Ppa_intakelogs {
  return {
    ppa_intakelogid: 'log-taken',
    ppa_loggedat: loggedAt.toISOString(),
    ppa_status: TAKEN,
    ppa_injectionsite: site,
    _ppa_medication_value: 'med-1',
  } as Ppa_intakelogs
}

function mockLogs({ taken, skipped }: { taken?: Ppa_intakelogs; skipped?: Ppa_intakelogs } = {}) {
  vi.mocked(Ppa_intakelogsService.getAll).mockImplementation(async (options) => {
    const filter = options?.filter ?? ''
    if (filter.includes(`ppa_status eq ${TAKEN}`)) return { data: taken ? [taken] : [], success: true }
    if (filter.includes(`ppa_status eq ${SKIPPED}`)) return { data: skipped ? [skipped] : [], success: true }
    return { data: [], success: true }
  })
}

function renderSchedule(...medications: Ppa_medications[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      {medications.map((medication) => (
        <MedicationSchedule key={medication.ppa_medicationid} medication={medication} />
      ))}
    </QueryClientProvider>,
  )
}

// The value cell of a row, found by its label.
async function row(label: 'Last taken' | 'Next intake'): Promise<HTMLElement> {
  const term = await screen.findByText(label)
  const container = term.parentElement
  if (!container) throw new Error(`Row "${label}" has no container`)
  return container
}

beforeEach(() => {
  mockLogs()
})

describe('MedicationSchedule — region', () => {
  it('is a region labelled with the Medication name', async () => {
    renderSchedule(makeMedication({ ppa_name: 'Metformin' }))
    expect(await screen.findByRole('region', { name: 'Schedule for Metformin' })).toBeInTheDocument()
  })
})

describe('MedicationSchedule — last taken', () => {
  it('shows the date and time of the latest Taken log', async () => {
    const loggedAt = at(-1)
    mockLogs({ taken: takenLog(loggedAt) })
    renderSchedule(makeMedication())

    const lastTaken = await row('Last taken')
    await waitFor(() =>
      expect(lastTaken).toHaveTextContent(`${dateLabel(loggedAt)}, ${formatTime(loggedAt)}`),
    )
    expect(lastTaken).not.toHaveTextContent('·')
  })

  it('adds the injection site for an Injection', async () => {
    const loggedAt = at(-3, 21, 0)
    mockLogs({ taken: takenLog(loggedAt, LEFT_HIP) })
    renderSchedule(makeMedication({ ppa_method: METHOD.Injection, ppa_frequency: FREQ.Weekly }))

    const lastTaken = await row('Last taken')
    await waitFor(() =>
      expect(lastTaken).toHaveTextContent(`${dateLabel(loggedAt)}, ${formatTime(loggedAt)} · Left Hip`),
    )
  })

  it('shows only the date and time for an Injection with no site recorded', async () => {
    const loggedAt = at(-3, 21, 0)
    mockLogs({ taken: takenLog(loggedAt) })
    renderSchedule(makeMedication({ ppa_method: METHOD.Injection, ppa_frequency: FREQ.Weekly }))

    const lastTaken = await row('Last taken')
    await waitFor(() => expect(lastTaken).toHaveTextContent(dateLabel(loggedAt)))
    expect(lastTaken).not.toHaveTextContent('·')
  })

  it('shows "Not yet taken" when there is no Taken log', async () => {
    renderSchedule(makeMedication())
    expect(await screen.findByText('Not yet taken')).toBeInTheDocument()
  })

  it('adds the year when the date is not in the current year', async () => {
    const loggedAt = at(-400)
    mockLogs({ taken: takenLog(loggedAt) })
    renderSchedule(makeMedication({ ppa_isactive: false }))

    const lastTaken = await row('Last taken')
    await waitFor(() => expect(lastTaken).toHaveTextContent(String(loggedAt.getFullYear())))
    expect(lastTaken).toHaveTextContent(dateLabel(loggedAt))
  })
})

describe('MedicationSchedule — next intake', () => {
  it('upcoming: shows the next date with no marker', async () => {
    // Weekly on the weekday two days from now, created today so nothing is missed.
    renderSchedule(
      makeMedication({
        ppa_frequency: FREQ.Weekly,
        ppa_scheduledday: weekdayOf(2),
        createdon: at(0, 0, 0).toISOString(),
      }),
    )

    const next = await row('Next intake')
    await waitFor(() => expect(next).toHaveTextContent(dateLabel(at(2))))
    expect(screen.queryByText('Due today')).not.toBeInTheDocument()
    expect(screen.queryByText(/Past Due/)).not.toBeInTheDocument()
    expect(screen.queryByText('Counted from last dose')).not.toBeInTheDocument()
  })

  it('due today: shows today and a "Due today" badge', async () => {
    renderSchedule(makeMedication())

    const next = await row('Next intake')
    await waitFor(() => expect(next).toHaveTextContent(dateLabel(at(0))))
    expect(within(next).getByText('Due today')).toBeInTheDocument()
  })

  it('past due on the fixed schedule: shows the next date and when it was due', async () => {
    // Weekly on yesterday's weekday, last taken eight days ago.
    mockLogs({ taken: takenLog(at(-8)) })
    renderSchedule(makeMedication({ ppa_frequency: FREQ.Weekly, ppa_scheduledday: weekdayOf(-1) }))

    const next = await row('Next intake')
    await waitFor(() =>
      expect(within(next).getByText(`Past Due · was due ${dateLabel(at(-1))}`)).toBeInTheDocument(),
    )
    expect(next).toHaveTextContent(dateLabel(at(6)))
    expect(screen.queryByText('Counted from last dose')).not.toBeInTheDocument()
  })

  it('past due on the rolling schedule: shows when it was due and no next date', async () => {
    // Weekly injection taken nine days ago: was due two days ago.
    mockLogs({ taken: takenLog(at(-9, 21, 0), LEFT_HIP) })
    renderSchedule(makeMedication({ ppa_method: METHOD.Injection, ppa_frequency: FREQ.Weekly }))

    const next = await row('Next intake')
    const badge = `Past Due · was due ${dateLabel(at(-2))}`
    await waitFor(() => expect(within(next).getByText(badge)).toBeInTheDocument())
    expect(within(next).getByText('Counted from last dose')).toBeInTheDocument()
    // Nothing in the row but the label, the badge and the hint.
    expect(next.textContent?.replace('Next intake', '').replace(badge, '').replace('Counted from last dose', '').trim()).toBe('')
  })

  it('rolling schedule: counts from the last dose and says so', async () => {
    mockLogs({ taken: takenLog(at(-3, 21, 0), LEFT_HIP) })
    renderSchedule(makeMedication({ ppa_method: METHOD.Injection, ppa_frequency: FREQ.Weekly }))

    const next = await row('Next intake')
    await waitFor(() => expect(next).toHaveTextContent(dateLabel(at(4))))
    expect(within(next).getByText('Counted from last dose')).toBeInTheDocument()
  })

  it('as-needed: reads "As needed"', async () => {
    renderSchedule(makeMedication({ ppa_frequency: FREQ.AsNeeded }))
    const next = await row('Next intake')
    await waitFor(() => expect(next).toHaveTextContent('As needed'))
  })

  it('unscheduled: reads "Not scheduled"', async () => {
    renderSchedule(makeMedication({ ppa_frequency: FREQ.Weekly, ppa_scheduledday: undefined }))
    const next = await row('Next intake')
    await waitFor(() => expect(next).toHaveTextContent('Not scheduled'))
  })

  it('inactive: reads "Reminders off" and still shows last taken', async () => {
    const loggedAt = at(-14)
    mockLogs({ taken: takenLog(loggedAt) })
    renderSchedule(makeMedication({ ppa_isactive: false }))

    const next = await row('Next intake')
    await waitFor(() => expect(next).toHaveTextContent('Reminders off'))
    expect(await row('Last taken')).toHaveTextContent(dateLabel(loggedAt))
    expect(screen.queryByText('Due today')).not.toBeInTheDocument()
  })
})

describe('MedicationSchedule — loading and error', () => {
  it('shows two skeleton rows and aria-busy while intake history loads', () => {
    vi.mocked(Ppa_intakelogsService.getAll).mockReturnValue(new Promise(() => {}))
    renderSchedule(makeMedication())

    const region = screen.getByRole('region', { name: 'Schedule for Aspirin' })
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2)
    expect(screen.queryByText('Not yet taken')).not.toBeInTheDocument()
  })

  it('is not busy once loaded', async () => {
    renderSchedule(makeMedication())
    await screen.findByText('Not yet taken')
    expect(screen.getByRole('region', { name: 'Schedule for Aspirin' })).toHaveAttribute('aria-busy', 'false')
  })

  it('shows an error with Retry, and never "Not yet taken", when the load fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(Ppa_intakelogsService.getAll).mockRejectedValue(new Error('network down'))
    renderSchedule(makeMedication())

    expect(await screen.findByText("Couldn't load schedule.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('Not yet taken')).not.toBeInTheDocument()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('Retry re-runs the failed queries and shows the schedule', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    vi.mocked(Ppa_intakelogsService.getAll).mockRejectedValue(new Error('network down'))
    renderSchedule(makeMedication())

    const retry = await screen.findByRole('button', { name: 'Retry' })
    expect(Ppa_intakelogsService.getAll).toHaveBeenCalledTimes(2)

    mockLogs()
    await user.click(retry)

    expect(await screen.findByText('Not yet taken')).toBeInTheDocument()
    expect(Ppa_intakelogsService.getAll).toHaveBeenCalledTimes(4)
    expect(screen.queryByText("Couldn't load schedule.")).not.toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('raises an error toast with the fixed id', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(Ppa_intakelogsService.getAll).mockRejectedValue(new Error('network down'))
    renderSchedule(makeMedication())

    await screen.findByText("Couldn't load schedule.")
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't load schedule for some medications.", {
        id: 'schedule-load-error',
      }),
    )
    consoleError.mockRestore()
  })

  it('two failing cards share one toast id, so Sonner shows a single toast', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(Ppa_intakelogsService.getAll).mockRejectedValue(new Error('network down'))
    renderSchedule(
      makeMedication({ ppa_medicationid: 'med-1', ppa_name: 'Aspirin' }),
      makeMedication({ ppa_medicationid: 'med-2', ppa_name: 'Metformin' }),
    )

    await waitFor(() => expect(screen.getAllByText("Couldn't load schedule.")).toHaveLength(2))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())

    const ids = new Set(vi.mocked(toast.error).mock.calls.map(([, options]) => options?.id))
    expect([...ids]).toEqual(['schedule-load-error'])
    consoleError.mockRestore()
  })

  it('does not raise a toast when the load succeeds', async () => {
    renderSchedule(makeMedication())
    await screen.findByText('Not yet taken')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('a failure on one card does not affect another', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(Ppa_intakelogsService.getAll).mockImplementation(async (options) => {
      if (options?.filter?.includes('_ppa_medication_value eq med-2')) throw new Error('boom')
      return { data: [], success: true }
    })
    renderSchedule(
      makeMedication({ ppa_medicationid: 'med-1', ppa_name: 'Aspirin' }),
      makeMedication({ ppa_medicationid: 'med-2', ppa_name: 'Metformin' }),
    )

    const failed = await screen.findByRole('region', { name: 'Schedule for Metformin' })
    await waitFor(() => expect(within(failed).getByText("Couldn't load schedule.")).toBeInTheDocument())
    const ok = screen.getByRole('region', { name: 'Schedule for Aspirin' })
    await waitFor(() => expect(within(ok).getByText('Not yet taken')).toBeInTheDocument())
    expect(within(ok).queryByText("Couldn't load schedule.")).not.toBeInTheDocument()
    consoleError.mockRestore()
  })
})
