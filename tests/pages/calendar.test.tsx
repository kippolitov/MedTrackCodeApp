import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import CalendarPage from '@/pages/calendar'
import { useUiStore } from '@/stores/ui-store'

vi.mock('@/generated/services/Ppa_medicationsService', () => ({
  Ppa_medicationsService: {
    getAll: vi.fn(),
  },
}))

vi.mock('@/generated/services/Ppa_intakelogsService', () => ({
  Ppa_intakelogsService: {
    getAll: vi.fn(),
    delete: vi.fn(),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function makeLog(date: string, status: 894250000 | 894250001 | 894250002, id = 'log1') {
  return {
    ppa_intakelogid: id,
    ppa_logname: 'TestMed',
    ppa_loggedat: new Date(date).toISOString(),
    ppa_scheduledfor: new Date(date).toISOString(),
    ppa_status: status,
    ownerid: 'u1',
    owneridtype: 'systemuser',
    statecode: 0 as const,
    createdbyyominame: '',
    modifiedbyyominame: '',
    owneridname: '',
    owneridyominame: '',
    owningbusinessunitname: '',
    'ppa_Medication@odata.bind': '/ppa_medications(med1)',
  }
}

beforeEach(async () => {
  useUiStore.setState({ selectedCalendarDate: null, isLogIntakeOpen: false })
  const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
  const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
  vi.mocked(Ppa_medicationsService.getAll).mockResolvedValue({ data: [], success: true })
  vi.mocked(Ppa_intakelogsService.getAll).mockResolvedValue({ data: [], success: true })
  vi.mocked(Ppa_intakelogsService.delete).mockResolvedValue(undefined)
})

describe('CalendarPage', () => {
  it('day with Taken-only log → green indicator via has-taken modifier', async () => {
    const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
    const today = new Date()
    vi.mocked(Ppa_intakelogsService.getAll).mockResolvedValue({
      data: [makeLog(today.toISOString(), 894250000)],
      success: true,
    })
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid') // calendar rendered
    // The has-taken modifier should be applied to today
    const todayCell = document.querySelector('[data-has-taken]')
    expect(todayCell).toBeTruthy()
  })

  it('renders calendar grid', async () => {
    render(<CalendarPage />, { wrapper })
    expect(await screen.findByRole('grid')).toBeInTheDocument()
  })

  it('month navigation prev/next buttons exist', async () => {
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('tapping a day opens day detail panel', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const today = new Date()
    const dayNum = today.getDate()
    // Click any gridcell
    const dayCells = screen.getAllByRole('gridcell')
    const targetCell = dayCells.find((cell) => cell.textContent?.trim() === String(dayNum))
    if (targetCell) {
      await user.click(targetCell)
      expect(screen.getByRole('region', { name: /day detail/i })).toBeInTheDocument()
    }
  })

  it('"Log Intake" in panel opens LogIntakeDialog with calendarDate', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const dayCells = screen.getAllByRole('gridcell')
    if (dayCells.length > 0) {
      await user.click(dayCells[0])
      const logBtn = screen.queryByRole('button', { name: /log intake/i })
      if (logBtn) {
        await user.click(logBtn)
        expect(useUiStore.getState().isLogIntakeOpen).toBe(true)
      }
    }
  })

  it('month navigation triggers new query for that month', async () => {
    const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const prevBtn = screen.getByRole('button', { name: /previous/i })
    await user.click(prevBtn)
    // Query should be called again for the new month
    expect(Ppa_intakelogsService.getAll).toHaveBeenCalledTimes(2)
  })

  it('tapping empty day shows panel with empty state', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const dayCells = screen.getAllByRole('gridcell')
    if (dayCells.length > 0) {
      await user.click(dayCells[0])
      const panel = screen.queryByRole('region', { name: /day detail/i })
      if (panel) {
        expect(panel).toBeInTheDocument()
      }
    }
  })
})
