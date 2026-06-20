import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MedicationForm from '@/components/medications/medication-form'

// Mock the service
vi.mock('@/generated/services/Ppa_medicationsService', () => ({
  Ppa_medicationsService: {
    create: vi.fn().mockResolvedValue({ data: { ppa_medicationid: '123', ppa_name: 'Test' } }),
    update: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const defaultProps = {
  mode: 'add' as const,
  open: true,
  onOpenChange: vi.fn(),
  onSaved: vi.fn(),
}

describe('MedicationForm', () => {
  it('Save button disabled when Name is empty', () => {
    render(<MedicationForm {...defaultProps} />, { wrapper })
    const saveBtn = screen.getByRole('button', { name: /save/i })
    expect(saveBtn).toBeDisabled()
  })

  it('Scheduled Day field appears when Frequency = Weekly', async () => {
    const user = userEvent.setup()
    render(<MedicationForm {...defaultProps} />, { wrapper })
    // Open frequency select
    const freqTrigger = screen.getByRole('combobox', { name: /frequency/i })
    await user.click(freqTrigger)
    await user.click(screen.getByRole('option', { name: 'Weekly' }))
    expect(screen.getByRole('combobox', { name: /scheduled day/i })).toBeInTheDocument()
  })

  it('Scheduled Day field appears when Frequency = Biweekly', async () => {
    const user = userEvent.setup()
    render(<MedicationForm {...defaultProps} />, { wrapper })
    const freqTrigger = screen.getByRole('combobox', { name: /frequency/i })
    await user.click(freqTrigger)
    await user.click(screen.getByRole('option', { name: /biweekly/i }))
    expect(screen.getByRole('combobox', { name: /scheduled day/i })).toBeInTheDocument()
  })

  it('Scheduled Day field hidden when Frequency = Daily', async () => {
    const user = userEvent.setup()
    render(<MedicationForm {...defaultProps} />, { wrapper })
    const freqTrigger = screen.getByRole('combobox', { name: /frequency/i })
    await user.click(freqTrigger)
    await user.click(screen.getByRole('option', { name: /daily/i }))
    expect(screen.queryByRole('combobox', { name: /scheduled day/i })).not.toBeInTheDocument()
  })

  it('switching Frequency to Daily clears Scheduled Day from form state', async () => {
    const user = userEvent.setup()
    render(<MedicationForm {...defaultProps} />, { wrapper })
    // First set to Weekly
    const freqTrigger = screen.getByRole('combobox', { name: /frequency/i })
    await user.click(freqTrigger)
    await user.click(screen.getByRole('option', { name: 'Weekly' }))
    // Select a day
    const dayTrigger = screen.getByRole('combobox', { name: /scheduled day/i })
    await user.click(dayTrigger)
    await user.click(screen.getByRole('option', { name: /monday/i }))
    // Then switch to Daily
    const freqTrigger2 = screen.getByRole('combobox', { name: /frequency/i })
    await user.click(freqTrigger2)
    await user.click(screen.getByRole('option', { name: /daily/i }))
    // Scheduled Day should be gone
    expect(screen.queryByRole('combobox', { name: /scheduled day/i })).not.toBeInTheDocument()
  })

  it('NO injection site section exists in the form', () => {
    render(<MedicationForm {...defaultProps} />, { wrapper })
    expect(screen.queryByText(/injection site/i)).not.toBeInTheDocument()
  })

  it('form calls Ppa_medicationsService.create with correct payload on Save', async () => {
    const { Ppa_medicationsService } = await import('@/generated/services/Ppa_medicationsService')
    const user = userEvent.setup()
    render(<MedicationForm {...defaultProps} />, { wrapper })
    await user.type(screen.getByRole('textbox', { name: /name/i }), 'Aspirin')
    await user.type(screen.getByRole('textbox', { name: /dosage/i }), '100mg')
    const freqTrigger = screen.getByRole('combobox', { name: /frequency/i })
    await user.click(freqTrigger)
    await user.click(screen.getByRole('option', { name: /daily/i }))
    const methodTrigger = screen.getByRole('combobox', { name: /method/i })
    await user.click(methodTrigger)
    await user.click(screen.getByRole('option', { name: /pill/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(Ppa_medicationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ ppa_name: 'Aspirin', ppa_dosage: '100mg' })
    )
  })
})
