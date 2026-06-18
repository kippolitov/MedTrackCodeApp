import { useState, useEffect } from 'react'
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
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import type {
  Ppa_medicationsppa_frequency,
  Ppa_medicationsppa_method,
  Ppa_medicationsppa_scheduledday,
} from '@/generated/models/Ppa_medicationsModel'
import { Ppa_medicationsppa_scheduledday as ScheduledDayEnum } from '@/generated/models/Ppa_medicationsModel'
import { useCreateMedication, useUpdateMedication } from '@/hooks/use-medications'

export type MedicationViewModel = Ppa_medications

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

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1)) // "1".."12"
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')) // "00","05".."55"
type Period = 'AM' | 'PM'

// Reminder time is stored as a 24-hour "HH:mm" string. These helpers convert
// to/from the 12-hour hour/minute/period parts shown in the dropdowns.
function parseTimeParts(value: string): { hour12: string; minute: string; period: Period } {
  const m = value.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return { hour12: '', minute: '', period: 'AM' }
  const h = Number(m[1])
  if (isNaN(h)) return { hour12: '', minute: '', period: 'AM' }
  const period: Period = h >= 12 ? 'PM' : 'AM'
  return { hour12: String(h % 12 || 12), minute: m[2], period }
}

function buildTime(hour12: string, minute: string, period: Period): string {
  if (!hour12 || !minute) return ''
  let h = Number(hour12) % 12
  if (period === 'PM') h += 12
  return `${String(h).padStart(2, '0')}:${minute}`
}

function emptyForm() {
  return {
    name: '',
    dosage: '',
    frequency: null as FreqKey | null,
    scheduledDay: null as DayKey | null,
    method: null as MethodKey | null,
    reminderTime: '',
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
  const createMed = useCreateMedication()
  const updateMed = useUpdateMedication()

  useEffect(() => {
    if (open) {
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
    form.method !== null

  function handleFrequencyChange(val: string) {
    const freq = Number(val) as FreqKey
    const clearDay = freq !== 894250001 && freq !== 894250002
    setForm((f) => ({
      ...f,
      frequency: freq,
      scheduledDay: clearDay ? null : f.scheduledDay,
    }))
  }

  const timeParts = parseTimeParts(form.reminderTime)
  // If existing data has a minute that isn't a 5-minute step, surface it as an option.
  const minuteOptions =
    timeParts.minute && !MINUTE_OPTIONS.includes(timeParts.minute)
      ? [...MINUTE_OPTIONS, timeParts.minute].sort()
      : MINUTE_OPTIONS

  function setTimePart(part: Partial<{ hour12: string; minute: string; period: Period }>) {
    const next = { ...timeParts, ...part }
    // Default the complementary part so a single selection commits a full time.
    if (next.hour12 && !next.minute) next.minute = '00'
    if (next.minute && !next.hour12) next.hour12 = '12'
    setForm((f) => ({ ...f, reminderTime: buildTime(next.hour12, next.minute, next.period) }))
  }

  function clearReminderTime() {
    setForm((f) => ({ ...f, reminderTime: '' }))
  }

  async function handleSave() {
    if (!canSave || form.frequency === null || form.method === null) return

    const payload = {
      ppa_name: form.name.trim(),
      ppa_dosage: form.dosage.trim(),
      ppa_frequency: form.frequency,
      ppa_scheduledday: form.scheduledDay ?? undefined,
      ppa_method: form.method,
      ppa_remindertime: form.reminderTime || undefined,
      ppa_instructions: form.instructions || undefined,
      ppa_isactive: form.isActive,
    }

    if (mode === 'add') {
      const result = await createMed.mutateAsync(payload as Parameters<typeof createMed.mutateAsync>[0])
      onSaved(result.data)
    } else if (mode === 'edit' && initialValues) {
      const result = await updateMed.mutateAsync({
        id: initialValues.ppa_medicationid,
        fields: payload,
      })
      onSaved(result.data)
    }
    onOpenChange(false)
  }

  const isSaving = createMed.isPending || updateMed.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Aspirin"
              aria-label="Name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-dosage">Dosage</Label>
            <Input
              id="med-dosage"
              value={form.dosage}
              onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
              placeholder="e.g. 100mg"
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
                  setForm((f) => ({ ...f, scheduledDay: Number(val) as DayKey }))
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
                setForm((f) => ({ ...f, method: Number(val) as MethodKey }))
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

          <div className="flex flex-col gap-1.5">
            <Label>Reminder Time (optional)</Label>
            <div className="flex items-center gap-2">
              <Select
                value={timeParts.hour12}
                onValueChange={(val) => setTimePart({ hour12: val })}
              >
                <SelectTrigger aria-label="Reminder hour" className="flex-1">
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">:</span>
              <Select
                value={timeParts.minute}
                onValueChange={(val) => setTimePart({ minute: val })}
              >
                <SelectTrigger aria-label="Reminder minute" className="flex-1">
                  <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent>
                  {minuteOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={timeParts.period}
                onValueChange={(val) => setTimePart({ period: val as Period })}
              >
                <SelectTrigger aria-label="Reminder AM/PM" className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
              {form.reminderTime && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearReminderTime}
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
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              placeholder="Special handling notes"
              aria-label="Instructions"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="med-isactive"
              checked={form.isActive}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
              aria-label="Active"
            />
            <Label htmlFor="med-isactive">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'add' ? 'Save' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
