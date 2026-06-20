import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BodyMap from '@/components/intake/body-map'
import type { Ppa_intakelogsppa_injectionsite } from '@/generated/models/Ppa_intakelogsModel'

const defaultProps = {
  recentSites: [] as Ppa_intakelogsppa_injectionsite[],
  selectedSite: undefined as Ppa_intakelogsppa_injectionsite | undefined,
  onSiteSelect: vi.fn(),
}

describe('BodyMap', () => {
  it('all 5 chip buttons always rendered', () => {
    render(<BodyMap {...defaultProps} />)
    expect(screen.getByRole('button', { name: /right hip/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /left hip/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /abdominal right/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /abdominal center/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /abdominal left/i })).toBeInTheDocument()
  })

  it('no chip auto-selected on mount', () => {
    render(<BodyMap {...defaultProps} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn).not.toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('tapping a chip calls onSiteSelect with correct site value', async () => {
    const user = userEvent.setup()
    const onSiteSelect = vi.fn()
    render(<BodyMap {...defaultProps} onSiteSelect={onSiteSelect} />)
    await user.click(screen.getByRole('button', { name: /right hip/i }))
    expect(onSiteSelect).toHaveBeenCalledWith(894250000)
  })

  it('tapping a second chip deselects the first (single-select via onSiteSelect)', async () => {
    const user = userEvent.setup()
    const onSiteSelect = vi.fn()
    render(<BodyMap {...defaultProps} onSiteSelect={onSiteSelect} />)
    await user.click(screen.getByRole('button', { name: /left hip/i }))
    expect(onSiteSelect).toHaveBeenLastCalledWith(894250001)
    await user.click(screen.getByRole('button', { name: /right hip/i }))
    expect(onSiteSelect).toHaveBeenLastCalledWith(894250000)
  })

  it('recently-used chip shows "(recent)" suffix', () => {
    render(<BodyMap {...defaultProps} recentSites={[894250000]} />)
    expect(screen.getByRole('button', { name: /right hip.*recent/i })).toBeInTheDocument()
  })

  it('figure dots have pointer-events-none (not interactive)', () => {
    const { container } = render(<BodyMap {...defaultProps} />)
    // The SVG dots should have pointer-events: none
    const dots = container.querySelectorAll('[data-site-dot]')
    dots.forEach((dot) => {
      // Check class or inline style
      expect((dot as HTMLElement).classList.contains('pointer-events-none') ||
             (dot as SVGElement).getAttribute('pointer-events') === 'none').toBe(true)
    })
  })
})
