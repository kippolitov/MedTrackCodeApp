import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import AnalyticsPage from '@/pages/analytics'

vi.mock('@/generated/services/Ppa_medicationsService', () => ({
  Ppa_medicationsService: {
    getAll: vi.fn(),
  },
}))

vi.mock('@/generated/services/Ppa_intakelogsService', () => ({
  Ppa_intakelogsService: {
    getAll: vi.fn(),
  },
}))

vi.mock('@/lib/csv-export', () => ({
  downloadCsv: vi.fn(),
  buildCsvString: vi.fn(() => ''),
}))

// Stub recharts so it renders without canvas issues in happy-dom
vi.mock('recharts', () => {
  const React = require('react')
  return {
    BarChart: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'bar-chart' }, children),
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
  }
})

function makeMed(id: string, name: string) {
  return {
    ppa_medicationid: id,
    ppa_name: name,
    ppa_dosage: '10mg',
    ppa_frequency: 894250000,
    ppa_method: 894250000,
    ppa_isactive: true,
    statecode: 0 as const,
    ownerid: 'u1',
    owneridtype: 'systemuser',
    createdbyyominame: '',
    modifiedbyyominame: '',
    owneridname: '',
    owneridyominame: '',
    owningbusinessunitname: '',
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
  const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
  vi.mocked(Ppa_medicationsService.getAll).mockResolvedValue({
    data: [makeMed('med1', 'Aspirin'), makeMed('med2', 'Metformin')],
    success: true,
  })
  vi.mocked(Ppa_intakelogsService.getAll).mockResolvedValue({ data: [], success: true })
})

describe('AnalyticsPage', () => {
  it('default time window selector shows 3M active on load', async () => {
    render(<AnalyticsPage />, { wrapper })
    const btn = await screen.findByRole('button', { name: /3M/i })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('switching to 6M triggers a different date range query', async () => {
    const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
    const user = userEvent.setup()
    render(<AnalyticsPage />, { wrapper })
    await screen.findByRole('button', { name: /3M/i })
    const btn6m = screen.getByRole('button', { name: /6M/i })
    await user.click(btn6m)
    expect(btn6m).toHaveAttribute('aria-pressed', 'true')
    expect(Ppa_intakelogsService.getAll).toHaveBeenCalledTimes(2)
  })

  it('switching to 1Y triggers a different date range query', async () => {
    const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
    const user = userEvent.setup()
    render(<AnalyticsPage />, { wrapper })
    await screen.findByRole('button', { name: /3M/i })
    const btn1y = screen.getByRole('button', { name: /1Y/i })
    await user.click(btn1y)
    expect(btn1y).toHaveAttribute('aria-pressed', 'true')
    expect(Ppa_intakelogsService.getAll).toHaveBeenCalledTimes(2)
  })

  it('medication filter dropdown lists all medications plus All', async () => {
    render(<AnalyticsPage />, { wrapper })
    await screen.findByRole('button', { name: /3M/i })
    // Open select
    const select = screen.getByRole('combobox')
    await userEvent.click(select)
    expect(screen.getByRole('option', { name: /all/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Aspirin' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Metformin' })).toBeInTheDocument()
  })

  it('Export button triggers downloadCsv with medtrack-report.csv filename', async () => {
    const { downloadCsv } = await import('@/lib/csv-export')
    const user = userEvent.setup()
    render(<AnalyticsPage />, { wrapper })
    await screen.findByRole('button', { name: /3M/i })
    const exportBtn = screen.getByRole('button', { name: /export/i })
    await user.click(exportBtn)
    expect(downloadCsv).toHaveBeenCalledWith(expect.anything(), 'medtrack-report.csv')
  })

  it('per-medication breakdown table renders medication names', async () => {
    render(<AnalyticsPage />, { wrapper })
    await screen.findByRole('button', { name: /3M/i })
    await waitFor(() => {
      expect(screen.getByText('Aspirin')).toBeInTheDocument()
    })
    expect(screen.getByText('Metformin')).toBeInTheDocument()
  })

  it('chart container renders', async () => {
    render(<AnalyticsPage />, { wrapper })
    await screen.findByRole('button', { name: /3M/i })
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })
})
