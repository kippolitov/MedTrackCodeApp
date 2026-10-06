import { useEffect } from 'react'
import { AlertTriangle, BellOff, CalendarCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMedicationSchedule } from '@/hooks/use-medication-schedule'
import { formatDateLabel, formatTime } from '@/lib/date-utils'
import { getSiteLabel } from '@/lib/injection-sites'
import type { MedicationViewModel } from '@/lib/adherence'
import type { ScheduleDetails } from '@/lib/schedule'

// One id for every card, so any number of failing cards shows a single toast;
// the in-card message says which Medication is affected.
const LOAD_ERROR_TOAST_ID = 'schedule-load-error'

// The year is shown only when it is not the current one.
function formatScheduleDate(date: Date): string {
  return formatDateLabel(date, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  })
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="text-xs text-muted-foreground sm:w-24 sm:shrink-0">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">{children}</dd>
    </div>
  )
}

function LastTaken({ lastTaken }: { lastTaken: ScheduleDetails['lastTaken'] }) {
  if (!lastTaken) return <span className="text-muted-foreground">Not yet taken</span>
  const when = `${formatScheduleDate(lastTaken.at)}, ${formatTime(lastTaken.at)}`
  return <span>{lastTaken.site != null ? `${when} · ${getSiteLabel(lastTaken.site)}` : when}</span>
}

function NextIntake({ details }: { details: ScheduleDetails }) {
  switch (details.kind) {
    case 'inactive':
      return (
        <span className="flex items-center gap-1 text-muted-foreground">
          <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
          Reminders off
        </span>
      )
    case 'as-needed':
      return <span className="text-muted-foreground">As needed</span>
    case 'unscheduled':
      return <span className="text-muted-foreground">Not scheduled</span>
  }

  return (
    <>
      {details.nextIntake && <span>{formatScheduleDate(details.nextIntake)}</span>}
      {details.status === 'due-today' && (
        <Badge>
          <CalendarCheck aria-hidden="true" />
          Due today
        </Badge>
      )}
      {details.status === 'past-due' && details.missedDueDate && (
        <Badge variant="destructive" className="whitespace-normal">
          <AlertTriangle aria-hidden="true" />
          {`Past Due · was due ${formatScheduleDate(details.missedDueDate)}`}
        </Badge>
      )}
      {details.kind === 'rolling' && (
        <span className="text-xs text-muted-foreground">Counted from last dose</span>
      )}
    </>
  )
}

interface MedicationScheduleProps {
  medication: MedicationViewModel
}

export default function MedicationSchedule({ medication }: MedicationScheduleProps) {
  const { details, isLoading, isError, error, refetch } = useMedicationSchedule(medication)

  useEffect(() => {
    if (!isError) return
    console.error(`Schedule load error for ${medication.ppa_medicationid}:`, error)
    toast.error("Couldn't load schedule for some medications.", { id: LOAD_ERROR_TOAST_ID })
  }, [isError, error, medication.ppa_medicationid])

  return (
    <section aria-label={`Schedule for ${medication.ppa_name}`} aria-busy={isLoading}>
      {isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-5 w-40 max-w-full" />
        </div>
      )}

      {isError && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load schedule.</p>
          <Button variant="outline" className="min-h-11 min-w-11" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {details && (
        <dl className="flex flex-col gap-2">
          <Row label="Last taken">
            <LastTaken lastTaken={details.lastTaken} />
          </Row>
          <Row label="Next intake">
            <NextIntake details={details} />
          </Row>
        </dl>
      )}
    </section>
  )
}
