import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMedications } from '@/hooks/use-medications'
import { useIntakeLogs } from '@/hooks/use-intake-logs'
import { scheduledDosesOnDay } from '@/lib/adherence'
import { startOfLocalDay, endOfLocalDay, isSameLocalDay } from '@/lib/date-utils'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

interface ScheduleListProps {
  onLog: (medication: Ppa_medications) => void
  onEdit?: (log: Ppa_intakelogs) => void
}

const STATUS_CONFIG = {
  894250000: { label: 'Taken',   className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  894250001: { label: 'Skipped', className: 'bg-gray-100  text-gray-700  dark:bg-gray-800       dark:text-gray-400' },
  894250002: { label: 'Missed',  className: 'bg-red-100   text-red-800   dark:bg-red-900/30     dark:text-red-400' },
} as const

export default function ScheduleList({ onLog, onEdit }: ScheduleListProps) {
  const today = new Date()
  const { data: medications = [] } = useMedications()
  const { data: logs = [] } = useIntakeLogs({
    from: startOfLocalDay(today),
    to: endOfLocalDay(today),
  })

  const scheduled = scheduledDosesOnDay(medications, today)

  // Build a map: medicationId → best log for today.
  // Prefer Taken over Skipped/Missed so a corrected log wins.
  const logByMedId = new Map<string, Ppa_intakelogs>()
  for (const log of logs) {
    const mid = log._ppa_medication_value
    if (!mid || !isSameLocalDay(new Date(log.ppa_loggedat), today)) continue
    const existing = logByMedId.get(mid)
    if (!existing || log.ppa_status === 894250000) {
      logByMedId.set(mid, log)
    }
  }

  if (scheduled.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No doses scheduled today.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {scheduled.map((med) => {
        const log = logByMedId.get(med.ppa_medicationid)
        const statusCfg = log ? STATUS_CONFIG[log.ppa_status as keyof typeof STATUS_CONFIG] : undefined

        return (
          <li
            key={med.ppa_medicationid}
            className="flex items-center justify-between border rounded-lg px-4 py-3 gap-3"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{med.ppa_name}</span>
              <span className="text-xs text-muted-foreground">
                {med.ppa_dosage}
                {med.ppa_remindertime && ` · ${med.ppa_remindertime}`}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {log && statusCfg ? (
                <>
                  <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                  {onEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(log)}
                      aria-label={`Edit ${med.ppa_name} log`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => onLog(med)}>
                  Log
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
