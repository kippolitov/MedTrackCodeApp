import { useState, useEffect, useRef } from 'react'
import { Pill, Syringe, Wind, Droplets, Leaf, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type {
  Ppa_medicationsppa_frequency,
  Ppa_medicationsppa_method,
  Ppa_medicationsppa_scheduledday,
} from '@/generated/models/Ppa_medicationsModel'
import { Ppa_medicationsppa_scheduledday as ScheduledDayEnum } from '@/generated/models/Ppa_medicationsModel'
import { toast } from 'sonner'
import { useCreateMedication, useUpdateMedication, useMedications } from '@/hooks/use-medications'

import type { MedicationViewModel } from '@/lib/adherence'

type MedicationFormMode = 'add' | 'edit'

interface MedicationFormProps {
  mode: MedicationFormMode
  initialValues?: MedicationViewModel
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (medication: MedicationViewModel) => void
}

type FreqKey = Ppa_medicationsppa_frequency
type MethodKey = Ppa_medicationsppa_method
type DayKey = Ppa_medicationsppa_scheduledday

const FREQ_OPTIONS: Array<{ value: FreqKey; label: string }> = [
  { value: 894250000, label: 'Daily' },
  { value: 894250001, label: 'Weekly' },
  { value: 894250002, label: 'Biweekly' },
  { value: 894250003, label: 'As-Needed' },
]

const METHOD_OPTIONS: Array<{ value: MethodKey; label: string; Icon: React.FC<{ className?: string }> }> = [
  { value: 894250000, label: 'Pill', Icon: Pill },
  { value: 894250001, label: 'Injection', Icon: Syringe },
  { value: 894250002, label: 'Topical', Icon: Leaf },
  { value: 894250003, label: 'Inhaler', Icon: Wind },
  { value: 894250004, label: 'Liquid', Icon: Droplets },
]

const DAY_OPTIONS: Array<{ value: DayKey; label: string }> = [
  { value: 894250000, label: 'Monday' },
  { value: 894250001, label: 'Tuesday' },
  { value: 894250002, label: 'Wednesday' },
  { value: 894250003, label: 'Thursday' },
  { value: 894250004, label: 'Friday' },
  { value: 894250005, label: 'Saturday' },
  { value: 894250006, label: 'Sunday' },
]


function emptyForm() {
  return {
    name: '',
    dosage: '',
    frequency: null as FreqKey | null,
    scheduledDay: null as DayKey | null,
    method: null as MethodKey | null,
    reminderTime: '',
    startDate: '',
    instructions: '',
    isActive: true,
  }
}

export default function MedicationForm({
  mode,
  initialValues,
  open,
  onOpenChange,
  onSaved,
}: MedicationFormProps) {
  const [form, setForm] = useState(emptyForm)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const isDirtyRef = useRef(false)
  const createMed = useCreateMedication()
  const updateMed = useUpdateMedication()
  const { data: allMedications = [] } = useMedications()

  useEffect(() => {
    if (open) {
      isDirtyRef.current = false
      if (mode === 'edit' && initialValues) {
        setForm({
          name: initialValues.ppa_name,
          dosage: initialValues.ppa_dosage,
          frequency: initialValues.ppa_frequency,
          scheduledDay: (() => {
            const raw = initialValues.ppa_scheduledday
            const num = Number(raw)
            if (raw != null && !isNaN(num) && num in ScheduledDayEnum) return num as DayKey
            const sdkPattern = /^\[Day:\s*(\w+)\]$/i
            const str = String(raw ?? '')
            const m = str.match(sdkPattern)
            if (m) {
              const label = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
              return DAY_OPTIONS.find(o => o.label === label)?.value ?? null
            }
            const name = initialValues.ppa_scheduleddayname
            if (name) {
              const m2 = name.match(sdkPattern)
              const clean = m2 ? m2[1][0].toUpperCase() + m2[1].slice(1).toLowerCase() : name
              return DAY_OPTIONS.find(o => o.label.toLowerCase() === clean.toLowerCase())?.value ?? null
            }
            return null
          })(),
          method: initialValues.ppa_method,
          reminderTime: initialValues.ppa_remindertime ?? '',
          startDate: initialValues.ppa_startdate ?? '',
          instructions: initialValues.ppa_instructions ?? '',
          isActive: initialValues.ppa_isactive,
        })
      } else {
        setForm(emptyForm())
      }
    }
    // Re-initialize only when the dialog opens or the edited record changes —
    // NOT on every new `initialValues` reference. React Query refetches produce
    // fresh objects for the same record (e.g. on window focus when the time
    // picker opens), and depending on the whole object would reset the form and
    // discard the user's in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initialValues?.ppa_medicationid])

  const showScheduledDay =
    form.frequency === 894250001 || form.frequency === 894250002

  const canSave =
    form.name.trim() !== '' &&
    form.dosage.trim() !== '' &&
    form.frequency !== null &&
    form.method !== null &&
    (!showScheduledDay || form.scheduledDay !== null)

  function handleFrequencyChange(val: string) {
    isDirtyRef.current = true
    const freq = Number(val) as FreqKey
    const clearDay = freq !== 894250001 && freq !== 894250002
    setForm((f) => ({
      ...f,
      frequency: freq,
      scheduledDay: clearDay ? null : f.scheduledDay,
    }))
  }

  function requestClose() {
    // In edit mode, confirm before discarding unsaved changes
    if (mode === 'edit' && isDirtyRef.current) {
      setShowDiscardConfirm(true)
    } else {
      onOpenChange(false)
    }
  }

  async function handleSave() {
    if (!canSave || form.frequency === null || form.method === null) return

    const normalizedName = form.name.trim().toLowerCase()
    const duplicate = allMedications.find(
      (m) =>
        m.ppa_name?.toLowerCase() === normalizedName &&
        m.ppa_medicationid !== initialValues?.ppa_medicationid
    )
    if (duplicate) {
      toast.warning(`A medication named "${duplicate.ppa_name}" already exists.`)
    }

    const payload = {
      ppa_name: form.name.trim(),
      ppa_dosage: form.dosage.trim(),
      ppa_frequency: form.frequency,
      ppa_scheduledday: form.scheduledDay ?? undefined,
      ppa_method: form.method,
      ppa_remindertime: form.reminderTime || undefined,
      ppa_startdate: form.startDate || undefined,
      ppa_instructions: form.instructions || undefined,
      ppa_isactive: form.isActive,
    }

    try {
      if (mode === 'add') {
        const result = await createMed.mutateAsync(payload as Parameters<typeof createMed.mutateAsync>[0])
        if (!result.success || !result.data) {
          toast.error('Failed to save medication. Please try again.')
          return
        }
        onSaved(result.data)
      } else if (mode === 'edit' && initialValues) {
        const result = await updateMed.mutateAsync({
          id: initialValues.ppa_medicationid,
          fields: payload,
        })
        if (!result.success || !result.data) {
          toast.error('Failed to save medication. Please try again.')
          return
        }
        onSaved(result.data)
      }
      onOpenChange(false)
    } catch (err) {
      console.error('Save medication error:', err)
      toast.error('Failed to save medication. Please try again.')
    }
  }

  const isSaving = createMed.isPending || updateMed.isPending

  function updateForm(updater: (f: ReturnType<typeof emptyForm>) => ReturnType<typeof emptyForm>) {
    isDirtyRef.current = true
    setForm(updater)
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          requestClose()
        } else {
          onOpenChange(true)
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'add' ? 'Add Medication' : 'Edit Medication'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-name">Name</Label>
            <Input
              id="med-name"
              value={form.name}
              onChange={(e) => updateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Aspirin"
              aria-label="Name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-dosage">Dosage</Label>
            <Input
              id="med-dosage"
              value={form.dosage}
              onChange={(e) => updateForm((f) => ({ ...f, dosage: e.target.value }))}
              placeholder="e.g. 100mg or 40mg/0.8mL"
              aria-label="Dosage"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-frequency">Frequency</Label>
            <Select
              value={form.frequency !== null ? String(form.frequency) : ''}
              onValueChange={handleFrequencyChange}
            >
              <SelectTrigger id="med-frequency" aria-label="Frequency" className="w-full">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {FREQ_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showScheduledDay && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="med-scheduledday">Scheduled Day</Label>
              <Select
                value={form.scheduledDay !== null ? String(form.scheduledDay) : ''}
                onValueChange={(val) =>
                  updateForm((f) => ({ ...f, scheduledDay: Number(val) as DayKey }))
                }
              >
                <SelectTrigger id="med-scheduledday" aria-label="Scheduled Day" className="w-full">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-method">Method</Label>
            <Select
              value={form.method !== null ? String(form.method) : ''}
              onValueChange={(val) =>
                updateForm((f) => ({ ...f, method: Number(val) as MethodKey }))
              }
            >
              <SelectTrigger id="med-method" aria-label="Method" className="w-full">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map(({ value, label, Icon }) => (
                  <SelectItem key={value} value={String(value)}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.frequency === 894250002 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="med-startdate">Start Date (optional)</Label>
              <Input
                id="med-startdate"
                type="date"
                value={form.startDate}
                onChange={(e) => updateForm((f) => ({ ...f, startDate: e.target.value }))}
                aria-label="Start date"
              />
              <p className="text-xs text-muted-foreground">
                Sets the week-0 anchor for biweekly scheduling. Leave blank to use the record creation date.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-reminder-time">Reminder Time (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="med-reminder-time"
                type="time"
                value={form.reminderTime}
                onChange={(e) => updateForm((f) => ({ ...f, reminderTime: e.target.value }))}
                aria-label="Reminder time"
                className="flex-1"
              />
              {form.reminderTime && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => updateForm((f) => ({ ...f, reminderTime: '' }))}
                  aria-label="Clear reminder time"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-instructions">Instructions (optional)</Label>
            <Textarea
              id="med-instructions"
              value={form.instructions}
              onChange={(e) => updateForm((f) => ({ ...f, instructions: e.target.value }))}
              placeholder="Special handling notes"
              aria-label="Instructions"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="med-isactive"
              checked={form.isActive}
              onCheckedChange={(checked) => updateForm((f) => ({ ...f, isActive: checked }))}
              aria-label="Active"
            />
            <Label htmlFor="med-isactive">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={requestClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'add' ? 'Save' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Discard confirmation — shown in edit mode when Cancel is clicked with unsaved changes (C-14) */}
    <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Discard changes?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Your unsaved changes will be lost.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={() => { setShowDiscardConfirm(false); onOpenChange(false) }}>
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
