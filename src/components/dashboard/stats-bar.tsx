import { Skeleton } from '@/components/ui/skeleton'
import type { AdherenceStats } from '@/lib/adherence'

interface StatsBarProps {
  stats: AdherenceStats
  isLoading: boolean
}

interface StatTileProps {
  label: string
  value: string
  isLoading: boolean
}

function StatTile({ label, value, isLoading }: StatTileProps) {
  return (
    <div className="border rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {isLoading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span className="text-2xl font-bold">{value}</span>
      )}
    </div>
  )
}

export default function StatsBar({ stats, isLoading }: StatsBarProps) {
  const noMeds = !isLoading && stats.activeMedicationCount === 0
  const adherenceLabel = noMeds || stats.adherencePercent7d === null ? '—' : `${stats.adherencePercent7d}%`
  const streakLabel    = noMeds ? '—' : `${stats.streak}d`
  const missedLabel    = noMeds ? '—' : String(stats.missedToday)
  const activeLabel    = noMeds ? '—' : String(stats.activeMedicationCount)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatTile label="7-day Adherence" value={adherenceLabel} isLoading={isLoading} />
      <StatTile label="Streak"          value={streakLabel}    isLoading={isLoading} />
      <StatTile label="Missed today"    value={missedLabel}    isLoading={isLoading} />
      <StatTile label="Active meds"     value={activeLabel}    isLoading={isLoading} />
    </div>
  )
}
