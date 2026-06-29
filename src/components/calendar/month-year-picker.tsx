import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { formatDateLabel } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

const YEARS_PER_PAGE = 12
const MONTH_INDEXES = Array.from({ length: 12 }, (_, i) => i)

interface MonthYearPickerProps {
  /** Which picker to show: a month grid or a paged year grid. */
  mode: 'month' | 'year'
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The trigger element the popover anchors directly beneath. */
  trigger: React.ReactNode
  /** Currently viewed month; its month/year drive the selected pill. */
  value: Date
  /** Called with the new first-of-month Date when a pill is chosen. */
  onChange: (date: Date) => void
  /** Inclusive year range available for selection. */
  minYear: number
  maxYear: number
}

function Pill({
  selected,
  label,
  onSelect,
}: {
  selected: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'flex h-10 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted/50 text-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {label}
    </button>
  )
}

export default function MonthYearPicker({
  mode,
  open,
  onOpenChange,
  trigger,
  value,
  onChange,
  minYear,
  maxYear,
}: MonthYearPickerProps) {
  const selectedMonth = value.getMonth()
  const selectedYear = value.getFullYear()

  // First year of the currently shown year page (aligned to minYear).
  const [pageStart, setPageStart] = useState(minYear)
  useEffect(() => {
    if (open && mode === 'year') {
      const offset = Math.max(0, Math.floor((selectedYear - minYear) / YEARS_PER_PAGE)) * YEARS_PER_PAGE
      setPageStart(minYear + offset)
    }
  }, [open, mode, selectedYear, minYear])

  // Pick a value, apply it, and auto-close the popover.
  function pick(date: Date) {
    onChange(date)
    onOpenChange(false)
  }

  const pageEnd = Math.min(pageStart + YEARS_PER_PAGE - 1, maxYear)
  const pageYears: number[] = []
  for (let y = pageStart; y <= pageEnd; y++) pageYears.push(y)
  const canPrev = pageStart > minYear
  const canNext = pageStart + YEARS_PER_PAGE <= maxYear

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="center" sideOffset={6} className="w-auto p-3">
        {mode === 'year' && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Previous years"
              disabled={!canPrev}
              onClick={() => setPageStart((s) => Math.max(minYear, s - YEARS_PER_PAGE))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium" aria-live="polite">
              {pageStart}–{pageEnd}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Next years"
              disabled={!canNext}
              onClick={() => setPageStart((s) => s + YEARS_PER_PAGE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div role="listbox" aria-label={mode === 'month' ? 'Month' : 'Year'} className="grid grid-cols-3 gap-2">
          {mode === 'month'
            ? MONTH_INDEXES.map((m) => (
                <Pill
                  key={m}
                  selected={m === selectedMonth}
                  label={formatDateLabel(new Date(2000, m, 1), { month: 'short' })}
                  onSelect={() => pick(new Date(selectedYear, m, 1))}
                />
              ))
            : pageYears.map((y) => (
                <Pill
                  key={y}
                  selected={y === selectedYear}
                  label={String(y)}
                  onSelect={() => pick(new Date(y, selectedMonth, 1))}
                />
              ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
