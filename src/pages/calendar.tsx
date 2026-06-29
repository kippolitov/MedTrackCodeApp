import { useState, useMemo, useRef } from 'react'
import { format, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { Button } from '@/components/ui/button'
import IntakeLogCard from '@/components/intake/intake-log-card'
import LogIntakeDialog from '@/components/intake/log-intake-dialog'
import MonthYearPicker from '@/components/calendar/month-year-picker'
import { useIntakeLogs, useDeleteIntakeLog } from '@/hooks/use-intake-logs'
import { useMedications } from '@/hooks/use-medications'
import { isSameLocalDay, formatDateLabel, getCalendarBounds } from '@/lib/date-utils'
import { useUiStore } from '@/stores/ui-store'
import { useLogIntakeStore } from '@/stores/log-intake-store'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

export default function CalendarPage() {
  const [viewedMonth, setViewedMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
  const [overlay, setOverlay] = useState<'none' | 'month' | 'year'>('none')
  const dayPanelRef = useRef<HTMLElement>(null)

  // Bounded month/year range for navigation.
  const { startMonth, endMonth } = useMemo(() => getCalendarBounds(), [])

  const canGoPrev = startOfMonth(viewedMonth) > startOfMonth(startMonth)
  const canGoNext = startOfMonth(viewedMonth) < startOfMonth(endMonth)
  const monthLabel = formatDateLabel(viewedMonth, { month: 'long' })
  const yearLabel = String(viewedMonth.getFullYear())

  const { isLogIntakeOpen, setLogIntakeOpen } = useUiStore()
  const { prePopulation, setPrePopulation, clearPrePopulation } = useLogIntakeStore()

  useMedications()

  const { data: logs = [], isPending } = useIntakeLogs({
    from: startOfMonth(viewedMonth),
    to: endOfMonth(viewedMonth),
  })

  const deleteMutation = useDeleteIntakeLog()

  const { hasTakenDays, hasMissedDays, hasSkippedDays, mixedDays } = useMemo(() => {
    const taken: Date[] = []
    const missed: Date[] = []
    const skipped: Date[] = []
    const mixed: Date[] = []

    const dayMap = new Map<string, { hasTaken: boolean; hasMissed: boolean; hasSkipped: boolean }>()

    for (const log of logs) {
      const d = new Date(log.ppa_loggedat)
      const key = format(d, 'yyyy-MM-dd')
      const existing = dayMap.get(key) ?? { hasTaken: false, hasMissed: false, hasSkipped: false }

      if (log.ppa_status === 894250000) existing.hasTaken = true
      else if (log.ppa_status === 894250002) existing.hasMissed = true
      else if (log.ppa_status === 894250001) existing.hasSkipped = true

      dayMap.set(key, existing)
    }

    for (const [key, { hasTaken, hasMissed, hasSkipped }] of dayMap) {
      const d = new Date(key + 'T12:00:00')
      if (hasTaken && hasMissed) mixed.push(d)
      else if (hasTaken) taken.push(d)
      else if (hasMissed) missed.push(d)
      else if (hasSkipped) skipped.push(d)
    }

    return { hasTakenDays: taken, hasMissedDays: missed, hasSkippedDays: skipped, mixedDays: mixed }
  }, [logs])

  const selectedDayLogs: Ppa_intakelogs[] = selectedDate
    ? logs.filter((l) => isSameLocalDay(new Date(l.ppa_loggedat), selectedDate))
    : []

  function handleDayClick(day: Date) {
    setSelectedDate(day)
    useUiStore.getState().setSelectedCalendarDate(day)
    // Scroll day panel into view on mobile after state updates
    setTimeout(() => dayPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  // Click delegation: DayPicker puts data-day on <td> elements, so we catch
  // clicks on both <td> and inner <button> via bubble and parse data-day.
  function handleCalendarClick(e: React.MouseEvent) {
    const td = (e.target as Element).closest('[data-day]') as HTMLElement | null
    if (!td) return
    const dateStr = td.dataset.day
    if (!dateStr) return
    if (td.dataset.outside === 'true') return
    const [y, m, d] = dateStr.split('-').map(Number)
    handleDayClick(new Date(y, m - 1, d, 12))
  }

  function handleLogFromPanel() {
    if (!selectedDate) return
    setPrePopulation({ calendarDate: selectedDate })
    setLogIntakeOpen(true)
  }

  async function handleDelete(logId: string) {
    try {
      await deleteMutation.mutateAsync(logId)
      toast.success('Intake log deleted')
    } catch (err) {
      console.error('Delete intake log error:', err)
      toast.error('Failed to delete intake log. Please try again.')
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setViewedMonth(new Date()); setSelectedDate(new Date()) }}
        >
          Today
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          {/* Month navigation: prev/next arrows flanking separately-tappable
              month and year labels, each opening its own picker overlay. */}
          <div className="mb-2 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous month"
              disabled={!canGoPrev}
              onClick={() => setViewedMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-1 text-lg font-semibold">
              <MonthYearPicker
                mode="month"
                open={overlay === 'month'}
                onOpenChange={(o) => setOverlay(o ? 'month' : 'none')}
                value={viewedMonth}
                onChange={setViewedMonth}
                minYear={startMonth.getFullYear()}
                maxYear={endMonth.getFullYear()}
                trigger={
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-label={`${monthLabel}, change month`}
                    className="rounded-md px-2 py-1 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {monthLabel}
                  </button>
                }
              />
              <MonthYearPicker
                mode="year"
                open={overlay === 'year'}
                onOpenChange={(o) => setOverlay(o ? 'year' : 'none')}
                value={viewedMonth}
                onChange={setViewedMonth}
                minYear={startMonth.getFullYear()}
                maxYear={endMonth.getFullYear()}
                trigger={
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-label={`${yearLabel}, change year`}
                    className="rounded-md px-2 py-1 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {yearLabel}
                  </button>
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next month"
              disabled={!canGoNext}
              onClick={() => setViewedMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {isPending ? (
            <div
              aria-label="Loading calendar"
              className="h-64 flex items-center justify-center text-sm text-muted-foreground"
            >
              Loading…
            </div>
          ) : (
            <div onClick={handleCalendarClick}>
              <DayPicker
                month={viewedMonth}
                onMonthChange={setViewedMonth}
                selected={selectedDate ?? undefined}
                hideNavigation
                startMonth={startMonth}
                endMonth={endMonth}
                classNames={{
                  root: 'w-full',
                  months: 'w-full',
                  month: 'w-full',
                  // Built-in caption/nav is hidden; navigation is our custom header above.
                  month_caption: 'hidden',
                  month_grid: 'w-full border-collapse',
                  weekdays: 'border-b border-border/40',
                  weekday: 'py-3 text-xs font-medium text-center text-muted-foreground',
                }}
                modifiers={{
                  'has-taken': hasTakenDays,
                  'has-missed': hasMissedDays,
                  'has-skipped': hasSkippedDays,
                  mixed: mixedDays,
                }}
                components={{
                  Day: ({ day, modifiers, ...tdProps }) => {
                    const {
                      children,
                      style: _style,
                      className: _cls,
                      ...restProps
                    } = tdProps as React.TdHTMLAttributes<HTMLTableCellElement> & { children?: React.ReactNode }

                    const isSelected = selectedDate ? isSameLocalDay(day.date, selectedDate) : false

                    const cellStyle: React.CSSProperties = {}
                    if (modifiers['mixed']) {
                      cellStyle.backgroundColor = 'rgba(124,45,18,0.85)'
                    } else if (modifiers['has-taken']) {
                      cellStyle.backgroundColor = 'rgba(20,83,45,0.85)'
                    } else if (modifiers['has-missed']) {
                      cellStyle.backgroundColor = 'rgba(127,29,29,0.85)'
                    } else if (modifiers['has-skipped']) {
                      cellStyle.backgroundColor = 'rgba(55,65,81,0.6)'
                    }
                    if (isSelected) {
                      cellStyle.boxShadow = 'inset 0 0 0 2px #22d3ee'
                    }
                    if (modifiers.outside) cellStyle.opacity = 0.3

                    const hasLog = modifiers['has-taken'] || modifiers['has-missed'] || modifiers['has-skipped'] || modifiers['mixed']
                    if (hasLog) {
                      cellStyle.color = 'white'
                    }
                    const dotColor = modifiers['mixed'] ? '#f97316'
                      : modifiers['has-taken'] ? '#22c55e'
                      : modifiers['has-missed'] ? '#ef4444'
                      : '#9ca3af'

                    return (
                      <td
                        {...restProps}
                        data-has-taken={modifiers['has-taken'] || undefined}
                        data-has-missed={modifiers['has-missed'] || undefined}
                        data-has-skipped={modifiers['has-skipped'] || undefined}
                        data-mixed={modifiers['mixed'] || undefined}
                        className="border border-border/30 align-top"
                        style={cellStyle}
                      >
                        <div className="flex flex-col items-center py-2 gap-1 min-h-[4.5rem]">
                          {children}
                          {hasLog && (
                            <span
                              className="w-1.5 h-1.5 rounded-full block"
                              style={{ backgroundColor: dotColor }}
                            />
                          )}
                        </div>
                      </td>
                    )
                  },
                }}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500" />Taken
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500" />Missed
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-gray-400" />Skipped
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-orange-500" />Mixed
            </span>
          </div>
        </div>

        {selectedDate && isSameMonth(selectedDate, viewedMonth) && (
          <aside
            ref={dayPanelRef}
            role="region"
            aria-label="Day detail"
            className="w-full md:w-72 border rounded-lg p-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {formatDateLabel(selectedDate, { year: 'numeric', month: 'long', day: 'numeric' })}
              </h2>
              <Button size="sm" onClick={handleLogFromPanel}>
                Log Intake
              </Button>
            </div>

            {selectedDayLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No logs for this day.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {selectedDayLogs.map((log) => (
                  <li key={log.ppa_intakelogid}>
                    <IntakeLogCard
                      log={log}
                      onEdit={() => {
                        setPrePopulation({
                          editingLogId: log.ppa_intakelogid,
                          medicationId: log._ppa_medication_value,
                          loggedAt: new Date(log.ppa_loggedat),
                          initialStatus: log.ppa_status,
                          initialInjectionSite: log.ppa_injectionsite,
                          initialNotes: log.ppa_notes,
                          calendarDate: selectedDate ?? undefined,
                        })
                        setLogIntakeOpen(true)
                      }}
                      onDelete={() => handleDelete(log.ppa_intakelogid)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      {isLogIntakeOpen && (
        <LogIntakeDialog
          open={isLogIntakeOpen}
          onOpenChange={setLogIntakeOpen}
          prePopulation={prePopulation}
          onSaved={() => clearPrePopulation()}
        />
      )}
    </div>
  )
}
