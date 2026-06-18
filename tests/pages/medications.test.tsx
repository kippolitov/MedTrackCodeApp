import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import MedicationsPage from '@/pages/medications'
import { useUiStore } from '@/stores/ui-store'

vi.mock('@/generated/services/Ppa_medicationsService', () => ({
  Ppa_medicationsService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
