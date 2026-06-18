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
  const adherenceLabel =
    stats.adherencePercent7d !== null ? `${stats.adherencePercent7d}%` : '—'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatTile label="7-day Adherence" value={adherenceLabel} isLoading={isLoading} />
      <StatTile label="Streak" value={`${stats.streak}d`} isLoading={isLoading} />
      <StatTile label="Missed today" value={String(stats.missedToday)} isLoading={isLoading} />
      <StatTile label="Active medications" value={String(stats.activeMedicationCount)} isLoading={isLoading} />
    </div>
  )
}
