import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMedications } from '@/hooks/use-medications'
import { useIntakeLogs } from '@/hooks/use-intake-logs'
import { scheduledDosesOnDay, takenLogsOnDay } from '@/lib/adherence'
import { startOfLocalDay, endOfLocalDay } from '@/lib/date-utils'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'

interface ScheduleListProps {
  onLog: (medication: Ppa_medications) => void
}

export default function ScheduleList({ onLog }: ScheduleListProps) {
  const today = new Date()
  const { data: medications = [] } = useMedications()
  const { data: logs = [] } = useIntakeLogs({
    from: startOfLocalDay(today),
    to: endOfLocalDay(today),
  })

  const scheduled = scheduledDosesOnDay(medications, today)
  const taken = takenLogsOnDay(logs, today)
  const takenMedIds = new Set(
    taken.map((l) => l._ppa_medication_value).filter(Boolean)
  )

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
        const isTaken = takenMedIds.has(med.ppa_medicationid)
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
            <div className="flex items-center gap-2">
              {isTaken ? (
                <Badge variant="secondary">Taken</Badge>
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
