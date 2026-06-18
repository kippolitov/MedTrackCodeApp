import { useMemo } from 'react'
import { useMedications } from './use-medications'
import { useIntakeLogs } from './use-intake-logs'
import { startOfLocalDay, endOfLocalDay } from '@/lib/date-utils'
import { adherence7d, currentStreak, missedToday } from '@/lib/adherence'
import type { AdherenceStats } from '@/lib/adherence'

export function useAdherence(): { stats: AdherenceStats; isLoading: boolean } {
  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  const { data: medications = [], isLoading: medsLoading } = useMedications()
  const { data: logs = [], isLoading: logsLoading } = useIntakeLogs({
    from: startOfLocalDay(sevenDaysAgo),
    to: endOfLocalDay(today),
  })

  const stats = useMemo<AdherenceStats>(() => {
    const activeMeds = medications.filter((m) => m.ppa_isactive)
    return {
      adherencePercent7d: adherence7d(activeMeds, logs),
      streak: currentStreak(activeMeds, logs),
      missedToday: missedToday(activeMeds, logs),
      activeMedicationCount: activeMeds.length,
    }
  }, [medications, logs])

  return { stats, isLoading: medsLoading || logsLoading }
}
