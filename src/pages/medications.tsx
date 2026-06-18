import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import MedicationList from '@/components/medications/medication-list'
import MedicationForm from '@/components/medications/medication-form'
import { useMedications, useUpdateMedication, useDeleteMedication } from '@/hooks/use-medications'
import { useUiStore } from '@/stores/ui-store'
import type { MedicationViewModel } from '@/components/medications/medication-card'

export default function MedicationsPage() {
  const { data: medications = [], isLoading } = useMedications()
  const updateMed = useUpdateMedication()
  const deleteMed = useDeleteMedication()

  const {
    isMedicationFormOpen,
    medicationFormMode,
    editingMedication,
    setMedicationFormOpen,
    setMedicationFormMode,
    setEditingMedication,
  } = useUiStore()

  function handleAdd() {
    setEditingMedication(null)
    setMedicationFormMode('add')
    setMedicationFormOpen(true)
  }

  function handleEdit(medication: MedicationViewModel) {
    setEditingMedication(medication)
    setMedicationFormMode('edit')
    setMedicationFormOpen(true)
  }

  async function handleDelete(medicationId: string) {
    const med = medications.find((m) => m.ppa_medicationid === medicationId)
    await deleteMed.mutateAsync(medicationId)
    toast.success(`${med?.ppa_name ?? 'Medication'} deleted`)
  }

  async function handleToggleActive(medicationId: string, isActive: boolean) {
    await updateMed.mutateAsync({ id: medicationId, fields: { ppa_isactive: isActive } })
  }

  function handleSaved(medication: MedicationViewModel) {
    toast.success(`${medication.ppa_name} saved`)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Medications</h1>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Medication
        </Button>
      </div>

      <MedicationList
        medications={medications}
        isLoading={isLoading}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />

      <MedicationForm
        mode={medicationFormMode}
        initialValues={editingMedication ?? undefined}
        open={isMedicationFormOpen}
        onOpenChange={setMedicationFormOpen}
        onSaved={handleSaved}
      />
    </div>
  )
}
