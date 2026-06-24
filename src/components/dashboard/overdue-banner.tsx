import { Button } from '@/components/ui/button'
import type { OverdueMedication, MedicationViewModel } from '@/lib/adherence'

interface OverdueBannerProps {
  overdueMedications: OverdueMedication[]
  onLog: (medication: MedicationViewModel) => void
}

function formatOverdue(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`
  if (hours > 0) return `${hours}h`
  return `${minutes}min`
}

export default function OverdueBanner({ overdueMedications, onLog }: OverdueBannerProps) {
  if (overdueMedications.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Overdue medications"
      className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 rounded-lg px-4 py-3 flex flex-col gap-2"
    >
      {overdueMedications.length > 1 && (
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {overdueMedications.length} doses overdue
        </p>
      )}
      {overdueMedications.map(({ medication, overdueBy }) => (
        <div
          key={medication.ppa_medicationid}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {medication.ppa_name} {medication.ppa_dosage} — overdue by {formatOverdue(overdueBy)}
          </span>
          <Button size="sm" variant="outline" onClick={() => onLog(medication)}>
            Log
          </Button>
        </div>
      ))}
    </div>
  )
}
