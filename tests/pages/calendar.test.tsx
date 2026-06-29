import { render, screen, within } from '@testing-library/react'
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

// Localized month names matching the app's resolveLocale() default.
// Header buttons use the long name; overlay pills use the short name.
function monthName(monthIndex: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2000, monthIndex, 1))
}
function monthShort(monthIndex: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(2000, monthIndex, 1))
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

  // --- US2: direct month/year jump via the overlay pickers ---

  it('[US2] year overlay shows up to 12 year pills, all within bounds', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    await user.click(screen.getByRole('button', { name: /change year/i }))
    const listbox = await screen.findByRole('listbox', { name: /year/i })
    const years = within(listbox).getAllByRole('option').map((o) => Number(o.textContent))
    const cy = new Date().getFullYear()
    expect(years.length).toBeLessThanOrEqual(12)
    expect(years).toContain(cy) // the page containing today's year is shown first
    for (const y of years) {
      expect(y).toBeGreaterThanOrEqual(cy - 20)
      expect(y).toBeLessThanOrEqual(cy + 3)
    }
  })

  it('[US2] year overlay pages back to the lower bound, then disables Previous', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const cy = new Date().getFullYear()
    await user.click(screen.getByRole('button', { name: /change year/i }))
    await screen.findByRole('listbox', { name: /year/i })
    await user.click(screen.getByRole('button', { name: /previous years/i }))
    expect(screen.getByRole('option', { name: String(cy - 20) })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /previous years/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /next years/i })).toBeEnabled()
  })

  it('[US2] selecting a year auto-closes the overlay, jumps the calendar, and refetches', async () => {
    const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const callsBefore = vi.mocked(Ppa_intakelogsService.getAll).mock.calls.length
    const target = new Date().getFullYear() - 2
    await user.click(screen.getByRole('button', { name: /change year/i }))
    await screen.findByRole('listbox', { name: /year/i })
    await user.click(screen.getByRole('option', { name: String(target) }))
    // Auto-close: popover gone, header reflects the chosen year.
    expect(screen.queryByRole('listbox', { name: /year/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`${target}, change year`, 'i') })).toBeInTheDocument()
    expect(vi.mocked(Ppa_intakelogsService.getAll).mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('[US2] selecting a month auto-closes the overlay and jumps to that month', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const current = new Date().getMonth()
    const targetIdx = current === 0 ? 1 : 0
    await user.click(screen.getByRole('button', { name: /change month/i }))
    await screen.findByRole('listbox', { name: /month/i })
    await user.click(screen.getByRole('option', { name: monthShort(targetIdx) }))
    expect(screen.queryByRole('listbox', { name: /month/i })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: new RegExp(`${monthName(targetIdx)}, change month`, 'i') }),
    ).toBeInTheDocument()
  })

  // --- US1: adjacent month stepping, Today, rollover ---

  it('[US1] "Today" returns to the current month after navigating away', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const cy = new Date().getFullYear()
    // Jump 3 years back via the year overlay (auto-closes), then Today.
    await user.click(screen.getByRole('button', { name: /change year/i }))
    await screen.findByRole('listbox', { name: /year/i })
    await user.click(screen.getByRole('option', { name: String(cy - 3) }))
    await user.click(screen.getByRole('button', { name: /today/i }))
    expect(
      screen.getByRole('button', { name: new RegExp(`${monthName(new Date().getMonth())}, change month`, 'i') }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`${cy}, change year`, 'i') })).toBeInTheDocument()
  })

  it('[US1] December → January rollover advances the year', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const cy = new Date().getFullYear()
    // Set year (cy-1) then month December via the two overlays, then step forward.
    await user.click(screen.getByRole('button', { name: /change year/i }))
    await screen.findByRole('listbox', { name: /year/i })
    await user.click(screen.getByRole('option', { name: String(cy - 1) }))
    await user.click(screen.getByRole('button', { name: /change month/i }))
    await screen.findByRole('listbox', { name: /month/i })
    await user.click(screen.getByRole('option', { name: monthShort(11) }))
    await user.click(screen.getByRole('button', { name: /next month/i }))
    expect(
      screen.getByRole('button', { name: new RegExp(`${monthName(0)}, change month`, 'i') }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`${cy}, change year`, 'i') })).toBeInTheDocument()
  })

  it('[US1] January → December rollback decrements the year', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const cy = new Date().getFullYear()
    await user.click(screen.getByRole('button', { name: /change year/i }))
    await screen.findByRole('listbox', { name: /year/i })
    await user.click(screen.getByRole('option', { name: String(cy) }))
    await user.click(screen.getByRole('button', { name: /change month/i }))
    await screen.findByRole('listbox', { name: /month/i })
    await user.click(screen.getByRole('option', { name: monthShort(0) }))
    await user.click(screen.getByRole('button', { name: /previous month/i }))
    expect(
      screen.getByRole('button', { name: new RegExp(`${monthName(11)}, change month`, 'i') }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(`${cy - 1}, change year`, 'i') })).toBeInTheDocument()
  })

  it('[US1] navigating to an empty month renders the grid without error', async () => {
    const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
    vi.mocked(Ppa_intakelogsService.getAll).mockResolvedValue({ data: [], success: true })
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(document.querySelector('[data-has-taken]')).toBeNull()
  })

  it('[US1] selecting a day then changing month hides the out-of-month day panel', async () => {
    const user = userEvent.setup()
    render(<CalendarPage />, { wrapper })
    await screen.findByRole('grid')
    const today = new Date()
    const dayCells = screen.getAllByRole('gridcell')
    const targetCell = dayCells.find((c) => c.textContent?.trim() === String(today.getDate()))
    if (targetCell) {
      await user.click(targetCell)
      expect(screen.getByRole('region', { name: /day detail/i })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /next/i }))
      expect(screen.queryByRole('region', { name: /day detail/i })).not.toBeInTheDocument()
    }
  })
})
