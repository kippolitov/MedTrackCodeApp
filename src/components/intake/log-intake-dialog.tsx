import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import BodyMap from './body-map'
import { useMedications } from '@/hooks/use-medications'
import { useIntakeLogs, useCreateIntakeLog } from '@/hooks/use-intake-logs'
import { getRecentSites } from '@/lib/injection-sites'
import { startOfLocalDay, endOfLocalDay } from '@/lib/date-utils'
import type { Ppa_intakelogsppa_injectionsite } from '@/generated/models/Ppa_intakelogsModel'
import type { Ppa_intakelogsppa_status } from '@/generated/models/Ppa_intakelogsModel'
import type { LogIntakePrePopulation } from '@/stores/log-intake-store'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

// We re-export the IntakeLogViewModel used externally
export interface IntakeLogViewModel extends Ppa_intakelogs {
  loggedAtDate: Date
  scheduledForDate: Date
}

interface LogIntakeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prePopulation: LogIntakePrePopulation
  onSaved: (log: Ppa_intakelogs) => void
}

function formatDateInput(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function LogIntakeDialog({
  open,
  onOpenChange,
  prePopulation,
  onSaved,
}: LogIntakeDialogProps) {
  const now = new Date()

  const [selectedMedId, setSelectedMedId] = useState<string>('')
  const [date, setDate] = useState(formatDateInput(prePopulation.calendarDate ?? now))
  const [time, setTime] = useState(formatTimeInput(now))
  const [status, setStatus] = useState<Ppa_intakelogsppa_status>(894250000) // Taken
  const [selectedSite, setSelectedSite] = useState<Ppa_intakelogsppa_injectionsite | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [showBodyMap, setShowBodyMap] = useState(true)

  const { data: medications = [] } = useMedications()
  const createLog = useCreateIntakeLog()

  const today = new Date()
  const { data: recentLogs = [] } = useIntakeLogs({
    from: startOfLocalDay(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
    to: endOfLocalDay(today),
  })

  const recentSites = getRecentSites(recentLogs, now)

  const isPreSet = !!prePopulation.medicationId

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      const initNow = new Date()
      setSelectedMedId(prePopulation.medicationId ?? '')
      setDate(formatDateInput(prePopulation.calendarDate ?? prePopulation.dateTime ?? initNow))
      setTime(formatTimeInput(prePopulation.dateTime ?? initNow))
      setStatus(894250000)
      setSelectedSite(undefined)
      setNotes('')
      setShowBodyMap(true)
    }
  }, [open, prePopulation])

  const activeMeds = medications.filter((m) => m.ppa_isactive)
  const selectedMed = activeMeds.find((m) => m.ppa_medicationid === selectedMedId)
  const isInjection = selectedMed?.ppa_method === 894250001

  // Clear site when med changes to non-injection
  function handleMedChange(id: string) {
    setSelectedMedId(id)
    setSelectedSite(undefined)
  }

  const canSave =
    selectedMedId !== '' &&
    (!isInjection || selectedSite !== undefined)

  async function handleSave() {
    if (!canSave || !selectedMed) return

    const loggedAtDate = new Date(`${date}T${time}`)
    const scheduledFor = new Date(`${date}T${selectedMed.ppa_remindertime ?? time}`)

    const payload = {
      ppa_logname: selectedMed.ppa_name,
      ppa_loggedat: loggedAtDate.toISOString(),
      ppa_scheduledfor: scheduledFor.toISOString(),
      ppa_status: status,
      ppa_notes: notes || undefined,
      ppa_injectionsite: isInjection ? selectedSite : undefined,
      'ppa_Medication@odata.bind': `/ppa_medications(${selectedMed.ppa_medicationid})`,
    }

    try {
      console.log('[LogIntake] payload:', payload)
      const result = await createLog.mutateAsync(payload as Parameters<typeof createLog.mutateAsync>[0])
      console.log('[LogIntake] result:', result)
      if (!result.success) {
        toast.error('Failed to save intake log. Please try again.')
        console.error('createLog failed:', result.error)
        return
      }
      toast.success('Intake logged')
      onSaved(result.data)
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to save intake log. Please try again.')
      console.error('createLog error:', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Intake</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-medication">Medication</Label>
            <Select
              value={selectedMedId}
              onValueChange={handleMedChange}
              disabled={isPreSet}
            >
              <SelectTrigger
                id="log-medication"
                aria-label="Medication"
                className="w-full"
                disabled={isPreSet}
              >
                <SelectValue placeholder="Select medication" />
              </SelectTrigger>
              <SelectContent>
                {activeMeds.map((med) => (
                  <SelectItem key={med.ppa_medicationid} value={med.ppa_medicationid}>
                    {med.ppa_name} — {med.ppa_dosage}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <Label htmlFor="log-date">Date</Label>
              <Input
                id="log-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Date"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <Label htmlFor="log-time">Time</Label>
              <Input
                id="log-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-label="Time"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <div className="flex gap-2">
              {([
                { value: 894250000 as const, label: 'Taken', color: 'bg-green-100 text-green-800 border-green-300' },
                { value: 894250001 as const, label: 'Skipped', color: 'bg-gray-100 text-gray-700 border-gray-300' },
                { value: 894250002 as const, label: 'Missed', color: 'bg-red-100 text-red-800 border-red-300' },
              ] as const).map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  aria-pressed={status === value}
                  className={`flex-1 min-h-[44px] rounded-md border text-sm font-medium transition-colors ${
                    status === value ? color + ' border-2' : 'bg-background border-input hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {isInjection && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Injection Site</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBodyMap((v) => !v)}
                >
                  {showBodyMap ? 'Hide Body Map' : 'Show Body Map'}
                </Button>
              </div>
              {showBodyMap && (
                <BodyMap
                  recentSites={recentSites}
                  selectedSite={selectedSite}
                  onSiteSelect={setSelectedSite}
                />
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="log-notes">Notes (optional)</Label>
            <Textarea
              id="log-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this dose"
              aria-label="Notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createLog.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || createLog.isPending}>
            Log Intake
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
