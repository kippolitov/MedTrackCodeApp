import { useState, useMemo, useRef } from 'react'
import { subMonths, subYears, endOfWeek, format, eachWeekOfInterval } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import AdherenceChart from '@/components/analytics/adherence-chart'
import { useMedications } from '@/hooks/use-medications'
import { useIntakeLogs } from '@/hooks/use-intake-logs'
import { downloadCsv } from '@/lib/csv-export'
import { scheduledDosesOnDay, takenLogsOnDay } from '@/lib/adherence'
import { getSiteLabel } from '@/lib/injection-sites'
import type { AdherenceDataPoint } from '@/lib/adherence'
import type { IntakeLogRow } from '@/lib/csv-export'

type Window = '3M' | '6M' | '1Y'

function getWindowStart(w: Window, today: Date): Date {
  if (w === '3M') return subMonths(today, 3)
  if (w === '6M') return subMonths(today, 6)
  return subYears(today, 1)
}

export default function AnalyticsPage() {
  const [timeWindow, setTimeWindow] = useState<Window>('3M')
  const [medicationId, setMedicationId] = useState<string>('all')

  const today = useMemo(() => new Date(), [])
  const from = useMemo(() => getWindowStart(timeWindow, today), [timeWindow, today])

  const { data: medications = [], isPending: medsPending } = useMedications()
  const { data: logs = [], isPending: logsPending } = useIntakeLogs({ from, to: today })

  // One-way gate: once data has loaded, never show the full-page spinner again.
  // This keeps the time-window buttons visible during subsequent window-switch refetches.
  const hasInitiallyLoaded = useRef(false)
  if (!medsPending && !logsPending) hasInitiallyLoaded.current = true

  const filteredLogs = useMemo(
    () =>
      medicationId === 'all'
        ? logs
        : logs.filter((l) => l._ppa_medication_value === medicationId),
    [logs, medicationId]
  )

  const filteredMeds = useMemo(
    () =>
      medicationId === 'all'
        ? medications
        : medications.filter((m) => m.ppa_medicationid === medicationId),
    [medications, medicationId]
  )

  const chartData: AdherenceDataPoint[] = useMemo(() => {
    const weeks = eachWeekOfInterval({ start: from, end: today }, { weekStartsOn: 1 })
    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
      let scheduled = 0
      let taken = 0
      const cursor = new Date(weekStart)
      while (cursor <= weekEnd && cursor <= today) {
        scheduled += scheduledDosesOnDay(filteredMeds, cursor).length
        taken += takenLogsOnDay(filteredLogs, cursor).length
        cursor.setDate(cursor.getDate() + 1)
      }
      const adherencePercent = scheduled === 0 ? 0 : Math.round((taken / scheduled) * 100)
      return {
        periodLabel: format(weekStart, 'MM/dd'),
        periodStart: weekStart,
        adherencePercent,
        scheduledCount: scheduled,
        takenCount: taken,
      }
    })
  }, [filteredLogs, filteredMeds, from, today])

  const perMedStats = useMemo(() => {
    // Pre-group taken days by medication ID for O(1) lookup per (med, day) pair
    const takenDaysByMed = new Map<string, Set<string>>()
    for (const log of logs) {
      if (log.ppa_status !== 894250000 || !log._ppa_medication_value) continue
      const key = log.ppa_loggedat.slice(0, 10)
      if (!takenDaysByMed.has(log._ppa_medication_value)) {
        takenDaysByMed.set(log._ppa_medication_value, new Set())
      }
      takenDaysByMed.get(log._ppa_medication_value)!.add(key)
    }

    return medications.map((med) => {
      const medId = med.ppa_medicationid
      const takenDays = takenDaysByMed.get(medId) ?? new Set<string>()
      let scheduled = 0
      let taken = 0
      const cursor = new Date(from)
      while (cursor <= today) {
        if (scheduledDosesOnDay([med], cursor).length > 0) {
          scheduled++
          if (takenDays.has(cursor.toISOString().slice(0, 10))) taken++
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      const adherencePercent = scheduled === 0 ? 0 : Math.round((taken / scheduled) * 100)
      return { med, scheduled, taken, adherencePercent }
    })
  }, [medications, logs, from, today])

  function handleExport() {
    const statusMap: Record<number, string> = {
      894250000: 'Taken',
      894250001: 'Skipped',
      894250002: 'Missed',
    }
    const rows: IntakeLogRow[] = filteredLogs.map((l) => {
      const med = medications.find((m) => m.ppa_medicationid === l._ppa_medication_value)
      return {
        medicationName: med?.ppa_name ?? l.ppa_logname,
        loggedAt: new Date(l.ppa_loggedat),
        status: statusMap[Number(l.ppa_status)] ?? String(l.ppa_status),
        injectionSite: l.ppa_injectionsite != null ? getSiteLabel(l.ppa_injectionsite) : undefined,
        notes: l.ppa_notes,
      }
    })
    downloadCsv(rows, 'medtrack-report.csv')
    toast.success('Report downloaded')
  }

  if (!hasInitiallyLoaded.current) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div aria-label="Loading analytics" className="h-64 flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="flex flex-wrap items-center gap-3">
        {/* Time window selector */}
        <div className="flex gap-1">
          {(['3M', '6M', '1Y'] as Window[]).map((w) => (
            <Button
              key={w}
              variant={timeWindow === w ? 'default' : 'outline'}
              size="sm"
              aria-pressed={timeWindow === w}
              onClick={() => setTimeWindow(w)}
            >
              {w}
            </Button>
          ))}
        </div>

        {/* Medication filter */}
        <Select value={medicationId} onValueChange={setMedicationId}>
          <SelectTrigger className="w-44" aria-label="Medication filter">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {medications.map((med) => (
              <SelectItem key={med.ppa_medicationid} value={med.ppa_medicationid}>
                {med.ppa_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      <AdherenceChart data={chartData} isLoading={false} />

      {/* Per-medication breakdown table */}
      <section aria-label="Per-medication breakdown">
        <h2 className="font-semibold mb-3">Medication Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-medium">Medication</th>
                <th className="py-2 pr-4 font-medium text-right">Scheduled</th>
                <th className="py-2 pr-4 font-medium text-right">Taken</th>
                <th className="py-2 font-medium text-right">Adherence</th>
              </tr>
            </thead>
            <tbody>
              {perMedStats.map(({ med, scheduled, taken, adherencePercent }) => (
                <tr key={med.ppa_medicationid} className="border-b last:border-0">
                  <td className="py-2 pr-4">{med.ppa_name}</td>
                  <td className="py-2 pr-4 text-right">{scheduled}</td>
                  <td className="py-2 pr-4 text-right">{taken}</td>
                  <td className="py-2 text-right">{adherencePercent}%</td>
                </tr>
              ))}
              {perMedStats.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-muted-foreground">
                    No medications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
