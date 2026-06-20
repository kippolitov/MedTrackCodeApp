import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import StatsBar from '@/components/dashboard/stats-bar'
import ScheduleList from '@/components/dashboard/schedule-list'
import OverdueBanner from '@/components/dashboard/overdue-banner'
import LogIntakeDialog from '@/components/intake/log-intake-dialog'
import { useAdherence } from '@/hooks/use-adherence'
import { useOverdue } from '@/hooks/use-overdue'
import { useUser } from '@/hooks/use-user'
import { useUiStore } from '@/stores/ui-store'
import { useLogIntakeStore } from '@/stores/log-intake-store'
import { useMedications } from '@/hooks/use-medications'
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'
import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'

export default function HomePage() {
  const { stats, isLoading, isError } = useAdherence()
  const overdueMedications = useOverdue()
  const { firstName } = useUser()
  const { data: medications = [] } = useMedications()

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const { isLogIntakeOpen, setLogIntakeOpen } = useUiStore()
  const { prePopulation, setPrePopulation, clearPrePopulation } = useLogIntakeStore()

  const hasActiveMeds = medications.some((m) => m.ppa_isactive)

  function handleLog(medication: Ppa_medications) {
    setPrePopulation({ medicationId: medication.ppa_medicationid, dateTime: new Date() })
    setLogIntakeOpen(true)
  }

  function handleEditLog(log: Ppa_intakelogs) {
    setPrePopulation({
      editingLogId: log.ppa_intakelogid,
      medicationId: log._ppa_medication_value,
      loggedAt: new Date(log.ppa_loggedat),
      initialStatus: log.ppa_status,
      initialInjectionSite: log.ppa_injectionsite,
      initialNotes: log.ppa_notes,
    })
    setLogIntakeOpen(true)
  }

  function handleStandaloneLog() {
    setPrePopulation({ dateTime: new Date() })
    setLogIntakeOpen(true)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto flex flex-col gap-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(now, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {isError && (
        <div
          role="alert"
          className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3"
        >
          <span>Could not load your data. Check your connection.</span>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {overdueMedications.length > 0 && (
        <OverdueBanner overdueMedications={overdueMedications} onLog={handleLog} />
      )}

      <StatsBar stats={stats} isLoading={isLoading} />

      <section>
        <h2 className="font-semibold mb-3">Today's Schedule</h2>
        {!isLoading && !hasActiveMeds ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No active medications yet. Add your first medication to get started.
            </p>
            <Button onClick={() => window.location.assign('/medications')}>
              Add Medication
            </Button>
          </div>
        ) : (
          <ScheduleList onLog={handleLog} onEdit={handleEditLog} />
        )}
      </section>

      {/* Floating action button — fixed above mobile nav bar */}
      <button
        onClick={handleStandaloneLog}
        className="fixed bottom-20 right-4 md:bottom-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
        aria-label="Log Intake"
      >
        <Plus className="h-6 w-6" />
      </button>

      <LogIntakeDialog
        open={isLogIntakeOpen}
        onOpenChange={setLogIntakeOpen}
        prePopulation={prePopulation}
        onSaved={() => clearPrePopulation()}
      />
    </div>
  )
}
