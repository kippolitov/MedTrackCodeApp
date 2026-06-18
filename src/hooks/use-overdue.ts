import { useMemo } from 'react'
import { useMedications } from './use-medications'
import { useIntakeLogs } from './use-intake-logs'
import { startOfLocalDay, endOfLocalDay, isSameLocalDay } from '@/lib/date-utils'
import type { OverdueMedication } from '@/lib/adherence'

export function useOverdue(): OverdueMedication[] {
  const today = new Date()

  const { data: medications = [] } = useMedications()
  const { data: logs = [] } = useIntakeLogs(
    {
      from: startOfLocalDay(today),
      to: endOfLocalDay(today),
    },
  )

  return useMemo<OverdueMedication[]>(() => {
    const now = new Date()
    const todayLogs = logs.filter((l) => isSameLocalDay(new Date(l.ppa_loggedat), now))
    const takenMedIds = new Set(
      todayLogs
        .filter((l) => l.ppa_status === 894250000) // Taken
        .map((l) => l._ppa_medication_value)
        .filter(Boolean)
    )

    const overdue: OverdueMedication[] = []

    for (const med of medications) {
      if (!med.ppa_isactive) continue
      if (!med.ppa_remindertime) continue
      if (takenMedIds.has(med.ppa_medicationid)) continue

      const [hours, minutes] = med.ppa_remindertime.split(':').map(Number)
      const reminderMs = hours * 60 * 60 * 1000 + minutes * 60 * 1000
      const dayStartMs = startOfLocalDay(now).getTime()
      const reminderDate = new Date(dayStartMs + reminderMs)

      if (reminderDate < now) {
        overdue.push({
          medication: med,
          overdueBy: now.getTime() - reminderDate.getTime(),
        })
      }
    }

    return overdue.sort((a, b) => b.overdueBy - a.overdueBy)
  }, [medications, logs])
}
