import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import MedicationCard, { type MedicationViewModel } from './medication-card'

interface MedicationListProps {
  medications: MedicationViewModel[]
  isLoading: boolean
  onAdd: () => void
  onEdit: (medication: MedicationViewModel) => void
  onDelete: (medicationId: string) => Promise<void>
  onToggleActive: (medicationId: string, isActive: boolean) => Promise<void>
}

export default function MedicationList({
  medications,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  onToggleActive,
}: MedicationListProps) {
  const byName = (a: MedicationViewModel, b: MedicationViewModel) =>
    (a.ppa_name ?? '').localeCompare(b.ppa_name ?? '')
  const active = medications.filter((m) => m.ppa_isactive).sort(byName)
  const inactive = medications.filter((m) => !m.ppa_isactive).sort(byName)

  if (!isLoading && medications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <p className="text-muted-foreground">No medications yet.</p>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add your first medication
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold">Active</h2>
          <Badge>{active.length}</Badge>
        </div>
        <div className="flex flex-col gap-3">
          {active.map((med) => (
            <MedicationCard
              key={med.ppa_medicationid}
              medication={med}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
            />
          ))}
          {active.length === 0 && (
            <p className="text-sm text-muted-foreground">No active medications.</p>
          )}
        </div>
      </section>

      {inactive.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-semibold">Inactive</h2>
            <Badge variant="secondary">{inactive.length}</Badge>
          </div>
          <div className="flex flex-col gap-3">
            {inactive.map((med) => (
              <MedicationCard
                key={med.ppa_medicationid}
                medication={med}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleActive={onToggleActive}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
