import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LogIntakeDialog from '@/components/intake/log-intake-dialog'

vi.mock('@/generated/services/Ppa_medicationsService', () => ({
  Ppa_medicationsService: {
    getAll: vi.fn(),
  },
}))

vi.mock('@/generated/services/Ppa_intakelogsService', () => ({
  Ppa_intakelogsService: {
    getAll: vi.fn(),
    create: vi.fn(),
  },
}))

const injectionMed = {
  ppa_medicationid: 'inj1',
  ppa_name: 'Insulin',
  ppa_dosage: '40mg',
  ppa_frequency: 894250000 as const,
  ppa_method: 894250001 as const, // Injection
  ppa_isactive: true,
  ownerid: 'u1',
  owneridtype: 'systemuser',
  statecode: 0 as const,
  createdbyyominame: '',
  modifiedbyyominame: '',
  owneridname: '',
  owneridyominame: '',
  owningbusinessunitname: '',
}

const pillMed = {
  ...injectionMed,
  ppa_medicationid: 'pill1',
  ppa_name: 'Aspirin',
  ppa_method: 894250000 as const, // Pill
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  prePopulation: {},
  onSaved: vi.fn(),
}

beforeEach(async () => {
  const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
  const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
  vi.mocked(Ppa_medicationsService.getAll).mockResolvedValue({
    data: [injectionMed, pillMed],
    success: true,
  })
  vi.mocked(Ppa_intakelogsService.getAll).mockResolvedValue({ data: [], success: true })
  vi.mocked(Ppa_intakelogsService.create).mockResolvedValue({
    data: { ppa_intakelogid: 'new1', ppa_logname: 'Insulin' } as never,
    success: true,
  })
})

describe('LogIntakeDialog', () => {
  it('injection site section visible when Injection medication selected', async () => {
    const user = userEvent.setup()
    render(<LogIntakeDialog {...defaultProps} />, { wrapper })
    await screen.findByRole('combobox', { name: /medication/i })
    const medSelect = screen.getByRole('combobox', { name: /medication/i })
    await user.click(medSelect)
    await user.click(screen.getByRole('option', { name: /insulin/i }))
    expect(await screen.findByText(/injection site/i)).toBeInTheDocument()
  })

  it('injection site section hidden when Pill medication selected', async () => {
    const user = userEvent.setup()
    render(<LogIntakeDialog {...defaultProps} />, { wrapper })
    await screen.findByRole('combobox', { name: /medication/i })
    const medSelect = screen.getByRole('combobox', { name: /medication/i })
    await user.click(medSelect)
    await user.click(screen.getByRole('option', { name: /aspirin/i }))
    expect(screen.queryByText(/injection site/i)).not.toBeInTheDocument()
  })

  it('"Log Intake" button disabled when Injection med selected and no site chosen', async () => {
    const user = userEvent.setup()
    render(<LogIntakeDialog {...defaultProps} />, { wrapper })
    await screen.findByRole('combobox', { name: /medication/i })
    const medSelect = screen.getByRole('combobox', { name: /medication/i })
    await user.click(medSelect)
    await user.click(screen.getByRole('option', { name: /insulin/i }))
    const logBtn = await screen.findByRole('button', { name: /log intake/i })
    expect(logBtn).toBeDisabled()
  })

  it('"Log Intake" button enabled when Pill med selected (no site required)', async () => {
    const user = userEvent.setup()
    render(<LogIntakeDialog {...defaultProps} />, { wrapper })
    await screen.findByRole('combobox', { name: /medication/i })
    const medSelect = screen.getByRole('combobox', { name: /medication/i })
    await user.click(medSelect)
    await user.click(screen.getByRole('option', { name: /aspirin/i }))
    const logBtn = screen.getByRole('button', { name: /log intake/i })
    expect(logBtn).not.toBeDisabled()
  })

  it('changing medication from Injection→Pill hides injection section and clears site', async () => {
    const user = userEvent.setup()
    render(<LogIntakeDialog {...defaultProps} />, { wrapper })
    await screen.findByRole('combobox', { name: /medication/i })
    const medSelect = screen.getByRole('combobox', { name: /medication/i })
    await user.click(medSelect)
    await user.click(screen.getByRole('option', { name: /insulin/i }))
    await screen.findByText(/injection site/i)
    await user.click(screen.getByRole('combobox', { name: /medication/i }))
    await user.click(screen.getByRole('option', { name: /aspirin/i }))
    expect(screen.queryByText(/injection site/i)).not.toBeInTheDocument()
  })

  it('medication field disabled when pre-set from banner entry point', async () => {
    render(
      <LogIntakeDialog
        {...defaultProps}
        prePopulation={{ medicationId: 'inj1' }}
      />,
      { wrapper }
    )
    await screen.findByRole('combobox', { name: /medication/i })
    expect(screen.getByRole('combobox', { name: /medication/i })).toBeDisabled()
  })

  it('service.create called with correct payload on save', async () => {
    const { Ppa_intakelogsService } = await import('@/generated/services/Ppa_intakelogsService')
    const user = userEvent.setup()
    render(<LogIntakeDialog {...defaultProps} />, { wrapper })
    await screen.findByRole('combobox', { name: /medication/i })
    const medSelect = screen.getByRole('combobox', { name: /medication/i })
    await user.click(medSelect)
    await user.click(screen.getByRole('option', { name: /aspirin/i }))
    await user.click(screen.getByRole('button', { name: /log intake/i }))
    expect(Ppa_intakelogsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ ppa_logname: 'Aspirin' })
    )
  })
})
