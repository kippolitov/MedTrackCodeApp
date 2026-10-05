import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import MedicationsPage from '@/pages/medications'
import { useUiStore } from '@/stores/ui-store'
import { formatDateLabel } from '@/lib/date-utils'

vi.mock('@/generated/services/Ppa_medicationsService', () => ({
  Ppa_medicationsService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

// Each card's schedule section reads the latest Taken and Skipped Intake Logs.
vi.mock('@/generated/services/Ppa_intakelogsService', () => ({
  Ppa_intakelogsService: {
    getAll: vi.fn(),
  },
}))

function makeMedication(overrides = {}) {
  return {
    ppa_medicationid: '1',
    ppa_name: 'Aspirin',
    ppa_dosage: '100mg',
    ppa_frequency: 894250000 as const,
    ppa_method: 894250000 as const,
    ppa_isactive: true,
    ownerid: 'user1',
    owneridtype: 'systemuser',
    statecode: 0 as const,
    createdbyyominame: '',
    modifiedbyyominame: '',
    owneridname: '',
    owneridyominame: '',
    owningbusinessunitname: '',
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
  // Reset Zustand store so dialog state doesn't leak between tests
  useUiStore.setState({
    isMedicationFormOpen: false,
    medicationFormMode: 'add',
    editingMedication: null,
    selectedCalendarDate: null,
    isLogIntakeOpen: false,
  })
  const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
  vi.mocked(Ppa_medicationsService.getAll).mockResolvedValue({ data: [makeMedication()], success: true })
  vi.mocked(Ppa_medicationsService.create).mockResolvedValue({ data: makeMedication({ ppa_medicationid: '2', ppa_name: 'New Med' }), success: true })
  vi.mocked(Ppa_medicationsService.update).mockResolvedValue({ data: makeMedication(), success: true })
  vi.mocked(Ppa_medicationsService.delete).mockResolvedValue(undefined)
  const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
  vi.mocked(Ppa_intakelogsService.getAll).mockResolvedValue({ data: [], success: true })
})

describe('MedicationsPage', () => {
  it('empty state shows CTA when list is empty', async () => {
    const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
    vi.mocked(Ppa_medicationsService.getAll).mockResolvedValueOnce({ data: [], success: true })
    render(<MedicationsPage />, { wrapper })
    expect(await screen.findByText(/add your first medication/i)).toBeInTheDocument()
  })

  it('medication appears in Active section after create', async () => {
    render(<MedicationsPage />, { wrapper })
    expect(await screen.findByText('Aspirin')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Active' })).toBeInTheDocument()
  })

  it('edit form pre-populates all saved field values', async () => {
    const user = userEvent.setup()
    render(<MedicationsPage />, { wrapper })
    await screen.findByText('Aspirin')
    const editBtn = screen.getByRole('button', { name: /edit/i })
    await user.click(editBtn)
    expect(screen.getByDisplayValue('Aspirin')).toBeInTheDocument()
  })

  it('delete shows confirm dialog before calling service.delete', async () => {
    const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
    const user = userEvent.setup()
    render(<MedicationsPage />, { wrapper })
    await screen.findByText('Aspirin')
    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    await user.click(deleteBtn)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(Ppa_medicationsService.delete).not.toHaveBeenCalled()
  })

  it('toggling Active calls update mutation', async () => {
    const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
    const user = userEvent.setup()
    render(<MedicationsPage />, { wrapper })
    await screen.findByText('Aspirin')
    const toggle = screen.getByRole('switch', { name: /active/i })
    await user.click(toggle)
    expect(Ppa_medicationsService.update).toHaveBeenCalled()
  })
})

describe('MedicationsPage — schedule section (US1)', () => {
  it('each card ends with a region labelled "Schedule for <name>"', async () => {
    const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
    vi.mocked(Ppa_medicationsService.getAll).mockResolvedValue({
      data: [
        makeMedication({ ppa_medicationid: '1', ppa_name: 'Aspirin' }),
        makeMedication({ ppa_medicationid: '2', ppa_name: 'Metformin' }),
      ],
      success: true,
    })
    render(<MedicationsPage />, { wrapper })

    for (const name of ['Aspirin', 'Metformin']) {
      const region = await screen.findByRole('region', { name: `Schedule for ${name}` })
      const card = region.parentElement
      expect(card).not.toBeNull()
      // Last block of the card, below the Active switch.
      expect(card?.lastElementChild).toBe(region)
      const activeSwitch = within(card as HTMLElement).getByRole('switch', { name: /active/i })
      expect(
        activeSwitch.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(await within(region).findByText('Last taken')).toBeInTheDocument()
      expect(within(region).getByText('Next intake')).toBeInTheDocument()
    }
  })

  it('reads the latest Taken and Skipped log for every card', async () => {
    const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
    render(<MedicationsPage />, { wrapper })
    await screen.findByText('Not yet taken')

    const filters = vi.mocked(Ppa_intakelogsService.getAll).mock.calls.map(([options]) => options?.filter ?? '')
    expect(filters).toHaveLength(2)
    expect(filters.every((f) => f.includes('_ppa_medication_value eq 1'))).toBe(true)
    expect(filters.some((f) => f.includes('ppa_status eq 894250000'))).toBe(true)
    expect(filters.some((f) => f.includes('ppa_status eq 894250001'))).toBe(true)
  })

  it('a card in the Inactive section reads "Reminders off"', async () => {
    const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
    vi.mocked(Ppa_medicationsService.getAll).mockResolvedValue({
      data: [makeMedication({ ppa_isactive: false })],
      success: true,
    })
    render(<MedicationsPage />, { wrapper })

    expect(await screen.findByRole('heading', { name: 'Inactive' })).toBeInTheDocument()
    const region = await screen.findByRole('region', { name: 'Schedule for Aspirin' })
    expect(await within(region).findByText('Reminders off')).toBeInTheDocument()
    expect(within(region).queryByText('Due today')).not.toBeInTheDocument()
  })

  it('switching Inactive to Active shows the next intake date without a reload', async () => {
    const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
    let isActive = false
    vi.mocked(Ppa_medicationsService.getAll).mockImplementation(async () => ({
      data: [makeMedication({ ppa_isactive: isActive })],
      success: true,
    }))
    vi.mocked(Ppa_medicationsService.update).mockImplementation(async (_id, fields) => {
      isActive = fields.ppa_isactive ?? isActive
      return { data: makeMedication({ ppa_isactive: isActive }), success: true }
    })

    const user = userEvent.setup()
    render(<MedicationsPage />, { wrapper })
    const before = await screen.findByRole('region', { name: 'Schedule for Aspirin' })
    expect(await within(before).findByText('Reminders off')).toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: /active/i }))

    // A Daily Medication with no logs is due today.
    const today = formatDateLabel(new Date(), { weekday: 'short', month: 'short', day: 'numeric' })
    await waitFor(() => {
      const region = screen.getByRole('region', { name: 'Schedule for Aspirin' })
      expect(within(region).queryByText('Reminders off')).not.toBeInTheDocument()
      expect(region).toHaveTextContent(today)
      expect(within(region).getByText('Due today')).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: 'Active' })).toBeInTheDocument()
  })
})
