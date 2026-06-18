import { useState } from 'react'
import { Pencil, Trash2, Pill, Syringe, Wind, Droplets, Leaf, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import {
  Ppa_medicationsppa_frequency,
  Ppa_medicationsppa_method,
  Ppa_medicationsppa_scheduledday,
} from '@/generated/models/Ppa_medicationsModel'

export type MedicationViewModel = Ppa_medications

// The Power Apps Code App SDK returns Dataverse choice fields as "[Day: wednesday]" at runtime.
// This helper extracts a proper display label from any format the SDK may return.
function parseDayLabel(raw: unknown, nameAnnotation?: string): string | null {
  const sdkPattern = /^\[Day:\s*(\w+)\]$/i
  if (nameAnnotation) {
    const m = nameAnnotation.match(sdkPattern)
    if (m) return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
    return nameAnnotation
  }
  if (raw == null) return null
  const str = String(raw)
  const m = str.match(sdkPattern)
  if (m) return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
  const num = Number(raw)
  return (!isNaN(num) && Ppa_medicationsppa_scheduledday[num as keyof typeof Ppa_medicationsppa_scheduledday]) || null
}

// Reminder time is stored as a 24-hour "HH:mm" string; display it in 12-hour AM/PM format.
function formatReminderTime(raw: string): string {
  const m = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return raw
  let hours = Number(m[1])
  const minutes = m[2]
  if (isNaN(hours)) return raw
  const period = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${period}`
}

interface MedicationCardProps {
  medication: MedicationViewModel
  onEdit: (medication: MedicationViewModel) => void
  onDelete: (medicationId: string) => void
  onToggleActive: (medicationId: string, isActive: boolean) => void
}

const METHOD_ICONS: Record<number, React.ReactNode> = {
  894250000: <Pill className="h-4 w-4" />,
  894250001: <Syringe className="h-4 w-4" />,
  894250002: <Leaf className="h-4 w-4" />,
  894250003: <Wind className="h-4 w-4" />,
  894250004: <Droplets className="h-4 w-4" />,
}

export default function MedicationCard({
  medication,
  onEdit,
  onDelete,
  onToggleActive,
}: MedicationCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const freqLabel = Ppa_medicationsppa_frequency[medication.ppa_frequency] ?? String(medication.ppa_frequency)
  const methodLabel = Ppa_medicationsppa_method[medication.ppa_method] ?? String(medication.ppa_method)
  const dayLabel = parseDayLabel(medication.ppa_scheduledday, medication.ppa_scheduleddayname)

  const instructions = medication.ppa_instructions ?? ''
  const instructionsPreview = instructions.length > 60
    ? instructions.slice(0, 60) + '…'
    : instructions

  return (
    <>
      <div className="border rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{medication.ppa_name}</span>
            <Badge variant="secondary">{medication.ppa_dosage}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit"
              onClick={() => onEdit(medication)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{freqLabel.replace('_', ' ')}</Badge>
          {dayLabel && (
            <Badge variant="outline" className="flex items-center gap-1 border-cyan-500/40 bg-cyan-500/10 text-cyan-400">
              <CalendarDays className="h-3 w-3" />
              {dayLabel}
            </Badge>
          )}
          <Badge variant="outline" className="flex items-center gap-1">
            {METHOD_ICONS[Number(medication.ppa_method)]}
            {methodLabel}
          </Badge>
          {medication.ppa_remindertime && (
            <span className="text-xs">{formatReminderTime(medication.ppa_remindertime)}</span>
          )}
        </div>

        {instructionsPreview && (
          <p className="text-sm text-muted-foreground">{instructionsPreview}</p>
        )}

        <div className="flex items-center gap-2">
          <Switch
            id={`active-${medication.ppa_medicationid}`}
            checked={medication.ppa_isactive}
            onCheckedChange={(checked) =>
              onToggleActive(medication.ppa_medicationid, checked)
            }
            aria-label="Active"
          />
          <Label htmlFor={`active-${medication.ppa_medicationid}`} className="text-sm">
            Active
          </Label>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete medication?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{medication.ppa_name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDeleteDialog(false)
                onDelete(medication.ppa_medicationid)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
