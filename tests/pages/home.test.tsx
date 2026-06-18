import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import HomePage from '@/pages/home'
import { useUiStore } from '@/stores/ui-store'

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

function makeMed(overrides = {}) {
  return {
    ppa_medicationid: 'med1',
    ppa_name: 'Aspirin',
    ppa_dosage: '100mg',
    ppa_frequency: 894250000 as const,
    ppa_method: 894250000 as const,
    ppa_isactive: true,
    ppa_remindertime: '08:00',
    ownerid: 'u1',
    owneridtype: 'systemuser',
    statecode: 0 as const,
    createdbyyominame: '',
    modifiedbyyominame: '',
    owneridname: '',
    owneridyominame: '',
    owningbusinessunitname: '',
    createdon: '2026-01-01T00:00:00Z',
    ...overrides,
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
  useUiStore.setState({ isMedicationFormOpen: false, isLogIntakeOpen: false })
  const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
  const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
  vi.mocked(Ppa_medicationsService.getAll).mockResolvedValue({ data: [makeMed()], success: true })
  vi.mocked(Ppa_intakelogsService.getAll).mockResolvedValue({ data: [], success: true })
})

describe('HomePage', () => {
  it('StatsBar renders all 4 stat tiles', async () => {
    render(<HomePage />, { wrapper })
    expect(await screen.findByText(/adherence/i)).toBeInTheDocument()
    expect(screen.getByText(/streak/i)).toBeInTheDocument()
    expect(screen.getByText(/missed/i)).toBeInTheDocument()
    expect(screen.getByText(/active/i)).toBeInTheDocument()
  })

  it('OverdueBanner visible when overdue medication exists', async () => {
    // Reminder at 07:00, and today after that — the logs are empty, so overdue
    // We need to check if OverdueBanner appears; if reminderTime < now and no log
    const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
    vi.mocked(Ppa_medicationsService.getAll).mockResolvedValue({
      data: [makeMed({ ppa_remindertime: '00:01' })], // reminder at 00:01 = always overdue
      success: true,
    })
    render(<HomePage />, { wrapper })
    expect(await screen.findByRole('region', { name: /overdue/i })).toBeInTheDocument()
  })

  it('OverdueBanner hidden when no overdue medications', async () => {
    render(<HomePage />, { wrapper })
    await screen.findByText(/streak/i)
    expect(screen.queryByRole('region', { name: /overdue/i })).not.toBeInTheDocument()
  })

  it("Today's Schedule lists all doses due today", async () => {
    render(<HomePage />, { wrapper })
    expect(await screen.findByRole('heading', { name: /today/i })).toBeInTheDocument()
    expect(await screen.findByText('Aspirin')).toBeInTheDocument()
  })

  it('standalone Log Intake button is rendered', async () => {
    render(<HomePage />, { wrapper })
    expect(await screen.findByRole('button', { name: /log intake/i })).toBeInTheDocument()
  })
})
