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
import type { Ppa_medications } from '@/generated/models/Ppa_medicationsModel'

export default function HomePage() {
  const { stats, isLoading } = useAdherence()
  const overdueMedications = useOverdue()
  const { firstName } = useUser()

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const { isLogIntakeOpen, setLogIntakeOpen } = useUiStore()
  const { prePopulation, setPrePopulation, clearPrePopulation } = useLogIntakeStore()

  function handleLog(medication: Ppa_medications) {
    setPrePopulation({ medicationId: medication.ppa_medicationid, dateTime: new Date() })
    setLogIntakeOpen(true)
  }

  function handleStandaloneLog() {
    setPrePopulation({ dateTime: new Date() })
    setLogIntakeOpen(true)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(now, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {overdueMedications.length > 0 && (
        <OverdueBanner overdueMedications={overdueMedications} onLog={handleLog} />
      )}

      <StatsBar stats={stats} isLoading={isLoading} />

      <section>
        <h2 className="font-semibold mb-3">Today's Schedule</h2>
        <ScheduleList onLog={handleLog} />
      </section>

      <Button variant="outline" className="w-full" onClick={handleStandaloneLog}>
        Log Intake
      </Button>

      <LogIntakeDialog
        open={isLogIntakeOpen}
        onOpenChange={setLogIntakeOpen}
        prePopulation={prePopulation}
        onSaved={() => clearPrePopulation()}
      />
    </div>
  )
}
