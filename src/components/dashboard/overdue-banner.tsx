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

  const first = overdueMedications[0]

  return (
    <div
      role="region"
      aria-label="Overdue medications"
      className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
    >
      {overdueMedications.length === 1 ? (
        <>
          <span className="text-sm font-medium text-amber-900">
            {first.medication.ppa_name} {first.medication.ppa_dosage} — overdue by{' '}
            {formatOverdue(first.overdueBy)}
          </span>
          <Button size="sm" variant="outline" onClick={() => onLog(first.medication)}>
            Log
          </Button>
        </>
      ) : (
        <>
          <span className="text-sm font-medium text-amber-900">
            {overdueMedications.length} doses overdue
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onLog(first.medication)}>
              Log First
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
