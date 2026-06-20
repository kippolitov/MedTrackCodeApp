import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
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
import { useIntakeLogs, useCreateIntakeLog, useUpdateIntakeLog } from '@/hooks/use-intake-logs'
import { getRecentSites, getSiteLabel } from '@/lib/injection-sites'
import { startOfLocalDay, endOfLocalDay } from '@/lib/date-utils'
import type { Ppa_intakelogsppa_injectionsite } from '@/generated/models/Ppa_intakelogsModel'
import type { Ppa_intakelogsppa_status } from '@/generated/models/Ppa_intakelogsModel'
import type { LogIntakePrePopulation } from '@/stores/log-intake-store'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

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
  const [selectedMedId, setSelectedMedId] = useState<string>('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [status, setStatus] = useState<Ppa_intakelogsppa_status>(894250000)
  const [selectedSite, setSelectedSite] = useState<Ppa_intakelogsppa_injectionsite | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [showBodyMap, setShowBodyMap] = useState(false)
  const [attemptedSave, setAttemptedSave] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Tracks whether any field has been touched since dialog opened
  const isDirtyRef = useRef(false)
  // Prevents duplicate submissions from rapid taps before isPending propagates
  const isSavingRef = useRef(false)

  const { data: medications = [] } = useMedications()
  const createLog = useCreateIntakeLog()
  const updateLog = useUpdateIntakeLog()

  const { data: recentLogs = [] } = useIntakeLogs({
    from: startOfLocalDay(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    to: endOfLocalDay(new Date()),
  })

  const isEdit = !!prePopulation.editingLogId
  const isPreSet = !isEdit && !!prePopulation.medicationId

  useEffect(() => {
    if (open) {
      const initNow = new Date()
      const baseDateTime = prePopulation.loggedAt ?? prePopulation.dateTime ?? initNow
      const initMedId = prePopulation.medicationId ?? ''

      setSelectedMedId(initMedId)
      setDate(formatDateInput(prePopulation.calendarDate ?? baseDateTime))
      setTime(formatTimeInput(baseDateTime))
      setStatus(prePopulation.initialStatus ?? 894250000)
      setSelectedSite(prePopulation.initialInjectionSite ?? undefined)
      setNotes(prePopulation.initialNotes ?? '')
      setAttemptedSave(false)
      isDirtyRef.current = false
      isSavingRef.current = false

      // Auto-expand body map only when an injection-method medication is pre-populated (C-11)
      const preMed = medications.find((m) => m.ppa_medicationid === initMedId)
      setShowBodyMap(preMed?.ppa_method === 894250001)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prePopulation])

  // In edit mode, include the currently-logged medication even if it's now inactive
  // so historical logs remain editable (C-10)
  const activeMeds = medications.filter((m) => m.ppa_isactive)
  const editingMed = isEdit
    ? medications.find((m) => m.ppa_medicationid === prePopulation.medicationId)
    : undefined
  const medsForDropdown =
    isEdit && editingMed && !editingMed.ppa_isactive
      ? [...activeMeds, editingMed]
      : activeMeds

  const selectedMed = medsForDropdown.find((m) => m.ppa_medicationid === selectedMedId)
  const isInjection = selectedMed?.ppa_method === 894250001

  // Compute recent sites fresh each time (not frozen at component mount)
  const recentSites = getRecentSites(recentLogs, new Date())

  function markDirty() {
    isDirtyRef.current = true
  }

  function handleMedChange(id: string) {
    setSelectedMedId(id)
    setSelectedSite(undefined)
    // Auto-expand body map when user selects an injection medication mid-dialog
    const med = medsForDropdown.find((m) => m.ppa_medicationid === id)
    setShowBodyMap(med?.ppa_method === 894250001)
    markDirty()
  }

  const canSave =
    selectedMedId !== '' &&
    (!isInjection || selectedSite !== undefined)

  function requestClose() {
    if (isDirtyRef.current) {
      setShowDiscardConfirm(true)
    } else {
      onOpenChange(false)
    }
  }

  function confirmDiscard() {
    setShowDiscardConfirm(false)
    onOpenChange(false)
  }

  async function handleSave() {
    setAttemptedSave(true)
    if (!canSave || !selectedMed) return
    if (isSavingRef.current) return
    isSavingRef.current = true

    const loggedAtDate = new Date(`${date}T${time}`)
    if (loggedAtDate > new Date()) {
      toast.error('Logged time cannot be in the future.')
      isSavingRef.current = false
      return
    }
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
      if (isEdit && prePopulation.editingLogId) {
        const result = await updateLog.mutateAsync({
          id: prePopulation.editingLogId,
          fields: payload as Parameters<typeof updateLog.mutateAsync>[0]['fields'],
        })
        if (!result.success) {
          toast.error('Failed to update intake log. Please try again.')
          return
        }
        toast.success('Intake log updated')
        onSaved(result.data)
      } else {
        const result = await createLog.mutateAsync(payload as Parameters<typeof createLog.mutateAsync>[0])
        if (!result.success) {
          toast.error('Failed to save intake log. Please try again.')
          return
        }
        toast.success('Intake logged')
        onSaved(result.data)
      }
      isDirtyRef.current = false
      onOpenChange(false)
    } catch (err) {
      toast.error('Failed to save intake log. Please try again.')
      console.error('LogIntake error:', err)
    } finally {
      isSavingRef.current = false
    }
  }

  const isMutating = createLog.isPending || updateLog.isPending

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          // Intercept all close attempts (backdrop click, Escape) when form is dirty (C-13)
          if (!nextOpen) {
            requestClose()
          } else {
            onOpenChange(true)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Intake' : 'Log Intake'}</DialogTitle>
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
                  {medsForDropdown.map((med) => (
                    <SelectItem key={med.ppa_medicationid} value={med.ppa_medicationid}>
                      {med.ppa_name} — {med.ppa_dosage}
                      {!med.ppa_isactive && ' (inactive)'}
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
                  onChange={(e) => { setDate(e.target.value); markDirty() }}
                  aria-label="Date"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <Label htmlFor="log-time">Time</Label>
                <Input
                  id="log-time"
                  type="time"
                  value={time}
                  onChange={(e) => { setTime(e.target.value); markDirty() }}
                  aria-label="Time"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <div className="flex gap-2">
                {([
                  { value: 894250000 as const, label: 'Taken',   Icon: CheckCircle2, color: 'bg-green-100 text-green-800 border-green-300' },
                  { value: 894250001 as const, label: 'Skipped', Icon: MinusCircle,  color: 'bg-gray-100 text-gray-700 border-gray-300' },
                  { value: 894250002 as const, label: 'Missed',  Icon: XCircle,      color: 'bg-red-100 text-red-800 border-red-300' },
                ] as const).map(({ value, label, Icon, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setStatus(value); markDirty() }}
                    aria-pressed={status === value}
                    className={`flex-1 min-h-[44px] rounded-md border text-sm font-medium transition-colors ${
                      status === value ? color + ' border-2' : 'bg-background border-input hover:bg-muted'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </span>
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
                    onSiteSelect={(site) => { setSelectedSite(site); markDirty() }}
                  />
                )}
                {/* Show selected site label when body map is collapsed */}
                {!showBodyMap && selectedSite !== undefined && (
                  <p className="text-sm text-muted-foreground">
                    Selected:{' '}
                    <span className="font-medium text-foreground">
                      {getSiteLabel(selectedSite)}
                      {recentSites.includes(selectedSite) && ' (recent)'}
                    </span>
                  </p>
                )}
                {/* Inline hint when user tried to save without selecting a site (C-12) */}
                {attemptedSave && !selectedSite && (
                  <p className="text-sm text-destructive" role="alert">
                    Select an injection site to continue.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="log-notes">Notes (optional)</Label>
              <Textarea
                id="log-notes"
                value={notes}
                onChange={(e) => { setNotes(e.target.value); markDirty() }}
                placeholder="Any notes about this dose"
                aria-label="Notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={requestClose} disabled={isMutating}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isMutating}>
              {isMutating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Update' : 'Log Intake'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation — shown when closing a modified form (C-13) */}
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
            <Button variant="destructive" onClick={confirmDiscard}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
